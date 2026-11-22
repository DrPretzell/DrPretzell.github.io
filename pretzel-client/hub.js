// Pretzel Client - in-game hub (Right Shift).
//
// Three boxes over the running game: this build and the mods installed for the
// account, the friends/chat drawer, and the emote wheel. The chat box opens the
// exact same drawer the launchpad uses (messages.js), so conversations, blocks,
// mutes and history are one set of data.
(function () {
	'use strict';

	var EMOTE_KEY = 'pretzel.emotes.v1';
	var EMOTE_LEGACY = 'pretzel.cosmetics.v1';
	var SESSION = 'pretzel.session.v1';
	var ACCOUNTS = 'pretzel.accounts.v1';
	var CHAT = 'pretzel.chat.v1';

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

	var BUILD = [
		{ name: 'Minecraft 1.21.11', note: 'TeaVM runtime' },
		{ name: 'Multiplayer', note: 'WebSocket transport' },
		{ name: 'Launcher join', note: 'address + name handoff' },
		{ name: 'Mod storage', note: 'per-account, Modrinth' },
		{ name: 'Friends & chat', note: 'shared with launchpad' },
		{ name: 'Emotes', note: 'Pretzel emotes' }
	];

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
		try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full */ }
	}

	function accountName() {
		var session = read(SESSION, null);
		if (session && session.username) return String(session.username);
		if (typeof session === 'string' && session) return session;
		return '';
	}

	function account() {
		var name = accountName().toLowerCase();
		if (!name) return null;
		var list = read(ACCOUNTS, []);
		return (Array.isArray(list) ? list : []).find(function (a) {
			return String(a.username || '').toLowerCase() === name;
		}) || null;
	}

	function friends() {
		var acc = account();
		return acc && Array.isArray(acc.friends) ? acc.friends : [];
	}

	function installedMods() {
		return window.PretzelModStorage ? window.PretzelModStorage.list() : [];
	}

	function human(bytes) {
		var value = Number(bytes) || 0;
		if (value >= 1048576) return (value / 1048576).toFixed(1) + ' MB';
		if (value >= 1024) return Math.round(value / 1024) + ' KB';
		return value + ' B';
	}

	function emoteStore() {
		var all = read(EMOTE_KEY, null);
		if (!all) all = read(EMOTE_LEGACY, {}) || {};
		all = all || {};
		var key = (accountName() || 'local').toLowerCase();
		if (!all[key]) all[key] = { equipped: {}, emotes: [], owned: [] };
		return { all: all, mine: all[key] };
	}

	function activeEmotes() {
		return emoteStore().mine.emotes || [];
	}

	function toggleEmote(emote) {
		var s = emoteStore();
		var list = s.mine.emotes || [];
		var index = list.indexOf(emote.id);
		if (index >= 0) list.splice(index, 1);
		else if (list.length < 4) list.push(emote.id);
		else list[3] = emote.id;
		s.mine.emotes = list;
		write(EMOTE_KEY, s.all);
		render();
		playEmote(emote);
	}

	function conversations() {
		var map = read(CHAT, {}) || {};
		return Object.keys(map).filter(function (key) {
			return map[key] && Array.isArray(map[key].messages) && map[key].messages.length;
		}).length;
	}

	// ------------------------------------------------------------------ style

	function style() {
		if (document.getElementById('pzh-style')) return;
		var css =
			'#pzh-root{position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;' +
				'background:rgba(4,4,6,.82);padding:3vmin;box-sizing:border-box;font-family:"PretzelPixel",ui-monospace,monospace}' +
			'#pzh-root.on{display:flex}' +
			'#pzh-root.on .pzh-panel{animation:pzh-in .16s steps(3,end) both}' +
			'@keyframes pzh-in{from{transform:translateY(10px) scale(.985);opacity:.4}to{transform:none;opacity:1}}' +
			'#pzh-root *{box-sizing:border-box}' +
			'.pzh-panel{width:min(1060px,96vw);max-height:92vh;display:flex;flex-direction:column;background:#0b0b0d;' +
				'border:2px solid #f2b84b;box-shadow:0 0 0 2px #000,0 18px 60px rgba(0,0,0,.8);image-rendering:pixelated}' +
			'.pzh-head{display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f2b84b;color:#120d02;' +
				'border-bottom:2px solid #000;font-size:12px;letter-spacing:.08em;text-transform:uppercase}' +
			'.pzh-head .sp{flex:1}' +
			'.pzh-head b{font-weight:400}' +
			'.pzh-key{border:2px solid #120d02;padding:2px 6px;font-size:9px;background:#120d02;color:#f2b84b}' +
			'.pzh-x{border:2px solid #120d02;background:transparent;color:#120d02;width:22px;height:22px;line-height:1;' +
				'font:inherit;font-size:11px;cursor:pointer}' +
			'.pzh-x:hover{background:#120d02;color:#f2b84b}' +
			'.pzh-cols{display:grid;grid-template-columns:1.1fr 1.05fr 1fr;gap:10px;padding:10px;overflow:auto}' +
			'@media (max-width:860px){.pzh-cols{grid-template-columns:1fr}}' +
			'.pzh-box{border:2px solid #26262c;background:#101014;display:flex;flex-direction:column;min-height:0}' +
			'.pzh-box.mid{border-color:#f2b84b}' +
			'.pzh-box-head{display:flex;align-items:center;gap:7px;padding:8px 10px;border-bottom:2px solid #26262c;' +
				'font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#f2b84b;background:#15151a}' +
			'.pzh-box.mid .pzh-box-head{border-bottom-color:#5a4620}' +
			'.pzh-box-head .sp{flex:1}' +
			'.pzh-box-head em{font-style:normal;color:#8d8d99;font-size:9px}' +
			'.pzh-body{padding:9px;overflow:auto;display:flex;flex-direction:column;gap:7px;max-height:56vh}' +
			'.pzh-row{display:flex;align-items:center;gap:8px;padding:7px;border:2px solid #202027;background:#15151a;' +
				'font-size:9.5px;color:#d8d8e2;cursor:default}' +
			'.pzh-row.press{cursor:pointer}' +
			'.pzh-row.press:hover{border-color:#7a6330}' +
			'.pzh-row .n{flex:1;line-height:1.45;min-width:0}' +
			'.pzh-row .n small{display:block;color:#7e7e8c;font-size:8.5px;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
			'.pzh-sub{font-size:8.5px;letter-spacing:.12em;color:#6f6f7d;text-transform:uppercase;margin-top:2px}' +
			'.pzh-empty{border:2px dashed #2a2a33;padding:10px;color:#7e7e8c;font-size:8.5px;line-height:1.8;letter-spacing:.03em}' +
			'.pzh-emotes{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}' +
			'.pzh-emote{border:2px solid #2a2a33;background:#15151a;padding:8px 3px;display:flex;flex-direction:column;' +
				'align-items:center;gap:5px;cursor:pointer;font-size:7.5px;letter-spacing:.06em;color:#b9b9c6;text-transform:uppercase}' +
			'.pzh-emote:hover{border-color:#7a6330;color:#f2b84b}' +
			'.pzh-emote.on{border-color:#f2b84b;background:#2a2109;color:#f2b84b}' +
			'.pzh-go{border:2px solid #f2b84b;background:transparent;color:#f2b84b;font:inherit;font-size:9px;' +
				'letter-spacing:.1em;padding:8px;cursor:pointer;text-transform:uppercase;width:100%}' +
			'.pzh-go:hover{background:#f2b84b;color:#120d02}' +
			'.pzh-go.ghost{border-color:#3a3a46;color:#c9c9d6}' +
			'.pzh-go.ghost:hover{background:#1b1b22;color:#fff}' +
			'.pzh-note{font-size:8px;color:#6a6a78;line-height:1.6;letter-spacing:.03em;margin:0}' +
			'.pzh-foot{display:flex;align-items:center;gap:8px;padding:8px 11px;border-top:2px solid #26262c;background:#0d0d11;' +
				'font-size:8px;letter-spacing:.08em;color:#777784;text-transform:uppercase}' +
			'.pzh-foot .sp{flex:1}' +
			'#pzh-pill{position:fixed;right:12px;bottom:12px;z-index:40;display:none;gap:5px;align-items:center;border:2px solid #f2b84b;' +
				'background:#0b0b0dcc;color:#f2b84b;font:inherit;font-size:9px;letter-spacing:.1em;padding:7px 10px;cursor:pointer;' +
				'font-family:"PretzelPixel",ui-monospace,monospace}' +
			'body.playing #pzh-pill{display:inline-flex}' +
			'#pzh-pill:hover{background:#f2b84b;color:#120d02}' +
			'#pzh-toast{position:fixed;left:50%;bottom:64px;transform:translateX(-50%);z-index:70;padding:8px 13px;' +
				'border:2px solid #f2b84b;background:#0b0b0dee;color:#f2b84b;font:inherit;font-size:9px;letter-spacing:.1em;' +
				'opacity:0;transition:opacity .18s;pointer-events:none;font-family:"PretzelPixel",ui-monospace,monospace}' +
			'#pzh-toast.on{opacity:1}' +
			'#pzh-emote-flash{position:fixed;inset:0;z-index:65;display:none;align-items:center;justify-content:center;pointer-events:none}' +
			'#pzh-emote-flash.on{display:flex}' +
			'#pzh-emote-flash .burst{display:flex;flex-direction:column;align-items:center;gap:9px;padding:20px 28px;' +
				'border:3px solid #f2b84b;background:#0b0b0dee;color:#f2b84b;font-size:13px;letter-spacing:.1em;' +
				'animation:pzh-pop .34s steps(3) both,pzh-fade 1.4s ease-in 1s forwards;font-family:"PretzelPixel",ui-monospace,monospace}' +
			'@keyframes pzh-pop{from{transform:scale(.6)}to{transform:scale(1)}}' +
			'@keyframes pzh-fade{to{opacity:0;transform:scale(1.06)}}';
		var tag = document.createElement('style');
		tag.id = 'pzh-style';
		tag.textContent = css;
		document.head.appendChild(tag);

		if (!document.getElementById('pzh-font')) {
			var font = document.createElement('style');
			font.id = 'pzh-font';
			font.textContent = '@font-face{font-family:"PretzelPixel";src:url("/launcher/assets/fonts/press-start-2p.woff2") format("woff2");font-display:swap}';
			document.head.appendChild(font);
		}
	}

	// ----------------------------------------------------------------- markup

	function buildHTML() {
		var mods = installedMods();
		var total = mods.reduce(function (sum, item) { return sum + (Number(item.size) || 0); }, 0);
		return '<div class="pzh-box"><div class="pzh-box-head">' + ico('cube', 12) +
			'<b>Build &amp; Mods</b><span class="sp"></span><em>' + mods.length + ' INSTALLED</em></div>' +
			'<div class="pzh-body">' +
				'<div class="pzh-sub">This client build</div>' +
				BUILD.map(function (item) {
					return '<div class="pzh-row">' + ico('check', 11, '#4fdc82') +
						'<span class="n">' + esc(item.name) + '<small>' + esc(item.note) + '</small></span></div>';
				}).join('') +
				'<div class="pzh-sub">Your account storage' + (total ? ' \u00b7 ' + human(total) : '') + '</div>' +
				(mods.length
					? mods.slice(0, 14).map(function (item) {
						return '<div class="pzh-row">' + ico('cube', 11, item.enabled === false ? '#666c76' : '#f2b84b') +
							'<span class="n">' + esc(item.title) + '<small>' + esc(item.version) + ' \u00b7 ' +
							human(item.size) + (item.enabled === false ? ' \u00b7 disabled' : '') + '</small></span></div>';
					}).join('')
					: '<div class="pzh-empty">No mods installed. Open Mods in the launchpad, press INSTALL and the file lands in this account\'s storage.</div>') +
				'<button class="pzh-go" data-pzh="mods">Open Modrinth mods page</button>' +
				'<p class="pzh-note">Files are stored per account in the browser. A Java jar cannot execute inside the browser runtime, so it stays stored and linked.</p>' +
			'</div></div>';
	}

	function chatHTML() {
		var list = friends();
		var online = list.filter(function (f) { return f.state === 'online'; }).length;
		var threads = conversations();
		return '<div class="pzh-box mid"><div class="pzh-box-head">' + ico('chat', 12) +
			'<b>Friends &amp; Chat</b><span class="sp"></span><em>' + online + '/' + list.length + '</em></div>' +
			'<div class="pzh-body">' +
				'<button class="pzh-go" data-pzh="messages">Open messages' + (threads ? ' \u00b7 ' + threads : '') + '</button>' +
				'<button class="pzh-go ghost" data-pzh="friends">Friends drawer</button>' +
				(list.length
					? '<div class="pzh-sub">Friends</div>' + list.slice(0, 8).map(function (person) {
						return '<div class="pzh-row press" data-pzh="chat" data-name="' + esc(person.name) + '">' +
							ico('person', 11, person.state === 'online' ? '#4fdc82' : '#7e7e8c') +
							'<span class="n">' + esc(person.name) +
							'<small>' + (person.state === 'online' ? 'online' : 'offline') +
							(person.muted ? ' \u00b7 muted' : '') + (person.blocked ? ' \u00b7 blocked' : '') + '</small></span>' +
							ico('chat', 12, '#8d8d99') + '</div>';
					}).join('')
					: '<div class="pzh-empty">No friends yet. Add them from the launchpad friends drawer and they show up here with the same chat history.</div>') +
				'<p class="pzh-note">Same drawer as the launchpad: block, mute and the emoji picker live in the chat header.</p>' +
			'</div></div>';
	}

	function emotesHTML() {
		var active = activeEmotes();
		return '<div class="pzh-box"><div class="pzh-box-head">' + ico('smile', 12) +
			'<b>Emotes</b><span class="sp"></span><em>' + active.length + '/4</em></div>' +
			'<div class="pzh-body">' +
				'<div class="pzh-emotes">' + EMOTES.map(function (emote) {
					return '<button class="pzh-emote' + (active.indexOf(emote.id) >= 0 ? ' on' : '') + '"' +
						' data-pzh="emote" data-id="' + esc(emote.id) + '">' + ico(emote.ico, 16, emote.color) +
						'<span>' + esc(emote.name) + '</span></button>';
				}).join('') + '</div>' +
				'<p class="pzh-note">Tap up to four for the wheel. Clicking plays the emote over the game; the player model animation needs an in-game hook.</p>' +
			'</div></div>';
	}

	function render() {
		var root = document.getElementById('pzh-root');
		if (!root) return;
		root.innerHTML = '<div class="pzh-panel" role="dialog" aria-label="Pretzel client hub">' +
			'<div class="pzh-head">' + ico('star', 13, '#120d02') + '<b>Pretzel Hub</b><span class="sp"></span>' +
				'<span class="pzh-key">RIGHT SHIFT</span><button class="pzh-x" data-pzh="close" aria-label="Close">&times;</button></div>' +
			'<div class="pzh-cols">' + buildHTML() + chatHTML() + emotesHTML() + '</div>' +
			'<div class="pzh-foot">' + ico('person', 9) + '<span>' + esc(accountName() || 'local profile') + '</span>' +
				'<span class="sp"></span><span>ESC closes</span></div>' +
			'</div>';
	}

	// --------------------------------------------------------------- behaviour

	function isPlaying() {
		return document.body.classList.contains('playing');
	}

	var lastFocus = null;

	function focusables() {
		var root = document.getElementById('pzh-root');
		if (!root) return [];
		return Array.prototype.slice.call(root.querySelectorAll('button, a[href], input'))
			.filter(function (el) { return !el.disabled && el.offsetParent !== null; });
	}

	function open() {
		var root = document.getElementById('pzh-root');
		if (!root) return;
		lastFocus = document.activeElement;
		render();
		root.classList.add('on');
		if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
		var first = focusables()[0];
		if (first) first.focus();
	}

	function close() {
		var root = document.getElementById('pzh-root');
		if (root) root.classList.remove('on');
		if (lastFocus && lastFocus.focus) {
			try { lastFocus.focus(); } catch (e) { /* element gone */ }
		}
		lastFocus = null;
		var canvas = document.getElementById('gameCanvas');
		if (canvas && isPlaying() && canvas.requestPointerLock) {
			try { canvas.requestPointerLock(); } catch (e) { /* not allowed here */ }
		}
	}

	var lastToggle = 0;

	function toggle() {
		var root = document.getElementById('pzh-root');
		if (!root) return;
		// A click that lands twice in the same beat (pointer-lock release emits a
		// second one) must not open and instantly close the hub.
		var now = Date.now();
		if (now - lastToggle < 300) return;
		lastToggle = now;
		if (root.classList.contains('on')) close();
		else open();
	}

	var toastTimer = null;
	function flashToast(text) {
		var el = document.getElementById('pzh-toast');
		if (!el) return;
		el.textContent = text;
		el.classList.add('on');
		clearTimeout(toastTimer);
		toastTimer = setTimeout(function () { el.classList.remove('on'); }, 1400);
	}

	function playEmote(emote) {
		var flash = document.getElementById('pzh-emote-flash');
		if (!flash) return;
		flash.innerHTML = '<div class="burst">' + ico(emote.ico, 46, emote.color) + esc(emote.name.toUpperCase()) + '</div>';
		flash.classList.remove('on');
		void flash.offsetWidth;
		flash.classList.add('on');
		setTimeout(function () { flash.classList.remove('on'); }, 2200);
	}

	function wire() {
		if (window.__pzhWired) return;
		window.__pzhWired = true;
		style();

		var root = document.createElement('div');
		root.id = 'pzh-root';
		document.body.appendChild(root);

		var pill = document.createElement('button');
		pill.id = 'pzh-pill';
		pill.type = 'button';
		pill.innerHTML = ico('star', 10) + ' HUB';
		pill.addEventListener('click', toggle);
		document.body.appendChild(pill);

		var toast = document.createElement('div');
		toast.id = 'pzh-toast';
		document.body.appendChild(toast);

		var flash = document.createElement('div');
		flash.id = 'pzh-emote-flash';
		document.body.appendChild(flash);

		root.addEventListener('click', function (event) {
			if (event.target.closest('[data-pzh="close"]') || event.target === root) { close(); return; }

			var button = event.target.closest('[data-pzh]');
			if (!button) return;
			var action = button.getAttribute('data-pzh');
			var id = button.getAttribute('data-id');

			if (action === 'emote') {
				var emote = EMOTES.filter(function (e) { return e.id === id; })[0];
				if (emote) toggleEmote(emote);
				return;
			}
			if (action === 'mods') { window.location.href = '/launcher/#mods'; return; }
			if (action === 'messages' || action === 'friends') {
				close();
				if (window.PretzelMessages) window.PretzelMessages.open(action === 'friends' ? 'friends' : 'messages');
				return;
			}
			if (action === 'chat') {
				var name = button.getAttribute('data-name');
				close();
				if (window.PretzelMessages && name) window.PretzelMessages.chat(name);
			}
		});

		function moveFocus(step) {
			var list = focusables();
			if (!list.length) return;
			var index = list.indexOf(document.activeElement);
			if (index < 0) index = step > 0 ? -1 : 0;
			var next = (index + step + list.length) % list.length;
			list[next].focus();
		}

		// Right Shift is the hub key while a world or server is loaded, and the
		// event is consumed so the game does not read it as sneak. While the hub
		// is open the game gets no keys at all, so the player never walks off.
		window.addEventListener('keydown', function (event) {
			var open = root.classList.contains('on');
			if (event.code === 'ShiftRight' && (isPlaying() || open)) {
				event.preventDefault();
				event.stopPropagation();
				if (!event.repeat) toggle();
				return;
			}
			if (!open) return;
			if (event.key === 'Escape') {
				event.preventDefault();
				event.stopPropagation();
				close();
				return;
			}
			if (event.key === 'Tab') {
				event.preventDefault();
				event.stopPropagation();
				moveFocus(event.shiftKey ? -1 : 1);
				return;
			}
			if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
				event.preventDefault();
				event.stopPropagation();
				moveFocus(1);
				return;
			}
			if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
				event.preventDefault();
				event.stopPropagation();
				moveFocus(-1);
				return;
			}
			event.stopPropagation();
		}, true);

		window.addEventListener('keyup', function (event) {
			if (event.code === 'ShiftRight' && (isPlaying() || root.classList.contains('on'))) {
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			if (root.classList.contains('on')) event.stopPropagation();
		}, true);

		window.PretzelHub = { open: open, close: close, toggle: toggle, emotes: EMOTES };
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
	else wire();
})();
