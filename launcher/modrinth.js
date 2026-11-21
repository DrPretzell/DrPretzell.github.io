// Pretzel Client - Modrinth mod browser.
//
// Everything on this page comes from https://api.modrinth.com/v2: search results,
// project metadata, icons, authors, versions, files and dependencies. Nothing is
// hardcoded. Requests are cached for a few minutes, time out, page by page, and
// surface real errors with a retry.
//
// Honest compatibility: this client runs Minecraft in the browser through TeaVM,
// so a Fabric / Forge / Quilt / NeoForge jar cannot be executed inside it. The
// page says so per project instead of claiming a working install; the download
// button hands over the real file and the library tracks it for updates.
(function () {
	'use strict';

	var API = 'https://api.modrinth.com/v2';
	var LIBRARY = 'pretzel.modrinth.library.v1';
	var PAGE = 20;
	var TIMEOUT = 12000;
	var TTL = 5 * 60 * 1000;

	var state = {
		query: '',
		index: 'relevance',
		page: 1,
		total: 0,
		results: [],
		loading: false,
		error: '',
		detail: null,
		versions: null,
		versionsLoading: false,
		versionsError: ''
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

	function read(key, fallback) {
		try {
			var raw = localStorage.getItem(key);
			return raw ? JSON.parse(raw) : fallback;
		} catch (e) { return fallback; }
	}

	function write(key, value) {
		try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
	}

	function cachedGet(url) {
		var hit = cache[url];
		if (hit && Date.now() - hit.at < TTL) return Promise.resolve(hit.data);
		return fetchJson(url).then(function (data) {
			cache[url] = { at: Date.now(), data: data };
			return data;
		});
	}

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

	// ------------------------------------------------------------ formatting

	function compact(n) {
		var value = Number(n) || 0;
		if (value >= 1e9) return (value / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
		if (value >= 1e6) return (value / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
		if (value >= 1e3) return (value / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
		return String(value);
	}

	function library() {
		return read(LIBRARY, []) || [];
	}

	function saveLibrary(list) {
		write(LIBRARY, list);
	}

	function inLibrary(id) {
		return library().some(function (item) { return item.id === id; });
	}

	// --------------------------------------------------------- compatibility

	// The browser build renders the game with TeaVM; it has no JVM and cannot
	// load a jar. This is the single place that decides the verdict.
	function verdict(project, version) {
		var loaders = (version && version.loaders) || (project && project.loaders) || [];
		var browser = loaders.filter(function (l) {
			return l === 'eaglercraft' || l === 'browser';
		});
		if (browser.length) {
			return { ok: true, label: 'BROWSER BUILD', why: 'This project ships a browser-compatible build.' };
		}
		var named = loaders.filter(function (l) { return l !== 'minecraft'; }).map(function (l) {
			return l.charAt(0).toUpperCase() + l.slice(1);
		});
		return {
			ok: false,
			label: named.length ? named.join(' / ') + ' ONLY' : 'JAVA MOD ONLY',
			why: 'This is a Java mod. Pretzel runs Minecraft in the browser, so it can be downloaded and tracked, but it cannot be loaded inside the web client.'
		};
	}

	// ---------------------------------------------------------------- style

	function style() {
		if (document.getElementById('pm-style')) return;
		var css = '' +
			'.pm-wrap{padding:0}' +
			'.pm-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +
			'.pm-title{font-size:13px;color:#f4f6fa}' +
			'.pm-count{color:#6f757e;font-size:9px}' +
			'.pm-line{margin:6px 0 0;color:#8f949d;font-size:10px;line-height:1.6;max-width:820px}' +
			'.pm-line b{color:#e8c37a;font-weight:400}' +
			'.pm-bar{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin:10px 0 8px}' +
			'.pm-tab{padding:5px 9px;border:2px solid #292d35;background:#14171c;color:#a7adb6;font-size:8px;cursor:pointer}' +
			'.pm-tab:hover{border-color:#3d434d;color:#eef1f5}' +
			'.pm-tab.on{border-color:#8a6a22;background:#241d10;color:#f2c66a}' +
			'.pm-search{margin-left:auto;min-width:190px;padding:6px 9px;border:2px solid #292d35;background:#101317;color:#e8ecf1;font-size:10.5px;outline:none}' +
			'.pm-search:focus{border-color:#8a6a22}' +
			'.pm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:7px}' +
			'.pm-card{display:flex;flex-direction:column;border:2px solid #24272e;background:#14171c;padding:9px;cursor:pointer}' +
			'.pm-card:hover{border-color:#3a3f49;background:#171b21}' +
			'.pm-top{display:flex;align-items:center;gap:8px;min-width:0}' +
			'.pm-logo{flex:0 0 auto;width:28px;height:28px;display:grid;place-items:center;background:#0d1014;border:2px solid #232830;overflow:hidden}' +
			'.pm-logo img{width:24px;height:24px;object-fit:cover;image-rendering:pixelated}' +
			'.pm-names{display:flex;flex-direction:column;min-width:0}' +
			'.pm-name{font-size:8.5px;color:#eef1f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.7}' +
			'.pm-sub{font-size:9px;color:#6f757e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
			'.pm-desc{margin:6px 0 0;color:#98a0aa;font-size:10px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:30px}' +
			'.pm-meta{display:flex;align-items:center;gap:6px;margin-top:7px;font-size:9px;color:#7d8794;flex-wrap:wrap}' +
			'.pm-chip{border:1px solid #2a2f38;padding:2px 5px;color:#98a2ae;font-size:8px;font-family:"Pretzel Pixel",monospace}' +
			'.pm-chip.no{border-color:#5a2a2a;color:#ff9d9d}' +
			'.pm-chip.ok{border-color:#33513d;color:#8bd6a4}' +
			'.pm-row{display:flex;align-items:center;gap:7px;margin-top:8px}' +
			'.pm-add{min-width:84px;padding:5px 10px;border:2px solid #8a6a22;background:#241d10;color:#f2c66a;font-size:7.5px;cursor:pointer}' +
			'.pm-add:hover{background:#2e2513}' +
			'.pm-add.ghost{border-color:#2f3540;background:none;color:#a8b1bd;min-width:0}' +
			'.pm-add:disabled{border-color:#2a2e35;background:#15181d;color:#666c76;cursor:default}' +
			'.pm-src{margin-left:auto;border:1px solid #262a31;padding:2px 5px;color:#7d848e;font-size:8px;cursor:help}' +
			'.pm-state{padding:26px 8px;text-align:center;color:#8f949d;font-size:11px}' +
			'.pm-state .pm-add{margin-top:10px}' +
			'.pm-page{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;color:#79838f;font-size:9.5px}' +
			'.pm-page button{padding:5px 9px;border:2px solid #292d35;background:#14171c;color:#c3ccd8;font-size:8px;cursor:pointer}' +
			'.pm-page button:disabled{opacity:.4;cursor:default}' +
			'.pm-sheet{position:fixed;inset:0;z-index:75;display:grid;place-items:center;background:rgba(3,4,7,.7);padding:16px}' +
			'.pm-detail{width:min(760px,96vw);max-height:88vh;overflow:auto;background:#12151b;border:2px solid #2b303a;box-shadow:6px 6px 0 #000;color:#e9edf3}' +
			'.pm-detail-head{display:flex;gap:10px;align-items:flex-start;padding:12px;border-bottom:2px solid #22262e}' +
			'.pm-detail-head h3{margin:0 0 3px;font-family:"Pretzel Pixel",monospace;font-size:11px;color:#fff}' +
			'.pm-detail-body{padding:12px;font-size:11px;color:#aab3bf;line-height:1.65}' +
			'.pm-detail-body h4{margin:14px 0 6px;font-family:"Pretzel Pixel",monospace;font-size:8.5px;color:#e8c37a}' +
			'.pm-version{display:flex;align-items:center;gap:8px;padding:7px 8px;border:2px solid #232830;background:#151920;margin-bottom:5px;flex-wrap:wrap}' +
			'.pm-version .v-name{font-family:"Pretzel Pixel",monospace;font-size:8px;color:#eef2f7}' +
			'.pm-version .v-sub{font-size:9.5px;color:#7d8794}' +
			'.pm-x{margin-left:auto;background:none;border:2px solid transparent;color:#98a1ad;cursor:pointer;padding:2px 5px}' +
			'.pm-x:hover{border-color:#2f3540;color:#fff}' +
			'.pm-note{color:#8a7350;font-size:9.5px;line-height:1.6;border:2px solid #3a2f1b;background:#18140c;padding:8px}';
		var node = document.createElement('style');
		node.id = 'pm-style';
		node.textContent = css;
		document.head.appendChild(node);
	}

	// --------------------------------------------------------------- search

	function searchUrl() {
		var facets = [['project_type:mod']];
		var params = [
			'query=' + encodeURIComponent(state.query),
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
		} catch (error) {
			state.versionsError = error && error.message ? error.message : 'Could not load versions.';
		} finally {
			state.versionsLoading = false;
			render();
		}
	}

	// --------------------------------------------------------------- render

	function card(hit) {
		var loaders = (hit.categories || []).filter(function (c) {
			return ['fabric', 'forge', 'quilt', 'neoforge', 'liteloader', 'rift'].indexOf(c) >= 0;
		});
		var v = verdict({ loaders: loaders }, null);
		return '<article class="pm-card" data-mr="open" data-id="' + esc(hit.project_id || hit.slug) + '">' +
			'<div class="pm-top">' +
				'<span class="pm-logo">' + (hit.icon_url
					? '<img src="' + esc(hit.icon_url) + '" alt="" loading="lazy" onerror="this.remove()">'
					: ico('bolt', 14, '#8a6a22')) + '</span>' +
				'<span class="pm-names"><span class="pm-name">' + esc(hit.title) + '</span>' +
					'<span class="pm-sub">' + esc(hit.author || 'Modrinth') + ' \u00b7 ' + compact(hit.downloads) + ' downloads</span></span>' +
			'</div>' +
			'<p class="pm-desc">' + esc(hit.description) + '</p>' +
			'<div class="pm-meta">' +
				'<span class="pm-chip' + (v.ok ? ' ok' : ' no') + '">' + esc(v.label) + '</span>' +
				(hit.versions && hit.versions.length ? '<span class="pm-chip">' + esc(hit.versions[hit.versions.length - 1]) + '</span>' : '') +
				(hit.follows ? '<span class="pm-chip">\u2665 ' + compact(hit.follows) + '</span>' : '') +
			'</div>' +
			'<div class="pm-row">' +
				'<button class="pm-add ghost" data-mr="open" data-id="' + esc(hit.project_id || hit.slug) + '">Versions</button>' +
				(inLibrary(hit.project_id)
					? '<button class="pm-add" disabled>Saved</button>'
					: '<button class="pm-add" data-mr="save" data-id="' + esc(hit.project_id) + '" data-title="' + esc(hit.title) + '">Save</button>') +
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
		if (!state.versions || !state.versions.length) return '<div class="pm-state">This project has no published versions.</div>';
		return state.versions.slice(0, 12).map(function (v) {
			var file = (v.files || []).find(function (f) { return f.primary; }) || (v.files || [])[0] || null;
			var vv = verdict(state.detail, v);
			return '<div class="pm-version">' +
				'<span class="pm-names"><span class="v-name">' + esc(v.version_number) + '</span>' +
				'<span class="v-sub">' + esc((v.game_versions || []).slice(-2).join(', ')) + ' \u00b7 ' +
					esc((v.loaders || []).join(' / ')) + (file ? ' \u00b7 ' + compact(file.size) + 'B' : '') + '</span></span>' +
				'<span class="pm-chip' + (vv.ok ? ' ok' : ' no') + '">' + esc(vv.label) + '</span>' +
				(file
					? '<a class="pm-add" style="text-decoration:none" href="' + esc(file.url) + '" target="_blank" rel="noopener noreferrer" data-mr="file">Download</a>'
					: '<span class="pm-chip">no file</span>') +
			'</div>';
		}).join('');
	}

	function detailHTML() {
		var p = state.detail;
		var loaders = (p.loaders || []).filter(function (l) { return l !== 'minecraft'; });
		var v = verdict(p, null);
		var bodyText = String(p.body || '').replace(/[#*`>]/g, ' ').replace(/\s+/g, ' ').trim();
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
				'<div class="pm-meta"><span class="pm-chip' + (v.ok ? ' ok' : ' no') + '">' + esc(v.label) + '</span>' +
					loaders.map(function (l) { return '<span class="pm-chip">' + esc(l) + '</span>'; }).join('') +
					'<span class="pm-chip">' + esc((p.game_versions || []).slice(-1)[0] || '') + '</span></div>' +
				'<p class="pm-note" style="margin:9px 0">' + esc(v.why) + '</p>' +
				'<h4>VERSIONS</h4>' + versionsHTML() +
				(bodyText ? '<h4>ABOUT</h4><p>' + esc(bodyText.slice(0, 900)) + (bodyText.length > 900 ? '\u2026' : '') + '</p>' : '') +
				'<p class="pm-note">Source: api.modrinth.com/v2 \u00b7 project ' + esc(p.id) + '</p>' +
			'</div>' +
		'</div></div>';
	}

	function bodyHTML() {
		if (state.loading) return '<div class="pm-state">Searching Modrinth\u2026</div>';
		if (state.error) {
			return '<div class="pm-state">' + esc(state.error) + '<br><button class="pm-add" data-mr="retry">Retry</button></div>';
		}
		if (!state.results.length) {
			return '<div class="pm-state">No projects matched "' + esc(state.query) + '".</div>';
		}
		var pages = Math.max(1, Math.ceil(state.total / PAGE));
		return '<div class="pm-grid">' + state.results.map(card).join('') + '</div>' +
			'<div class="pm-page"><span>' + (state.page - 1) * PAGE + 1 + '\u2013' +
				Math.min(state.page * PAGE, state.total) + ' of ' + compact(state.total) + ' mods</span>' +
				'<span style="display:flex;gap:5px">' +
					'<button data-mr="page" data-value="' + (state.page - 1) + '"' + (state.page <= 1 ? ' disabled' : '') + '>Prev</button>' +
					'<span style="align-self:center;font-size:9px">' + state.page + '/' + pages + '</span>' +
					'<button data-mr="page" data-value="' + (state.page + 1) + '"' + (state.page >= pages ? ' disabled' : '') + '>Next</button>' +
				'</span></div>';
	}

	function render() {
		var root = document.getElementById('pretzel-mods-root');
		if (!root) return;
		root.innerHTML = '<div class="pm-wrap">' +
			'<div class="pm-head"><span class="pm-title">Mods</span>' +
				'<span class="pm-count">live from api.modrinth.com</span></div>' +
			'<p class="pm-line">Real Modrinth search: every card, icon, author, version and file below is an API response. ' +
				'<b>Java mods cannot be executed by the browser client</b>, so Pretzel downloads and tracks them instead of pretending they load.</p>' +
			'<div class="pm-bar">' +
				['relevance', 'downloads', 'follows', 'newest'].map(function (index) {
					var labels = { relevance: 'RELEVANCE', downloads: 'DOWNLOADS', follows: 'FOLLOWS', newest: 'NEWEST' };
					return '<button class="pm-tab' + (state.index === index ? ' on' : '') + '" data-mr="index" data-value="' + index + '">' + labels[index] + '</button>';
				}).join('') +
				'<button class="pm-tab" data-mr="library">LIBRARY ' + library().length + '</button>' +
				'<input class="pm-search" id="pm-search" type="search" placeholder="Search Modrinth mods\u2026" value="' + esc(state.query) + '">' +
			'</div>' +
			bodyHTML() +
		'</div>' +
		(state.detail ? detailHTML() : '');
	}

	// -------------------------------------------------------------- actions

	function save(hitId, title) {
		var list = library();
		if (list.some(function (item) { return item.id === hitId; })) return;
		list.push({ id: hitId, title: title, at: Date.now(), version: null });
		saveLibrary(list);
		checkUpdates();
		render();
	}

	async function checkUpdates() {
		var list = library();
		var changed = false;
		for (var i = 0; i < list.length; i++) {
			var item = list[i];
			try {
				var versions = await cachedGet(API + '/project/' + encodeURIComponent(item.id) + '/version');
				var latest = versions && versions[0];
				if (latest && latest.version_number && latest.version_number !== item.version) {
					item.version = latest.version_number;
					changed = true;
				}
			} catch (e) { /* a bookmarked project may be removed; keep the entry */ }
		}
		if (changed) saveLibrary(list);
	}

	function mount(root) {
		if (!root) return;
		style();
		render();
		if (!state.results.length && !state.loading && !state.error) runSearch();
	}

	function wire() {
		document.addEventListener('input', function (event) {
			if (event.target.id !== 'pm-search') return;
			state.query = event.target.value;
			state.page = 1;
			clearTimeout(wire.timer);
			wire.timer = setTimeout(runSearch, 350);
		});

		document.addEventListener('click', function (event) {
			var el = event.target.closest('[data-mr]');
			if (!el) return;
			var act = el.getAttribute('data-mr');
			if (act === 'index') { state.index = el.getAttribute('data-value'); state.page = 1; runSearch(); return; }
			if (act === 'page') {
				var page = Number(el.getAttribute('data-value'));
				if (!page || page < 1) return;
				state.page = page;
				runSearch();
				return;
			}
			if (act === 'open') { openProject(el.getAttribute('data-id')); return; }
			if (act === 'save') {
				event.stopPropagation();
				save(el.getAttribute('data-id'), el.getAttribute('data-title'));
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
			if (act === 'library') {
				var list = library();
				state.query = '';
				state.results = list.map(function (item) {
					return { project_id: item.id, slug: item.id, title: item.title, description: 'Saved to your library', author: 'library', downloads: 0 };
				});
				state.total = list.length;
				state.loading = false;
				state.error = '';
				render();
				return;
			}
		});
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
	else wire();

	window.PretzelMods = { mount: mount, search: runSearch };
})();
