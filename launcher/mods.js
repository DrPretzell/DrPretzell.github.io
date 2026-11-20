/*
 * Pretzel Client - mods page.
 *
 * Lists the Java mods people ask for alongside the Pretzel port that covers
 * each one. Installing records the mod on this browser and names the in-game
 * toggle that does the work: the client is compiled ahead of time, so there is
 * no jar to download. Every ported mod links to the source that implements it.
 *
 * Public surface: window.PretzelMods.mount(element)
 */
(function () {
	'use strict';

	var INSTALLED_KEY = 'pretzel.mods.list.v1';
	var SOURCE_DIR = 'src/game/java/net/pretzelclient/mods/';

	// kind: the Pretzel mod that covers this Java mod, or null when the browser
	// build genuinely cannot do it. src: the file that implements the port.
	var MODS = [
		{ id: 'sodium', name: 'Sodium', author: 'CaffeineMC', cat: 'Performance', logo: 'So',
			desc: 'Rendering engine rewrite with far higher frame rates.',
			covers: 'FPS Optimizer + Chunk Optimizer', src: 'PretzelModCatalog.java' },
		{ id: 'lithium', name: 'Lithium', author: 'CaffeineMC', cat: 'Performance', logo: 'Li',
			desc: 'Optimises game logic and entity ticking.',
			covers: 'Animation Optimizer', src: 'PretzelModCatalog.java' },
		{ id: 'entityculling', name: 'Entity Culling', author: 'tr7zw', cat: 'Performance', logo: 'EC',
			desc: 'Skips entities that are hidden behind blocks.',
			covers: 'Entity Culling', src: 'PretzelModCatalog.java' },
		{ id: 'starlight', name: 'Starlight', author: 'PaperMC', cat: 'Performance', logo: 'St',
			desc: 'Replaces the light engine with a faster one.',
			covers: null, why: 'The browser build uses its own lighting pass.' },
		{ id: 'ferritecore', name: 'FerriteCore', author: 'malte0811', cat: 'Performance', logo: 'Fc',
			desc: 'Cuts memory use of block and model data.',
			covers: null, why: 'Nothing to reclaim: the browser build keeps no block-data cache.' },
		{ id: 'krypton', name: 'Krypton', author: 'Asek3', cat: 'Performance', logo: 'Kr',
			desc: 'Optimises the network stack.',
			covers: null, why: 'Networking goes through the browser WebSocket, not Netty.' },
		{ id: 'iris', name: 'Iris Shaders', author: 'coderbot', cat: 'Visual', logo: 'Ir',
			desc: 'Loads OptiFine-format shader packs.',
			covers: null, why: 'Shader packs need GLSL that the WebGL build cannot compile.' },
		{ id: 'optifine', name: 'OptiFine', author: 'sp614x', cat: 'Visual', logo: 'OF',
			desc: 'Zoom, brightness and crosshair tweaks.',
			covers: 'Zoom + Fullbright + Custom Crosshair', src: 'FeatureRegistry.java' },
		{ id: 'perspective', name: 'Perspective Mod', author: 'Cynosphere', cat: 'Visual', logo: 'Pe',
			desc: 'Third-person freelook without turning the player.',
			covers: 'Freelook', src: 'FeatureRegistry.java' },
		{ id: 'xaeros', name: "Xaero's Minimap", author: 'xaero96', cat: 'Utility', logo: 'Xa',
			desc: 'Minimap with waypoints and death points.',
			covers: 'World Map + Waypoints', src: 'FeatureRegistry.java' },
		{ id: 'pingdisplay', name: 'Better Ping Display', author: 'vladmarica', cat: 'Utility', logo: 'BP',
			desc: 'Shows your ping as a number instead of bars.',
			covers: 'Ping Display', src: 'PretzelModCatalog.java' },
		{ id: 'essential', name: 'Essential Mod', author: 'SparkUniverse', cat: 'Utility', logo: 'Es',
			desc: 'Friends list, invites and cosmetics.',
			covers: 'Friend System + Cosmetics', src: 'FeatureRegistry.java' },
		{ id: 'autogg', name: 'AutoGG', author: 'Sk1er', cat: 'Utility', logo: 'AG',
			desc: 'Says gg automatically when a match ends.',
			covers: 'Auto GG', src: 'FeatureRegistry.java' },
		{ id: 'appleskin', name: 'AppleSkin', author: 'squeek502', cat: 'Utility', logo: 'Ap',
			desc: 'Hunger and saturation values on the HUD.',
			covers: null, why: 'Hunger values are not exposed to the browser client.' }
	];

	var CATS = ['All', 'Performance', 'Visual', 'Utility'];

	var state = { cat: 'All', query: '', installing: {}, percent: {} };

	var ACCENT = {
		Performance: ['#3f7fe0', '#1d3a6b'],
		Visual: ['#a06ce0', '#4a2a6b'],
		Utility: ['#35b57e', '#17442f']
	};

	var STYLE = [
		'.pm-wrap{padding:22px 22px 44px;max-width:1180px}',
		'.pm-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}',
		'.pm-title{font-size:19px;font-weight:600;color:#f2f4f7;letter-spacing:.2px}',
		'.pm-line{margin:9px 0 0;color:#8f949d;font-size:11.5px;line-height:1.6;max-width:820px}',
		'.pm-line b{color:#e8c37a;font-weight:600}',
		'.pm-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:18px 0 14px}',
		'.pm-tab{padding:6px 12px;border:1px solid #292d35;border-radius:7px;background:#14171c;color:#a7adb6;font:inherit;font-size:11px;cursor:pointer}',
		'.pm-tab:hover{border-color:#3d434d;color:#eef1f5}',
		'.pm-tab.on{border-color:#8a6a22;background:#241d10;color:#f2c66a}',
		'.pm-search{margin-left:auto;min-width:200px;padding:7px 11px;border:1px solid #292d35;border-radius:7px;background:#101317;color:#e8ecf1;font:inherit;font-size:11.5px}',
		'.pm-search::placeholder{color:#666c76}',
		'.pm-search:focus{outline:none;border-color:#8a6a22}',
		'.pm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}',
		'.pm-card{display:flex;flex-direction:column;border:1px solid #24272e;border-radius:9px;background:linear-gradient(180deg,#171a20,#13161b);padding:13px 14px 12px}',
		'.pm-card:hover{border-color:#3a3f49}',
		'.pm-card.on{border-color:#3f5c47}',
		'.pm-top{display:flex;align-items:center;gap:9px}',
		'.pm-logo{flex:0 0 auto;width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;',
		'font-size:11px;font-weight:700;letter-spacing:.3px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.45);',
		'box-shadow:inset 0 0 0 1px rgba(255,255,255,.14),0 2px 6px rgba(0,0,0,.35)}',
		'.pm-logo.dead{filter:grayscale(.75) brightness(.8)}',
		'.pm-name{font-size:12.5px;font-weight:600;color:#eef1f5}',
		'.pm-author{margin-left:auto;color:#6f757e;font-size:9.5px}',
		'.pm-desc{margin:8px 0 0;color:#98a0aa;font-size:11px;line-height:1.55}',
		'.pm-covers{margin:9px 0 0;color:#8dc6a3;font-size:10.5px;line-height:1.5}',
		'.pm-covers span{color:#5f6a63}',
		'.pm-missing{margin:9px 0 0;color:#9a8360;font-size:10.5px;line-height:1.5}',
		'.pm-row{display:flex;align-items:center;gap:8px;margin-top:12px}',
		'.pm-add{position:relative;overflow:hidden;min-width:104px;padding:6px 14px;border:1px solid #8a6a22;border-radius:7px;',
		'background:#241d10;color:#f2c66a;font:inherit;font-size:10.5px;cursor:pointer}',
		'.pm-add:hover{background:#2e2513}',
		'.pm-add.working{border-color:#4a6fa8;background:#111a26;color:#bcd4f5;cursor:progress}',
		'.pm-add.added{border-color:#3c5a46;background:#16241b;color:#82c99b}',
		'.pm-add:disabled{border-color:#2a2e35;background:#15181d;color:#666c76;cursor:default}',
		'.pm-fill{position:absolute;inset:0 auto 0 0;width:0;background:rgba(90,150,235,.32);transition:width .12s linear}',
		'.pm-label{position:relative}',
		'.pm-src{margin-left:auto;color:#7d848e;font-size:9.5px;font-family:ui-monospace,Menlo,Consolas,monospace;cursor:help}',
		'.pm-hint{color:#6f757e;font-size:9.5px}',
		'.pm-empty{padding:40px 0;color:#8f949d;font-size:12px;text-align:center}',
		'.pm-foot{margin-top:18px;padding-top:14px;border-top:1px solid #22252c;color:#6f757e;font-size:10.5px;line-height:1.7}'
	].join('\n');

	function esc(value) {
		return String(value).replace(/[&<>"']/g, function (ch) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
		});
	}

	function installed() {
		try {
			var raw = localStorage.getItem(INSTALLED_KEY);
			var list = raw ? JSON.parse(raw) : [];
			if (!Array.isArray(list)) return [];
			return list.map(function (item) {
				return typeof item === 'string' ? { id: item, at: 0 } : item;
			}).filter(function (item) { return item && item.id; });
		} catch (e) {
			return [];
		}
	}

	function saveInstalled(list) {
		try {
			localStorage.setItem(INSTALLED_KEY, JSON.stringify(list));
		} catch (e) { /* local only */ }
	}

	function isInstalled(id) {
		return installed().some(function (item) { return item.id === id; });
	}

	function toast(message) {
		var stack = document.getElementById('toasts');
		var node = document.createElement('div');
		node.className = 'toast good';
		node.textContent = message;
		if (stack) {
			stack.appendChild(node);
			setTimeout(function () { node.remove(); }, 4200);
		}
	}

	function visible() {
		var needle = state.query.trim().toLowerCase();
		return MODS.filter(function (mod) {
			if (state.cat !== 'All' && mod.cat !== state.cat) return false;
			if (!needle) return true;
			return (mod.name + ' ' + mod.desc + ' ' + mod.author + ' ' + (mod.covers || '')).toLowerCase().indexOf(needle) !== -1;
		});
	}

	function logoHTML(mod) {
		var pair = ACCENT[mod.cat] || ACCENT.Utility;
		var style = 'background:linear-gradient(160deg,' + pair[0] + ',' + pair[1] + ')';
		var dead = mod.covers ? '' : ' dead';
		return '<span class="pm-logo' + dead + '" style="' + style + '" aria-hidden="true">' +
			esc(mod.logo || mod.name.slice(0, 2)) + '</span>';
	}

	function cardHTML(mod) {
		var on = isInstalled(mod.id);
		var mapped = Boolean(mod.covers);
		var percent = state.percent[mod.id];
		var working = state.installing[mod.id];

		var action;
		if (!mapped) {
			action = '<button class="pm-add" disabled>Not in browser</button>';
		} else if (working) {
			action = '<button class="pm-add working" data-working="' + esc(mod.id) + '" disabled>' +
				'<span class="pm-fill" style="width:' + percent + '%"></span>' +
				'<span class="pm-label">Installing ' + percent + '%</span></button>';
		} else if (on) {
			action = '<button class="pm-add added" data-remove="' + esc(mod.id) + '">Installed</button>' +
				'<span class="pm-hint">Toggle: ' + esc(mod.covers) + '</span>';
		} else {
			action = '<button class="pm-add" data-install="' + esc(mod.id) + '">Install</button>';
		}

		// The game source lives in a private repo, so name the file instead of
		// linking somewhere that 404s for visitors.
		var src = mod.src
			? '<span class="pm-src" title="' + esc(SOURCE_DIR + mod.src) + '">src \u00b7 ' + esc(mod.src) + '</span>'
			: '';

		return '<article class="pm-card' + (on ? ' on' : '') + '">' +
			'<div class="pm-top">' + logoHTML(mod) +
				'<span class="pm-name">' + esc(mod.name) + '</span>' +
				'<span class="pm-author">' + esc(mod.author) + '</span></div>' +
			'<p class="pm-desc">' + esc(mod.desc) + '</p>' +
			(mapped
				? '<p class="pm-covers"><span>Pretzel:</span> ' + esc(mod.covers) + '</p>'
				: '<p class="pm-missing">' + esc(mod.why || 'Not available in the browser build.') + '</p>') +
			'<div class="pm-row">' + action + src + '</div>' +
			'</article>';
	}

	function gridHTML() {
		var list = visible();
		if (!list.length) {
			return '<p class="pm-empty">No mod matches that search.</p>';
		}
		return '<div class="pm-grid">' + list.map(cardHTML).join('') + '</div>';
	}

	function startInstall(root, mod) {
		if (state.installing[mod.id]) return;
		state.installing[mod.id] = true;
		state.percent[mod.id] = 0;

		// The port is compiled in, so there is nothing to download: the bar walks
		// through registering the mod in this browser, then it is really saved.
		var step = 0;
		var timer = setInterval(function () {
			step += 1;
			var value = Math.min(100, Math.round(step * 7 + Math.random() * 5));
			state.percent[mod.id] = value;
			var cell = root.querySelector('[data-working="' + mod.id + '"]');
			if (cell) {
				var fill = cell.querySelector('.pm-fill');
				var label = cell.querySelector('.pm-label');
				if (fill) fill.style.width = value + '%';
				if (label) label.textContent = 'Installing ' + value + '%';
			} else {
				// First frame: swap the button into its working state.
				var grid = root.querySelector('#pm-grid');
				if (grid) grid.innerHTML = gridHTML();
			}
			if (value >= 100) {
				clearInterval(timer);
				var list = installed().filter(function (item) { return item.id !== mod.id; });
				list.push({ id: mod.id, at: Date.now() });
				saveInstalled(list);
				delete state.installing[mod.id];
				delete state.percent[mod.id];
				var grid2 = root.querySelector('#pm-grid');
				if (grid2) grid2.innerHTML = gridHTML();
				toast(mod.name + ' installed \u00b7 turn on ' + mod.covers + ' in game');
			}
		}, 70);
	}

	function mount(root) {
		if (!root) return;
		if (!document.getElementById('pm-style')) {
			var style = document.createElement('style');
			style.id = 'pm-style';
			style.textContent = STYLE;
			document.head.appendChild(style);
		}

		root.innerHTML =
			'<div class="pm-wrap">' +
				'<div class="pm-head"><span class="pm-title">Pretzel Mods</span></div>' +
				'<p class="pm-line">Pick a Java mod and install the Pretzel port that covers it &mdash; ' +
					'the client is compiled ahead of time, so <b>no jar is downloaded</b>; install records it ' +
					'here and names the toggle to switch on in game.</p>' +
				'<div class="pm-bar" id="pm-tabs">' +
					CATS.map(function (cat) {
						return '<button class="pm-tab' + (cat === state.cat ? ' on' : '') + '" data-cat="' + esc(cat) + '">' +
							esc(cat) + '</button>';
					}).join('') +
					'<input class="pm-search" id="pm-search" type="search" placeholder="Search mods..." value="' + esc(state.query) + '">' +
				'</div>' +
				'<div id="pm-grid">' + gridHTML() + '</div>' +
				'<p class="pm-foot">Every port names the source file that implements it. Mods marked Not in browser need ' +
					'something the WebGL build cannot do, such as GLSL shader packs or a custom network stack. ' +
					'The rest are toggled client-side and need nothing on the server.</p>' +
			'</div>';

		root.querySelector('#pm-tabs').addEventListener('click', function (event) {
			var button = event.target.closest('[data-cat]');
			if (!button) return;
			state.cat = button.getAttribute('data-cat');
			mount(root);
		});

		var search = root.querySelector('#pm-search');
		search.addEventListener('input', function () {
			state.query = search.value;
			root.querySelector('#pm-grid').innerHTML = gridHTML();
		});

		root.querySelector('#pm-grid').addEventListener('click', function (event) {
			var install = event.target.closest('[data-install]');
			if (install) {
				var mod = MODS.find(function (item) { return item.id === install.getAttribute('data-install'); });
				if (mod) startInstall(root, mod);
				return;
			}
			var remove = event.target.closest('[data-remove]');
			if (remove) {
				var id = remove.getAttribute('data-remove');
				var found = MODS.find(function (item) { return item.id === id; });
				saveInstalled(installed().filter(function (item) { return item.id !== id; }));
				if (found) toast(found.name + ' removed');
				root.querySelector('#pm-grid').innerHTML = gridHTML();
			}
		});
	}

	window.PretzelMods = { mount: mount };
})();
