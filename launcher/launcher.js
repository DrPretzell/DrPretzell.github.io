'use strict';

// Pretzel Client launcher.
//
// Sections: launchpad, servers, mods, friends, store. Accounts and news live
// in localStorage; passwords are hashed with SHA-256. The sign-in form is a
// modal opened from the account chip, never an always-visible panel.
// Servers come from /api/launcher/servers (proxied list), mods from Modrinth.

const CLIENT_URL = '/pretzel-client/client.html';
const MODRINTH = 'https://api.modrinth.com/v2';
const STEVE = '/launcher/assets/steve-head.png';
const HERO = '/launcher/assets/hero.png';
const PATHOST = '/launcher/assets/pathost.png';

const LS = {
	accounts: 'pretzel.accounts.v1',
	session: 'pretzel.session.v1',
	installed: 'pretzel.installed.v1',
	news: 'pretzel.news.v1',
	pendingSkin: 'pretzel.pendingSkin.v1',
};

const OWNER = null;

const NAV = [
	{ id: 'launchpad', label: 'Launchpad', icon: '<path d="M13.5 4.5c3.6-.6 5.5-1 6-1-.1.5-.5 2.4-1.1 6-.5 3-2.3 5.3-4.9 6.6l-1 3.4-2.3-3.4-3.3-2.3 3.4-1c1.3-2.6 3.6-4.4 6.6-4.9Z"/><circle cx="14.6" cy="8.9" r="1.5"/>' },
	{ id: 'servers', label: 'Servers', icon: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.2 2.2 3.2 5 3.2 8S14.2 17.8 12 20c-2.2-2.2-3.2-5-3.2-8S9.8 6.2 12 4Z"/>' },
	{ id: 'mods', label: 'Mods', icon: '<path d="M12 3.4 19.4 7.7v8.6L12 20.6 4.6 16.3V7.7Z"/><path d="M4.6 7.7 12 12l7.4-4.3M12 12v8.6"/>' },
	{ id: 'friends', label: 'Friends', icon: '<circle cx="9.2" cy="8.6" r="3.1"/><path d="M3.6 19.4c.5-3 2.8-4.7 5.6-4.7s5.1 1.7 5.6 4.7"/><path d="M16.4 6.4a3 3 0 0 1 0 5.6M18 15.2c1.6.6 2.6 2.1 2.9 4.2"/>' },
	{ id: 'store', label: 'Store', icon: '<circle cx="9.5" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/><path d="M3.5 4.5h2.2l2.4 10.1h10.7l2-7.6H6.4"/>' },
];

const state = {
	view: 'launchpad',
	modal: null,
	authMode: 'login',
	authError: '',
	status: null,
	servers: null,
	serverError: '',
	serverQuery: '',
	serverTag: '',
	serverDetail: null,
	mods: null,
	modsError: '',
	modsLoading: false,
	installing: {},
	modsQuery: '',
	modSource: 'modrinth',
	friendTab: 'friends',
	pendingSkin: null,
	newsDraft: null,
	newsDetail: null,
	announceDismissed: false,
};

// ------------------------------------------------------------------ storage

function read(key, fallback) {
	try {
		const raw = localStorage.getItem(key);
		return raw ? JSON.parse(raw) : fallback;
	} catch (e) {
		return fallback;
	}
}

function write(key, value) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch (e) {
		/* storage full or blocked: keep working for this session */
	}
}

