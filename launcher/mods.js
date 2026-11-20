/*
 * Pretzel Client - mods page.
 *
 * Lists the Java mods people ask for alongside the Pretzel port that covers
 * each one. "Add" keeps the mod on your list and names the in-game toggle that
 * does the work, because the client is compiled ahead of time: it cannot load a
 * jar at runtime, so there is no file to install.
 *
 * Public surface: window.PretzelMods.mount(element)
 */
(function () {
	'use strict';

	var INSTALLED_KEY = 'pretzel.mods.list.v1';

	// kind: the Pretzel mod that covers this Java mod, or null when the browser
	// build genuinely cannot do it.
	var MODS = [
		{ id: 'sodium', name: 'Sodium', author: 'CaffeineMC', cat: 'Performance',
			desc: 'Rendering engine rewrite with far higher frame rates.',
			covers: 'FPS Optimizer + Chunk Optimizer' },
		{ id: 'lithium', name: 'Lithium', author: 'CaffeineMC', cat: 'Performance',
			desc: 'Optimises game logic and entity ticking.',
			covers: 'Animation Optimizer' },
		{ id: 'entityculling', name: 'Entity Culling', author: 'tr7zw', cat: 'Performance',
			desc: 'Skips entities that are hidden behind blocks.',
			covers: 'Entity Culling' },
		{ id: 'starlight', name: 'Starlight', author: 'PaperMC', cat: 'Performance',
			desc: 'Replaces the light engine with a faster one.',
			covers: null, why: 'The browser build uses its own lighting pass.' },
		{ id: 'ferritecore', name: 'FerriteCore', author: 'malte0811', cat: 'Performance',
			desc: 'Cuts memory use of block and model data.',
			covers: null, why: 'Nothing to reclaim: the browser build keeps no block-data cache.' },
		{ id: 'krypton', name: 'Krypton', author: 'Asek3', cat: 'Performance',
			desc: 'Optimises the network stack.',
			covers: null, why: 'Networking goes through the browser WebSocket, not Netty.' },
		{ id: 'iris', name: 'Iris Shaders', author: 'coderbot', cat: 'Visual',
			desc: 'Loads OptiFine-format shader packs.',
			covers: null, why: 'Shader packs need GLSL that the WebGL build cannot compile.' },
		{ id: 'optifine', name: 'OptiFine', author: 'sp614x', cat: 'Visual',
			desc: 'Zoom, brightness and crosshair tweaks.',
			covers: 'Zoom + Fullbright + Custom Crosshair' },
		{ id: 'perspective', name: 'Perspective Mod', author: 'Cynosphere', cat: 'Visual',
			desc: 'Third-person freelook without turning the player.',
			covers: 'Freelook' },
		{ id: 'xaeros', name: "Xaero's Minimap", author: 'xaero96', cat: 'Utility',
			desc: 'Minimap with waypoints and death points.',
			covers: 'World Map + Waypoints' },
		{ id: 'pingdisplay', name: 'Better Ping Display', author: 'vladmarica', cat: 'Utility',
			desc: 'Shows your ping as a number instead of bars.',
			covers: 'Ping Display' },
		{ id: 'essential', name: 'Essential Mod', author: 'SparkUniverse', cat: 'Utility',
			desc: 'Friends list, invites and cosmetics.',
			covers: 'Friend System + Cosmetics' },
		{ id: 'autogg', name: 'AutoGG', author: 'Sk1er', cat: 'Utility',
			desc: 'Says gg automatically when a match ends.',
			covers: 'Auto GG' },
		{ id: 'appleskin', name: 'AppleSkin', author: 'squeek502', cat: 'Utility',
			desc: 'Hunger and saturation values on the HUD.',
			covers: null, why: 'Hunger values are not exposed to the browser client.' }
	];

	var CATS = ['All', 'Performance', 'Visual', 'Utility'];

	var state = { cat: 'All', query: '' };

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
		'.pm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(292px,1fr));gap:10px}',
		'.pm-card{display:flex;flex-direction:column;border:1px solid #24272e;border-radius:9px;background:linear-gradient(180deg,#171a20,#13161b);padding:13px 14px 12px}',
		'.pm-card:hover{border-color:#3a3f49}',
		'.pm-card.on{border-color:#3f5c47}',
		'.pm-top{display:flex;align-items:baseline;gap:7px}',
		'.pm-name{font-size:12.5px;font-weight:600;color:#eef1f5}',
		'.pm-author{margin-left:auto;color:#6f757e;font-size:9.5px}',
		'.pm-desc{margin:7px 0 0;color:#98a0aa;font-size:11px;line-height:1.55}',
		'.pm-covers{margin:9px 0 0;color:#8dc6a3;font-size:10.5px;line-height:1.5}',
		'.pm-covers span{color:#5f6a63}',
		'.pm-missing{margin:9px 0 0;color:#9a8360;font-size:10.5px;line-height:1.5}',
		'.pm-row{display:flex;align-items:center;gap:8px;margin-top:12px}',
		'.pm-add{padding:6px 14px;border:1px solid #8a6a22;border-radius:7px;background:#241d10;color:#f2c66a;font:inherit;font-size:10.5px;cursor:pointer}',
		'.pm-add:hover{background:#2e2513}',
		'.pm-add.added{border-color:#3c5a46;background:#16241b;color:#82c99b}',
		'.pm-add:disabled{border-color:#2a2e35;background:#15181d;color:#666c76;cursor:default}',
		'.pm-hint{margin-left:auto;color:#6f757e;font-size:9.5px}',
		'.pm-empty{padding:40px 0;color:#8f949d;font-size:12px;text-align:center}',
		'.pm-foot{margin-top:18px;padding-top:14px;border-top:1px solid #22252c;color:#6f757e;font-size:10.5px;line-height:1.7}'
	].join('\n');

	function esc(value) {
		return String(value).replace(/[&<>"']/g, function (ch) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
		});
	}

	function added() {
		try {
			var raw = localStorage.getItem(INSTALLED_KEY);
			var list = raw ? JSON.parse(raw) : [];
			return Array.isArray(list) ? list : [];
		} catch (e) {
			return [];
		}
	}

	function saveAdded(ids) {
		try {
			localStorage.setItem(INSTALLED_KEY, JSON.stringify(ids));
		} catch (e) { /* local only */ }
	}

	function isAdded(id) {
		return added().indexOf(id) !== -1;
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

	function cardHTML(mod) {
		var on = isAdded(mod.id);
		var mapped = Boolean(mod.covers);
		var action = mapped
			? '<button class="pm-add' + (on ? ' added' : '') + '" data-add="' + esc(mod.id) + '">' + (on ? 'Added' : 'Add') + '</button>' +
				'<span class="pm-hint">' + (on ? 'Enable it in game' : '') + '</span>'
			: '<button class="pm-add" disabled>Not in browser</button>';
		return '<article class="pm-card' + (on ? ' on' : '') + '">' +
			'<div class="pm-top"><span class="pm-name">' + esc(mod.name) + '</span>' +
			'<span class="pm-author">' + esc(mod.author) + '</span></div>' +
			'<p class="pm-desc">' + esc(mod.desc) + '</p>' +
			(mapped
				? '<p class="pm-covers"><span>Pretzel:</span> ' + esc(mod.covers) + '</p>'
				: '<p class="pm-missing">' + esc(mod.why || 'Not available in the browser build.') + '</p>') +
			'<div class="pm-row">' + action + '</div>' +
			'</article>';
	}

	function gridHTML() {
		var list = visible();
		if (!list.length) {
			return '<p class="pm-empty">No mod matches that search.</p>';
		}
		return '<div class="pm-grid">' + list.map(cardHTML).join('') + '</div>';
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
				'<p class="pm-line">Add a Java mod and you get the Pretzel port that covers it &mdash; ' +
					'the client is compiled ahead of time, so <b>no jar is loaded</b>; flip the named toggle ' +
					'in game from the Mods icon on the title screen.</p>' +
				'<div class="pm-bar" id="pm-tabs">' +
					CATS.map(function (cat) {
						return '<button class="pm-tab' + (cat === state.cat ? ' on' : '') + '" data-cat="' + esc(cat) + '">' +
							esc(cat) + '</button>';
					}).join('') +
					'<input class="pm-search" id="pm-search" type="search" placeholder="Search mods..." value="' + esc(state.query) + '">' +
				'</div>' +
				'<div id="pm-grid">' + gridHTML() + '</div>' +
				'<p class="pm-foot">Mods marked Not in browser need something the WebGL build cannot do, such as ' +
					'GLSL shader packs or a custom network stack. Everything else is toggled client-side and needs ' +
					'nothing on the server.</p>' +
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
			var button = event.target.closest('[data-add]');
			if (!button) return;
			var id = button.getAttribute('data-add');
			var mod = MODS.find(function (item) { return item.id === id; });
			if (!mod) return;
			var list = added();
			var index = list.indexOf(id);
			if (index === -1) {
				list.push(id);
				saveAdded(list);
				toast(mod.name + ' added \u00b7 turn on ' + mod.covers + ' in game');
			} else {
				list.splice(index, 1);
				saveAdded(list);
			}
			mount(root);
		});
	}

	window.PretzelMods = { mount: mount };
})();
