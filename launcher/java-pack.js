// Pretzel Client - Java pack writer.
//
// The browser client is Java compiled to JavaScript, so a downloaded jar has
// nowhere to run inside the page. This module turns the account's stored jars
// into .mrpack files: each is a zip holding modrinth.index.json plus the jars
// under overrides/mods/. Modrinth App, Prism Launcher and MultiMC all import
// that, and what they build is a real Java 1.21.11 instance whose mods/ folder
// holds these exact files - which is where the mods actually run.
//
// One pack per loader. A single pack cannot mix Fabric and NeoForge jars, so
// the account is grouped and every group gets its own .mrpack; nothing is
// dropped because some other mod happened to be more popular.
//
// The zip is written here (stored, no compression) so the page needs no
// library and no server; every jar keeps its bytes and its verified hash.
(function () {
	'use strict';

	var GAME_VERSION = '1.21.11';
	var FABRIC_META = 'https://meta.fabricmc.net/v2/versions/loader/' + GAME_VERSION;
	var QUILT_META = 'https://meta.quiltmc.org/v3/versions/loader';
	var NEOFORGE_VERSIONS = 'https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge';
	var FORGE_PROMOS = 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json';

	// ------------------------------------------------------------------- crc32

	var CRC_TABLE = null;

	function crcTable() {
		if (CRC_TABLE) return CRC_TABLE;
		CRC_TABLE = new Uint32Array(256);
		for (var i = 0; i < 256; i++) {
			var value = i;
			for (var bit = 0; bit < 8; bit++) {
				value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
			}
			CRC_TABLE[i] = value >>> 0;
		}
		return CRC_TABLE;
	}

	function crc32(bytes) {
		var table = crcTable();
		var crc = 0xFFFFFFFF;
		for (var i = 0; i < bytes.length; i++) {
			crc = table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
		}
		return (crc ^ 0xFFFFFFFF) >>> 0;
	}

	function utf8(text) {
		return new TextEncoder().encode(String(text));
	}

	function stamp(when) {
		var date = new Date(when);
		var year = Math.max(1980, date.getFullYear());
		return {
			time: ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) | ((Math.floor(date.getSeconds() / 2)) & 31),
			date: (((year - 1980) & 127) << 9) | (((date.getMonth() + 1) & 15) << 5) | (date.getDate() & 31)
		};
	}

	// --------------------------------------------------------------------- zip

	/** entries: [{ name, data: Uint8Array }] -> a stored (uncompressed) zip Blob. */
	function zip(entries) {
		var when = stamp(Date.now());
		var chunks = [];
		var directory = [];
		var offset = 0;

		entries.forEach(function (entry) {
			var name = utf8(entry.name);
			var data = entry.data instanceof Uint8Array ? entry.data : new Uint8Array(entry.data);
			var sum = crc32(data);

			var local = new Uint8Array(30 + name.length);
			var lv = new DataView(local.buffer);
			lv.setUint32(0, 0x04034b50, true);
			lv.setUint16(4, 20, true);
			lv.setUint16(6, 0x0800, true); // names are UTF-8
			lv.setUint16(8, 0, true); // stored
			lv.setUint16(10, when.time, true);
			lv.setUint16(12, when.date, true);
			lv.setUint32(14, sum, true);
			lv.setUint32(18, data.length, true);
			lv.setUint32(22, data.length, true);
			lv.setUint16(26, name.length, true);
			lv.setUint16(28, 0, true);
			local.set(name, 30);
			chunks.push(local, data);

			var central = new Uint8Array(46 + name.length);
			var cv = new DataView(central.buffer);
			cv.setUint32(0, 0x02014b50, true);
			cv.setUint16(4, 20, true);
			cv.setUint16(6, 20, true);
			cv.setUint16(8, 0x0800, true);
			cv.setUint16(10, 0, true);
			cv.setUint16(12, when.time, true);
			cv.setUint16(14, when.date, true);
			cv.setUint32(16, sum, true);
			cv.setUint32(20, data.length, true);
			cv.setUint32(24, data.length, true);
			cv.setUint16(28, name.length, true);
			cv.setUint16(30, 0, true);
			cv.setUint16(32, 0, true);
			cv.setUint16(34, 0, true);
			cv.setUint16(36, 0, true);
			cv.setUint32(38, 0, true);
			cv.setUint32(42, offset, true);
			central.set(name, 46);
			directory.push(central);

			offset += local.length + data.length;
		});

		var directorySize = 0;
		directory.forEach(function (block) { directorySize += block.length; });

		var end = new Uint8Array(22);
		var ev = new DataView(end.buffer);
		ev.setUint32(0, 0x06054b50, true);
		ev.setUint16(4, 0, true);
		ev.setUint16(6, 0, true);
		ev.setUint16(8, entries.length, true);
		ev.setUint16(10, entries.length, true);
		ev.setUint32(12, directorySize, true);
		ev.setUint32(16, offset, true);
		ev.setUint16(20, 0, true);

		return new Blob(chunks.concat(directory, [end]), { type: 'application/zip' });
	}

	// ---------------------------------------------------------------- loaders

	var LOADERS = ['fabric', 'neoforge', 'forge'];

	function loaderOf(entry) {
		var loaders = (entry.loaders || []).map(function (l) { return String(l).toLowerCase(); });
		if (loaders.indexOf('neoforge') >= 0) return 'neoforge';
		if (loaders.indexOf('forge') >= 0) return 'forge';
		return 'fabric'; // fabric and quilt: a Quilt instance loads Fabric mods
	}

	function dependencyKey(kind) {
		return kind === 'neoforge' ? 'neoforge' : kind === 'forge' ? 'forge' : 'fabric-loader';
	}

	async function getJson(url) {
		var response = await fetch(url, { headers: { Accept: 'application/json' } });
		if (!response.ok) return null;
		return response.json();
	}

	/** The loader build a launcher should install for this pack. */
	async function loaderVersion(kind) {
		try {
			if (kind === 'fabric') {
				var fabric = await getJson(FABRIC_META);
				return Array.isArray(fabric) && fabric[0] && fabric[0].loader ? String(fabric[0].loader.version) : null;
			}
			if (kind === 'neoforge') {
				var neoforge = await getJson(NEOFORGE_VERSIONS);
				var versions = (neoforge && neoforge.versions) || [];
				// NeoForge numbers releases 21.11.x for Minecraft 1.21.11.
				var prefix = GAME_VERSION.split('.').slice(1).join('.') + '.';
				var mine = versions.filter(function (v) { return String(v).indexOf(prefix) === 0; });
				mine.sort(function (a, b) {
					var pa = String(a).split('.').map(Number);
					var pb = String(b).split('.').map(Number);
					for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
						if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
					}
					return 0;
				});
				return mine.length ? String(mine[mine.length - 1]) : null;
			}
			if (kind === 'forge') {
				var promos = await getJson(FORGE_PROMOS);
				var latest = promos && promos.promos && promos.promos[GAME_VERSION + '-latest'];
				return latest ? GAME_VERSION + '-' + latest : null;
			}
			if (kind === 'quilt') {
				var quilt = await getJson(QUILT_META);
				return Array.isArray(quilt) && quilt[0] ? String(quilt[0].version) : null;
			}
		} catch (error) {
			/* the pack is still valid without a pinned loader build */
		}
		return null;
	}

	function slug(value) {
		return String(value || 'local').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'local';
	}

	function title(kind) {
		return kind === 'neoforge' ? 'NeoForge' : kind === 'forge' ? 'Forge' : 'Fabric';
	}

	function readme(kind, version, count) {
		return [
			'Pretzel Client - Java mod pack',
			'',
			count + ' mods for Minecraft ' + GAME_VERSION + ' on ' + title(kind) + '.',
			'',
			'Import this .mrpack in Modrinth App, Prism Launcher or MultiMC.',
			'The launcher creates a Java ' + GAME_VERSION + ' instance and copies the jars from',
			'overrides/mods/ into that instance\'s mods/ folder. Those are the real files,',
			'with the SHA-1 Modrinth publishes, so the same mods run in Java as they would',
			'from any other download.',
			'',
			version
				? 'This pack asks for ' + dependencyKey(kind) + ' ' + version + '; if your launcher'
				: 'Pick the newest ' + title(kind) + ' build for ' + GAME_VERSION + '; the mods',
			version
				? 'offers a different build, use the newest one - the mods do not pin one.'
				: 'do not pin a loader build.',
			'',
			'Fabric mods will not load in a Forge/NeoForge instance, so import every pack',
			'this account produced; each one carries only the mods for its own loader.',
			'',
			'A browser tab has no JVM, so the Pretzel browser client cannot run these jars.',
			'This pack is the path that installs them where they do run: Java.'
		].join('\n');
	}

	// --------------------------------------------------------------------- build

	function packOne(kind, entries, store) {
		return (async function () {
			var account = store.account();
			var version = await loaderVersion(kind);
			var files = [];
			var used = {};
			for (var i = 0; i < entries.length; i++) {
				var item = entries[i];
				var record = null;
				try { record = await store.file(item.id); } catch (error) { record = null; }
				if (!record || !record.blob) continue;
				var data = new Uint8Array(await record.blob.arrayBuffer());
				var name = String(item.filename || (slug(item.title) + '.jar')).replace(/[\\/:*?"<>|]/g, '_');
				if (!/\.jar$/i.test(name)) name += '.jar';
				if (used[name]) {
					used[name] += 1;
					name = used[name] + '-' + name;
				} else {
					used[name] = 1;
				}
				files.push({ name: name, data: data });
			}
			if (!files.length) return null;

			var index = {
				formatVersion: 1,
				game: 'minecraft',
				versionId: 'pretzel-' + slug(account) + '-' + kind,
				name: 'Pretzel Java Pack - ' + account + ' (' + title(kind) + ')',
				summary: files.length + ' ' + title(kind) + ' mods picked on the Pretzel launchpad for Minecraft ' + GAME_VERSION + '.',
				files: [],
				dependencies: { minecraft: GAME_VERSION }
			};
			if (version) index.dependencies[dependencyKey(kind)] = version;

			var zipEntries = [{ name: 'modrinth.index.json', data: utf8(JSON.stringify(index, null, 2)) }];
			files.forEach(function (file) {
				zipEntries.push({ name: 'overrides/mods/' + file.name, data: file.data });
			});
			zipEntries.push({ name: 'overrides/PRETZEL-README.txt', data: utf8(readme(kind, version, files.length)) });

			var filename = 'pretzel-java-' + slug(account) + '-' + kind + '.mrpack';
			download(zip(zipEntries), filename);
			return { kind: kind, count: files.length, version: version, filename: filename };
		})();
	}

	/**
	 * build(store) -> { packs: [{ kind, count, version, filename }], total, skipped }
	 * store is window.PretzelModStorage; its list() and file(id) carry the jars.
	 * One .mrpack is downloaded per loader present in the account.
	 */
	async function build(store) {
		if (!store) throw new Error('Mod storage did not load.');

		var all = store.list().filter(function (item) {
			return item.kind === 'java-jar' && item.enabled !== false && /\.jar$/i.test(item.filename || '');
		});
		if (!all.length) throw new Error('The Java pack is empty - add a mod first.');

		var groups = {};
		all.forEach(function (item) {
			var kind = loaderOf(item);
			(groups[kind] = groups[kind] || []).push(item);
		});

		var packs = [];
		for (var i = 0; i < LOADERS.length; i++) {
			var kind = LOADERS[i];
			if (!groups[kind]) continue;
			var made = await packOne(kind, groups[kind], store);
			if (made) packs.push(made);
		}
		if (!packs.length) throw new Error('The stored jars could not be read back from this browser.');

		var total = packs.reduce(function (sum, pack) { return sum + pack.count; }, 0);
		return { packs: packs, total: total, skipped: all.length - total, account: store.account() };
	}

	function download(blob, filename) {
		var url = URL.createObjectURL(blob);
		var link = document.createElement('a');
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
	}

	window.PretzelJavaPack = {
		build: build,
		zip: zip,
		gameVersion: GAME_VERSION
	};
})();