async function sha256(text) {
	const bytes = new TextEncoder().encode(text);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function accounts() {
	return read(LS.accounts, []);
}

function saveAccounts(list) {
	write(LS.accounts, list);
}

async function seedOwner() {
	// Static public build: no seeded account credentials.
	return;
}

function currentAccount() {
	const session = read(LS.session, null);
	if (!session || !session.username) {
		return null;
	}
	return accounts().find((a) => a.username.toLowerCase() === session.username.toLowerCase()) || null;
}

function updateAccount(mutator) {
	const account = currentAccount();
	if (!account) return null;
	const list = accounts();
	const index = list.findIndex((a) => a.username.toLowerCase() === account.username.toLowerCase());
	const result = mutator(list[index]);
	saveAccounts(list);
	return result === undefined ? list[index] : result;
}

function signOut() {
	localStorage.removeItem(LS.session);
	state.modal = null;
	toast('Signed out');
	render();
}

// ------------------------------------------------------------------ helpers

const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => (
	{ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function compact(n) {
	const v = Number(n);
	if (!Number.isFinite(v)) return '0';
	if (v >= 1e9) return (v / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
	if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
	if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
	return String(v);
}

function toast(message, kind) {
	const stack = document.getElementById('toasts');
	const node = document.createElement('div');
	node.className = 'toast' + (kind ? ' ' + kind : '');
	node.textContent = message;
	stack.appendChild(node);
	setTimeout(() => node.remove(), 4200);
}

// A player head: a 64x64 skin is cropped to its 8x8 face, anything else is
// drawn as-is. Everyone without a skin shows the default Steve head.
function headMarkup(skin, cls) {
	const style = skin
		? "background-image:url('" + skin + "');background-size:800% 800%;background-position:14.2857% 14.2857%;image-rendering:pixelated"
		: "background-image:url('" + STEVE + "');background-size:cover;background-position:center";
	return '<span class="head ' + (cls || '') + '" style="' + style + '"></span>';
}

function newsList() {
	return read(LS.news, []);
}

function saveNews(list) {
	write(LS.news, list);
}

// ------------------------------------------------------------------ data

async function loadStatus() {
	try {
		const res = await fetch('/api/status', { cache: 'no-store' });
		state.status = res.ok ? await res.json() : null;
	} catch (e) {
		state.status = null;
	}
}

async function loadServers(force) {
	const manual = read('pretzel.manualServers.v1', []);
	const manualList = Array.isArray(manual) ? manual : [];
	if (state.servers && !force) {
		state.servers = state.servers.filter((s) => !s.manual).concat(manualList);
		if (state.view === 'servers') renderView();
		return;
	}
	try {
		const res = await fetch('/api/launcher/servers', { cache: 'no-store' });
		if (!res.ok) throw new Error('HTTP ' + res.status);
		const data = await res.json();
		state.servers = (Array.isArray(data.servers) ? data.servers : []).concat(manualList);
		state.serverError = state.servers.length ? '' : 'The server list came back empty.';
	} catch (e) {
		state.servers = manualList;
		state.serverError = state.servers.length ? '' : 'Could not reach the server list.';
	}
	if (state.view === 'servers') renderView();
}

async function loadMods(force) {
	// The Lunar-style Explore page is mounted from mods.js.
}

function installedList() {
	return read(LS.installed, []);
}

function isInstalled(id) {
	return installedList().some((m) => m.id === id);
}

async function installMod(mod) {
	if (state.installing[mod.id] || isInstalled(mod.id)) return;
	state.installing[mod.id] = true;
	try {
		const versionUrl = MODRINTH + '/project/' + encodeURIComponent(mod.slug || mod.id) +
			'/version?game_versions=' + encodeURIComponent('["1.21.11"]') +
			'&loaders=' + encodeURIComponent('["fabric"]');
		const res = await fetch(versionUrl);
		const versions = res.ok ? await res.json() : [];
		const version = Array.isArray(versions) ? versions[0] : null;
		const file = version && version.files && version.files[0] ? version.files[0] : null;
		const payload = {
			id: mod.id,
			title: mod.title,
			slug: mod.slug,
			source: 'modrinth',
			version: version ? version.version_number : '',
			fileUrl: file ? file.url : '',
			fileName: file ? file.filename : '',
		};
		const saved = await fetch('/api/launcher/mods', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'install', mod: payload }),
		});
		const result = saved.ok ? await saved.json().catch(function () { return {}; }) : {};
		const list = installedList().filter((m) => m.id !== mod.id);
		list.push(Object.assign({}, mod, {
			version: payload.version,
			file: result && result.downloaded ? payload.fileName : '',
			bytes: result ? result.bytes || 0 : 0,
		}));
		write(LS.installed, list);
		toast(mod.title + ' installed', 'good');
	} catch (e) {
		toast('Could not install ' + mod.title, 'bad');
	} finally {
		delete state.installing[mod.id];
		render();
	}
}

async function uninstallMod(id) {
	write(LS.installed, installedList().filter((m) => m.id !== id));
	try {
		await fetch('/api/launcher/mods', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'remove', id }),
		});
	} catch (e) { /* ignore */ }
	toast('Mod removed');
	render();
}

// ------------------------------------------------------------------ auth

async function signIn(login, password) {
	const needle = login.trim().toLowerCase();
	const account = accounts().find((a) => a.username.toLowerCase() === needle || a.email.toLowerCase() === needle);
	if (!account) throw new Error('No account with that username or Gmail.');
	if ((await sha256(password)) !== account.passwordHash) throw new Error('That password is not right.');
	write(LS.session, { username: account.username });
	if (state.pendingSkin) {
		updateAccount((acc) => { acc.skin = state.pendingSkin; });
		localStorage.removeItem(LS.pendingSkin);
		state.pendingSkin = null;
	}
}

async function signUp(username, email, password, confirm) {
	const name = username.trim();
	if (name.length < 3 || name.length > 16) throw new Error('Username must be 3 to 16 characters.');
	if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error('Username can only use letters, numbers and _.');
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('That Gmail address does not look right.');
	if (password.length < 6) throw new Error('Password needs at least 6 characters.');
	if (password !== confirm) throw new Error('The two passwords do not match.');
	const list = accounts();
	if (list.some((a) => a.username.toLowerCase() === name.toLowerCase())) throw new Error('That username is taken.');
	if (list.some((a) => a.email.toLowerCase() === email.trim().toLowerCase())) throw new Error('That Gmail already has an account.');
	list.push({
		username: name,
		email: email.trim(),
		role: 'user',
		passwordHash: await sha256(password),
		skin: state.pendingSkin || null,
		friends: [],
		requests: [],
		sent: [],
	});
	saveAccounts(list);
	write(LS.session, { username: name });
	localStorage.removeItem(LS.pendingSkin);
	state.pendingSkin = null;
}

// ------------------------------------------------------------------ render

function render() {
	renderRail();
	renderTopbar();
	renderView();
	renderModal();
}

function renderRail() {
	const installed = installedList().length;
	let html = '<div class="rail-brand"><img src="/pretzel-logo.png" alt="Pretzel"></div>';
	for (const item of NAV) {
		const active = state.view === item.id ? ' active' : '';
		html += '<button class="rail-btn' + active + '" data-action="nav:' + item.id + '" title="' + item.label + '" aria-label="' + item.label + '">' +
			'<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
			item.icon + '</svg>' +
			(item.id === 'mods' && installed ? '<span class="badge">' + installed + '</span>' : '') +
			'</button>';
	}
	document.getElementById('rail').innerHTML = html;
}

function clientPill() {
	if (!state.status) return { cls: 'ok', text: 'modded client' };
	if (state.status.bundle && state.status.bundle.available) return { cls: 'ok', text: 'modded client ready' };
	if (state.status.build && state.status.build.state === 'linking') return { cls: 'warn', text: 'linking client' };
	return { cls: 'bad', text: 'modded build required' };
}

function renderTopbar() {
	const account = currentAccount();
	const pill = clientPill();
	document.getElementById('clientState').className = 'pill ghost mono ' + pill.cls;
	document.getElementById('clientStateText').textContent = pill.text;

	const chip = document.getElementById('accountChip');
	const text = document.getElementById('accountText');
	const avatar = document.getElementById('accountAvatar');
	if (account) {
		chip.className = 'account signed';
		avatar.innerHTML = headMarkup(account.skin, 'head-24');
		text.innerHTML = '<span>' + esc(account.username) + '</span>' +
			(account.role === 'owner' ? ' <span class="owner-chip">Owner</span>' : '');
	} else {
		chip.className = 'account';
		avatar.innerHTML = headMarkup(null, 'head-24');
		text.textContent = 'Click to Login';
	}
}

