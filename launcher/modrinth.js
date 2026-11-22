// Pretzel Client - Mods page on the official Modrinth API.
//
// Every card, icon, author, version and file on this page is a response from
// https://api.modrinth.com/v2 - nothing is hardcoded. The page is filtered to
// Minecraft 1.21.11, the version this client builds, and INSTALL sends the real
// file through PretzelModStorage: download, hash check, per-account storage,
// then registered with the client so the hub and this page list the same mods.
(function () {
	'use strict';

	var API = 'https://api.modrinth.com/v2';
	var GAME_VERSION = '1.21.11';
	var PAGE = 20;
	var TIMEOUT = 12000;
	var TTL = 5 * 60 * 1000;

	// Browse filters. Modrinth has no pvp/minimap/hud/cosmetics category slugs, so
	// those run as a text query; everything else is a real facet.
	var CATEGORIES = [
		{ id: 'all', label: 'ALL' },
		{ id: 'performance', label: 'PERFORMANCE', facet: ['categories:optimization'] },
		{ id: 'optimization', label: 'OPTIMIZATION', facet: ['categories:optimization'], index: 'downloads' },
		{ id: 'pvp', label: 'PVP', query: 'pvp' },
		{ id: 'minimap', label: 'MINIMAP', query: 'minimap' },
		{ id: 'hud', label: 'HUD', query: 'hud' },
		{ id: 'cosmetics', label: 'COSMETICS', facet: ['categories:decoration'] },
		{ id: 'utility', label: 'UTILITY', facet: ['categories:utility'] },
		{ id: 'adventure', label: 'ADVENTURE', facet: ['categories:adventure'] },
		{ id: 'technology', label: 'TECHNOLOGY', facet: ['categories:technology'] },
		{ id: 'resourcepacks', label: 'RESOURCE PACKS', type: 'resourcepack' },
		{ id: 'shaders', label: 'SHADERS', type: 'shader' },
		{ id: 'browser', label: 'BROWSER COMPATIBLE', query: 'eaglercraft' }
	];

	var state = {
		query: '',
		cat: 'all',
		index: 'relevance',
		page: 1,
		total: 0,
		results: [],
		loading: false,
		error: '',
		detail: null,
		versions: null,
		versionsLoading: false,
		versionsError: '',
		mode: 'search',
		installing: {},
		installError: ''
	};

	var cache = {};

	function ico(name, size, color) {
		return window.PretzelPixels ? window.PretzelPixels.svg(name, size || 14, color) : '';
	}

	function esc(value) {
		return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
		});
	}

	function toast(message, bad) {
		if (typeof window.pretzelToast === 'function') { window.pretzelToast(message, bad); return; }
		var stack = document.getElementById('toasts');
		if (!stack) return;
		var node = document.createElement('div');
		node.className = 'toast ' + (bad ? 'bad' : 'good');
		node.textContent = message;
		stack.appendChild(node);
		setTimeout(function () { node.remove(); }, 4200);
	}

	function storage() {
		return window.PretzelModStorage || null;
	}

	function installed(projectId) {
		return storage() ? storage().find(projectId) : null;
	}

	function installedCount() {
		return storage() ? storage().list().length : 0;
	}

	function human(bytes) {
		var value = Number(bytes) || 0;
		if (value >= 1073741824) return (value / 1073741824).toFixed(1) + ' GB';
		if (value >= 1048576) return (value / 1048576).toFixed(1) + ' MB';
		if (value >= 1024) return Math.round(value / 1024) + ' KB';
		return value + ' B';
	}

	// ------------------------------------------------------------------ fetch

	function fetchJson(url) {
		var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
		var timer = controller ? setTimeout(function () { controller.abort(); }, TIMEOUT) : null;
		return fetch(url, {
			headers: { Accept: 'application/json' },
			signal: controller ? controller.signal : undefined,
			cache: 'default'
		}).then(function (res) {
			if (timer) clearTimeout(timer);
			if (res.status === 429) throw new Error('Modrinth rate limit hit - try again in a moment.');
			if (!res.ok) throw new Error('Modrinth returned ' + res.status + ' for this request.');
			return res.json();
		}).catch(function (error) {
			if (timer) clearTimeout(timer);
			if (error && error.name === 'AbortError') throw new Error('Modrinth took too long to answer.');
			throw error;
		});
	}

	function cachedGet(url) {
		var hit = cache[url];
		if (hit && Date.now() - hit.at < TTL) return Promise.resolve(hit.data);
		return fetchJson(url).then(function (data) {
			cache[url] = { at: Date.now(), data: data };
			return data;
		});
	}

	function compact(n) {
		var value = Number(n) || 0;
		if (value >= 1e9) return (value / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
		if (value >= 1e6) return (value / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
		if (value >= 1e3) return (value / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
		return String(value);
	}

	/** Versions that actually ship for this client's Minecraft version. */
	function forThisVersion(versions) {
		return (versions || []).filter(function (version) {
			var games = version.game_versions || [];
			return games.indexOf(GAME_VERSION) >= 0;
		});
	}

	// ------------------------------------------------------------------ style

	function style() {
		if (document.getElementById('pm-style')) return;
		var css = '' +
			'.pm-wrap{padding:0}' +
			'.pm-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +
			'.pm-title{font-size:13px;color:#f4f6fa}' +
			'.pm-count{color:#6f757e;font-size:9px}' +
			'.pm-line{margin:8px 0 0;color:#8f949d;font-size:10px;line-height:1.7;max-width:840px}' +
			'.pm-line b{color:#e8c37a;font-weight:400}' +
			'.pm-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:12px 0 10px}' +
			'.pm-tab{padding:6px 10px;border:2px solid #292d35;background:#14171c;color:#a7adb6;font-size:8px;cursor:pointer}' +
			'.pm-tab:hover{border-color:#3d434d;color:#eef1f5}' +
			'.pm-tab.on{border-color:#8a6a22;background:#241d10;color:#f2c66a}' +
			'.pm-search{margin-left:auto;min-width:200px;padding:7px 10px;border:2px solid #292d35;background:#101317;color:#e8ecf1;font-size:10.5px;outline:none}' +
			'.pm-search:focus{border-color:#8a6a22}' +
			'.pm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:9px}' +
			'.pm-cats{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 10px}' +
			'.pm-cat{padding:5px 8px;border:2px solid #23272e;background:#11141a;color:#8f99a6;font-size:7.5px;letter-spacing:.04em;cursor:pointer}' +
			'.pm-cat:hover{border-color:#3d434d;color:#eef1f5}' +
			'.pm-cat.on{border-color:#8a6a22;background:#241d10;color:#f2c66a}' +
			'.pm-links{display:flex;flex-wrap:wrap;gap:5px}' +
			'.pm-link{border:2px solid #2f3540;background:#151920;color:#c9d2dd;font-size:8px;padding:5px 8px;text-decoration:none}' +
			'.pm-link:hover{border-color:#8a6a22;color:#f2c66a}' +
			'.pm-card{display:flex;flex-direction:column;border:2px solid #24272e;background:#14171c;padding:10px;cursor:pointer}' +
			'.pm-card:hover{border-color:#3a3f49;background:#171b21}' +
			'.pm-top{display:flex;align-items:center;gap:9px;min-width:0}' +
			'.pm-logo{flex:0 0 auto;width:30px;height:30px;display:grid;place-items:center;background:#0d1014;border:2px solid #232830;overflow:hidden}' +
			'.pm-logo img{width:26px;height:26px;object-fit:cover;image-rendering:pixelated}' +
			'.pm-names{display:flex;flex-direction:column;min-width:0}' +
			'.pm-name{font-size:8.5px;color:#eef1f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.7}' +
			'.pm-sub{font-size:9px;color:#6f757e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
			'.pm-desc{margin:7px 0 0;color:#98a0aa;font-size:10px;line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:31px}' +
			'.pm-meta{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:9px;color:#7d8794;flex-wrap:wrap}' +
			'.pm-chip{border:1px solid #2a2f38;padding:2px 5px;color:#98a2ae;font-size:8px;font-family:"Pretzel Pixel",monospace}' +
			'.pm-chip.ok{border-color:#33513d;color:#8bd6a4}' +
			'.pm-row{display:flex;align-items:center;gap:7px;margin-top:10px}' +
			'.pm-add{min-width:90px;padding:6px 11px;border:2px solid #8a6a22;background:#241d10;color:#f2c66a;font-size:7.5px;cursor:pointer}' +
			'.pm-add:hover{background:#2e2513}' +
			'.pm-add.ghost{border-color:#2f3540;background:none;color:#a8b1bd;min-width:0}' +
			'.pm-add.installed{border-color:#33513d;background:#101a13;color:#8bd6a4}' +
			'.pm-add:disabled{border-color:#2a2e35;background:#15181d;color:#666c76;cursor:default}' +
			'.pm-src{margin-left:auto;border:1px solid #262a31;padding:2px 5px;color:#7d848e;font-size:8px;cursor:help}' +
			'.pm-state{padding:28px 8px;text-align:center;color:#8f949d;font-size:11px;line-height:1.7}' +
			'.pm-state .pm-add{margin-top:12px}' +
			'.pm-page{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px;color:#79838f;font-size:9.5px}' +
			'.pm-page button{padding:6px 10px;border:2px solid #292d35;background:#14171c;color:#c3ccd8;font-size:8px;cursor:pointer}' +
			'.pm-page button:disabled{opacity:.4;cursor:default}' +
			'.pm-sheet{position:fixed;inset:0;z-index:75;display:grid;place-items:center;background:rgba(3,4,7,.7);padding:16px}' +
			'.pm-detail{width:min(760px,96vw);max-height:88vh;overflow:auto;background:#12151b;border:2px solid #2b303a;box-shadow:6px 6px 0 #000;color:#e9edf3}' +
			'.pm-detail-head{display:flex;gap:10px;align-items:flex-start;padding:12px;border-bottom:2px solid #22262e}' +
			'.pm-detail-head h3{margin:0 0 3px;font-family:"Pretzel Pixel",monospace;font-size:11px;color:#fff}' +
			'.pm-detail-body{padding:12px;font-size:11px;color:#aab3bf;line-height:1.65}' +
			'.pm-detail-body h4{margin:15px 0 7px;font-family:"Pretzel Pixel",monospace;font-size:8.5px;color:#e8c37a}' +
			'.pm-version{display:flex;align-items:center;gap:8px;padding:8px;border:2px solid #232830;background:#151920;margin-bottom:6px;flex-wrap:wrap}' +
			'.pm-version .v-name{font-family:"Pretzel Pixel",monospace;font-size:8px;color:#eef2f7}' +
			'.pm-version .v-sub{font-size:9.5px;color:#7d8794}' +
			'.pm-x{margin-left:auto;background:none;border:2px solid transparent;color:#98a1ad;cursor:pointer;padding:2px 5px}' +
			'.pm-x:hover{border-color:#2f3540;color:#fff}' +
			'.pm-note{color:#8a7350;font-size:9.5px;line-height:1.7;border:2px solid #3a2f1b;background:#18140c;padding:9px;margin:10px 0 0}' +
			'.pm-own{display:flex;align-items:center;gap:9px;padding:9px;border:2px solid #24272e;background:#14171c;margin-bottom:6px}' +
			'.pm-own.off{opacity:.55}' +
			'.pm-own .pm-names{flex:1}' +
			'.pm-own .acts{display:flex;gap:5px}';
		var node = document.createElement('style');
		node.id = 'pm-style';
		node.textContent = css;
		document.head.appendChild(node);
	}

	// ----------------------------------------------------------------- search

	function activeCategory() {
		return CATEGORIES.find(function (c) { return c.id === state.cat; }) || CATEGORIES[0];
	}

	function searchUrl() {
		var cat = activeCategory();
		var facets = [['project_type:' + (cat.type || 'mod')], ['versions:' + GAME_VERSION]];
		if (cat.facet) facets = facets.concat([cat.facet]);
		var query = state.query;
		if (!query && cat.query) query = cat.query;
		var params = [
			'query=' + encodeURIComponent(query),
			'limit=' + PAGE,
			'offset=' + (state.page - 1) * PAGE,
			'index=' + encodeURIComponent(state.index),
			'facets=' + encodeURIComponent(JSON.stringify(facets))
		];
		return API + '/search?' + params.join('&');
	}

	async function runSearch() {
		state.loading = true;
		state.error = '';
		state.mode = 'search';
		render();
		try {
			var data = await cachedGet(searchUrl());
			state.results = data.hits || [];
			state.total = data.total_hits || 0;
		} catch (error) {
			state.error = error && error.message ? error.message : 'Could not reach Modrinth.';
			state.results = [];
			state.total = 0;
		} finally {
			state.loading = false;
			render();
		}
	}

	async function openProject(id) {
		state.detail = null;
		state.versions = null;
		state.versionsError = '';
		render();
		try {
			var project = await cachedGet(API + '/project/' + encodeURIComponent(id));
			state.detail = project;
			render();
			state.versionsLoading = true;
			render();
			var versions = await cachedGet(API + '/project/' + encodeURIComponent(id) + '/version');
			state.versions = versions || [];
			resolveDependencies();
		} catch (error) {
			state.versionsError = error && error.message ? error.message : 'Could not load versions.';
		} finally {
			state.versionsLoading = false;
			render();
		}
	}

	// --------------------------------------------------------------- install

	function setProgress(projectId, text) {
		state.installing[projectId] = text;
		var holder = document.querySelector('[data-progress="' + projectId + '"]');
		if (holder) holder.textContent = text;
	}

	async function doInstall(projectId, title, versionId) {
		var store = storage();
		if (!store) { toast('Mod storage is not loaded on this page.', true); return; }
		state.installError = '';
		state.installing[projectId] = 'FETCHING';
		render();
		try {
			var project = state.detail && state.detail.id === projectId ? state.detail : await cachedGet(API + '/project/' + encodeURIComponent(projectId));
			var versions = forThisVersion(state.versions && state.detail && state.detail.id === projectId
				? state.versions
				: await cachedGet(API + '/project/' + encodeURIComponent(projectId) + '/version'));
			var version = versionId
				? versions.find(function (v) { return v.id === versionId; })
				: versions[0];
			if (!version) throw new Error('No ' + GAME_VERSION + ' release is published for this project yet.');
			var file = (version.files || []).find(function (f) { return f.primary; }) || (version.files || [])[0];
			if (!file) throw new Error('That version has no downloadable file.');

			var entry = await store.install(project, version, file, function (got, total) {
				var text = total ? Math.min(99, Math.round((got / total) * 100)) + '%' : human(got);
				setProgress(projectId, text);
			});
			toast((title || project.title) + ' installed to your account storage');
			state.installing[projectId] = '';
			if (!entry.loadable) {
				toast('Saved to your account - Java mods only run when they are built into the client (Pretzel Essentials)', true);
			}
			if (state.mode === 'mine') await refreshUpdates();
		} catch (error) {
			state.installError = error && error.message ? error.message : 'Install failed.';
			toast(state.installError, true);
		} finally {
			delete state.installing[projectId];
			render();
		}
	}

	async function refreshUpdates() {
		var store = storage();
		if (!store) return;
		var list = store.list();
		for (var i = 0; i < list.length; i++) {
			var item = list[i];
			try {
				var versions = forThisVersion(await cachedGet(API + '/project/' + encodeURIComponent(item.id) + '/version'));
				var latest = versions[0];
				item.update = latest && latest.version_number && latest.version_number !== item.version
					? { versionId: latest.id, version: latest.version_number }
					: null;
			} catch (e) { item.update = null; }
		}
		state.ownUpdate = list.filter(function (i) { return i.update; }).length;
		render();
	}

	// ----------------------------------------------------------------- render

	function installButton(projectId, title, versionId) {
		var entry = installed(projectId);
		var busy = state.installing[projectId];
		if (busy) {
			return '<button class="pm-add" disabled data-progress="' + esc(projectId) + '">' + esc(busy) + '</button>';
		}
		if (entry && !versionId) {
			return '<button class="pm-add installed" data-mr="own">IN CLIENT</button>';
		}
		return '<button class="pm-add" data-mr="install" data-id="' + esc(projectId) + '" data-title="' + esc(title || '') +
			'" data-version="' + esc(versionId || '') + '">INSTALL</button>';
	}

	var JAVA_LOADERS = ['fabric', 'forge', 'neoforge', 'quilt', 'liteloader', 'rift'];

	function loadersOf(project) {
		return (project.loaders || project.categories || []).filter(function (l) {
			return JAVA_LOADERS.indexOf(String(l).toLowerCase()) >= 0;
		});
	}

	function card(hit) {
		var id = hit.project_id || hit.slug;
		var games = hit.versions || [];
		var hasThis = games.indexOf(GAME_VERSION) >= 0 || !games.length;
		return '<article class="pm-card" data-mr="open" data-id="' + esc(id) + '">' +
			'<div class="pm-top">' +
				'<span class="pm-logo">' + (hit.icon_url
					? '<img src="' + esc(hit.icon_url) + '" alt="" loading="lazy" onerror="this.remove()">'
					: ico('bolt', 14, '#8a6a22')) + '</span>' +
				'<span class="pm-names"><span class="pm-name">' + esc(hit.title) + '</span>' +
					'<span class="pm-sub">' + esc(hit.author || 'Modrinth') + ' \u00b7 ' + compact(hit.downloads) + ' downloads</span></span>' +
			'</div>' +
			'<p class="pm-desc">' + esc(hit.description) + '</p>' +
			'<div class="pm-meta">' +
				'<span class="pm-chip' + (hasThis ? ' ok' : '') + '">' + GAME_VERSION + '</span>' +
				(loadersOf(hit).length ? '<span class="pm-chip">' + esc(loadersOf(hit).join('/')) + '</span>' : '') +
				(loadersOf(hit).length ? '<span class="pm-chip">JAVA ONLY</span>' : '') +
				(hit.follows ? '<span class="pm-chip">\u2665 ' + compact(hit.follows) + '</span>' : '') +
			'</div>' +
			'<div class="pm-row">' +
				'<button class="pm-add ghost" data-mr="open" data-id="' + esc(id) + '">Versions</button>' +
				installButton(hit.project_id || id, hit.title) +
				'<span class="pm-src" title="api.modrinth.com/v2">API</span>' +
			'</div>' +
		'</article>';
	}

	function versionsHTML() {
		if (state.versionsLoading) return '<div class="pm-state">Loading versions from Modrinth\u2026</div>';
		if (state.versionsError) {
			return '<div class="pm-state">' + esc(state.versionsError) +
				'<br><button class="pm-add" data-mr="retry-versions">Retry</button></div>';
		}
		var versions = forThisVersion(state.versions);
		if (!state.versions || !state.versions.length) return '<div class="pm-state">This project has no published versions.</div>';
		if (!versions.length) {
			return '<div class="pm-state">No ' + GAME_VERSION + ' release published. ' +
				esc((state.versions[0] && (state.versions[0].game_versions || []).slice(-1)[0]) || '') + ' is the newest one.</div>';
		}
		return versions.slice(0, 12).map(function (v) {
			var file = (v.files || []).find(function (f) { return f.primary; }) || (v.files || [])[0] || null;
			return '<div class="pm-version">' +
				'<span class="pm-names"><span class="v-name">' + esc(v.version_number) + '</span>' +
				'<span class="v-sub">' + esc((v.game_versions || []).slice(-2).join(', ')) + ' \u00b7 ' +
				esc((v.loaders || []).join(' / ')) + (file ? ' \u00b7 ' + human(file.size) : '') + '</span></span>' +
				(file
					? installButton(state.detail.id, state.detail.title, v.id)
					: '<span class="pm-chip">no file</span>') +
			'</div>';
		}).join('');
	}

	function linksHTML(p) {
		var links = [
			{ url: p.source_url, label: 'SOURCE' },
			{ url: p.wiki_url, label: 'WIKI' },
			{ url: p.issues_url, label: 'ISSUES' },
			{ url: p.discord_url, label: 'DISCORD' },
			{ url: 'https://modrinth.com/project/' + p.slug, label: 'MODRINTH' }
		].filter(function (link) { return Boolean(link.url); });
		return links.length
			? '<div class="pm-links">' + links.map(function (link) {
				return '<a class="pm-link" href="' + esc(link.url) + '" target="_blank" rel="noopener noreferrer">' + link.label + '</a>';
			}).join('') + '</div>'
			: '';
	}

	/** Fills in dependency project titles so the sheet shows names, not ids. */
	function resolveDependencies() {
		var version = forThisVersion(state.versions)[0];
		if (!version) return;
		var ids = (version.dependencies || []).filter(function (d) { return d.project_id; }).map(function (d) { return d.project_id; });
		var names = {};
		Promise.all(ids.map(function (depId) {
			return cachedGet(API + '/project/' + encodeURIComponent(depId))
				.then(function (project) { names[depId] = project.title || depId; })
				.catch(function () { names[depId] = depId; });
		})).then(function () {
			state.depNames = names;
			render();
		});
	}

	function dependenciesHTML() {
		var version = forThisVersion(state.versions)[0];
		if (!version) return '';
		var deps = (version.dependencies || []).filter(function (d) { return d.project_id; });
		if (!deps.length) return '<h4>DEPENDENCIES</h4><p class="pm-note">This version declares no dependencies.</p>';
		var names = state.depNames || {};
		return '<h4>DEPENDENCIES</h4><div class="pm-links">' + deps.map(function (dep) {
			return '<a class="pm-link" href="https://modrinth.com/project/' + esc(dep.project_id) +
				'" target="_blank" rel="noopener noreferrer">' + esc(dep.dependency_type) + ' \u00b7 ' +
				esc(names[dep.project_id] || dep.project_id) + '</a>';
		}).join('') + '</div>';
	}

	function detailHTML() {
		var p = state.detail;
		var bodyText = String(p.body || '').replace(/[#*`>]/g, ' ').replace(/\s+/g, ' ').trim();
		var entry = installed(p.id);
		return '<div class="pm-sheet" data-mr="close"><div class="pm-detail" role="dialog" aria-modal="true">' +
			'<div class="pm-detail-head">' +
				'<span class="pm-logo" style="width:44px;height:44px">' + (p.icon_url
					? '<img src="' + esc(p.icon_url) + '" alt="" style="width:40px;height:40px">'
					: ico('bolt', 18, '#8a6a22')) + '</span>' +
				'<span class="pm-names"><h3>' + esc(p.title) + '</h3>' +
					'<span class="pm-sub">' + esc(p.slug) + ' \u00b7 ' + compact(p.downloads) + ' downloads \u00b7 ' +
					esc((p.categories || []).slice(0, 3).join(', ')) + '</span></span>' +
				'<button class="pm-x" data-mr="close" aria-label="Close">' + ico('close', 14) + '</button>' +
			'</div>' +
			'<div class="pm-detail-body">' +
				'<p style="margin-top:0">' + esc(p.description) + '</p>' +
				'<div class="pm-meta"><span class="pm-chip ok">' + GAME_VERSION + '</span>' +
					'<span class="pm-chip">' + esc((p.loaders || []).filter(function (l) { return l !== 'minecraft'; }).join(' / ') || 'datapack') + '</span>' +
					(entry ? '<span class="pm-chip ok">IN CLIENT ' + esc(entry.version) + '</span>' : '') + '</div>' +
				'<h4>VERSIONS FOR ' + GAME_VERSION + '</h4>' + versionsHTML() +
				(linksHTML(p) ? '<h4>PROJECT LINKS</h4>' + linksHTML(p) : '') +
				dependenciesHTML() +
				(bodyText ? '<h4>ABOUT</h4><p>' + esc(bodyText.slice(0, 900)) + (bodyText.length > 900 ? '\u2026' : '') + '</p>' : '') +
				(state.installError ? '<p class="pm-note" style="border-color:#5a2a2a;color:#ffb4b4">' + esc(state.installError) + '</p>' : '') +
				'<p class="pm-note">Installing stores the real file in this account\'s storage and registers it with the client. ' +
					'The client is Java compiled to JavaScript ahead of time, so a downloaded jar can be kept, verified and updated, ' +
					'but only mods built into the client (Pretzel Essentials) run in game.</p>' +
				'<p class="pm-note">Source: api.modrinth.com/v2 \u00b7 project ' + esc(p.id) + '</p>' +
			'</div>' +
		'</div></div>';
	}

	function ownHTML() {
		var store = storage();
		if (!store) return '<div class="pm-state">Mod storage did not load.</div>';
		var list = store.list();
		if (!list.length) {
			return '<div class="pm-state">Nothing installed for <b>' + esc(store.account()) + '</b> yet.' +
				'<br>Search a mod and press INSTALL - it lands in this account only.</div>';
		}
		return list.map(function (item) {
			return '<div class="pm-own' + (item.enabled === false ? ' off' : '') + '">' +
				'<span class="pm-logo">' + (item.icon
					? '<img src="' + esc(item.icon) + '" alt="" loading="lazy" onerror="this.remove()">'
					: ico('cube', 14, '#8a6a22')) + '</span>' +
				'<span class="pm-names"><span class="pm-name">' + esc(item.title) + '</span>' +
					'<span class="pm-sub">' + esc(item.version) + ' \u00b7 ' + human(item.size) + ' \u00b7 ' +
					esc((item.loaders || []).filter(function (l) { return l !== 'minecraft'; }).join(' / ') || 'file') + '</span></span>' +
				'<span class="acts">' +
					(item.update
						? '<button class="pm-add" data-mr="install" data-id="' + esc(item.id) + '" data-title="' + esc(item.title) +
							'" data-version="' + esc(item.update.versionId) + '">UPDATE</button>'
						: '') +
					'<button class="pm-add ghost" data-mr="toggle" data-id="' + esc(item.id) + '">' +
						(item.enabled === false ? 'ENABLE' : 'DISABLE') + '</button>' +
					'<button class="pm-add ghost" data-mr="remove" data-id="' + esc(item.id) + '">REMOVE</button>' +
				'</span>' +
			'</div>';
		}).join('') +
			'<div class="pm-bar" style="margin-top:10px">' +
				'<button class="pm-add ghost" data-mr="export">EXPORT MANIFEST</button>' +
				'<button class="pm-add ghost" data-mr="import">IMPORT MANIFEST</button>' +
				'<input id="pm-import" type="file" accept="application/json,.json" style="display:none">' +
			'</div>' +
			'<p class="pm-note">Account storage: ' + human(store.usage()) + ' for ' + esc(store.account()) + '. ' +
				'Exported manifests carry ids, versions and enabled state; imported entries are registered without their file until you install them again.</p>';
	}

	function bodyHTML() {
		if (state.mode === 'mine') return ownHTML();
		if (state.loading) return '<div class="pm-state">Searching Modrinth for ' + GAME_VERSION + ' mods\u2026</div>';
		if (state.error) {
			return '<div class="pm-state">' + esc(state.error) + '<br><button class="pm-add" data-mr="retry">Retry</button></div>';
		}
		if (!state.results.length) {
			return '<div class="pm-state">No ' + GAME_VERSION + ' mods matched "' + esc(state.query) + '".</div>';
		}
		var pages = Math.max(1, Math.ceil(state.total / PAGE));
		return '<div class="pm-grid">' + state.results.map(card).join('') + '</div>' +
			'<div class="pm-page"><span>' + ((state.page - 1) * PAGE + 1) + '\u2013' +
				Math.min(state.page * PAGE, state.total) + ' of ' + compact(state.total) + ' mods</span>' +
				'<span style="display:flex;gap:6px">' +
					'<button data-mr="page" data-value="' + (state.page - 1) + '"' + (state.page <= 1 ? ' disabled' : '') + '>Prev</button>' +
					'<span style="align-self:center;font-size:9px">' + state.page + '/' + pages + '</span>' +
					'<button data-mr="page" data-value="' + (state.page + 1) + '"' + (state.page >= pages ? ' disabled' : '') + '>Next</button>' +
				'</span></div>';
	}

	function render() {
		var root = document.getElementById('pretzel-mods-root');
		if (!root) return;
		var count = installedCount();
		var store = storage();
		root.innerHTML = '<div class="pm-wrap">' +
			'<div class="pm-head"><span class="pm-title">Mods \u00b7 ' + GAME_VERSION + '</span>' +
				'<span class="pm-count">live from api.modrinth.com \u00b7 ' + count + ' in this account</span></div>' +
			'<p class="pm-line">Every project below is a real Modrinth response filtered to Minecraft ' + GAME_VERSION + '. ' +
				'<b>INSTALL</b> downloads the file into the signed-in account\'s own storage and links it to the client - ' +
				'no manual downloads, no copies shared between accounts.</p>' +
			'<div class="pm-bar">' +
				['relevance', 'downloads', 'follows', 'newest', 'updated'].map(function (index) {
					var labels = { relevance: 'RELEVANCE', downloads: 'DOWNLOADS', follows: 'FOLLOWS', newest: 'NEWEST', updated: 'UPDATED' };
					return '<button class="pm-tab' + (state.index === index && state.mode === 'search' ? ' on' : '') +
						'" data-mr="index" data-value="' + index + '">' + labels[index] + '</button>';
				}).join('') +
				'<button class="pm-tab' + (state.mode === 'mine' ? ' on' : '') + '" data-mr="own">MY MODS ' + count + '</button>' +
				'<input class="pm-search" id="pm-search" type="search" placeholder="Search Modrinth ' + GAME_VERSION + ' mods\u2026" value="' + esc(state.query) + '">' +
			'</div>' +
			'<div class="pm-cats">' + CATEGORIES.map(function (cat) {
				return '<button class="pm-cat' + (state.cat === cat.id ? ' on' : '') + '" data-mr="cat" data-value="' + cat.id + '">' + cat.label + '</button>';
			}).join('') + '</div>' +
			bodyHTML() +
		'</div>' +
		(state.detail ? detailHTML() : '') +
		(store ? '' : '<p class="pm-note">Mod storage module did not load - check mod-storage.js.</p>');
	}

	// ---------------------------------------------------------------- actions

	function mount(root) {
		if (!root) return;
		style();
		render();
		if (!state.results.length && !state.loading && !state.error && state.mode === 'search') runSearch();
	}

	function wire() {
		document.addEventListener('input', function (event) {
			if (event.target.id !== 'pm-search') return;
			state.query = event.target.value;
			state.page = 1;
			clearTimeout(wire.timer);
			wire.timer = setTimeout(runSearch, 350);
		});

		document.addEventListener('change', function (event) {
			if (event.target.id !== 'pm-import') return;
			var file = event.target.files && event.target.files[0];
			if (!file || !storage()) return;
			file.text().then(function (text) {
				var added = storage().importManifest(text);
				toast(added ? added + ' mods imported into ' + storage().account() : 'Manifest merged - nothing new');
			}).catch(function (error) {
				toast(error && error.message ? error.message : 'Import failed', true);
			}).finally(function () {
				event.target.value = '';
				render();
			});
		});

		document.addEventListener('click', function (event) {
			var el = event.target.closest('[data-mr]');
			if (!el) return;
			var act = el.getAttribute('data-mr');
			if (act === 'index') { state.index = el.getAttribute('data-value'); state.page = 1; runSearch(); return; }
			if (act === 'cat') {
				state.cat = el.getAttribute('data-value');
				state.page = 1;
				var picked = activeCategory();
				if (picked.index) state.index = picked.index;
				runSearch();
				return;
			}
			if (act === 'page') {
				var page = Number(el.getAttribute('data-value'));
				if (!page || page < 1) return;
				state.page = page;
				runSearch();
				return;
			}
			if (act === 'open') { openProject(el.getAttribute('data-id')); return; }
			if (act === 'install') {
				event.stopPropagation();
				var id = el.getAttribute('data-id');
				if (!id) return;
				doInstall(id, el.getAttribute('data-title'), el.getAttribute('data-version') || '');
				return;
			}
			if (act === 'own') {
				state.mode = 'mine';
				state.detail = null;
				state.page = 1;
				render();
				refreshUpdates();
				return;
			}
			if (act === 'toggle') {
				if (storage()) storage().toggle(el.getAttribute('data-id'));
				render();
				return;
			}
			if (act === 'remove') {
				var projectId = el.getAttribute('data-id');
				if (!storage()) return;
				storage().remove(projectId).then(function () {
					toast('Removed from ' + storage().account() + ' storage');
					render();
				});
				return;
			}
			if (act === 'export') {
				if (!storage()) return;
				storage().exportManifest();
				toast('Manifest exported for ' + storage().account());
				return;
			}
			if (act === 'import') {
				var pick = document.getElementById('pm-import');
				if (pick) pick.click();
				return;
			}
			if (act === 'retry') { runSearch(); return; }
			if (act === 'retry-versions' && state.detail) { openProject(state.detail.id); return; }
			if (act === 'close') {
				if (event.target.closest('.pm-detail') && !event.target.closest('.pm-x')) return;
				state.detail = null;
				state.versions = null;
				render();
				return;
			}
		});
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
	else wire();

	window.PretzelMods = { mount: mount, search: runSearch, gameVersion: GAME_VERSION };
})();
