// Pretzel Client - cosmetics and emotes.
//
// A page in the launchpad with a live 3D character preview (the account's real
// skin, rendered from the skin service) and the cosmetic layers drawn on top, so
// equipping something shows immediately on the model. Equipped state is stored
// per account and is what the in-game cosmetics hook reads.
(function () {
	'use strict';

	var KEY = 'pretzel.cosmetics.v1';
	var ACCOUNTS = 'pretzel.accounts.v1';
	var SESSION = 'pretzel.session.v1';

	var CATALOG = [
		{ id: 'halo-gold', name: 'Golden Halo', slot: 'hat', tier: 'rare', color: '#f2b84b', ico: 'halo' },
		{ id: 'crown-pixel', name: 'Pixel Crown', slot: 'hat', tier: 'epic', color: '#ffd47a', ico: 'star' },
		{ id: 'cap-pretzel', name: 'Pretzel Cap', slot: 'hat', tier: 'common', color: '#c98a2b', ico: 'shirt' },
		{ id: 'wings-angel', name: 'Angel Wings', slot: 'wings', tier: 'epic', color: '#e8eef7', ico: 'wings' },
		{ id: 'wings-demon', name: 'Demon Wings', slot: 'wings', tier: 'epic', color: '#c0392b', ico: 'wings' },
		{ id: 'wings-pixel', name: 'Pixel Wings', slot: 'wings', tier: 'rare', color: '#4f9be0', ico: 'wings' },
		{ id: 'cape-pretzel', name: 'Pretzel Cape', slot: 'cape', tier: 'rare', color: '#f2b84b', ico: 'shirt' },
		{ id: 'cape-void', name: 'Void Cape', slot: 'cape', tier: 'epic', color: '#7a5ce0', ico: 'shirt' },
		{ id: 'cape-flame', name: 'Flame Cape', slot: 'cape', tier: 'legendary', color: '#e07a3f', ico: 'bolt' },
		{ id: 'aura-gold', name: 'Gold Aura', slot: 'aura', tier: 'legendary', color: '#ffd47a', ico: 'star' },
		{ id: 'aura-frost', name: 'Frost Aura', slot: 'aura', tier: 'rare', color: '#7fd6ff', ico: 'heart' },
		{ id: 'hat-party', name: 'Party Hat', slot: 'hat', tier: 'common', color: '#e05ca8', ico: 'star' }
	];

	var EMOTES = [
		{ id: 'wave', name: 'Wave', ico: 'person', color: '#f2b84b' },
		{ id: 'gg', name: 'GG', ico: 'check', color: '#38d47a' },
		{ id: 'heart', name: 'Heart', ico: 'heart', color: '#ff6b8b' },
		{ id: 'dance', name: 'Dance', ico: 'bolt', color: '#7a5ce0' },
		{ id: 'laugh', name: 'Laugh', ico: 'smile', color: '#f2c66a' },
		{ id: 'cry', name: 'Cry', ico: 'chat', color: '#7fd6ff' },
		{ id: 'flex', name: 'Flex', ico: 'star', color: '#e07a3f' },
		{ id: 'ggwp', name: 'Salute', ico: 'check', color: '#9aa4b1' }
	];

	var state = { tab: 'cosmetics', filter: 'all' };

	function ico(name, size, color) {
		return window.PretzelPixels ? window.PretzelPixels.svg(name, size || 16, color) : '';
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

	function accountName() {
		var session = read(SESSION, null);
		return session && session.username ? session.username : '';
	}

	function store() {
		var all = read(KEY, {}) || {};
		var key = (accountName() || 'local').toLowerCase();
		if (!all[key]) all[key] = { equipped: {}, emotes: [], owned: [] };
		return { all: all, key: key, mine: all[key] };
	}

	function equipped() {
		return store().mine.equipped || {};
	}

	function equippedEmotes() {
		return store().mine.emotes || [];
	}

	function equip(item) {
		var s = store();
		var current = s.mine.equipped || {};
		if (current[item.slot] === item.id) delete current[item.slot];
		else current[item.slot] = item.id;
		s.mine.equipped = current;
		if (s.mine.owned.indexOf(item.id) < 0) s.mine.owned.push(item.id);
		write(KEY, s.all);
		mount(document.getElementById('pretzel-cosmetics-root'));
	}

	function equipEmote(emote) {
		var s = store();
		var list = s.mine.emotes || [];
		var index = list.indexOf(emote.id);
		if (index >= 0) list.splice(index, 1);
		else if (list.length < 4) list.push(emote.id);
		else list[3] = emote.id;
		s.mine.emotes = list;
		write(KEY, s.all);
		mount(document.getElementById('pretzel-cosmetics-root'));
	}

	function layer(item) {
		if (!item) return '';
		if (item.slot === 'hat') {
			return '<span class="pzc-hat" style="--c:' + item.color + '"></span>';
		}
		if (item.slot === 'wings') {
			return '<span class="pzc-wings" style="--c:' + item.color + '">' + ico('wings', 78, item.color) + '</span>';
		}
		if (item.slot === 'cape') {
			return '<span class="pzc-cape" style="--c:' + item.color + '"></span>';
		}
		if (item.slot === 'aura') {
			return '<span class="pzc-aura" style="--c:' + item.color + '"></span>';
		}
		return '';
	}

	function style() {
		if (document.getElementById('px-cosmetics-style')) return;
		var css = '' +
			'.pzc{display:grid;grid-template-columns:300px 1fr;gap:10px;align-items:start}' +
			'@media (max-width:900px){.pzc{grid-template-columns:1fr}}' +
			'.pzc-card{background:#111419;border:2px solid #23272f;padding:10px;display:flex;flex-direction:column;gap:8px}' +
			'.pzc-stage{position:relative;height:320px;background:radial-gradient(circle at 50% 30%,#1c2230,#0a0c11 70%);border:2px solid #1f242c;overflow:hidden;display:grid;place-items:center}' +
			'.pzc-stage::after{content:"";position:absolute;left:0;right:0;bottom:0;height:36px;background:linear-gradient(180deg,transparent,rgba(0,0,0,.55))}' +
			'.pzc-model{position:relative;width:150px;height:290px;display:grid;place-items:end center;transform-style:preserve-3d;animation:pzcTurn 9s ease-in-out infinite}' +
			'@keyframes pzcTurn{0%,100%{transform:rotateY(-12deg)}50%{transform:rotateY(12deg)}}' +
			'.pzc-model img{position:relative;z-index:3;height:270px;image-rendering:pixelated;filter:drop-shadow(0 10px 14px rgba(0,0,0,.55))}' +
			'.pzc-model .pzc-steve{height:250px;width:110px;background:url("/launcher/assets/steve-head.png") center/contain no-repeat;image-rendering:pixelated}' +
			'.pzc-cape{position:absolute;z-index:2;left:50%;top:96px;width:64px;height:96px;margin-left:-32px;background:linear-gradient(180deg,var(--c),#101318);border:2px solid rgba(0,0,0,.5);transform:translateZ(-14px) skewX(-4deg)}' +
			'.pzc-wings{position:absolute;z-index:1;left:50%;top:92px;transform:translateX(-50%);opacity:.95;filter:drop-shadow(0 0 10px var(--c))}' +
			'.pzc-hat{position:absolute;z-index:4;left:50%;top:8px;width:54px;height:14px;margin-left:-27px;background:var(--c);border:2px solid #05060a;box-shadow:0 0 10px var(--c)}' +
			'.pzc-aura{position:absolute;z-index:0;inset:26px 6px 40px;border:2px dashed var(--c);opacity:.55;animation:pzcPulse 2.8s ease-in-out infinite}' +
			'@keyframes pzcPulse{0%,100%{opacity:.25}50%{opacity:.7}}' +
			'.pzc-name{font-family:"Pretzel Pixel",monospace;font-size:11px;text-align:center;color:#fff}' +
			'.pzc-status{font-family:"Pretzel Pixel",monospace;font-size:8px;text-align:center;color:#82c99b;letter-spacing:.04em}' +
			'.pzc-actions{display:grid;gap:6px}' +
			'.pzc-action{background:#151920;border:2px solid #2a2f38;color:#dfe5ee;font-family:"Pretzel Pixel",monospace;font-size:8px;padding:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px}' +
			'.pzc-action:hover{border-color:#3d434e}' +
			'.pzc-action.danger{border-color:#5a2a2a;color:#ff8a8a;justify-content:center}' +
			'.pzc-right{display:flex;flex-direction:column;gap:8px;min-width:0}' +
			'.pzc-tabs{display:flex;gap:6px}' +
			'.pzc-tab{background:#141821;border:2px solid #262b34;color:#9aa4b1;font-family:"Pretzel Pixel",monospace;font-size:8px;padding:7px 11px;cursor:pointer}' +
			'.pzc-tab.on{border-color:#8a6a22;background:#241d10;color:#f2c66a}' +
			'.pzc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(146px,1fr));gap:7px}' +
			'.pzc-item{background:#13161c;border:2px solid #24282f;padding:8px;display:flex;flex-direction:column;gap:6px;cursor:pointer}' +
			'.pzc-item:hover{border-color:#3a404b}' +
			'.pzc-item.on{border-color:#4b4022;background:#1b1810}' +
			'.pzc-item-top{display:flex;align-items:center;gap:7px;min-width:0}' +
			'.pzc-swatch{width:26px;height:26px;display:grid;place-items:center;border:2px solid #0a0c10;background:var(--c,#333)}' +
			'.pzc-item-name{font-family:"Pretzel Pixel",monospace;font-size:7.5px;color:#eef2f7;line-height:1.7;overflow:hidden}' +
			'.pzc-item-meta{font-size:9px;color:#79838f;display:flex;justify-content:space-between;gap:6px}' +
			'.pzc-item-meta b{font-weight:400;color:#b9c2cd;font-family:"Pretzel Pixel",monospace;font-size:7px}' +
			'.pzc-note{color:#6d7683;font-size:9.5px;line-height:1.6}' +
			'.pzc-slotbar{display:flex;gap:5px;flex-wrap:wrap}' +
			'.pzc-slot{background:#0f1217;border:2px solid #242833;color:#98a1ad;font-family:"Pretzel Pixel",monospace;font-size:7px;padding:5px 7px;cursor:pointer}' +
			'.pzc-slot.on{border-color:#5c4a1f;color:#f2c66a;background:#1c1810}';
		var node = document.createElement('style');
		node.id = 'px-cosmetics-style';
		node.textContent = css;
		document.head.appendChild(node);
	}

	function currentSkin(name) {
		var list = read(ACCOUNTS, []);
		var found = list.find(function (a) { return String(a.username).toLowerCase() === String(name).toLowerCase(); });
		return found && found.skin ? found.skin : '';
	}

	function preview() {
		var name = accountName();
		var skin = name ? currentSkin(name) : '';
		var body = skin
			? '<img src="' + esc(skin) + '" alt="" style="height:270px;width:auto;object-fit:contain">'
			: '<img src="https://mc-heads.net/body/' + encodeURIComponent(name || 'Steve') + '/180" alt="" onerror="this.onerror=null;this.parentElement.classList.add(\'no-skin\');this.remove()">';
		var eq = equipped();
		var byId = {};
		CATALOG.forEach(function (item) { byId[item.id] = item; });
		var layers = Object.keys(eq).map(function (slot) { return byId[eq[slot]]; }).filter(Boolean);

		return '<div class="pzc-stage"><div class="pzc-model">' +
			layers.map(layer).join('') + body +
		'</div></div>';
	}

	function cosmeticsTab() {
		var eq = equipped();
		var filters = [{ id: 'all', label: 'ALL' }, { id: 'hat', label: 'HATS' }, { id: 'wings', label: 'WINGS' }, { id: 'cape', label: 'CAPES' }, { id: 'aura', label: 'AURAS' }];
		var items = CATALOG.filter(function (item) { return state.filter === 'all' || item.slot === state.filter; });
		return '<div class="pzc-slotbar">' + filters.map(function (f) {
			return '<button class="pzc-slot' + (state.filter === f.id ? ' on' : '') + '" data-pzc="filter" data-value="' + f.id + '">' + f.label + '</button>';
		}).join('') + '</div>' +
		'<div class="pzc-grid">' + items.map(function (item) {
			var on = eq[item.slot] === item.id;
			return '<div class="pzc-item' + (on ? ' on' : '') + '" data-pzc="equip" data-id="' + item.id + '">' +
				'<div class="pzc-item-top"><span class="pzc-swatch" style="--c:' + item.color + '">' + ico(item.ico, 16, '#0a0c10') + '</span>' +
				'<span class="pzc-item-name">' + item.name + '</span></div>' +
				'<div class="pzc-item-meta"><span>' + item.slot.toUpperCase() + '</span><b>' + (on ? 'EQUIPPED' : item.tier.toUpperCase()) + '</b></div>' +
			'</div>';
		}).join('') + '</div>';
	}

	function emotesTab() {
		var chosen = equippedEmotes();
		return '<div class="pzc-grid">' + EMOTES.map(function (emote) {
			var index = chosen.indexOf(emote.id);
			return '<div class="pzc-item' + (index >= 0 ? ' on' : '') + '" data-pzc="emote" data-id="' + emote.id + '">' +
				'<div class="pzc-item-top"><span class="pzc-swatch" style="--c:' + emote.color + '">' + ico(emote.ico, 16, '#0a0c10') + '</span>' +
				'<span class="pzc-item-name">' + emote.name + '</span></div>' +
				'<div class="pzc-item-meta"><span>EMOTE</span><b>' + (index >= 0 ? 'SLOT ' + (index + 1) : 'ADD') + '</b></div>' +
			'</div>';
		}).join('') + '</div>' +
		'<p class="pzc-note">Four emotes fit the wheel (right shift opens it in game). Emotes chosen here are the ones the client shows.</p>';
	}

	function mount(root) {
		if (!root) return;
		style();
		var name = accountName();
		var eq = equipped();
		var count = Object.keys(eq).length;
		root.innerHTML = '<div class="page-head"><div><h1>Cosmetics</h1>' +
			'<p>' + (name ? esc(name) : 'Sign in') + ' &middot; ' + count + ' equipped &middot; ' + equippedEmotes().length + '/4 emotes</p></div></div>' +
			'<div class="pzc">' +
				'<div class="pzc-card">' + preview() +
					'<div class="pzc-name">' + esc(name || 'Steve') + '</div>' +
					'<div class="pzc-status">' + (name ? 'SIGNED IN &middot; 3D PREVIEW' : 'NOT SIGNED IN') + '</div>' +
					'<div class="pzc-actions">' +
						'<button class="pzc-action" data-pzc="profile">' + ico('shirt', 12) + ' Edit Profile</button>' +
						'<button class="pzc-action" data-pzc="store">' + ico('coin', 12) + ' Cosmetics Store</button>' +
						'<button class="pzc-action danger" data-pzc="clear">' + ico('trash', 12) + ' Unequip all</button>' +
					'</div>' +
				'</div>' +
				'<div class="pzc-right">' +
					'<div class="pzc-tabs">' +
						'<button class="pzc-tab' + (state.tab === 'cosmetics' ? ' on' : '') + '" data-pzc="tab" data-value="cosmetics">COSMETICS</button>' +
						'<button class="pzc-tab' + (state.tab === 'emotes' ? ' on' : '') + '" data-pzc="tab" data-value="emotes">EMOTES</button>' +
					'</div>' +
					(state.tab === 'emotes' ? emotesTab() : cosmeticsTab()) +
					'<p class="pzc-note">Everything here is drawn on the preview immediately and saved to this account. ' +
						'The in-game model reads the same equipped list.</p>' +
				'</div>' +
			'</div>';
	}

	function wire() {
		document.addEventListener('click', function (event) {
			var el = event.target.closest('[data-pzc]');
			if (!el) return;
			var act = el.getAttribute('data-pzc');
			if (act === 'equip') {
				var item = CATALOG.find(function (i) { return i.id === el.getAttribute('data-id'); });
				if (item) equip(item);
				return;
			}
			if (act === 'emote') {
				var emote = EMOTES.find(function (i) { return i.id === el.getAttribute('data-id'); });
				if (emote) equipEmote(emote);
				return;
			}
			if (act === 'tab') { state.tab = el.getAttribute('data-value'); mount(document.getElementById('pretzel-cosmetics-root')); return; }
			if (act === 'filter') { state.filter = el.getAttribute('data-value'); mount(document.getElementById('pretzel-cosmetics-root')); return; }
			if (act === 'clear') {
				var s = store();
				s.mine.equipped = {};
				write(KEY, s.all);
				mount(document.getElementById('pretzel-cosmetics-root'));
				return;
			}
			if (act === 'profile') {
				var chip = document.getElementById('accountChip');
				if (chip) chip.click();
				return;
			}
			if (act === 'store') {
				window.location.hash = '#cosmetics';
				var store = document.querySelector('[data-action="nav:store"]');
				if (store) store.click();
			}
		});
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
	else wire();

	window.PretzelCosmetics = { mount: mount, equipped: equipped, catalog: CATALOG, emotes: EMOTES };
})();