function renderView() {
	const map = {
		launchpad: launchpadView,
		servers: serversView,
		mods: modsView,
		friends: friendsView,
		store: storeView,
	};
	document.getElementById('view').innerHTML = (map[state.view] || launchpadView)();
	if (state.view === 'servers') watchServerVideos();
	if (state.view === 'mods' && window.PretzelMods) {
		window.PretzelMods.mount(document.getElementById('pretzel-mods-root'));
	}
}

// ---------------------------------------------------------------- modal

function openModal(modal) {
	state.modal = modal;
	state.authError = '';
	renderModal();
}

function closeModal() {
	state.modal = null;
	state.authError = '';
	renderModal();
}

function renderModal() {
	const root = document.getElementById('modal-root');
	if (!state.modal) {
		root.innerHTML = '';
		return;
	}
	const body = state.modal.type === 'auth' ? authModalBody()
		: state.modal.type === 'account' ? accountModalBody()
			: state.modal.type === 'news' ? newsModalBody()
				: state.modal.type === 'server' ? serverModalBody()
					: state.modal.type === 'add-server' ? addServerModalBody()
						: state.modal.type === 'post' ? postModalBody()
						: '';
	root.innerHTML = '' +
		'<div class="modal-backdrop" data-action="modal-close">' +
			'<div class="modal" role="dialog" aria-modal="true">' +
				'<button class="modal-x" data-action="modal-close" aria-label="Close">&times;</button>' +
				body +
			'</div>' +
		'</div>';
}

function authModalBody() {
	const login = state.authMode === 'login';
	const skin = state.pendingSkin || (currentAccount() || {}).skin || null;
	const skinRow = '' +
		'<div class="skin-row">' +
			headMarkup(skin, 'head-48') +
			'<div class="skin-meta"><b>Skin</b><span>Your head shows next to your name.</span></div>' +
			'<button class="btn skin-btn" data-action="pick-skin">Add skin</button>' +
		'</div>';

	const loginForm = '' +
		'<form data-form="login">' +
			'<div class="field"><label for="loginUser">Username/Gmail</label>' +
				'<input class="input" id="loginUser" name="loginUser" autocomplete="username" placeholder="Username or you@gmail.com"></div>' +
			'<div class="field"><label for="loginPass">Password</label>' +
				'<input class="input" id="loginPass" name="loginPass" type="password" autocomplete="current-password" placeholder="Password"></div>' +
			(state.authError ? '<p class="form-error">' + esc(state.authError) + '</p>' : '') +
			'<button class="btn gold" type="submit">Login</button>' +
			'<div class="row-between" style="margin-top:10px">' +
				'<button class="raw-link" type="button" data-action="forgot">Forgot password?</button>' +
				'<button class="raw-link" type="button" data-action="swap-signup">Create account</button>' +
			'</div>' +
		'</form>';

	const signupForm = '' +
		'<form data-form="signup">' +
			'<div class="field"><label for="suUser">Username</label>' +
				'<input class="input" id="suUser" name="suUser" autocomplete="username" placeholder="Username"></div>' +
			'<div class="field"><label for="suMail">Gmail</label>' +
				'<input class="input" id="suMail" name="suMail" autocomplete="email" placeholder="you@gmail.com"></div>' +
			'<div class="field"><label for="suPass">Password</label>' +
				'<input class="input" id="suPass" name="suPass" type="password" autocomplete="new-password" placeholder="Password"></div>' +
			'<div class="field"><label for="suPass2">Re enter password</label>' +
				'<input class="input" id="suPass2" name="suPass2" type="password" autocomplete="new-password" placeholder="Re enter password"></div>' +
			(state.authError ? '<p class="form-error">' + esc(state.authError) + '</p>' : '') +
			'<button class="btn ghost-gold" type="submit">Create Account</button>' +
			'<div class="row-between" style="margin-top:10px">' +
				'<span class="raw-link" style="cursor:default">Have a Account?</span>' +
				'<button class="raw-link" type="button" data-action="swap-login">Login In</button>' +
			'</div>' +
		'</form>';

	return '<div class="modal-head"><h3>' + (login ? 'Login' : 'Create account') + '</h3>' +
		'<p>' + (login ? 'Sign in to Pretzel Client.' : 'One account, no email verification.') + '</p></div>' +
		skinRow + (login ? loginForm : signupForm);
}

function accountModalBody() {
	const account = currentAccount();
	if (!account) return authModalBody();
	return '' +
	'<div class="modal-head"><h3>' + esc(account.username) +
		(account.role === 'owner' ? ' <span class="owner-chip">Owner account</span>' : '') + '</h3>' +
		'<p>' + esc(account.email) + '</p></div>' +
	'<div class="skin-row">' + headMarkup(account.skin, 'head-48') +
		'<div class="skin-meta"><b>Skin</b><span>Shown in the launcher and to friends.</span></div>' +
		'<button class="btn skin-btn" data-action="pick-skin">Add skin</button></div>' +
	'<button class="btn" data-action="signout" style="margin-top:4px">Sign out</button>';
}

