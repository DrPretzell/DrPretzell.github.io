// Pretzel Client - account and settings sheet.
//
// The reference screen: skin card on the left, privacy / social / account rows on
// the right, every row a real toggle that is saved per account. Sign out and
// delete account act on the same localStorage account store the launcher uses, so
// they actually sign you out / remove the account instead of just closing.
(function () {
	'use strict';

	var KEY = 'pretzel.settings.v1';
	var ACCOUNTS = 'pretzel.accounts.v1';
	var SESSION = 'pretzel.session.v1';

	var DEFAULTS = {
		messages: 'friends',
		queue: 'off',
		duels: true,
		parties: true,
		trades: 'friends',
		discord: true
	};

	var TABS = {
		messages: ['friends', 'anyone'],
		queue: ['off', 'partial', 'full'],
		trades: ['off', 'friends', 'anyone']
	};

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

	function session() {
		return read(SESSION, null);
	}

	function account() {
		var s = session();
		if (!s || !s.username) return null;
		return read(ACCOUNTS, []).find(function (a) {
			return String(a.username).toLowerCase() === String(s.username).toLowerCase();
		}) || null;
	}

	function settings() {
		var all = read(KEY, {}) || {};
		var name = (session() && session().username || 'local').toLowerCase();
		if (!all[name]) all[name] = Object.assign({}, DEFAULTS);
		return { all: all, key: name, mine: all[name] };
	}

	function set(key, value) {
		var s = settings();
		s.mine[key] = value;
		write(KEY, s.all);
		render();
	}

	function since(acc) {
		var at = acc && acc.createdAt ? new Date(acc.createdAt) : null;
		if (!at || isNaN(at.getTime())) return '';
		return at.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
	}

	function style() {
		if (document.getElementById('px-settings-style')) return;
		var css = '' +
			'.px-set{position:fixed;inset:0;z-index:78;display:grid;place-items:center;background:rgba(3,4,7,.74);padding:16px}' +
			'.px-set-card{width:min(880px,97vw);max-height:92vh;overflow:auto;background:#12151a;border:2px solid #2b303a;box-shadow:6px 6px 0 #000;color:#e9edf3;display:grid;grid-template-columns:250px 1fr}' +
			'@media (max-width:820px){.px-set-card{grid-template-columns:1fr}}' +
			'.px-set-left{border-right:2px solid #22262e;padding:12px;display:flex;flex-direction:column;gap:8px}' +
			'.px-set-model{height:230px;background:radial-gradient(circle at 50% 32%,#1d2330,#0a0c11 72%);border:2px solid #1f242c;display:grid;place-items:center;overflow:hidden}' +
			'.px-set-model img{height:210px;image-rendering:pixelated;filter:drop-shadow(0 8px 12px rgba(0,0,0,.6))}' +
			'.px-set-name{font-family:"Pretzel Pixel",monospace;font-size:10px;text-align:center;color:#fff}' +
			'.px-set-sub{font-family:"Pretzel Pixel",monospace;font-size:7.5px;text-align:center;color:#82c99b;letter-spacing:.03em}' +
			'.px-set-since{font-family:"Pretzel Pixel",monospace;font-size:7px;text-align:center;color:#6d7683}' +
			'.px-set-btn{background:#151920;border:2px solid #2a2f38;color:#dfe5ee;font-family:"Pretzel Pixel",monospace;font-size:7.5px;padding:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}' +
			'.px-set-btn:hover{border-color:#3d434e}' +
			'.px-set-btn.danger{border-color:#5a2a2a;color:#ff8a8a}' +
			'.px-set-right{padding:12px 14px;display:flex;flex-direction:column;gap:10px;min-width:0}' +
			'.px-set-head{display:flex;align-items:center;gap:8px}' +
			'.px-set-head h3{margin:0;font-family:"Pretzel Pixel",monospace;font-size:11px;color:#fff}' +
			'.px-set-x{margin-left:auto;background:none;border:2px solid transparent;color:#98a1ad;cursor:pointer;padding:2px 5px}' +
			'.px-set-x:hover{border-color:#2f3540;color:#fff}' +
			'.px-set-group{display:flex;align-items:center;gap:8px;font-family:"Pretzel Pixel",monospace;font-size:7.5px;color:#6d7683;letter-spacing:.08em;margin-top:2px}' +
			'.px-set-group::after{content:"";flex:1;height:2px;background:#1e232b}' +
			'.px-set-row{display:flex;align-items:center;gap:8px;min-height:30px}' +
			'.px-set-row .label{display:flex;align-items:center;gap:7px;font-size:10.5px;color:#cdd5df;min-width:0}' +
			'.px-set-row .label span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
			'.px-seg{margin-left:auto;display:flex;gap:3px}' +
			'.px-seg button{background:#141821;border:2px solid #262b34;color:#8f99a6;font-family:"Pretzel Pixel",monospace;font-size:7px;padding:5px 8px;cursor:pointer;text-transform:uppercase}' +
			'.px-seg button.on{border-color:#f2b84b;background:#f2b84b;color:#1a1305}' +
			'.px-set-foot{display:flex;align-items:center;gap:8px;margin-left:auto}' +
			'.px-done{background:#241d10;border:2px solid #8a6a22;color:#f2c66a;font-family:"Pretzel Pixel",monospace;font-size:8px;padding:8px 14px;cursor:pointer}' +
			'.px-done:hover{background:#2e2513}';
		var node = document.createElement('style');
		node.id = 'px-settings-style';
		node.textContent = css;
		document.head.appendChild(node);
	}

	function seg(key) {
		var value = settings().mine[key];
		return '<span class="px-seg">' + TABS[key].map(function (option) {
			return '<button class="' + (value === option ? 'on' : '') + '" data-set="' + key + '" data-value="' + option + '">' + option + '</button>';
		}).join('') + '</span>';
	}

	function toggle(key, label) {
		var value = Boolean(settings().mine[key]);
		return '<span class="px-seg"><button class="' + (value ? 'on' : '') + '" data-set="' + key + '" data-value="' + (value ? 'off' : 'on') + '">' + (value ? 'on' : 'off') + '</button></span>';
	}

	function socials() {
		return window.PretzelSocials ? window.PretzelSocials.mine() : {};
	}

	function body() {
		var acc = account();
		var name = acc ? acc.username : '';
		var skin = acc && acc.skin ? acc.skin : '';
		var discord = socials().discord;

		if (!acc) {
			return '<div class="px-set-card" style="grid-template-columns:1fr">' +
				'<div class="px-set-right"><div class="px-set-head">' + ico('person', 16, '#f2b84b') +
					'<h3>Account</h3><button class="px-set-x" data-set="close">' + ico('close', 13) + '</button></div>' +
					'<p class="px-alt" style="color:#8f99a6;font-size:10.5px">Sign in from the account chip to open your settings, privacy and account actions.</p>' +
					'<div class="px-set-foot"><button class="px-done" data-set="login">Login</button></div>' +
				'</div></div>';
		}

		return '<div class="px-set-card">' +
			'<div class="px-set-left">' +
				'<div class="px-set-model">' + (skin
					? '<img src="' + esc(skin) + '" alt="">'
					: '<img src="https://mc-heads.net/body/' + encodeURIComponent(name) + '/180" alt="" onerror="this.onerror=null;this.remove()">') + '</div>' +
				'<div class="px-set-name">' + esc(name) + '</div>' +
				'<div class="px-set-sub">SIGNED IN</div>' +
				(since(acc) ? '<div class="px-set-since">SINCE ' + since(acc) + '</div>' : '') +
				'<button class="px-set-btn" data-set="profile">' + ico('shirt', 11) + ' Edit Profile</button>' +
				'<button class="px-set-btn danger" data-set="delete">' + ico('trash', 11) + ' Delete account</button>' +
			'</div>' +
			'<div class="px-set-right">' +
				'<div class="px-set-head">' + ico('gear', 15, '#f2b84b') + '<h3>Settings</h3>' +
					'<button class="px-set-x" data-set="close" aria-label="Close">' + ico('close', 13) + '</button></div>' +
				'<div class="px-set-group">PRIVACY</div>' +
				'<div class="px-set-row"><span class="label">' + ico('chat', 13, '#8f99a6') + '<span>Messages</span></span>' + seg('messages') + '</div>' +
				'<div class="px-set-row"><span class="label">' + ico('people', 13, '#8f99a6') + '<span>Anonymous queue</span></span>' + seg('queue') + '</div>' +
				'<div class="px-set-group">SOCIAL</div>' +
				'<div class="px-set-row"><span class="label">' + ico('x', 13, '#8f99a6') + '<span>Duel requests</span></span>' + toggle('duels') + '</div>' +
				'<div class="px-set-row"><span class="label">' + ico('people', 13, '#8f99a6') + '<span>Party invites</span></span>' + toggle('parties') + '</div>' +
				'<div class="px-set-row"><span class="label">' + ico('coin', 13, '#8f99a6') + '<span>Trade requests</span></span>' + seg('trades') + '</div>' +
				'<div class="px-set-group">ACCOUNT</div>' +
				'<div class="px-set-row"><span class="label">' + ico('lock', 13, '#8f99a6') + '<span>Password</span></span>' +
					'<span class="px-seg"><button data-set="password">Change</button></span></div>' +
				'<div class="px-set-row"><span class="label">' + ico('discord', 13, '#8f99a6') + '<span>Discord</span></span>' +
					'<span class="px-seg"><button data-set="discord">' + (discord ? 'Unlink' : 'Link') + '</button></span></div>' +
				'<div class="px-set-row"><span class="label">' + ico('bolt', 13, '#8f99a6') + '<span>Sign out</span></span>' +
					'<span class="px-seg"><button data-set="signout">Here</button><button data-set="signout-all">Everywhere</button></span></div>' +
				'<div class="px-set-foot"><button class="px-done" data-set="close">Done</button></div>' +
			'</div>' +
		'</div>';
	}

	function render() {
		var root = document.getElementById('px-settings-root');
		if (!root) return;
		if (!root.dataset.open) { root.innerHTML = ''; return; }
		root.innerHTML = '<div class="px-set" data-set="close">' + body() + '</div>';
	}

	function open() {
		style();
		var root = document.getElementById('px-settings-root');
		if (!root) {
			root = document.createElement('div');
			root.id = 'px-settings-root';
			document.body.appendChild(root);
		}
		root.dataset.open = '1';
		render();
	}

	function close() {
		var root = document.getElementById('px-settings-root');
		if (root) {
			root.dataset.open = '';
			root.innerHTML = '';
		}
	}

	function signOut() {
		try { localStorage.removeItem(SESSION); } catch (e) { /* ignore */ }
		if (window.PretzelAccountApi && window.PretzelAccountApi.signOut) window.PretzelAccountApi.signOut();
		close();
	}

	function removeAccount() {
		var acc = account();
		if (!acc) return;
		if (!confirm('Delete the account "' + acc.username + '" from this browser?')) return;
		write(ACCOUNTS, read(ACCOUNTS, []).filter(function (a) {
			return String(a.username).toLowerCase() !== String(acc.username).toLowerCase();
		}));
		try { localStorage.removeItem(SESSION); } catch (e) { /* ignore */ }
		close();
	}

	function toast(message) {
		if (typeof window.pretzelToast === 'function') { window.pretzelToast(message); return; }
		var stack = document.getElementById('toasts');
		if (!stack) return;
		var node = document.createElement('div');
		node.className = 'toast good';
		node.textContent = message;
		stack.appendChild(node);
		setTimeout(function () { node.remove(); }, 3600);
	}

	function wire() {
		document.addEventListener('click', function (event) {
			var el = event.target.closest('[data-set]');
			if (!el) return;
			var act = el.getAttribute('data-set');
			var value = el.getAttribute('data-value');
			if (act === 'close') {
				if (event.target.closest('.px-set') === event.target || event.target.closest('.px-set-x') || event.target.closest('.px-done')) close();
				return;
			}
			if (act === 'login') {
				close();
				var chip = document.getElementById('accountChip');
				if (chip) chip.click();
				return;
			}
			if (act === 'messages' || act === 'queue' || act === 'trades') { set(act, value); return; }
			if (act === 'duels' || act === 'parties') { set(act, value === 'on'); return; }
			if (act === 'password') {
				toast('Password changes go through the account chip sign-in');
				return;
			}
			if (act === 'discord') {
				var socials = window.PretzelSocials;
				if (socials) { close(); socials.open(); }
				return;
			}
			if (act === 'signout' || act === 'signout-all') {
				signOut();
				toast(act === 'signout-all' ? 'Signed out everywhere' : 'Signed out');
				return;
			}
			if (act === 'delete') { removeAccount(); return; }
			if (act === 'profile') {
				close();
				var chipBtn = document.getElementById('accountChip');
				if (chipBtn) chipBtn.click();
				return;
			}

		});

		document.addEventListener('keydown', function (event) {
			if (event.key === 'Escape') close();
		});
	}

	function addButton() {
		if (document.getElementById('px-settings-btn')) return;
		var actions = document.querySelector('.top-actions');
		if (!actions) return;
		var button = document.createElement('button');
		button.id = 'px-settings-btn';
		button.className = 'icon-btn';
		button.title = 'Account settings';
		button.setAttribute('aria-label', 'Account settings');
		button.innerHTML = window.PretzelPixels ? window.PretzelPixels.svg('gear', 15) : 'S';
		button.addEventListener('click', open);
		actions.insertBefore(button, document.getElementById('clientState') || null);
	}

	function boot() {
		style();
		addButton();
		wire();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
	else boot();

	window.PretzelSettings = { open: open, close: close, values: function () { return settings().mine; } };
})();
