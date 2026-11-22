// Pretzel Client - Link Socials.
//
// The chain button in the top bar opens the same panel shape as the reference
// design: a 2x2 grid of Discord / Twitch / X / YouTube tiles with a linked
// state. There is no OAuth backend in this repo, so connecting stores the public
// handle the user types against their Pretzel account and never asks for a
// password or token. Everything lives in localStorage per account.
(function () {
	'use strict';

	var KEY = 'pretzel.socials.v1';
	var PLATFORMS = [
		{ id: 'discord', name: 'Discord', hint: 'username' },
		{ id: 'twitch', name: 'Twitch', hint: 'channel name' },
		{ id: 'x', name: 'X (Twitter)', hint: '@handle' },
		{ id: 'youtube', name: 'YouTube', hint: 'channel handle' }
	];

	function ico(name, size, color) {
		return window.PretzelPixels ? window.PretzelPixels.svg(name, size || 20, color) : '';
	}

	function accountName() {
		try {
			var raw = localStorage.getItem('pretzel.session.v1');
			if (raw) {
				var value = JSON.parse(raw);
				if (typeof value === 'string' && value) return value;
				if (value && value.username) return value.username;
			}
		} catch (e) { /* ignore */ }
		return 'local';
	}

	function all() {
		try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; }
	}

	function mine() {
		return all()[accountName().toLowerCase()] || {};
	}

	function save(next) {
		var store = all();
		store[accountName().toLowerCase()] = next;
		try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignore */ }
	}

	function linkedCount() {
		return Object.keys(mine()).length;
	}

	function style() {
		if (document.getElementById('px-socials-style')) return;
		var css = '' +
			'.px-backdrop{position:fixed;inset:0;background:rgba(3,4,7,.72);display:grid;place-items:center;z-index:80;padding:18px}' +
			'.px-socials{width:min(560px,94vw);background:#121418;border:2px solid #2b2f38;box-shadow:6px 6px 0 #000;color:#e9edf3;font-family:"Cascadia Mono",ui-monospace,monospace}' +
			'.px-socials-head{display:flex;align-items:center;gap:9px;padding:11px 13px;border-bottom:2px solid #23272f}' +
			'.px-socials-head h3{margin:0;font-family:"Pretzel Pixel",monospace;font-size:11px;letter-spacing:.02em;color:#f4f6fa}' +
			'.px-socials-x{margin-left:auto;width:24px;height:24px;display:grid;place-items:center;background:none;border:2px solid transparent;color:#98a1ad;cursor:pointer}' +
			'.px-socials-x:hover{border-color:#2f3540;color:#fff}' +
			'.px-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;padding:12px}' +
			'.px-tile{background:#171a20;border:2px solid #24282f;padding:14px 10px 10px;display:flex;flex-direction:column;align-items:center;gap:7px;cursor:pointer;transition:border-color .12s,background .12s}' +
			'.px-tile:hover{border-color:#3a404b;background:#1b1f26}' +
			'.px-tile.on{border-color:#4b4022;background:#1c1a12}' +
			'.px-tile-ico{color:#c9d1dc}' +
			'.px-tile.on .px-tile-ico{color:#f2b84b}' +
			'.px-tile-name{font-family:"Pretzel Pixel",monospace;font-size:8.5px;color:#e9edf3;text-align:center;line-height:1.6}' +
			'.px-tile-state{font-size:9.5px;color:#78828f}' +
			'.px-tile.on .px-tile-state{color:#82c99b}' +
			'.px-tile-badges{display:flex;gap:4px;justify-content:center;min-height:18px}' +
			'.px-tile-badges span{width:18px;height:18px;display:grid;place-items:center;background:#101318;border:1px solid #2a2f38;color:#9aa4b1}' +
			'.px-form{grid-column:1/-1;display:flex;gap:6px;align-items:center;background:#101318;border:2px solid #2b303a;padding:7px}' +
			'.px-form input{flex:1;min-width:0;background:#0b0d11;border:2px solid #242a33;color:#eef2f7;font:inherit;font-size:11px;padding:6px 8px;outline:none}' +
			'.px-form input:focus{border-color:#8a6a22}' +
			'.px-form button{background:#241d10;border:2px solid #8a6a22;color:#f2c66a;font-family:"Pretzel Pixel",monospace;font-size:7.5px;padding:7px 10px;cursor:pointer}' +
			'.px-form button.ghost{background:none;border-color:#2f3540;color:#a8b1bd}' +
			'.px-socials-foot{padding:0 12px 12px;color:#6d7683;font-size:9.5px;line-height:1.6}' +
			'.px-chain-badge{position:absolute;top:-3px;right:-3px;width:8px;height:8px;background:#38d47a;box-shadow:0 0 0 2px #0a0c10}';
		var node = document.createElement('style');
		node.id = 'px-socials-style';
		node.textContent = css;
		document.head.appendChild(node);
	}

	var openId = null;

	function tile(it) {
		var m = mine();
		var entry = m[it.id];
		var on = Boolean(entry && entry.handle);
		var badges = '';
		if (on) {
			badges = '<div class="px-tile-badges">' +
				PLATFORMS.filter(function (p) { return mine()[p.id]; }).map(function (p) {
					return '<span title="' + p.name + '">' + ico(p.id, 12) + '</span>';
				}).join('') + '</div>';
		}
		var form = openId === it.id
			? '<div class="px-form" data-form="' + it.id + '"><input id="px-social-input" placeholder="' + it.hint + '" value="' + (entry && entry.handle ? String(entry.handle).replace(/"/g, '&quot;') : '') + '" autocomplete="off">' +
				'<button data-save="' + it.id + '">Save</button><button class="ghost" data-cancel="1">Cancel</button></div>'
			: '';
		return '<div class="px-tile' + (on ? ' on' : '') + '" data-tile="' + it.id + '">' +
			'<span class="px-tile-ico">' + ico(it.id, 30) + '</span>' +
			'<span class="px-tile-name">' + it.name + '</span>' +
			'<span class="px-tile-state">' + (on ? String(entry.handle).replace(/</g, '&lt;') : 'Not Linked') + '</span>' +
			badges + form +
			'</div>';
	}

	function render() {
		var root = document.getElementById('px-socials-root');
		if (!root) return;
		var linked = linkedCount();
		root.innerHTML = '<div class="px-backdrop" data-close="1">' +
			'<div class="px-socials" role="dialog" aria-modal="true" aria-label="Link socials">' +
				'<div class="px-socials-head">' + ico('link', 16, '#f2b84b') +
					'<h3>Link Socials</h3>' +
					'<button class="px-socials-x" data-close="1" aria-label="Close">' + ico('close', 14) + '</button>' +
				'</div>' +
				'<div class="px-grid">' + PLATFORMS.map(tile).join('') + '</div>' +
				'<div class="px-socials-foot">' + (linked ? linked + ' linked to ' + accountName() + '. ' : '') +
					'Pretzel stores the public handle you type on this browser - no passwords or login tokens are requested.' +
				'</div>' +
			'</div>' +
		'</div>';
		if (openId) {
			var input = document.getElementById('px-social-input');
			if (input) { input.focus(); input.select(); }
		}
	}

	function open() {
		style();
		if (!document.getElementById('px-socials-root')) {
			var root = document.createElement('div');
			root.id = 'px-socials-root';
			document.body.appendChild(root);
		}
		openId = null;
		render();
	}

	function close() {
		var root = document.getElementById('px-socials-root');
		if (root) root.innerHTML = '';
		openId = null;
	}

	function wire() {
		document.addEventListener('click', function (event) {
			var root = document.getElementById('px-socials-root');
			if (!root || !root.firstChild) return;

			var saveBtn = event.target.closest('[data-save]');
			if (saveBtn) {
				var id = saveBtn.getAttribute('data-save');
				var input = document.getElementById('px-social-input');
				var handle = (input ? input.value : '').trim();
				var next = mine();
				if (handle) next[id] = { handle: handle, at: Date.now() };
				else delete next[id];
				save(next);
				openId = null;
				render();
				refreshChainDot();
				return;
			}
			if (event.target.closest('[data-cancel]')) {
				openId = null;
				render();
				return;
			}
			var tileEl = event.target.closest('[data-tile]');
			if (tileEl) {
				// Clicking inside the open form must not re-render, or the field loses
				// focus and whatever was typed before Save disappears.
				var tileId = tileEl.getAttribute('data-tile');
				if (openId === tileId && event.target.closest('.px-form')) return;
				if (openId === tileId) return;
				openId = tileId;
				render();
				return;
			}
			if (event.target.closest('[data-close]')) {
				close();
			}
		});

		document.addEventListener('keydown', function (event) {
			if (event.key === 'Escape') close();
			if (event.key === 'Enter' && openId) {
				var saveBtn = document.querySelector('[data-save]');
				if (saveBtn) saveBtn.click();
			}
		});
	}

	function refreshChainDot() {
		var button = document.getElementById('px-chain-btn');
		if (!button) return;
		button.classList.toggle('px-has-socials', linkedCount() > 0);
	}

	function addButton() {
		if (document.getElementById('px-chain-btn')) return;
		var actions = document.querySelector('.top-actions');
		if (!actions) return;
		var button = document.createElement('button');
		button.id = 'px-chain-btn';
		button.className = 'icon-btn';
		button.title = 'Link Socials';
		button.setAttribute('aria-label', 'Link Socials');
		button.style.position = 'relative';
		button.innerHTML = window.PretzelPixels ? window.PretzelPixels.svg('link', 15) : '&infin;';
		button.addEventListener('click', open);
		actions.insertBefore(button, actions.firstChild);
		refreshChainDot();
	}

	function boot() {
		style();
		addButton();
		wire();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', boot);
	} else {
		boot();
	}

	window.PretzelSocials = { open: open, close: close, mine: mine, platforms: PLATFORMS };
})();