function newsModalBody() {
	const draft = state.newsDraft || { banner: '', title: '', description: '' };
	return '' +
	'<div class="modal-head"><h3>Create news</h3><p>A banner, a title and a description.</p></div>' +
	'<form data-form="news">' +
		'<div class="news-banner-input">' +
			(draft.banner
				? '<img src="' + esc(draft.banner) + '" alt="Banner preview">'
				: '<div class="banner-empty">No banner yet</div>') +
			'<button class="btn skin-btn" type="button" data-action="pick-banner">Upload banner</button>' +
		'</div>' +
		'<div class="field"><label for="newsTitle">Title</label>' +
			'<input class="input" id="newsTitle" name="newsTitle" maxlength="60" value="' + esc(draft.title) + '" placeholder="Title"></div>' +
		'<div class="field"><label for="newsDesc">Description</label>' +
			'<textarea class="input textarea" id="newsDesc" name="newsDesc" maxlength="280" placeholder="Description">' + esc(draft.description) + '</textarea></div>' +
		(state.authError ? '<p class="form-error">' + esc(state.authError) + '</p>' : '') +
		'<button class="btn gold" type="submit">Publish</button>' +
	'</form>';
}

function serverModalBody() {
	const server = state.serverDetail;
	if (!server) return '';
	const banner = String(server.banner || '');
	const full = /\.webm(\?|$)/i.test(banner)
		? '<video src="' + esc(banner) + '" muted loop playsinline autoplay></video>'
		: banner ? '<img src="' + esc(banner) + '" alt="">' : '<div class="banner-empty">No banner</div>';
	return '' +
	'<div class="modal-head"><h3>' + esc(server.name) + '</h3>' +
		'<p>' + (server.custom ? 'Official server' : compact(server.players) + ' online') +
		' &middot; ' + esc(server.address) + '</p></div>' +
	'<div class="server-full-banner">' + full + '</div>' +
	'<p class="server-full-desc">' + esc(server.description || 'No description.') + '</p>' +
	'<div class="server-tags" style="margin-bottom:14px">' +
		(server.tags || []).map((t) => '<span class="tagpill">' + esc(t) + '</span>').join('') + '</div>' +
	'<div class="server-actions">' +
		'<button class="btn join" data-action="join:' + esc(server.id) + '">Join server</button>' +
		'<button class="btn copy" data-action="copy:' + esc(server.id) + '">Copy IP</button>' +
		(server.website ? '<a class="btn website" href="' + esc(server.website) + '" target="_blank" rel="noopener noreferrer">Website</a>' : '') +
	'</div>';
}

function addServerModalBody() {
	return '' +
	'<div class="modal-head"><h3>Add a server</h3><p>Add a custom server to your Servers section.</p></div>' +
	'<form data-form="add-server">' +
		'<div class="field"><label for="addServerName">Server name</label>' +
			'<input class="input" id="addServerName" name="addServerName" maxlength="48" placeholder="My Server"></div>' +
		'<div class="field"><label for="addServerAddress">Server address</label>' +
			'<input class="input" id="addServerAddress" name="addServerAddress" maxlength="128" placeholder="play.example.net"></div>' +
		'<div class="field"><label for="addServerDesc">Description</label>' +
			'<input class="input" id="addServerDesc" name="addServerDesc" maxlength="180" placeholder="Optional description"></div>' +
		(state.authError ? '<p class="form-error">' + esc(state.authError) + '</p>' : '') +
		'<button class="btn gold" type="submit">Add Server</button>' +
	'</form>';
}

function postModalBody() {
	const post = state.newsDetail;
	if (!post) return '';
	return '' +
	'<img class="post-banner" src="' + esc(post.banner) + '" alt="">' +
	'<div class="modal-head"><h3>' + esc(post.title) + '</h3>' +
		'<p>' + esc(post.author) + ' &middot; ' + new Date(post.createdAt).toLocaleDateString() + '</p></div>' +
	'<p class="post-text">' + esc(post.description) + '</p>';
}

// ---------------------------------------------------------------- launchpad

function newsSection() {
	const account = currentAccount();
	const isOwner = Boolean(account && account.role === 'owner');
	const news = newsList();
	const action = isOwner
		? '<button class="link" data-action="create-news">Create news</button>'
		: '<button class="link" data-action="nav:store">Explore the Pretzelverse &#9662;</button>';
	const head = '<div class="sec-head"><h3>Latest News <span class="count">(' + news.length + ')</span></h3>' + action + '</div>';

	if (!news.length) {
		if (!isOwner) return head + '<div class="empty">Nothing new right now.</div>';
		return head + '<div class="empty">No news yet. Create the first post for the launcher.</div>';
	}

	return head + '<div class="news-grid">' + news.slice(0, 9).map((item) => '' +
		'<article class="news-card" data-action="post:' + esc(item.id) + '">' +
			'<div class="news-banner-img">' +
				'<img src="' + esc(item.banner) + '" alt="">' +
				'<span class="news-dot"></span>' +
				'<span class="news-arrow"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M8 16 16 8M9 8h7v7"/></svg></span>' +
			'</div>' +
			'<div class="news-body">' +
				'<h4>' + esc(item.title) + '</h4>' +
				'<p>' + esc(item.description) + '</p>' +
				'<span class="news-author">' + esc(item.author) + '</span>' +
			'</div>' +
		'</article>').join('') + '</div>';
}

function premiumCard() {
	return '' +
	'<section class="ads-bar">' +
		'<div class="ads-row">' +
			'<div class="premium-logo"><img src="/pretzel-logo.png" alt=""><span class="premium-plus">+</span></div>' +
			'<div><h4>Remove ads with Pretzel Premium</h4><div class="sub">Cosmetics before release</div></div>' +
			'<button class="subscribe" data-action="premium">Subscribe</button>' +
		'</div>' +
		'<div class="premium-box"><span>Access to cosmetics before release &mdash; 1 to 2 months early</span>' +
			'<span class="soon">Coming soon</span></div>' +
	'</section>';
}

