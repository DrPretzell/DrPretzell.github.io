// Pretzel Client - per-account mod storage.
//
// Every account gets its own bucket. Installing a Modrinth project means: fetch
// the real file, check its hash when Modrinth publishes one, write the bytes to
// IndexedDB under that account, then register the project so the client hub and
// the mods page both read the same installed list.
//
// The browser client is TeaVM/JavaScript, so a plain Java jar cannot be executed
// inside it. Installs are therefore marked `loadable:false` for those files and
// the UI says stored-and-linked rather than pretending the mod runs.
(function () {
	'use strict';

	var DB_NAME = 'pretzel-mods';
	var DB_STORE = 'files';
	var REGISTRY = 'pretzel.mods.installed.v1';
	var ACCOUNTS = 'pretzel.accounts.v1';
	var SESSION = 'pretzel.session.v1';

	function read(key, fallback) {
		try {
			var raw = localStorage.getItem(key);
			return raw ? JSON.parse(raw) : fallback;
		} catch (e) { return fallback; }
	}

	function write(key, value) {
		try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* quota */ }
	}

	function account() {
		var session = read(SESSION, null);
		if (session && session.username) return String(session.username).toLowerCase();
		if (typeof session === 'string' && session) return session.toLowerCase();
		return 'local';
	}

	function registry() {
		return read(REGISTRY, {}) || {};
	}

	function saveRegistry(map) {
		write(REGISTRY, map);
	}

	/** Installed entries for the signed-in account. */
	function list() {
		var mine = registry()[account()];
		return Array.isArray(mine) ? mine : [];
	}

	function find(projectId) {
		return list().find(function (item) { return item.id === projectId; }) || null;
	}

	// ------------------------------------------------------------------- files

	var dbPromise = null;

	function db() {
		if (dbPromise) return dbPromise;
		dbPromise = new Promise(function (resolve, reject) {
			if (typeof indexedDB === 'undefined') { reject(new Error('This browser has no IndexedDB storage.')); return; }
			var request = indexedDB.open(DB_NAME, 1);
			request.onupgradeneeded = function () {
				var handle = request.result;
				if (!handle.objectStoreNames.contains(DB_STORE)) handle.createObjectStore(DB_STORE);
			};
			request.onsuccess = function () { resolve(request.result); };
			request.onerror = function () { reject(request.error || new Error('Could not open mod storage.')); };
		});
		return dbPromise;
	}

	function tx(mode, run) {
		return db().then(function (handle) {
			return new Promise(function (resolve, reject) {
				var transaction = handle.transaction(DB_STORE, mode);
				var store = transaction.objectStore(DB_STORE);
				var request = run(store);
				transaction.oncomplete = function () { resolve(request ? request.result : undefined); };
				transaction.onerror = function () { reject(transaction.error || new Error('Storage failed.')); };
				transaction.onabort = function () { reject(transaction.error || new Error('Storage aborted.')); };
			});
		});
	}

	function fileKey(projectId, versionId) {
		return account() + '|' + projectId + '|' + versionId;
	}

	function saveBlob(key, record) {
		return tx('readwrite', function (store) { return store.put(record, key); });
	}

	function readBlob(key) {
		return tx('readonly', function (store) { return store.get(key); });
	}

	function dropBlob(key) {
		return tx('readwrite', function (store) { return store.delete(key); });
	}

	// ------------------------------------------------------------------ hashes

	function toHex(buffer) {
		return Array.prototype.map.call(new Uint8Array(buffer), function (byte) {
			return byte.toString(16).padStart(2, '0');
		}).join('');
	}

	function sha1(buffer) {
		if (!window.crypto || !window.crypto.subtle) return Promise.resolve('');
		return window.crypto.subtle.digest('SHA-1', buffer).then(toHex).catch(function () { return ''; });
	}

	// ---------------------------------------------------------------- download

	/** Fetch a file and report byte progress; resolves with the ArrayBuffer. */
	function download(url, onProgress) {
		return fetch(url, { mode: 'cors', credentials: 'omit' }).then(function (response) {
			if (!response.ok) throw new Error('Download failed (' + response.status + ').');
			var total = Number(response.headers.get('content-length')) || 0;
			if (!response.body || !response.body.getReader) {
				return response.arrayBuffer().then(function (buffer) {
					if (onProgress) onProgress(total || buffer.byteLength, total || buffer.byteLength);
					return buffer;
				});
			}
			var reader = response.body.getReader();
			var chunks = [];
			var received = 0;
			function pump() {
				return reader.read().then(function (step) {
					if (step.done) {
						var out = new Uint8Array(received);
						var at = 0;
						chunks.forEach(function (chunk) { out.set(chunk, at); at += chunk.length; });
						return out.buffer;
					}
					chunks.push(step.value);
					received += step.value.length;
					if (onProgress) onProgress(received, total);
					return pump();
				});
			}
			return pump();
		});
	}

	// ---------------------------------------------------------------- install

	/**
	 * install(project, version, file, onProgress)
	 * project: a Modrinth project object (id, title, icon_url, slug)
	 * version: a Modrinth version object (id, version_number, game_versions, loaders)
	 * file:    one entry of version.files (url, filename, hashes, size)
	 */
	function install(project, version, file, onProgress) {
		if (!file || !file.url) return Promise.reject(new Error('This version has no downloadable file.'));
		var projectId = project.id || project.project_id;
		var key = fileKey(projectId, version.id);

		return download(file.url, onProgress).then(function (buffer) {
			return sha1(buffer).then(function (digest) {
				var expected = (file.hashes && file.hashes.sha1) || '';
				if (expected && digest && digest !== expected.toLowerCase()) {
					throw new Error('File did not match the SHA-1 Modrinth published. Install cancelled.');
				}
				return saveBlob(key, {
					projectId: projectId,
					versionId: version.id,
					filename: file.filename || (projectId + '.jar'),
					url: file.url,
					size: buffer.byteLength,
					sha1: digest || expected || '',
					at: Date.now(),
					blob: new Blob([buffer])
				}).then(function () {
					var java = /\.jar$/i.test(file.filename || '');
					var entry = {
						id: projectId,
						slug: project.slug || projectId,
						title: project.title || project.name || projectId,
						icon: project.icon_url || '',
						version: version.version_number || version.name || '',
						versionId: version.id,
						filename: file.filename || '',
						size: buffer.byteLength,
						sha1: digest || expected || '',
						gameVersions: version.game_versions || [],
						loaders: version.loaders || [],
						kind: java ? 'java-jar' : 'asset',
						loadable: !java,
						enabled: true,
						key: key,
						at: Date.now()
					};
					var map = registry();
					var acct = account();
					var mine = Array.isArray(map[acct]) ? map[acct] : [];
					var existing = mine.findIndex(function (item) { return item.id === projectId; });
					var previous = existing >= 0 ? mine[existing] : null;
					if (existing >= 0) mine[existing] = entry;
					else mine.push(entry);
					map[acct] = mine;
					saveRegistry(map);
					if (previous && previous.versionId && previous.versionId !== version.id) {
						dropBlob(fileKey(projectId, previous.versionId)).catch(function () { /* old file may be gone */ });
					}
					mirrorToAccount(mine);
					return entry;
				});
			});
		});
	}

	/** The account record carries a light copy so the client side sees the list. */
	function mirrorToAccount(mine) {
		var accounts = read(ACCOUNTS, []);
		if (!Array.isArray(accounts)) return;
		var index = accounts.findIndex(function (a) {
			return String(a.username || '').toLowerCase() === account();
		});
		if (index < 0) return;
		accounts[index].mods = mine.map(function (item) {
			return { id: item.id, title: item.title, version: item.version, at: item.at, loadable: item.loadable };
		});
		write(ACCOUNTS, accounts);
	}

	function remove(projectId) {
		var map = registry();
		var acct = account();
		var mine = Array.isArray(map[acct]) ? map[acct] : [];
		var entry = mine.find(function (item) { return item.id === projectId; });
		map[acct] = mine.filter(function (item) { return item.id !== projectId; });
		saveRegistry(map);
		mirrorToAccount(map[acct]);
		if (entry && entry.versionId) {
			return dropBlob(fileKey(projectId, entry.versionId)).catch(function () { /* ignore */ }).then(function () { return true; });
		}
		return Promise.resolve(true);
	}

	function toggle(projectId) {
		var map = registry();
		var acct = account();
		var mine = Array.isArray(map[acct]) ? map[acct] : [];
		var entry = mine.find(function (item) { return item.id === projectId; });
		if (!entry) return null;
		entry.enabled = !entry.enabled;
		map[acct] = mine;
		saveRegistry(map);
		mirrorToAccount(mine);
		return entry;
	}

	function usage() {
		return list().reduce(function (sum, item) { return sum + (Number(item.size) || 0); }, 0);
	}

	/** Bytes for one stored file, so the client can hand them to a loader. */
	function fetchFile(projectId) {
		var entry = find(projectId);
		if (!entry) return Promise.resolve(null);
		return readBlob(fileKey(projectId, entry.versionId)).then(function (record) {
			return record || null;
		});
	}

	window.PretzelModStorage = {
		install: install,
		remove: remove,
		toggle: toggle,
		list: list,
		find: find,
		usage: usage,
		file: fetchFile,
		account: account
	};
})();
