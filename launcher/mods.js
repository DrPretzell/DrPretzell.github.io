/*
 * Pretzel Client - mods page.
 *
 * Every entry here is compiled straight into the browser client. There are no
 * jars to fetch: the Java sources are ported to the client's own feature
 * registry, so a mod is either built in or it does not exist. The in-game Mods
 * screen (bottom bar of the title screen) is what toggles them.
 *
 * Public surface: window.PretzelMods.mount(element)
 */
(function () {
	'use strict';

	var MODS = [
		// HUD
		{ id: 'keystrokes', name: 'Keystrokes', cat: 'HUD', desc: 'WASD and mouse buttons drawn as keys that light up while held.' },
		{ id: 'cps-counter', name: 'CPS Counter', cat: 'HUD', desc: 'Clicks per second over the last second, updated every tick.' },
		{ id: 'reach-display', name: 'Reach Display', cat: 'HUD', desc: 'Distance to the entity you last hit, in blocks.' },
		{ id: 'hitbox-display', name: 'Hitbox Display', cat: 'HUD', desc: 'Outlines nearby living entities inside 24 blocks.' },
		{ id: 'combo-counter', name: 'Combo Counter', cat: 'HUD', desc: 'Counts consecutive hits, reset after five seconds or when you take damage.' },
		{ id: 'kill-counter', name: 'Kill Counter', cat: 'HUD', desc: 'Session kills, counted when a target you hit dies.' },
		{ id: 'death-counter', name: 'Death Counter', cat: 'HUD', desc: 'Session deaths.' },
		{ id: 'kill-effect', name: 'Kill Effect', cat: 'HUD', desc: 'Explosion particles when a target you hit dies.' },
		{ id: 'crosshair-customizer', name: 'Crosshair Customizer', cat: 'HUD', desc: 'Replaces the vanilla crosshair with the Pretzel one.' },
		{ id: 'armor-status', name: 'Armor Status', cat: 'HUD', desc: 'Durability left on each armour slot.' },
		{ id: 'potion-status', name: 'Potion Status', cat: 'HUD', desc: 'Active effects with their remaining time.' },
		{ id: 'block-overlay', name: 'Block Overlay', cat: 'HUD', desc: 'Name and coordinates of the block you are looking at.' },
		{ id: 'hit-color', name: 'Hit Color', cat: 'HUD', desc: 'Crit particles on every hit you land.' },
		{ id: 'damage-indicator', name: 'Damage Indicator', cat: 'HUD', desc: 'How much health your last hit removed.' },
		{ id: 'arrow-counter', name: 'Arrow Counter', cat: 'HUD', desc: 'Total arrows of every kind in your inventory.' },
		{ id: 'fps-counter', name: 'FPS Counter', cat: 'HUD', desc: 'Frames per second.' },
		{ id: 'ping-display', name: 'Ping Display', cat: 'HUD', desc: 'Your latency on the current server.' },
		{ id: 'coordinates-display', name: 'Coordinates Display', cat: 'HUD', desc: 'Your X, Y and Z.' },
		{ id: 'direction-hud', name: 'Direction HUD', cat: 'HUD', desc: 'Facing direction and yaw in degrees.' },
		{ id: 'clock', name: 'Clock', cat: 'HUD', desc: 'Local time of day.' },
		{ id: 'stopwatch', name: 'Stopwatch', cat: 'HUD', desc: 'Start and stop with R.' },
		{ id: 'boss-bar', name: 'Boss Bar', cat: 'HUD', desc: 'The active boss and its health percentage as text.' },
		{ id: 'scoreboard-customizer', name: 'Scoreboard Customizer', cat: 'HUD', desc: 'Sidebar objective and your score.' },
		{ id: 'potion-effects-hud', name: 'Potion Effects HUD', cat: 'HUD', desc: 'Effects with amplifier levels.' },
		{ id: 'armor-durability-hud', name: 'Armor Durability HUD', cat: 'HUD', desc: 'Armour condition as a percentage per slot.' },
		{ id: 'item-counter', name: 'Item Counter', cat: 'HUD', desc: 'The item in your main hand and its stack size.' },
		{ id: 'memory-usage', name: 'Memory Usage Display', cat: 'HUD', desc: 'Used and available memory.' },
		{ id: 'biome-display', name: 'Biome Display', cat: 'HUD', desc: 'The biome you are standing in.' },
		{ id: 'speedometer', name: 'Speedometer', cat: 'HUD', desc: 'Blocks per second, smoothed.' },
		{ id: 'session-info', name: 'Session Information', cat: 'HUD', desc: 'How long this client session has been open.' },
		// Visual
		{ id: 'motion-blur', name: 'Motion Blur', cat: 'Visual', desc: 'Smooth camera transitions instead of snapping.' },
		{ id: 'zoom', name: 'Zoom', cat: 'Visual', desc: 'Hold V to zoom the field of view.' },
		{ id: 'fullbright', name: 'Fullbright', cat: 'Visual', desc: 'Toggle gamma with G to see in the dark.' },
		{ id: 'custom-skins', name: 'Custom Cosmetics', cat: 'Visual', desc: 'Hats, back items, pets and particle auras from your locker.' },
		{ id: 'custom-capes', name: 'Custom Capes', cat: 'Visual', desc: 'Cloth-simulated cape that folds and trails as you move.' },
		{ id: 'custom-wings', name: 'Custom Wings', cat: 'Visual', desc: 'Layered feather wings with a trailing flap.' },
		{ id: 'name-tag-customizer', name: 'Name Tag Customizer', cat: 'Visual', desc: 'Hides name plates above players.' },
		{ id: 'weather-changer', name: 'Weather Changer', cat: 'Visual', desc: 'Clears rain while it is enabled.' },
		{ id: 'time-changer', name: 'Time Changer', cat: 'Visual', desc: 'Pins the world to midday.' },
		{ id: 'particle-customizer', name: 'Particle Customizer', cat: 'Visual', desc: 'Thins out ambient particles.' },
		{ id: 'damage-particles', name: 'Damage Particles', cat: 'Visual', desc: 'Critical particles on hits you land.' },
		{ id: 'custom-crosshair-color', name: 'Custom Crosshair Color', cat: 'Visual', desc: 'Draws the crosshair in green instead of gold.' },
		{ id: 'block-animation', name: 'Block Animation', cat: 'Visual', desc: 'Suppresses block break particles.' },
		{ id: 'item-physics', name: 'Item Physics', cat: 'Visual', desc: 'Dropped items render flat on the ground.' },
		{ id: 'freelook', name: 'Freelook', cat: 'Visual', desc: 'Hold the left Alt key to look around without turning.' },
		// Utility
		{ id: 'auto-gg', name: 'Auto GG', cat: 'Utility', desc: 'Says gg when a match ends, at most once every five seconds.' },
		{ id: 'chat-translator', name: 'Chat Translator', cat: 'Utility', desc: 'Offline ES/FR/DE/PT/IT phrasebook appended after the original line.' },
		{ id: 'chat-timestamps', name: 'Chat Timestamps', cat: 'Utility', desc: 'Prefixes every chat line with the local time.' },
		{ id: 'auto-text', name: 'Auto Text', cat: 'Utility', desc: 'Press J to send a preset luck message.' },
		{ id: 'waypoints', name: 'Waypoints', cat: 'Utility', desc: 'Press N to drop a waypoint and see its distance.' },
		{ id: 'world-map', name: 'World Map', cat: 'Utility', desc: 'A 25 by 25 block top-down minimap of the surface.' },
		{ id: 'screenshot-manager', name: 'Screenshot Manager', cat: 'Utility', desc: 'Press Print Screen to grab and save a screenshot.' },
		{ id: 'replay-system', name: 'Replay System', cat: 'Utility', desc: 'Records your camera at 20 Hz; U records, P flies the run back.' },
		{ id: 'friend-system', name: 'Friend System', cat: 'Utility', desc: 'Press L on a player to track them, with online state.' },
		{ id: 'server-switcher', name: 'Server Switcher', cat: 'Utility', desc: 'Press O to jump to the multiplayer list.' },
		// Performance
		{ id: 'fps-optimizer', name: 'FPS Optimizer', cat: 'Performance', desc: 'Caps render distance at 8 and thins particles.' },
		{ id: 'entity-culling', name: 'Entity Culling', cat: 'Performance', desc: 'Skips entities further than 48 blocks away.' },
		{ id: 'particle-reducer', name: 'Particle Reducer', cat: 'Performance', desc: 'Drops half of all spawned particles.' },
		{ id: 'chunk-optimizer', name: 'Chunk Optimizer', cat: 'Performance', desc: 'Caps render distance at 6.' },
		{ id: 'animation-optimizer', name: 'Animation Optimizer', cat: 'Performance', desc: 'Turns off entity shadows.' }
	];

	var CATS = ['All', 'HUD', 'Visual', 'Utility', 'Performance'];

	var state = { cat: 'All', query: '' };

	var STYLE = [
		'.pm-wrap{padding:22px 22px 40px;max-width:1180px}',
		'.pm-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
		'.pm-title{font-size:19px;font-weight:600;color:#f2f4f7;letter-spacing:.2px}',
		'.pm-count{margin-left:auto;color:#8f949d;font-size:11px}',
		'.pm-sub{margin:8px 0 0;color:#8f949d;font-size:11.5px;line-height:1.6;max-width:780px}',
		'.pm-sub b{color:#e8c37a;font-weight:600}',
		'.pm-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:18px 0 14px}',
		'.pm-tab{padding:6px 12px;border:1px solid #292d35;border-radius:7px;background:#14171c;color:#a7adb6;font:inherit;font-size:11px;cursor:pointer}',
		'.pm-tab:hover{border-color:#3d434d;color:#eef1f5}',
		'.pm-tab.on{border-color:#8a6a22;background:#241d10;color:#f2c66a}',
		'.pm-search{margin-left:auto;min-width:200px;padding:7px 11px;border:1px solid #292d35;border-radius:7px;background:#101317;color:#e8ecf1;font:inherit;font-size:11.5px}',
		'.pm-search::placeholder{color:#666c76}',
		'.pm-search:focus{outline:none;border-color:#8a6a22}',
		'.pm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(268px,1fr));gap:10px}',
		'.pm-card{border:1px solid #24272e;border-radius:9px;background:linear-gradient(180deg,#171a20,#13161b);padding:13px 14px 14px}',
		'.pm-card:hover{border-color:#3a3f49}',
		'.pm-top{display:flex;align-items:center;gap:8px}',
		'.pm-name{font-size:12.5px;font-weight:600;color:#eef1f5}',
		'.pm-chip{margin-left:auto;padding:2px 7px;border-radius:999px;border:1px solid #2c313a;color:#8f949d;font-size:9px;letter-spacing:.06em;text-transform:uppercase}',
		'.pm-desc{margin:7px 0 0;color:#98a0aa;font-size:11px;line-height:1.55}',
		'.pm-built{margin-top:10px;display:flex;align-items:center;gap:6px;color:#6f9f7f;font-size:9.5px;letter-spacing:.05em;text-transform:uppercase}',
		'.pm-built i{width:5px;height:5px;border-radius:50%;background:#4fbf7b;display:inline-block}',
		'.pm-empty{padding:40px 0;color:#8f949d;font-size:12px;text-align:center}',
		'.pm-foot{margin-top:18px;padding-top:14px;border-top:1px solid #22252c;color:#6f757e;font-size:10.5px;line-height:1.7}'
	].join('\n');

	function esc(value) {
		return String(value).replace(/[&<>"']/g, function (ch) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
		});
	}

	function visible() {
		var needle = state.query.trim().toLowerCase();
		return MODS.filter(function (mod) {
			if (state.cat !== 'All' && mod.cat !== state.cat) return false;
			if (!needle) return true;
			return (mod.name + ' ' + mod.desc + ' ' + mod.cat).toLowerCase().indexOf(needle) !== -1;
		});
	}

	function cardHTML(mod) {
		return '<article class="pm-card">' +
			'<div class="pm-top"><span class="pm-name">' + esc(mod.name) + '</span>' +
			'<span class="pm-chip">' + esc(mod.cat) + '</span></div>' +
			'<p class="pm-desc">' + esc(mod.desc) + '</p>' +
			'<div class="pm-built"><i></i>Built in</div>' +
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
				'<div class="pm-head">' +
					'<span class="pm-title">Pretzel Mods</span>' +
					'<span class="pm-count mono">' + MODS.length + ' built in</span>' +
				'</div>' +
				'<p class="pm-sub">These mods ship inside the client itself &mdash; nothing to download, no jars. ' +
					'Fabric 1.21.11 is already part of the build, and each entry below is a native port of the ' +
					'idea rather than a loader plugin. <b>Toggle them in game:</b> title screen &rarr; the Mods ' +
					'icon in the bottom bar.</p>' +
				'<div class="pm-bar" id="pm-tabs">' +
					CATS.map(function (cat) {
						return '<button class="pm-tab' + (cat === state.cat ? ' on' : '') + '" data-cat="' + esc(cat) + '">' +
							esc(cat) + '</button>';
					}).join('') +
					'<input class="pm-search" id="pm-search" type="search" placeholder="Search mods..." value="' + esc(state.query) + '">' +
				'</div>' +
				'<div id="pm-grid">' + gridHTML() + '</div>' +
				'<p class="pm-foot">Every mod is toggled client-side and applies instantly; none of them require the ' +
					'server to have anything installed. Cosmetic models, the replay recorder and the chat phrasebook ' +
					'all run inside the browser build.</p>' +
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
	}

	window.PretzelMods = { mount: mount };
})();