function friendsPanel() {
	const account = currentAccount();
	const friends = account ? account.friends || [] : [];
	const online = friends.filter((f) => f.state === 'online').length;
	const rows = friends.length
		? friends.map((f) => '' +
			'<div class="friend-row">' + headMarkup(f.skin, 'head-26') +
				'<span class="friend-name">' + esc(f.name) + '</span>' +
				'<span class="friend-state ' + (f.state === 'online' ? 'online' : '') + '">' +
				(f.state === 'online' ? 'Online' : 'Offline') + '</span>' +
			'</div>').join('')
		: '<button class="add-first" data-action="nav:friends">' + headMarkup(null, 'head-26') +
			'<span>Add your first friend</span></button>';

	const body = '<div class="friends-head"><h4>Friends <span class="n">(' + online + ' online)</span></h4>' +
		'<button class="link" data-action="nav:friends">Open</button></div>' + rows;

	const content = !account
		? '<div class="locked"><div class="locked-body">' + body + '</div>' +
			'<div class="locked-overlay">' +
				'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7">' +
				'<rect x="4.5" y="10.5" width="15" height="9.5" rx="2"></rect><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"></path></svg>' +
				'<p>Sign in to see your friends and their status.</p>' +
				'<button class="raw-link gold-link" data-action="open-login">Login</button>' +
			'</div></div>'
		: body;

	return '<section class="friends-panel">' + content + '</section>';
}

function serverStrip() {
	const servers = (state.servers || []).slice(0, 6);
	if (!servers.length) return '';
	return '<div class="server-strip">' + servers.map((s) =>
		'<button class="strip-tile" data-action="go-server:' + esc(s.id) + '" title="' + esc(s.name) + '"' +
		(s.icon ? ' style="background-image:url(\'' + esc(s.icon) + '\')"' : '') + '></button>').join('') + '</div>';
}

function onlineTotal() {
	if (!state.servers || !state.servers.length) return null;
	return state.servers.reduce((sum, s) => sum + (Number(s.players) || 0), 0);
}

function launchpadView() {
	const account = currentAccount();
	const greeting = account ? 'Welcome Back ' + esc(account.username) : 'Welcome to Pretzel Client';
	const total = onlineTotal();

	return '' +
	(state.announceDismissed ? '' :
		'<div class="announce"><span>Pretzel Client 1.21.11 is live &middot; Modded source build &middot; play in your browser</span>' +
		'<button class="announce-x" data-action="dismiss-announce" aria-label="Dismiss">&times;</button></div>') +
	'<div class="welcome-row">' +
		'<h1>' + greeting + '</h1>' +
		'<div class="online"><span class="dot"></span>' + (total == null ? '&mdash;' : total.toLocaleString()) + ' Online</div>' +
	'</div>' +
	'<div class="lp">' +
		'<div class="lp-main">' +
			'<section class="hero" style="background-image:linear-gradient(180deg,rgba(6,7,10,.5),rgba(6,7,10,.86)),url(\'' + HERO + '\')">' +
				'<div class="hero-inner">' +
					'<button class="launch" data-action="launch">Launch Game' +
						'<small><span>Pretzel Client 1.21.11 modded build</span><span class="sep"></span><span>Browser</span></small>' +
					'</button>' +
				'</div>' +
			'</section>' +
			newsSection() +
		'</div>' +
		'<div class="lp-side">' + serverStrip() + friendsPanel() +
			'<div class="side-spacer"></div>' + premiumCard() +
		'</div>' +
	'</div>';
}

// ---------------------------------------------------------------- servers

function serverCard(server) {
	const banner = String(server.banner || '');
	const isVideo = /\.webm(\?|$)/i.test(banner);
	const media = isVideo
		? '<video src="' + esc(banner) + '" muted loop playsinline preload="none"></video>'
		: banner ? '<img class="ban" src="' + esc(banner) + '" alt="" loading="lazy">' : '<div class="fallback"></div>';
	const tags = (server.tags || []).slice(0, 3)
		.map((t) => '<span class="tagpill">' + esc(t) + '</span>').join('');
	return '' +
	'<article class="server">' +
		'<div class="server-media" data-action="server:' + esc(server.id) + '">' + media +
			(server.icon ? '<div class="server-icon" style="background-image:url(\'' + esc(server.icon) + '\')"></div>' : '') +
			'<span class="server-players' + (server.custom ? ' official' : '') + '">' +
				(server.custom ? 'Official server' : compact(server.players || 0) + ' online') + '</span>' +
		'</div>' +
		'<div class="server-body">' +
			'<div class="server-title" data-action="server:' + esc(server.id) + '"><h4>' + esc(server.name) + '</h4>' +
				'<span class="server-addr mono">' + esc(server.address || '') + '</span></div>' +
			'<p class="server-desc" data-action="server:' + esc(server.id) + '">' + esc(server.description || '') + '</p>' +
			'<div class="server-tags">' + tags + '</div>' +
			'<div class="server-actions">' +
				'<button class="btn join" data-action="join:' + esc(server.id) + '">Join Server</button>' +
				'<button class="btn copy" data-action="copy:' + esc(server.id) + '">Copy IP</button>' +
			'</div>' +
		'</div>' +
	'</article>';
}

function filteredServers() {
	const list = state.servers || [];
	const needle = state.serverQuery.trim().toLowerCase();
	return list.filter((s) => {
		const tagOk = !state.serverTag || (s.tags || []).includes(state.serverTag);
		const textOk = !needle ||
			String(s.name).toLowerCase().includes(needle) ||
			String(s.address || '').toLowerCase().includes(needle);
		return tagOk && textOk;
	});
}

