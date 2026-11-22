// Pretzel Client - friends and messages drawer.
//
// Opens from the right edge (the reference layout) instead of taking over the
// whole page: friends list with Requests / Friends / Sent, a message inbox with
// groups, and per-thread chat history that is written to localStorage so a
// conversation survives a reload. Friend requests go through the real account
// API when a Pretzel backend answers /api/status, and stay local otherwise.
(function () {
	'use strict';

	var CHAT = 'pretzel.chat.v1';
	var PRIVACY = 'pretzel.chat.privacy.v1';
	var LEGACY = 'pretzel.friends.clean.v1';
	var EMOJIS = ['smile', 'heart', 'star', 'bolt', 'check', 'coin', 'cube', 'globe', 'rocket', 'halo', 'wings', 'person', 'discord', 'x', 'youtube', 'twitch'];
	var ACCOUNTS = 'pretzel.accounts.v1';
	var SESSION = 'pretzel.session.v1';

	var state = {
		open: false,
		mode: 'friends',
		tab: 'friends',
		thread: null,
		query: '',
		error: '',
		busy: false
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

	function account() {
		var session = read(SESSION, null);
		if (!session || !session.username) return null;
		var list = read(ACCOUNTS, []);
		return list.find(function (a) {
			return String(a.username).toLowerCase() === String(session.username).toLowerCase();
		}) || null;
	}

	function saveAccount(mutator) {
		var session = read(SESSION, null);
		if (!session || !session.username) return null;
		var list = read(ACCOUNTS, []);
		var index = list.findIndex(function (a) {
			return String(a.username).toLowerCase() === String(session.username).toLowerCase();
		});
		if (index < 0) return null;
		mutator(list[index]);
		write(ACCOUNTS, list);
		return list[index];
	}

	function friends() {
		var acc = account();
		return acc && Array.isArray(acc.friends) ? acc.friends : [];
	}

	function requests() {
		var acc = account();
		return acc && Array.isArray(acc.requests) ? acc.requests : [];
	}

	function sent() {
		var acc = account();
		return acc && Array.isArray(acc.sent) ? acc.sent : [];
	}

	function threads() {
		return read(CHAT, {}) || {};
	}

	function saveThreads(map) {
		write(CHAT, map);
	}

	function privacy() {
		return read(PRIVACY, 'anyone') || 'anyone';
	}

	/** Friends and chats that came from an older seeded build are dropped once. */
	function cleanLegacy() {
		try {
			if (localStorage.getItem(LEGACY)) return;
			var list = read(ACCOUNTS, []);
			if (Array.isArray(list)) {
				list.forEach(function (acc) {
					acc.friends = [];
					acc.requests = [];
					acc.sent = [];
				});
				write(ACCOUNTS, list);
			}
			write(CHAT, {});
			localStorage.setItem(LEGACY, '1');
		} catch (e) { /* storage blocked */ }
	}

	function friendOf(name) {
		return friends().find(function (f) {
			return String(f.name).toLowerCase() === String(name).toLowerCase();
		}) || null;
	}

	function flagOf(name, flag) {
		var person = friendOf(name);
		return Boolean(person && person[flag]);
	}

	function setFlag(name, flag, value) {
		saveAccount(function (acc) {
			var person = (acc.friends || []).find(function (f) {
				return String(f.name).toLowerCase() === String(name).toLowerCase();
			});
			if (!person) return;
			if (value) person[flag] = true;
			else delete person[flag];
		});
	}

	/** Settings owns the real privacy choice; fall back to the old key on its own. */
	function privacyValue() {
		try {
			if (window.PretzelSettings) return window.PretzelSettings.values().messages || 'friends';
		} catch (e) { /* ignore */ }
		return privacy();
	}

	function head(skin, cls, name) {
		var size = cls || 'head-26';
		if (skin) {
			return '<span class="head ' + size + '" style="background-image:url(\'' + esc(skin) +
				'\');background-size:800% 800%;background-position:14.2857% 14.2857%;image-rendering:pixelated"></span>';
		}
		if (name) {
			return '<img class="head head-img ' + size + '" src="https://mc-heads.net/avatar/' + encodeURIComponent(name) +
				'/64" alt="" onerror="this.onerror=null;this.src=\'/launcher/assets/steve-head.png\'">';
		}
		return '<span class="head ' + size + '" style="background-image:url(\'/launcher/assets/steve-head.png\');background-size:cover"></span>';
	}

	function style() {
		if (document.getElementById('px-messages-style')) return;
		var css = '' +
			'.px-drawer-wrap{position:fixed;inset:0;z-index:70;display:flex;justify-content:flex-end;pointer-events:none}' +
			'.px-drawer-scrim{position:absolute;inset:0;background:rgba(3,4,7,.45);pointer-events:auto}' +
			'.px-drawer{position:relative;pointer-events:auto;width:min(392px,100vw);height:100%;background:#131519;border-left:2px solid #2a2f38;box-shadow:-6px 0 0 rgba(0,0,0,.55);display:flex;flex-direction:column;color:#e9edf3;font-family:"Cascadia Mono",ui-monospace,monospace}' +
			'.px-d-head{display:flex;align-items:center;gap:8px;padding:10px 11px;border-bottom:2px solid #22262e}' +
			'.px-d-title{display:flex;flex-direction:column;gap:2px;min-width:0}' +
			'.px-d-title-text{display:flex;align-items:center;gap:6px;font-family:"Pretzel Pixel",monospace;font-size:11px;color:#fff}' +
			'.px-d-title small{font-size:9.5px;color:#7d8794;font-family:"Pretzel Pixel",monospace;letter-spacing:.03em}' +
			'.px-d-tools{margin-left:auto;display:flex;gap:4px}' +
			'.px-d-btn{width:26px;height:26px;display:grid;place-items:center;background:#191d23;border:2px solid #262b34;color:#a7b0bc;cursor:pointer}' +
			'.px-d-btn:hover{border-color:#3c434e;color:#fff}' +
			'.px-d-btn.on{border-color:#8a6a22;background:#241d10;color:#f2c66a}' +
			'.px-d-body{flex:1;min-height:0;overflow-y:auto;padding:10px 11px}' +
			'.px-search{display:flex;gap:6px;align-items:center;background:#0e1116;border:2px solid #242a33;padding:5px 7px}' +
			'.px-search input{flex:1;min-width:0;background:none;border:0;outline:none;color:#eef2f7;font:inherit;font-size:11px}' +
			'.px-search input::placeholder{color:#66707d}' +
			'.px-send{background:#f2b84b;border:2px solid #f2b84b;color:#1a1305;font-family:"Pretzel Pixel",monospace;font-size:7.5px;padding:6px 8px;cursor:pointer}' +
			'.px-send:hover{background:#ffd47a;border-color:#ffd47a}' +
			'.px-hint{margin:8px 0 6px;color:#6d7683;font-size:8.5px;font-family:"Pretzel Pixel",monospace;line-height:1.7}' +
			'.px-ftabs{display:flex;border-bottom:2px solid #23272f;margin:6px 0 0}' +
			'.px-ftab{flex:1;background:none;border:0;border-bottom:3px solid transparent;color:#8b95a2;font-family:"Pretzel Pixel",monospace;font-size:8px;padding:8px 4px;cursor:pointer}' +
			'.px-ftab.on{color:#fff;border-bottom-color:#f2b84b}' +
			'.px-row{display:flex;align-items:center;gap:8px;padding:7px 6px;border-bottom:1px solid #1c2027}' +
			'.px-row:hover{background:#171b21}' +
			'.px-row-main{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}' +
			'.px-row-name{font-family:"Pretzel Pixel",monospace;font-size:8.5px;color:#eef2f7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
			'.px-row-sub{font-size:9.5px;color:#79838f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
			'.px-row-sub.on{color:#82c99b}' +
			'.px-row-actions{display:flex;gap:4px;margin-left:auto}' +
			'.px-mini{width:24px;height:24px;display:grid;place-items:center;background:#191d23;border:2px solid #262b34;color:#a7b0bc;cursor:pointer}' +
			'.px-mini:hover{border-color:#3c434e;color:#fff}' +
			'.px-mini.ok{color:#8bd6a4;border-color:#33513d}' +
			'.px-empty{padding:22px 8px;text-align:center;color:#78828f;font-size:10.5px;line-height:1.7}' +
			'.px-group{display:flex;align-items:center;gap:9px;background:#171a20;border:2px solid #24282f;padding:8px;margin:8px 0;cursor:pointer}' +
			'.px-group:hover{border-color:#3a404b}' +
			'.px-group-plus{width:30px;height:30px;display:grid;place-items:center;background:#f2b84b;color:#1a1305}' +
			'.px-group-name{font-family:"Pretzel Pixel",monospace;font-size:9px;color:#f4f6fa}' +
			'.px-section{margin:10px 0 4px;color:#6d7683;font-size:8px;font-family:"Pretzel Pixel",monospace;letter-spacing:.06em}' +
			'.px-thread{display:flex;align-items:center;gap:8px;padding:8px 6px;cursor:pointer;border-bottom:1px solid #1c2027}' +
			'.px-thread:hover{background:#171b21}' +
			'.px-thread-name{font-family:"Pretzel Pixel",monospace;font-size:8.5px}' +
			'.px-thread-last{font-size:9.5px;color:#79838f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px}' +
			'.px-thread-at{margin-left:auto;font-size:9px;color:#5f6874;font-family:"Pretzel Pixel",monospace}' +
			'.px-chat{display:flex;flex-direction:column;height:100%;min-height:0}' +
			'.px-chat-log{flex:1;min-height:0;overflow-y:auto;padding:10px 11px;display:flex;flex-direction:column;gap:6px}' +
			'.px-msg{max-width:82%;padding:6px 8px;font-size:10.5px;line-height:1.55;background:#1b1f26;border:2px solid #262b34;align-self:flex-start}' +
			'.px-msg.me{align-self:flex-end;background:#241d10;border-color:#5c4a1f;color:#f7e6c2}' +
			'.px-msg-at{margin-top:3px;font-size:8px;color:#6d7683;font-family:"Pretzel Pixel",monospace}' +
			'.px-composer{display:flex;gap:6px;padding:8px 11px;border-top:2px solid #22262e;background:#101318}' +
			'.px-composer input{flex:1;min-width:0;background:#0b0d11;border:2px solid #242a33;color:#eef2f7;font:inherit;font-size:11px;padding:7px 8px;outline:none}' +
			'.px-composer input:focus{border-color:#8a6a22}' +
			'.px-d-foot{display:flex;align-items:center;gap:8px;padding:8px 11px;border-top:2px solid #22262e;background:#101318;font-size:8px;font-family:"Pretzel Pixel",monospace;color:#6d7683}' +
			'.px-d-foot button{margin-left:auto;background:none;border:2px solid #2b303a;color:#f2b84b;font-family:"Pretzel Pixel",monospace;font-size:7.5px;padding:5px 7px;cursor:pointer}' +
			'.px-d-foot button:hover{border-color:#8a6a22}' +
			'.px-rail-friends{cursor:pointer}' +
			'.px-tag{display:inline-block;margin-left:5px;padding:1px 4px;border:1px solid #3a414d;color:#8b95a2;font-family:"Pretzel Pixel",monospace;font-size:6.5px;letter-spacing:.04em;vertical-align:1px}' +
			'.px-tag.bad{border-color:#5a2a2a;color:#ff9d9d}' +
			'.px-row.blocked{opacity:.62}' +
			'.px-chat-tools{display:flex;align-items:center;gap:6px;padding:8px 11px;border-bottom:2px solid #22262e;background:#101318}' +
			'.px-chat-who{display:inline-flex;align-items:center;gap:5px;font-family:"Pretzel Pixel",monospace;font-size:8px;color:#cfd6e0}' +
			'.px-chat-tools .px-row-actions{margin-left:auto}' +
			'.px-emoji{display:flex;flex-wrap:wrap;gap:4px;padding:8px 11px;border-top:2px solid #22262e;background:#0d1015}' +
			'.px-emoji-item{width:28px;height:28px;display:grid;place-items:center;background:#151a20;border:2px solid #242a33;cursor:pointer}' +
			'.px-emoji-item:hover{border-color:#8a6a22;background:#242010}' +
			'.px-emoji-btn{width:32px;display:grid;place-items:center;background:#151a20;border:2px solid #242a33;cursor:pointer}' +
			'.px-emoji-btn:hover{border-color:#8a6a22}';
		var node = document.createElement('style');
		node.id = 'px-messages-style';
		node.textContent = css;
		document.head.appendChild(node);
	}

	// --------------------------------------------------------------- render

	function tagsFor(person) {
		var out = '';
		if (person.blocked) out += '<span class="px-tag bad">BLOCKED</span>';
		if (person.muted) out += '<span class="px-tag">MUTED</span>';
		return out;
	}

	function friendRow(person, actions) {
		var online = person.state === 'online';
		return '<div class="px-row' + (person.blocked ? ' blocked' : '') + '">' + head(person.skin, 'head-26', person.name) +
			'<span class="px-row-main"><span class="px-row-name">' + esc(person.name) + tagsFor(person) + '</span>' +
			'<span class="px-row-sub' + (online ? ' on' : '') + '">' + (online ? 'ONLINE' : 'OFFLINE') + '</span></span>' +
			(actions || '') + '</div>';
	}

	function friendsBody() {
		var acc = account();
		if (!acc) {
			return '<div class="px-empty">Sign in from the account chip to use friends and messages.' +
				'<br><br><button class="px-send" data-act="login">Open login</button></div>';
		}
		var list = friends();
		var online = list.filter(function (f) { return f.state === 'online'; }).length;
		var q = state.query.toLowerCase();
		var shown = q ? list.filter(function (f) { return String(f.name).toLowerCase().indexOf(q) >= 0; }) : list;
		var tab = state.tab;
		var pending = requests();
		var outgoing = sent();

		var rows;
		if (tab === 'requests') {
			rows = pending.length
				? pending.map(function (f) {
					return friendRow(f, '<span class="px-row-actions">' +
						'<button class="px-mini ok" title="Accept" data-act="accept" data-name="' + esc(f.name) + '">' + ico('check', 12) + '</button>' +
						'<button class="px-mini" title="Dismiss" data-act="dismiss" data-name="' + esc(f.name) + '">' + ico('close', 12) + '</button></span>');
				}).join('')
				: '<div class="px-empty">No incoming requests.</div>';
		} else if (tab === 'sent') {
			rows = outgoing.length
				? outgoing.map(function (f) {
					return friendRow(f, '<span class="px-row-actions">' +
						'<button class="px-mini" title="Cancel" data-act="cancel" data-name="' + esc(f.name) + '">' + ico('close', 12) + '</button></span>');
				}).join('')
				: '<div class="px-empty">Nothing sent yet.</div>';
		} else {
			rows = shown.length
				? shown.map(function (f) {
					if (f.blocked) {
						return friendRow(f, '<span class="px-row-actions">' +
							'<button class="px-mini ok" title="Unblock" data-act="unblock" data-name="' + esc(f.name) + '">' + ico('check', 12) + '</button>' +
							'<button class="px-mini" title="Remove" data-act="remove" data-name="' + esc(f.name) + '">' + ico('trash', 12) + '</button></span>');
					}
					return friendRow(f, '<span class="px-row-actions">' +
						'<button class="px-mini" title="Message" data-act="chat" data-name="' + esc(f.name) + '">' + ico('chat', 12) + '</button>' +
						'<button class="px-mini' + (f.muted ? ' ok' : '') + '" title="' + (f.muted ? 'Unmute' : 'Mute') + '" data-act="mute" data-name="' + esc(f.name) + '">' + ico('minus', 12) + '</button>' +
						'<button class="px-mini" title="Block" data-act="block" data-name="' + esc(f.name) + '">' + ico('lock', 12) + '</button>' +
						'<button class="px-mini" title="Remove" data-act="remove" data-name="' + esc(f.name) + '">' + ico('trash', 12) + '</button></span>');
				}).join('')
				: '<div class="px-empty">No friends yet. Friends you add on your Pretzel account appear here.</div>';
		}

		return '' +
			'<div class="px-search">' + ico('search', 12, '#7d8794') +
				'<input id="px-friend-q" placeholder="Search friends" value="' + esc(state.query) + '" autocomplete="off">' +
			'</div>' +
			(state.error ? '<div class="px-hint" style="color:#ff8a8a">' + esc(state.error) + '</div>' : '') +
			'<p class="px-hint">FRIENDS SEE WHEN YOU\'RE ONLINE AND CAN MESSAGE YOU</p>' +
			'<div class="px-ftabs">' +
				'<button class="px-ftab' + (tab === 'requests' ? ' on' : '') + '" data-act="tab" data-tab="requests">REQUESTS ' + (pending.length || '') + '</button>' +
				'<button class="px-ftab' + (tab === 'friends' ? ' on' : '') + '" data-act="tab" data-tab="friends">FRIENDS ' + list.length + '</button>' +
				'<button class="px-ftab' + (tab === 'sent' ? ' on' : '') + '" data-act="tab" data-tab="sent">SENT ' + (outgoing.length || '') + '</button>' +
			'</div>' + rows +
			'<div class="px-hint" style="margin-top:10px">' + online + ' of ' + list.length + ' online</div>';
	}

	function formatAt(ts) {
		if (!ts) return '';
		var date = new Date(ts);
		var now = new Date();
		if (date.toDateString() === now.toDateString()) {
			return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
		}
		return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase();
	}

	function messagesBody() {
		var acc = account();
		if (!acc) {
			return '<div class="px-empty">Sign in to message your friends.' +
				'<br><br><button class="px-send" data-act="login">Open login</button></div>';
		}
		var map = threads();
		var keys = Object.keys(map).filter(function (key) {
			return map[key] && Array.isArray(map[key].messages) && map[key].messages.length;
		});
		var q = state.query.toLowerCase();
		if (q) keys = keys.filter(function (key) { return key.toLowerCase().indexOf(q) >= 0; });
		keys.sort(function (a, b) {
			var at = map[a].messages[map[a].messages.length - 1].at || 0;
			var bt = map[b].messages[map[b].messages.length - 1].at || 0;
			return bt - at;
		});
		var anyFriend = friends();

		var list = keys.length
			? '<div class="px-section">CONVERSATIONS · ' + keys.length + '</div>' + keys.map(function (key) {
				var thread = map[key];
				var last = thread.messages[thread.messages.length - 1];
				var person = anyFriend.find(function (f) { return String(f.name).toLowerCase() === key.toLowerCase(); });
				return '<div class="px-thread" data-act="openthread" data-name="' + esc(key) + '">' +
					head(person ? person.skin : null, 'head-26', key) +
					'<span class="px-row-main"><span class="px-thread-name">' + esc(key) + '</span>' +
					'<span class="px-thread-last">' + esc((last.from === 'me' ? 'You: ' : '') + last.text) + '</span></span>' +
					'<span class="px-thread-at">' + formatAt(last.at) + '</span></div>';
			}).join('')
			: '<div class="px-empty">No messages yet. Pick a friend below and say hello.</div>';

		var friendList = anyFriend.length
			? '<div class="px-section">FRIENDS · ' + anyFriend.length + '</div>' +
				anyFriend.map(function (f) {
					return '<div class="px-thread" data-act="openthread" data-name="' + esc(f.name) + '">' +
						head(f.skin, 'head-26', f.name) +
						'<span class="px-row-main"><span class="px-thread-name">' + esc(f.name) + '</span>' +
						'<span class="px-thread-last">' + (f.state === 'online' ? 'Online' : 'Offline') + '</span></span>' +
						'<span class="px-thread-at">' + ico('chat', 12) + '</span></div>';
				}).join('')
			: '<div class="px-empty">Add a friend first - they show up here.</div>';

		return '' +
			'<div class="px-search">' + ico('search', 12, '#7d8794') +
				'<input id="px-thread-q" placeholder="Search friends" value="' + esc(state.query) + '" autocomplete="off">' +
			'</div>' +
			'<div class="px-group" data-act="newgroup"><span class="px-group-plus">' + ico('plus', 14, '#1a1305') + '</span>' +
				'<span class="px-row-main"><span class="px-group-name">New group</span>' +
				'<span class="px-row-sub">CHAT WITH 2 TO 9 FRIENDS AT ONCE</span></span></div>' +
			list + friendList;
	}

	function emojiPanel() {
		return '<div class="px-emoji">' + EMOJIS.map(function (name) {
			return '<button class="px-emoji-item" data-act="emoji-add" data-emoji="' + name + '" title="' + name + '">' +
				ico(name, 16, '#e9edf3') + '</button>';
		}).join('') + '</div>';
	}

	function chatBody() {
		var key = state.thread;
		var map = threads();
		var thread = map[key] || { messages: [] };
		var person = friendOf(key) || { name: key };
		var blocked = Boolean(person.blocked);
		var muted = Boolean(person.muted);
		return '<div class="px-chat">' +
			'<div class="px-chat-tools">' +
				'<span class="px-chat-who">' + ico('person', 11, '#8b95a2') + esc(key) + '</span>' + tagsFor(person) +
				'<span class="px-row-actions">' +
					'<button class="px-mini' + (muted ? ' ok' : '') + '" title="' + (muted ? 'Unmute' : 'Mute') + '" data-act="mute" data-name="' + esc(key) + '">' + ico('minus', 12) + '</button>' +
					'<button class="px-mini' + (blocked ? ' ok' : '') + '" title="' + (blocked ? 'Unblock' : 'Block') + '" data-act="' + (blocked ? 'unblock' : 'block') + '" data-name="' + esc(key) + '">' + ico('lock', 12) + '</button>' +
				'</span>' +
			'</div>' +
			'<div class="px-chat-log" id="px-chat-log">' +
				(thread.messages.length
					? thread.messages.map(function (m) {
						return '<div class="px-msg' + (m.from === 'me' ? ' me' : '') + '">' + esc(m.text) +
							'<div class="px-msg-at">' + formatAt(m.at) + '</div></div>';
					}).join('')
					: '<div class="px-empty">No messages yet with ' + esc(key) + '.</div>') +
			'</div>' +
			(state.emoji ? emojiPanel() : '') +
			'<div class="px-composer">' +
				'<button class="px-emoji-btn" data-act="emoji" title="Emoji">' + ico('smile', 14, '#f2b84b') + '</button>' +
				'<input id="px-chat-input" placeholder="' + (blocked ? 'Blocked' : 'Message ' + esc(key)) + '"' + (blocked ? ' disabled' : '') + ' autocomplete="off">' +
				'<button class="px-send" data-act="send">' + ico('send', 12, '#1a1305') + '</button></div>' +
		'</div>';
	}

	function body() {
		if (state.mode === 'chat' && state.thread) return chatBody();
		return state.mode === 'messages' ? messagesBody() : friendsBody();
	}

	function render() {
		var root = document.getElementById('px-messages-root');
		if (!root) return;
		if (!state.open) { root.innerHTML = ''; return; }
		var acc = account();
		var title = state.mode === 'chat' ? state.thread : (state.mode === 'messages' ? 'Messages' : 'Friends');
		var sub = state.mode === 'chat'
			? (friends().find(function (f) { return String(f.name).toLowerCase() === String(state.thread).toLowerCase(); }) || {}).state || 'offline'
			: (acc ? friends().length + ' FRIENDS \u00b7 ' + friends().filter(function (f) { return f.state === 'online'; }).length + ' ONLINE' : 'SIGN IN TO START');
		root.innerHTML = '<div class="px-drawer-wrap">' +
			'<div class="px-drawer-scrim" data-act="close"></div>' +
			'<aside class="px-drawer" role="dialog" aria-label="Friends and messages">' +
				'<header class="px-d-head">' +
					(state.mode === 'chat'
						? '<button class="px-d-btn" data-act="back" title="Back">' + window.PretzelPixels.svg('back', 13, '#a7b0bc') + '</button>'
						: (state.mode === 'messages'
							? '<img src="/assets/logos/chat-icon.webp" alt="" width="24" height="24" style="display:block;image-rendering:pixelated">'
							: '<span style="color:#f2b84b">' + ico('friends', 22) + '</span>')) +
					'<span class="px-d-title">' +
						'<span class="px-d-title-text">' + esc(title) + '</span>' +
						'<small>' + esc(String(sub).toUpperCase()) + '</small>' +
					'</span>' +
					'<span class="px-d-tools">' +
						(state.mode !== 'chat'
							? '<button class="px-d-btn' + (state.mode === 'friends' ? ' on' : '') + '" data-act="mode" data-mode="friends" title="Friends">' + ico('friends', 14) + '</button>' +
								'<button class="px-d-btn' + (state.mode === 'messages' ? ' on' : '') + '" data-act="mode" data-mode="messages" title="Messages">' + ico('chat', 14) + '</button>'
							: '') +
						'<button class="px-d-btn" data-act="close" title="Close">' + ico('close', 13) + '</button>' +
					'</span>' +
				'</header>' +
				(state.mode === 'chat' ? body() : '<div class="px-d-body">' + body() + '</div>') +
				'<div class="px-d-foot">' +
					(state.mode === 'messages'
						? (privacyValue() === 'anyone' ? 'ANYONE CAN MESSAGE YOU' : 'ONLY FRIENDS CAN MESSAGE YOU') +
							'<button data-act="privacy">CHANGE</button>'
						: 'FRIEND REQUESTS GO TO YOUR PRETZEL ACCOUNT') +
				'</div>' +
			'</aside>' +
		'</div>';
		var log = document.getElementById('px-chat-log');
		if (log) log.scrollTop = log.scrollHeight;
		var input = document.getElementById('px-chat-input');
		if (input) input.focus();
	}

	// -------------------------------------------------------------- actions

	function open(mode) {
		style();
		ensureRoot();
		state.open = true;
		if (mode) state.mode = mode;
		state.thread = state.mode === 'chat' ? (state.thread || null) : null;
		if (state.mode === 'chat' && !state.thread) state.mode = 'messages';
		render();
	}

	function close() {
		state.open = false;
		render();
	}

	function ensureRoot() {
		if (document.getElementById('px-messages-root')) return;
		var root = document.createElement('div');
		root.id = 'px-messages-root';
		document.body.appendChild(root);
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

	function api() {
		return window.PretzelAccountApi || null;
	}

	async function syncRemote() {
		var client = api();
		if (!client || !client.enabled) return;
		try {
			if (!(await client.enabled())) return;
			if (typeof window.pretzelSyncFriends === 'function') await window.pretzelSyncFriends();
		} catch (e) { /* ignore */ }
	}

	async function sendRequest(name) {
		if (!name) { state.error = 'Type a username first.'; render(); return; }
		state.error = '';
		state.busy = true;
		var client = api();
		try {
			if (client && await client.enabled()) {
				var result = await client.requestFriend(name);
				await syncRemote();
				state.tab = result && result.status === 'friends' ? 'friends' : 'sent';
				toast(result && result.status === 'friends' ? 'You are now friends with ' + name : 'Request sent to ' + name);
			} else {
				saveAccount(function (acc) {
					acc.sent = acc.sent || [];
					acc.sent.push({ name: name, state: 'offline', skin: null, at: Date.now() });
				});
				state.tab = 'sent';
				toast('Request saved for ' + name);
			}
		} catch (e) {
			state.error = e && e.message ? e.message : 'Could not send the request.';
		} finally {
			state.busy = false;
			render();
		}
	}

	async function accept(name) {
		var client = api();
		try {
			if (client && await client.enabled()) {
				await client.acceptFriend(name);
				await syncRemote();
			} else {
				saveAccount(function (acc) {
					acc.requests = (acc.requests || []).filter(function (f) { return f.name !== name; });
					acc.friends = acc.friends || [];
					acc.friends.push({ name: name, state: 'offline', skin: null });
				});
			}
			state.tab = 'friends';
			toast(name + ' is now your friend');
		} catch (e) {
			state.error = e && e.message ? e.message : 'Could not accept.';
		}
		render();
	}

	async function remove(name) {
		var client = api();
		try {
			if (client && await client.enabled()) {
				await client.removeFriend(name);
				await syncRemote();
			} else {
				saveAccount(function (acc) {
					acc.friends = (acc.friends || []).filter(function (f) { return f.name !== name; });
				});
			}
			toast(name + ' removed');
		} catch (e) {
			state.error = e && e.message ? e.message : 'Could not remove.';
		}
		render();
	}

	function openThread(name) {
		if (flagOf(name, 'blocked')) {
			toast(name + ' is blocked - unblock them first', true);
			return;
		}
		state.mode = 'chat';
		state.thread = name;
		state.emoji = false;
		render();
	}

	function insertEmoji(name) {
		var input = document.getElementById('px-chat-input');
		if (!input || input.disabled) return;
		input.value = input.value + ':' + name + ':';
		input.focus();
	}

	function send() {
		var input = document.getElementById('px-chat-input');
		var text = (input ? input.value : '').trim();
		if (!text || !state.thread) return;
		if (flagOf(state.thread, 'blocked')) { toast('Unblock ' + state.thread + ' to send messages', true); return; }
		var map = threads();
		var key = state.thread;
		if (!map[key]) map[key] = { messages: [] };
		map[key].messages.push({ from: 'me', text: text, at: Date.now() });
		saveThreads(map);
		render();
	}

	function wire() {
		document.addEventListener('click', function (event) {
			// the rail / panels still point at nav:friends - open the drawer instead
			var nav = event.target.closest('[data-action="nav:friends"]');
			if (nav) {
				event.preventDefault();
				event.stopPropagation();
				open('friends');
				return;
			}
			var root = document.getElementById('px-messages-root');
			if (!root || !root.firstChild) return;
			var el = event.target.closest('[data-act]');
			if (!el) return;
			var act = el.getAttribute('data-act');
			var name = el.getAttribute('data-name');
			if (act === 'close') { close(); return; }
			if (act === 'mode') { state.mode = el.getAttribute('data-mode'); state.thread = null; render(); return; }
			if (act === 'back') { state.mode = 'messages'; state.thread = null; render(); return; }
			if (act === 'tab') { state.tab = el.getAttribute('data-tab'); render(); return; }
			if (act === 'request') {
				var add = document.getElementById('px-friend-add');
				sendRequest((add ? add.value : '').trim());
				return;
			}
			if (act === 'accept') { accept(name); return; }
			if (act === 'remove') { remove(name); return; }
			if (act === 'mute') {
				var muting = !flagOf(name, 'muted');
				setFlag(name, 'muted', muting);
				toast(name + (muting ? ' muted' : ' unmuted'));
				render();
				return;
			}
			if (act === 'block') {
				setFlag(name, 'blocked', true);
				toast(name + ' blocked');
				if (state.mode === 'chat') { state.mode = 'friends'; state.thread = null; }
				render();
				return;
			}
			if (act === 'unblock') {
				setFlag(name, 'blocked', false);
				toast(name + ' unblocked');
				render();
				return;
			}
			if (act === 'emoji') { state.emoji = !state.emoji; render(); return; }
			if (act === 'emoji-add') { insertEmoji(el.getAttribute('data-emoji')); return; }
			if (act === 'dismiss') {
				saveAccount(function (acc) { acc.requests = (acc.requests || []).filter(function (f) { return f.name !== name; }); });
				render();
				return;
			}
			if (act === 'cancel') {
				saveAccount(function (acc) { acc.sent = (acc.sent || []).filter(function (f) { return f.name !== name; }); });
				render();
				return;
			}
			if (act === 'chat' || act === 'openthread') { openThread(name); return; }
			if (act === 'send') { send(); return; }
			if (act === 'openthread') { openThread(name); return; }
			if (act === 'newgroup') {
				toast('Group chats need at least 2 friends online');
				return;
			}
			if (act === 'privacy') {
				// the real control lives in the settings sheet, which owns privacy
				if (window.PretzelSettings) window.PretzelSettings.open();
				else { write(PRIVACY, privacy() === 'anyone' ? 'friends' : 'anyone'); render(); }
				return;
			}
			if (act === 'login') {
				event.stopPropagation();
				var chip = document.getElementById('accountChip');
				if (chip) chip.click();
				return;
			}
		}, true);

		document.addEventListener('keydown', function (event) {
			if (!state.open) return;
			if (event.key === 'Escape') { close(); return; }
			if (event.key === 'Enter') {
				if (state.mode === 'chat') { send(); }
				else {
					var add = document.getElementById('px-friend-add');
					if (add && document.activeElement === add) sendRequest(add.value.trim());
				}
			}
		});

		document.addEventListener('input', function (event) {
			if (event.target.id === 'px-friend-q' || event.target.id === 'px-thread-q') {
				state.query = event.target.value;
				var active = document.activeElement;
				render();
				var again = document.getElementById(active && active.id ? active.id : '');
				if (again) { again.focus(); again.value = state.query; }
			}
		});
	}

	function boot() {
		cleanLegacy();
		style();
		ensureRoot();
		wire();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
	else boot();

	window.PretzelMessages = {
		open: open,
		close: close,
		chat: function (name) {
			open('friends');
			openThread(name);
		}
	};
})();