function serversView() {
	const tags = Array.from(new Set((state.servers || []).flatMap((s) => s.tags || []))).slice(0, 8);
	const list = filteredServers();
	let body;
	if (state.servers === null) {
		body = '<div class="skeleton"><span class="spinner"></span> Loading servers…</div>';
	} else if (state.serverError) {
		body = '<div class="note">' + esc(state.serverError) + ' <button class="link" data-action="reload-servers">Retry</button></div>';
	} else if (!list.length) {
		body = '<div class="empty">No servers match that search.</div>';
	} else {
		body = '<div class="server-grid">' + list.map(serverCard).join('') + '</div>';
	}

	return '' +
	'<div class="page-head"><div><h1>Servers</h1>' +
		'<p>' + (state.servers ? state.servers.length + ' servers in your list' : 'Live Eaglercraft server list') + '</p></div>' +
		'<button class="btn ghost-gold" data-action="add-server" style="width:auto;height:36px;padding:0 16px">Add Server</button></div>' +
	'<div class="partner">' +
		'<img class="partner-logo" src="' + PATHOST + '" alt="Path Host">' +
		'<div class="partner-text"><span class="name">Path Host</span>' +
			'<span class="role">Official Hosting Partner</span></div>' +
		'<span class="go"><a href="https://pathost.xyz" target="_blank" rel="noopener noreferrer">pathost.xyz ' +
			'<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M8 16 16 8M9 8h7v7"/></svg></a></span>' +
	'</div>' +
	'<div class="toolbar">' +
		'<input class="input" id="serverSearch" placeholder="Search servers…" value="' + esc(state.serverQuery) + '">' +
		'<button class="chip' + (state.serverTag ? '' : ' on') + '" data-action="server-tag:">All</button>' +
		tags.map((t) => '<button class="chip' + (state.serverTag === t ? ' on' : '') + '" data-action="server-tag:' + esc(t) + '">' + esc(t) + '</button>').join('') +
	'</div>' +
	body;
}

function watchServerVideos() {
	if (!('IntersectionObserver' in window)) return;
	const observer = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			const video = entry.target;
			if (entry.isIntersecting) {
				const playing = video.play();
				if (playing && playing.catch) playing.catch(() => {});
			} else {
				video.pause();
			}
		}
	}, { root: document.getElementById('view'), threshold: 0.15 });
	document.querySelectorAll('.server-media video').forEach((video) => observer.observe(video));
}

// ---------------------------------------------------------------- mods

function modRow(mod) {
	const installed = isInstalled(mod.id);
	return '' +
	'<div class="mod-row">' +
		'<div class="mod-icon" style="background-image:url(\'' + esc(mod.icon || '') + '\')"></div>' +
		'<div class="mod-main">' +
			'<div class="mod-title"><h4>' + esc(mod.title) + '</h4></div>' +
			'<p class="mod-desc">' + esc(mod.description) + '</p>' +
			'<div class="mod-meta"><span>' + compact(mod.downloads) + ' downloads</span>' +
				'<span>by ' + esc(mod.author || 'unknown') + '</span>' +
				'<span class="tagpill">1.21.11</span><span class="tagpill">Fabric</span></div>' +
		'</div>' +
		'<div class="mod-side">' +
			(installed
				? '<button class="btn installed" data-action="uninstall:' + esc(mod.id) + '">Installed</button>'
				: '<button class="btn install" data-action="install:' + esc(mod.id) + '">Install</button>') +
		'</div>' +
	'</div>';
}

function modsView() {
	return '<div id="pretzel-mods-root"></div>';
}

// ---------------------------------------------------------------- friends

function friendsView() {
	const account = currentAccount();
	if (!account) {
		return '<div class="page-head"><div><h1>Friends</h1>' +
			'<p>Friends see when you are online and can message you</p></div></div>' +
			'<div class="empty locked-empty">' +
				'<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6">' +
				'<rect x="4.5" y="10.5" width="15" height="9.5" rx="2"></rect><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"></path></svg>' +
				'<p>Friends are locked until you sign in.</p>' +
				'<button class="btn gold" style="width:auto;padding:0 18px" data-action="open-login">Login to continue</button>' +
			'</div>';
	}

	const tab = state.friendTab;
	const friends = account.friends || [];
	const requests = account.requests || [];
	const sent = account.sent || [];
	const rows = (list, emptyText, actions) => list.length
		? list.map((f) => '' +
			'<div class="friend-card">' + headMarkup(f.skin, 'head-34') +
				'<div><div class="friend-name">' + esc(f.name) + '</div>' +
					'<div class="friend-state ' + (f.state === 'online' ? 'online' : '') + '">' +
					(f.state === 'online' ? 'Online' : 'Offline') + '</div></div>' +
				(actions ? '<div style="margin-left:auto;display:flex;gap:8px">' + actions(f) + '</div>' : '') +
			'</div>').join('')
		: '<div class="empty">' + emptyText + '</div>';

	let list = '';
	if (tab === 'friends') list = rows(friends, 'No friends yet. Add someone above.', (f) =>
		'<button class="btn" style="height:30px;width:auto;padding:0 12px" data-action="remove-friend:' + esc(f.name) + '">Remove</button>');
	if (tab === 'requests') list = rows(requests, 'No incoming requests.', (f) =>
		'<button class="btn installed" style="height:30px;width:auto;padding:0 12px" data-action="accept:' + esc(f.name) + '">Accept</button>');
	if (tab === 'sent') list = rows(sent, 'Nothing sent.', null);

	return '' +
	'<div class="friends-page">' +
		'<div class="page-head"><div><h1>Friends</h1>' +
			'<p>' + friends.length + ' friends &middot; ' + friends.filter((f) => f.state === 'online').length + ' online</p></div></div>' +
		'<div class="add-friend">' +
			'<input class="input" id="friendName" placeholder="Pretzel username">' +
			'<button class="btn ghost-gold" data-action="add-friend">Send Request</button>' +
		'</div>' +
		'<p class="hint" style="margin:0 0 12px">Friends see when you are online and can message you.</p>' +
		'<div class="f-tabs">' +
			'<button class="' + (tab === 'requests' ? 'on' : '') + '" data-action="friend-tab:requests">Requests</button>' +
			'<button class="' + (tab === 'friends' ? 'on' : '') + '" data-action="friend-tab:friends">Friends ' + friends.length + '</button>' +
			'<button class="' + (tab === 'sent' ? 'on' : '') + '" data-action="friend-tab:sent">Sent</button>' +
		'</div>' + list +
	'</div>' +
	'<aside class="friends-side">' +
		'<div class="friends-side-head">Friends</div>' +
		(friends.length ? friends.map((f) => '<div class="friends-side-row"><span class="friends-side-dot ' + (f.state === 'online' ? 'online' : '') + '"></span><span>' + esc(f.name) + '</span></div>').join('') : '<div class="friends-side-empty">No friends online</div>') +
	'</aside>';
}

// ---------------------------------------------------------------- store

function storeView() {
	return '' +
	'<div class="page-head"><div><h1>Store</h1><p>Cosmetics, capes and ranks</p></div></div>' +
	'<div class="store-hero">' +
		'<img src="/pretzel-logo.png" alt="">' +
		'<h2>Store coming soon</h2>' +
		'<p>Capes, wings and cosmetics will be here. Pretzel Premium unlocks them one to two months early.</p>' +
		'<span class="soon">Coming soon</span>' +
	'</div>';
}

// ------------------------------------------------------------------ events

function findServer(id) {
	return (state.servers || []).find((s) => s.id === id) || state.serverDetail;
}

async function copyText(text) {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch (e) {
		return false;
	}
}

function focusLogin() {
	state.modal = { type: 'auth' };
	state.authMode = 'login';
	state.authError = '';
	renderModal();
	const input = document.getElementById('loginUser');
	if (input) input.focus();
}

document.addEventListener('click', async (event) => {
	const target = event.target.closest('[data-action]');
	if (!target) return;
	const action = target.getAttribute('data-action');

	if (action === 'modal-close') {
		if (target.classList.contains('modal-backdrop') && event.target !== target) return;
		closeModal();
		return;
	}
	if (action.startsWith('nav:')) {
		state.view = action.slice(4);
		state.modal = null;
		render();
		if (state.view === 'servers') loadServers(false);
		if (state.view === 'mods') loadMods(false);
		return;
	}
	if (action === 'launch') {
		location.href = CLIENT_URL;
		return;
	}
	if (action === 'open-login') {
		focusLogin();
		return;
	}
	if (action === 'swap-signup') {
		state.authMode = 'signup';
		state.authError = '';
		renderModal();
		return;
	}
	if (action === 'swap-login') {
		state.authMode = 'login';
		state.authError = '';
		renderModal();
		return;
	}
	if (action === 'forgot') {
		toast('Password resets are local only. Create a new account instead.');
		return;
	}
	if (action === 'signout') {
		signOut();
		return;
	}
	if (action === 'pick-skin') {
		const input = document.getElementById('skinFile');
		if (input) input.click();
		return;
	}
	if (action === 'pick-banner') {
		const input = document.getElementById('bannerFile');
		if (input) input.click();
		return;
	}
	if (action === 'dismiss-announce') {
		state.announceDismissed = true;
		renderView();
		return;
	}
	if (action.startsWith('post:')) {
		const post = newsList().find((item) => item.id === action.slice(5));
		if (post) {
			state.newsDetail = post;
			openModal({ type: 'post' });
		}
		return;
	}
	if (action.startsWith('go-server:')) {
		state.view = 'servers';
		render();
		loadServers(false);
		const server = findServer(action.slice(10));
		if (server) {
			state.serverDetail = server;
			openModal({ type: 'server' });
		}
		return;
	}
	if (action === 'create-news') {
		const account = currentAccount();
		if (!account || account.role !== 'owner') {
			toast('Only the owner account can publish news.', 'bad');
			return;
		}
		state.newsDraft = { banner: '', title: '', description: '' };
		state.authError = '';
		openModal({ type: 'news' });
		return;
	}
	if (action === 'add-server') {
		state.authError = '';
		openModal({ type: 'add-server' });
		return;
	}
	if (action === 'reload-servers') {
		state.servers = null;
		renderView();
		loadServers(true);
		return;
	}
	if (action === 'reload-mods') {
		state.mods = null;
		loadMods(true);
		return;
	}
	if (action.startsWith('server-tag:')) {
		state.serverTag = action.slice(11);
		renderView();
		return;
	}
	if (action.startsWith('server:')) {
		const server = findServer(action.slice(7));
		if (server) {
			state.serverDetail = server;
			openModal({ type: 'server' });
		}
		return;
	}
	if (action.startsWith('modtab:')) {
		state.modSource = action.slice(7);
		renderView();
		if (state.modSource === 'modrinth') loadMods(false);
		return;
	}
	if (action.startsWith('install:')) {
		const mod = (state.mods || []).find((m) => m.id === action.slice(8));
		if (mod) await installMod(mod);
		return;
	}
	if (action.startsWith('uninstall:')) {
		await uninstallMod(action.slice(10));
		return;
	}
	if (action.startsWith('join:')) {
		const server = findServer(action.slice(5));
		if (!server) return;
		await copyText(server.address || '');
		toast('Address copied - paste it in Multiplayer. Launching…', 'good');
		setTimeout(() => { location.href = CLIENT_URL; }, 700);
		return;
	}
	if (action.startsWith('copy:')) {
		const server = findServer(action.slice(5));
		if (!server) return;
		const ok = await copyText(server.address || '');
		toast(ok ? 'Copied ' + server.address : 'Copy failed: ' + server.address, ok ? 'good' : 'bad');
		return;
	}
	if (action.startsWith('friend-tab:')) {
		state.friendTab = action.slice(11);
		renderView();
		return;
	}
	if (action === 'add-friend') {
		const input = document.getElementById('friendName');
		const name = (input ? input.value : '').trim();
		if (!name) {
			toast('Type a username first', 'bad');
			return;
		}
		updateAccount((account) => {
			account.friends = account.friends || [];
			account.sent = account.sent || [];
			if (!account.friends.some((f) => f.name.toLowerCase() === name.toLowerCase()) &&
				!account.sent.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
				account.sent.push({ name, state: 'offline', skin: null });
			}
		});
		toast('Request sent to ' + name, 'good');
		state.friendTab = 'sent';
		render();
		return;
	}
	if (action.startsWith('remove-friend:')) {
		const name = action.slice(14);
		updateAccount((account) => {
			account.friends = (account.friends || []).filter((f) => f.name !== name);
		});
		toast('Removed ' + name);
		render();
		return;
	}
	if (action.startsWith('accept:')) {
		const name = action.slice(7);
		updateAccount((account) => {
			account.requests = (account.requests || []).filter((f) => f.name !== name);
			account.friends = account.friends || [];
			account.friends.push({ name, state: 'offline', skin: null });
		});
		toast('You are now friends with ' + name, 'good');
		render();
		return;
	}
});

document.getElementById('accountChip').addEventListener('click', () => {
	const account = currentAccount();
	if (account) {
		openModal({ type: 'account' });
	} else {
		focusLogin();
	}
});

document.getElementById('premiumBtn').addEventListener('click', () => {
	toast('Pretzel Premium is coming soon - early cosmetics, 1 to 2 months before release.');
});

document.addEventListener('submit', async (event) => {
	const form = event.target.closest('[data-form]');
	if (!form) return;
	event.preventDefault();
	const kind = form.getAttribute('data-form');
	state.authError = '';
	try {
		if (kind === 'login') {
			if (!form.loginUser.value.trim() || !form.loginPass.value) throw new Error('Fill in both fields.');
			await signIn(form.loginUser.value, form.loginPass.value);
			const account = currentAccount();
			closeModal();
			toast('Welcome back ' + account.username, 'good');
			render();
			return;
		}
		if (kind === 'signup') {
			await signUp(form.suUser.value, form.suMail.value, form.suPass.value, form.suPass2.value);
			const account = currentAccount();
			closeModal();
			toast('Account created - welcome ' + account.username, 'good');
			render();
			return;
		}
		if (kind === 'add-server') {
			const name = form.addServerName.value.trim();
			const address = form.addServerAddress.value.trim();
			const description = form.addServerDesc.value.trim();
			if (!name) throw new Error('Give the server a name.');
			if (!address) throw new Error('Add the server address.');
			const manual = read('pretzel.manualServers.v1', []);
			const list = Array.isArray(manual) ? manual : [];
			list.push({ id: 'manual-' + Date.now(), name, address, description, tags: ['Custom'], players: 0, manual: true, banner: '', icon: '' });
			write('pretzel.manualServers.v1', list);
			await loadServers(true);
			state.view = 'servers';
			closeModal();
			toast(name + ' added to your servers', 'good');
			render();
			return;
		}
		if (kind === 'news') {
			const draft = state.newsDraft || { banner: '', title: '', description: '' };
			const title = form.newsTitle.value.trim();
			const description = form.newsDesc.value.trim();
			if (!draft.banner) throw new Error('A banner is required.');
			if (!title) throw new Error('Give the post a title.');
			if (!description) throw new Error('Add a description.');
			const account = currentAccount();
			const list = newsList();
			list.unshift({
				id: 'news-' + Date.now(),
				banner: draft.banner,
				title,
				description,
				author: account ? account.username : 'Pretzel',
				createdAt: Date.now(),
			});
			saveNews(list);
			state.newsDraft = null;
			closeModal();
			toast('News published', 'good');
			render();
			return;
		}
	} catch (e) {
		state.authError = e.message;
		renderModal();
	}
});

document.addEventListener('change', (event) => {
	const file = event.target.files && event.target.files[0];
	if (!file || !event.target.matches('input[type="file"]')) return;
	const kind = event.target.getAttribute('data-file');
	const reader = new FileReader();
	reader.onload = () => {
		const dataUrl = String(reader.result || '');
		if (kind === 'skin') {
			const account = currentAccount();
			if (account) {
				updateAccount((acc) => { acc.skin = dataUrl; });
				toast('Skin updated', 'good');
			} else {
				state.pendingSkin = dataUrl;
				write(LS.pendingSkin, dataUrl);
			}
			render();
			return;
		}
		if (kind === 'banner') {
			state.newsDraft = Object.assign({}, state.newsDraft, { banner: dataUrl });
			const titleInput = document.getElementById('newsTitle');
			const descInput = document.getElementById('newsDesc');
			const title = titleInput ? titleInput.value : '';
			const description = descInput ? descInput.value : '';
			state.newsDraft.title = title;
			state.newsDraft.description = description;
			renderModal();
		}
	};
	reader.readAsDataURL(file);
});

document.addEventListener('keydown', (event) => {
	if (event.key === 'Escape' && state.modal) {
		closeModal();
		return;
	}
	if (event.key !== 'Enter') return;
	const id = document.activeElement ? document.activeElement.id : '';
	if (id === 'serverSearch') {
		state.serverQuery = document.activeElement.value;
		renderView();
	} else if (id === 'modSearch') {
		state.modsQuery = document.activeElement.value;
		state.mods = null;
		loadMods(true);
	} else if (id === 'friendName') {
		const button = document.querySelector('[data-action="add-friend"]');
		if (button) button.click();
	}
});

document.addEventListener('input', (event) => {
	if (event.target.id === 'serverSearch') {
		state.serverQuery = event.target.value;
		const caret = event.target.selectionStart;
		renderView();
		const input = document.getElementById('serverSearch');
		if (input) {
			input.focus();
			if (caret != null) input.setSelectionRange(caret, caret);
		}
	}
});

// ------------------------------------------------------------------ boot

(async function boot() {
	await seedOwner();
	state.pendingSkin = read(LS.pendingSkin, null);
	render();
	loadStatus().then(renderTopbar);
	loadServers(false).then(() => { if (state.view === 'launchpad') renderView(); });
	setInterval(() => loadStatus().then(renderTopbar), 15000);
})();
