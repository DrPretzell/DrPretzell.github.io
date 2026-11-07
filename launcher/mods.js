'use strict';

/*
 * Pretzel launcher — Explore / Mods.
 *
 * This page is intentionally self-contained so the auth, server browser and
 * friends code in launcher.js stays untouched. It mounts into the element
 * returned by modsView() and drives everything from Modrinth's public API.
 */
(function () {
	const API = 'https://api.modrinth.com/v2';
	const INSTALLED_KEY = 'pretzel.installed.v1';
	const SALE_KEY = 'pretzel.mods.sale.v1';
	const TOP_LIMIT = 50;

	// Mods actually compiled into the client. Everything on Modrinth is a jar,
	// and this client is ahead-of-time compiled, so only these can run.
	const COMPILED = [
		{
			id: 'pretzel-essentials', title: 'Pretzel Essentials', author: 'DrPretzell', version: '1.0.0',
			description: 'FPS and mod card plus on-screen keystrokes. H toggles the card, K toggles keystrokes.',
		},
	];

	const CATALOG = [
		{
			slug: 'fabric-api', title: 'Fabric API', author: 'modmuss50',
			description: 'Lightweight and modular API providing common hooks and intercompatibility measures utilized by mods using the Fabric toolchain.',
			downloads: 295571504, updated: '2026-10-27T17:15:53.249505Z', tags: ['Fabric', 'Library'],
		},
		{
			slug: 'sodium', title: 'Sodium', author: 'CaffeineMC',
			description: 'A high-performance rendering engine replacement for Minecraft, which greatly improves frame rates and reduces micro-stutter.',
			downloads: 258920310, updated: '2026-10-15T17:51:44.107526Z', tags: ['Fabric', 'Optimization'],
		},
		{
			slug: 'iris', title: 'Iris Shaders', author: 'coderbot',
			description: 'A modern shader pack loader for Minecraft intended to be compatible with existing OptiFine shader packs',
			downloads: 200160889, updated: '2026-09-30T02:58:24.095409Z', tags: ['Fabric', 'Decoration'],
		},
		{
			slug: 'entityculling', title: 'Entity Culling', author: 'tr7zw',
			description: 'Using async path-tracing to hide Block-/Entities that are not visible',
			downloads: 194408348, updated: '2026-10-08T16:52:22.330921Z', tags: ['Fabric', 'Optimization'],
		},
		{
			slug: 'cloth-config', title: 'Cloth Config API', author: 'shedaniel',
			description: 'Configuration Library for Minecraft Mods',
			downloads: 189897426, updated: '2026-09-23T07:00:51.350542Z', tags: ['Fabric', 'Library'],
		},
		{
			slug: 'ferrite-core', title: 'FerriteCore', author: 'malte0811',
			description: 'Memory usage optimizations',
			downloads: 170965806, updated: '2026-03-24T18:31:50.491773Z', tags: ['Fabric', 'Optimization'],
		},
	];

	const CATEGORY_LABELS = {
		adventure: 'Adventure', cursed: 'Cursed', decoration: 'Decoration', economy: 'Economy',
		equipment: 'Equipment', food: 'Food', library: 'Library', magic: 'Magic',
		optimization: 'Optimization', technology: 'Technology', utility: 'Utility', worldgen: 'Worldgen',
		storage: 'Storage', transportation: 'Transportation', misc: 'Miscellaneous',
	};

	const CATEGORIES = [
		{ value: 'adventure', label: 'Adventure', glyph: '⌖' },
		{ value: 'cursed', label: 'Cursed', glyph: '☠' },
		{ value: 'decoration', label: 'Decoration', glyph: '✿' },
		{ value: 'economy', label: 'Economy', glyph: '$' },
		{ value: 'equipment', label: 'Equipment', glyph: '⚔' },
		{ value: 'food', label: 'Food', glyph: '◒' },
		{ value: 'ores', label: 'Ores and Resources', glyph: '◈' },
		{ value: 'thermal', label: 'Thermal Expansion', glyph: '♨' },
		{ value: 'cosmetic', label: 'Cosmetic', glyph: '✦' },
		{ value: 'misc', label: 'Miscellaneous', glyph: '▦' },
		{ value: 'education', label: 'Education', glyph: '✎' },
		{ value: 'worldgen', label: 'Worldgen', glyph: '◍' },
		{ value: 'technology', label: 'Technology', glyph: '⚙' },
		{ value: 'magic', label: 'Magic', glyph: '✧' },
		{ value: 'optimization', label: 'Optimization', glyph: '⚡' },
		{ value: 'utility', label: 'Utility', glyph: '⚒' },
	];

	const TAG_GLYPHS = {
		Fabric: '▰', Forge: '▰', NeoForge: '▰', Quilt: '▰', Library: '▤',
		Optimization: '⚡', Decoration: '✿', Adventure: '⌖', Equipment: '⚔',
		Food: '◒', Utility: '⚒', Magic: '✧', Technology: '⚙', Worldgen: '◍',
		Economy: '$', Cursed: '☠', Cosmetic: '✦', Education: '✎', Miscellaneous: '▦',
		Storage: '▣', Transportation: '➜',
	};

	const LOADERS = [
		['fabric', 'Fabric', 'F'],
		['forge', 'Forge', 'F'],
		['neoforge', 'NeoForge', 'N'],
		['quilt', 'Quilt', 'Q'],
	];

	const GAME_VERSIONS = ['1.21.11', '1.21.10', '1.21.9'];

	const ICON = {
		search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>',
		chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg>',
		package: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 7 4v10l-7 4-7-4V7Z"></path><path d="m5 7 7 4 7-4M12 11v10"></path></svg>',
		download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4"></path><path d="M4 20h16"></path></svg>',
		eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path><circle cx="12" cy="12" r="2.5"></circle></svg>',
		clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"></circle><path d="M12 8v5l3 2"></path></svg>',
		check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"></path></svg>',
		verified: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.3 14.6 5l3.7.4.4 3.7L21.7 12 19 14.6l-.4 3.7-3.7.4L12 21.7 9.4 19l-3.7-.4-.4-3.7L2.3 12 5 9.4l.4-3.7L9.4 5 12 2.3Zm-1.1 13.4 5-5-1.4-1.4-3.6 3.6-1.9-1.9-1.4 1.4 3.3 3.3Z"></path></svg>',
		warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2.5 20.5h19L12 3Z"></path><path d="M12 9v5M12 17.3h.01"></path></svg>',
		client: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="1.5"></rect><path d="M8 21h8M12 17v4"></path></svg>',
		server: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="7" rx="1.5"></rect><rect x="4" y="14" width="16" height="7" rx="1.5"></rect><path d="M8 6.5h.01M8 17.5h.01"></path></svg>',
	};

	const state = {
		root: null,
		mods: null,
		loading: false,
		error: '',
		offline: false,
		top: true,
		total: 77948,
		page: 1,
		totalPages: 1,
		query: '',
		source: 'modrinth',
		sort: 'downloads',
		category: '',
		loader: 'fabric',
		version: '1.21.11',
		environment: 'client',
		expanded: false,
		sale: readSale(),
		modal: null,
		versions: {},
		versionsLoading: false,
		installing: '',
		downloadsOpen: false,
		downloadsClearedAt: 0,
		dismissed: new Set(),
		defaultCrumbs: '',
		defaultTitle: '',
		synced: false,
	};

	let searchTimer = null;
	let requestSeq = 0;
	let observer = null;

	function esc(value) {
		return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
			'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
		}[c]));
	}

	function readSale() {
		try {
			return localStorage.getItem(SALE_KEY) !== 'hidden';
		} catch (e) {
			return true;
		}
	}

	function hideSale() {
		try {
			localStorage.setItem(SALE_KEY, 'hidden');
		} catch (e) { /* local only */ }
	}

	function modCount(value) {
		const n = Number(value) || 0;
		if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
		if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
		if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
		return String(n);
	}

	function timeAgo(value) {
		const stamp = typeof value === 'number' ? value : Date.parse(value);
		if (!Number.isFinite(stamp)) return 'recently';
		const mins = Math.max(0, Math.floor((Date.now() - stamp) / 60000));
		if (mins < 1) return 'a few seconds ago';
		if (mins < 60) return mins + (mins === 1 ? ' minute ago' : ' minutes ago');
		const hours = Math.floor(mins / 60);
		if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
		const days = Math.floor(hours / 24);
		if (days < 30) return days + (days === 1 ? ' day ago' : ' days ago');
		const months = Math.floor(days / 30);
		if (months < 12) return months <= 1 ? 'a month ago' : months + ' months ago';
		const years = Math.floor(months / 12);
		return years <= 1 ? 'a year ago' : years + ' years ago';
	}

	function initial(title) {
		return String(title || '?').trim().charAt(0).toUpperCase() || '?';
	}

	function categoryLabel(value) {
		return CATEGORY_LABELS[String(value || '').toLowerCase()] || '';
	}

	function loaderLabel(value) {
		return ({ fabric: 'Fabric', forge: 'Forge', neoforge: 'NeoForge', quilt: 'Quilt' })[value] || '';
	}

	function hydrate(project, spec) {
		if (!project) return null;
		const tags = [];
		if (spec && Array.isArray(spec.tags)) {
			for (const tag of spec.tags) if (!tags.includes(tag)) tags.push(tag);
		} else {
			const loaders = Array.isArray(project.loaders) && project.loaders.length
				? project.loaders
				: [state.loader];
			const loader = loaders.includes(state.loader) ? state.loader : loaders[0];
			if (loader) tags.push(loaderLabel(loader));
			for (const category of (project.categories || [])) {
				const label = categoryLabel(category);
				if (label && !tags.includes(label)) tags.push(label);
			}
		}
		return {
			id: project.id || project.project_id || project.slug,
			slug: project.slug || (spec && spec.slug) || '',
			title: project.title || (spec && spec.title) || 'Mod',
			description: project.description || (spec && spec.description) || '',
			icon: project.icon_url || (spec && spec.icon) || '',
			downloads: Number(project.downloads) || 0,
			updated: project.updated || project.date_modified || new Date().toISOString(),
			author: (spec && spec.author) || project.author || 'Pretzel',
			tags: Array.from(new Set(tags)).slice(0, 3),
			verified: Boolean(spec && spec.verified),
		};
	}

	function fallbackMods() {
		return CATALOG.map((mod) => hydrate({
			id: mod.slug, slug: mod.slug, title: mod.title, description: mod.description,
			downloads: mod.downloads, updated: mod.updated, loaders: ['fabric'], categories: [],
		}, { author: mod.author, tags: mod.tags, verified: true })).filter(Boolean);
	}

	function sortMods(list) {
		const next = list.slice();
		if (state.sort === 'name') next.sort((a, b) => a.title.localeCompare(b.title));
		else if (state.sort === 'updated') next.sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated));
		else next.sort((a, b) => b.downloads - a.downloads);
		return next;
	}

	function installed() {
		try {
			const raw = localStorage.getItem(INSTALLED_KEY);
			const list = raw ? JSON.parse(raw) : [];
			return Array.isArray(list) ? list.filter((mod) => mod && mod.id) : [];
		} catch (e) {
			return [];
		}
	}

	function saveInstalled(list) {
		try {
			localStorage.setItem(INSTALLED_KEY, JSON.stringify(list));
		} catch (e) { /* keep this session usable */ }
	}

	function isInstalled(id) {
		return installed().some((mod) => mod.id === id);
	}

	function recentDownloads() {
		return installed()
			.filter((mod) => !state.dismissed.has(mod.id))
			.filter((mod) => !state.downloadsClearedAt || Number(mod.queuedAt || 0) > state.downloadsClearedAt)
			.sort((a, b) => Number(b.queuedAt || 0) - Number(a.queuedAt || 0));
	}

	function toast(message, bad) {
		const stack = document.getElementById('toasts');
		if (!stack) return;
		const node = document.createElement('div');
		node.className = 'toast' + (bad ? ' bad' : ' good');
		node.textContent = message;
		stack.appendChild(node);
		setTimeout(() => node.remove(), 4600);
	}

	function installedToast(mod) {
		const stack = document.getElementById('toasts');
		if (!stack) return;
		const node = document.createElement('div');
		node.className = 'toast mod-toast good';
		node.innerHTML = '<div class="mod-toast-icon"' +
			(mod.icon ? ' style="background-image:url(\'' + esc(mod.icon) + '\')"' : '') + '>' +
			(mod.icon ? '' : '<b>' + esc(initial(mod.title)) + '</b>') + '</div>' +
			'<div><b>Mod Installed</b><span>' + esc(mod.title) + ' has been installed.</span></div>';
		stack.appendChild(node);
		setTimeout(() => node.remove(), 5600);
	}

	function iconFor(mod) {
		return (mod && mod.icon) || (state.mods || []).find((item) => item.slug === mod.slug || item.id === mod.id)?.icon || '';
	}

	function modIcon(mod, extraClass) {
		const icon = mod && mod.icon ? mod.icon : '';
		return '<span class="mx-icon ' + (extraClass || '') + (icon ? '' : ' noimg') + '"' +
			(icon ? ' style="background-image:url(\'' + esc(icon) + '\')"' : '') + '>' +
			(icon ? '' : '<b>' + esc(initial(mod && mod.title)) + '</b>') + '</span>';
	}

	function statDownload(value) {
		return '<span>' + ICON.download + modCount(value) + '</span>';
	}

	function statTime(value) {
		return '<span>' + ICON.clock + timeAgo(value) + '</span>';
	}

	function tagsHTML(mod) {
		return (mod.tags || []).map((tag) =>
			'<span class="mx-tag"><i>' + esc(TAG_GLYPHS[tag] || '•') + '</i>' + esc(tag) + '</span>'
		).join('');
	}

	function sourceButton(source, label, dotClass) {
		return '<button class="mx-source-btn' + (state.source === source ? ' on' : '') +
			'" data-mx="source:' + source + '">' +
			'<span class="mx-source-dot ' + dotClass + '">' + (source === 'curseforge' ? 'C' : '◍') + '</span>' +
			label + '</button>';
	}

	function saleHTML() {
		if (!state.sale) return '';
		return '<div class="mx-sale"><span class="mx-pumpkin">🎃</span>' +
			'<span>Happy Halloween! The entire store is <b>15% off</b>! Ends in now</span>' +
			'<button class="mx-sale-x" data-mx="dismiss-sale" aria-label="Dismiss">&times;</button></div>';
	}

	function filtersHTML() {
		const count = state.source === 'curseforge' ? '10,000+' : (Number(state.total) || 77948).toLocaleString();
		const placeholder = state.source === 'curseforge'
			? 'CurseForge browsing needs an API key'
			: state.top
				? 'Filter the top ' + TOP_LIMIT + '...'
				: 'Search ' + count + ' mods on Modrinth...';
		return '<div class="mx-filterbar">' +
			'<div class="mx-page-title">' + ICON.package + '<span>Mods</span>' +
				'<span class="mx-caret">' + ICON.chevron + '</span></div>' +
			'<label class="mx-search">' + ICON.search +
				'<input id="mxSearch" type="search" autocomplete="off" spellcheck="false" value="' + esc(state.query) + '"' +
				(state.source === 'curseforge' ? ' disabled' : '') + ' placeholder="' + esc(placeholder) + '">' +
			'</label>' +
			'<div class="mx-select">' +
				'<select id="mxSort" aria-label="Sort mods">' +
					'<option value="downloads"' + (state.sort === 'downloads' ? ' selected' : '') + '>Popularity</option>' +
					'<option value="updated"' + (state.sort === 'updated' ? ' selected' : '') + '>Recently updated</option>' +
					'<option value="name"' + (state.sort === 'name' ? ' selected' : '') + '>Name</option>' +
				'</select>' + ICON.chevron +
			'</div>' +
			'<button class="mx-topbtn' + (state.top ? ' on' : '') + '" data-mx="top"' +
				' title="Modrinth top 50 for ' + esc(state.version) + '">Top 50</button>' +
			'<div class="mx-source">' + sourceButton('curseforge', 'CurseForge', 'cf') + sourceButton('modrinth', 'Modrinth', 'mr') + '</div>' +
		'</div>';
	}

	function skeletonHTML() {
		let rows = '';
		for (let i = 0; i < 6; i++) {
			rows += '<div class="mx-skel-row"><div class="mx-skel-block mx-skel-icon"></div>' +
				'<div><div class="mx-skel-block mx-skel-line short"></div>' +
				'<div class="mx-skel-block mx-skel-line"></div>' +
				'<div class="mx-skel-block mx-skel-line tiny"></div></div>' +
				'<div class="mx-skel-block mx-skel-actions"></div></div>';
		}
		return '<div class="mx-skeleton">' + rows + '</div>';
	}

	function installActions(mod) {
		const installedMod = isInstalled(mod.id);
		const busy = state.installing === mod.id;
		const installButton = busy
			? '<button class="mx-action install installing" disabled>' + ICON.download + 'Installing...</button>'
			: installedMod
				? '<button class="mx-action installed" data-mx="open:' + esc(mod.id) + '">' + ICON.check + 'Installed <span class="mx-caret">▾</span></button>'
				: '<button class="mx-action install" data-mx="open:' + esc(mod.id) + '">' + ICON.download + 'Install</button>';
		return '<button class="mx-action view" data-mx="view:' + esc(mod.id) + '">' + ICON.eye + 'View</button>' + installButton;
	}

	function rowHTML(mod, index) {
		const rank = state.top ? '<span class="mx-rank">#' + (index + 1) + '</span> ' : '';
		const actions = state.top
			? '<span class="mx-status" title="This is a Fabric jar. Pretzel compiles Java ahead of time, so jars cannot be loaded at runtime.">Jar · can’t run here</span>' +
				'<a class="mx-action view" href="https://modrinth.com/mod/' + esc(mod.slug) + '" target="_blank" rel="noopener noreferrer">Modrinth</a>'
			: installActions(mod);
		return '<article class="mx-row">' +
			modIcon(mod) +
			'<div class="mx-body">' +
				'<div class="mx-title-row"><h3>' + rank + esc(mod.title) +
					(mod.verified ? '<span class="mx-verified" title="Verified project">' + ICON.verified + '</span>' : '') +
				'</h3><div class="mx-stats">' + statDownload(mod.downloads) +
					'<span class="mx-sep">·</span>' + statTime(mod.updated) + '</div></div>' +
				'<p class="mx-desc">' + esc(mod.description) + '</p>' +
				'<div class="mx-meta"><span class="mx-author"><span class="mx-author-av">' + esc(initial(mod.author)) + '</span>' +
					esc(mod.author) + '</span><span class="mx-meta-dot">•</span>' + tagsHTML(mod) + '</div>' +
			'</div>' +
			'<div class="mx-actions">' + actions + '</div>' +
		'</article>';
	}

	function curseforgeHTML() {
		return '<div class="mx-cf-empty"><div class="mx-cf-mark">C</div>' +
			'<h3>CurseForge browsing needs an API key</h3>' +
			'<p>Modrinth is live and needs no key. Add a CurseForge key to the launcher to search its catalog here, or switch back to Modrinth.</p>' +
			'<button class="mx-primary" data-mx="source:modrinth">Browse Modrinth</button></div>';
	}

	function pageNumbers(current, total) {
		const wanted = new Set([1, total, current - 2, current - 1, current, current + 1, current + 2]);
		const numbers = Array.from(wanted).filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
		const result = [];
		for (let i = 0; i < numbers.length; i++) {
			if (i && numbers[i] - numbers[i - 1] > 1) result.push('…');
			result.push(numbers[i]);
		}
		return result;
	}

	function pagerHTML() {
		if (state.loading || state.source === 'curseforge' || state.error || !state.total || state.top) return '';
		const pages = Math.max(1, state.totalPages || Math.ceil(state.total / 10));
		const start = (state.page - 1) * 10 + 1;
		const end = Math.min(state.page * 10, state.total);
		const buttons = pageNumbers(state.page, pages).map((n) => n === '…'
			? '<span class="mx-page-dots">…</span>'
			: '<button class="mx-page-btn' + (n === state.page ? ' on' : '') + '" data-mx="page:' + n + '"' +
				(n === state.page ? ' aria-current="page"' : '') + '>' + n + '</button>').join('');
		return '<div class="mx-pager">' +
			'<div class="mx-pager-count">Showing ' + start.toLocaleString() + '–' + end.toLocaleString() + ' of ' + Number(state.total).toLocaleString() + ' mods</div>' +
			'<div class="mx-pager-controls"><button class="mx-page-arrow" data-mx="page:prev"' + (state.page <= 1 ? ' disabled' : '') + ' aria-label="Previous page">‹</button>' +
				buttons +
				'<button class="mx-page-arrow" data-mx="page:next"' + (state.page >= pages ? ' disabled' : '') + ' aria-label="Next page">›</button></div>' +
			'<div class="mx-page-label">Page ' + state.page.toLocaleString() + ' of ' + pages.toLocaleString() + '</div>' +
		'</div>';
	}

	function topNoteHTML() {
		return '<div class="mx-topnote"><b>Modrinth’s top ' + TOP_LIMIT + ' for ' + esc(state.version) + '</b>' +
			'<span>Ranked by downloads. Pretzel compiles its Java client ahead of time, so these Fabric jars cannot be loaded at runtime — each row is a reference link, not an install. Mods compiled into this build are listed under “Built into this build” and in the in-game Mod Hub (Right Shift).</span></div>';
	}

	function includedHTML() {
		return '<div class="mx-included"><div class="mx-included-head"><b>Built into this build</b>' +
			'<span>' + COMPILED.length + ' compiled mod' + (COMPILED.length === 1 ? '' : 's') + '</span></div>' +
			COMPILED.map((mod) => '<div class="mx-included-row">' + modIcon(mod) +
				'<div><b>' + esc(mod.title) + '</b><span class="mx-inc-ver">v' + esc(mod.version) + '</span>' +
					'<p>' + esc(mod.description) + '</p></div>' +
				'<span class="mx-inc-chip">Built in</span></div>').join('') + '</div>';
	}

	function resultsHTML() {
		if (state.source === 'curseforge') return curseforgeHTML();
		if (state.loading) return skeletonHTML();
		if (state.error) {
			return '<div class="mx-empty">' + esc(state.error) +
				'<div style="margin-top:12px"><button class="mx-primary" data-mx="retry">Retry</button></div></div>';
		}
		const list = state.mods || [];
		if (!list.length) return (state.top ? topNoteHTML() + includedHTML() : '') + '<div class="mx-empty">No mods match those filters.</div>';
		return (state.top ? topNoteHTML() + includedHTML() : '') + list.map(rowHTML).join('') + pagerHTML() +
			(state.offline ? '<div class="mx-offline">Showing bundled mod info because Modrinth could not be reached.</div>' : '');
	}

	function categoryButtons() {
		const shown = state.expanded ? CATEGORIES : CATEGORIES.slice(0, 10);
		return shown.map((cat) =>
			'<button class="mx-cat' + (state.category === cat.value ? ' on' : '') +
			'" data-mx="category:' + cat.value + '"><i>' + cat.glyph + '</i>' + esc(cat.label) + '</button>'
		).join('');
	}

	function asideHTML() {
		const loaders = LOADERS.map(([value, label, mark]) =>
			'<button class="mx-loader' + (state.loader === value ? ' on' : '') + '" data-mx="loader:' + value + '">' +
			'<span class="mx-loader-mark">' + mark + '</span>' + label + '</button>'
		).join('');
		const versions = GAME_VERSIONS.map((version) =>
			'<button class="mx-version-chip' + (state.version === version ? ' on' : '') + '" data-mx="version:' + version + '">' + version + '</button>'
		).join('');
		return '<aside class="mx-aside">' +
			'<section class="mx-panel"><h4>Categories</h4><div class="mx-cat-grid">' + categoryButtons() + '</div>' +
				'<button class="mx-more" data-mx="toggle-categories">' + (state.expanded ? 'View Less' : 'View 13 More') + '</button></section>' +
			'<section class="mx-panel"><h4>Loaders</h4><div class="mx-loader-grid">' + loaders + '</div></section>' +
			'<section class="mx-panel"><h4>Environment</h4><div class="mx-env-grid">' +
				'<button class="mx-env' + (state.environment === 'client' ? ' on' : '') + '" data-mx="environment:client">' + ICON.client + 'Client</button>' +
				'<button class="mx-env" data-mx="environment:server" title="Open the Servers section">' + ICON.server + 'Server</button>' +
			'</div></section>' +
			'<section class="mx-panel"><h4>Game Versions</h4><div class="mx-version-grid">' + versions + '</div></section>' +
			'<div class="mx-sponsor"><span class="mx-sponsor-note">PRETZEL+</span>' +
				'<div class="mx-sponsor-brand">PRETZEL <span>PREMIUM</span></div>' +
				'<h3>Play in <em>style.</em></h3>' +
				'<p>Cosmetics, capes and wings before release. Support the client and stand out in every lobby.</p>' +
				'<button data-mx="premium">Learn more →</button>' +
				'<img class="mx-sponsor-mark" src="/pretzel-logo.png" alt="">' +
			'</div>' +
			'<div class="mx-adfoot"><span>Remove ads with Pretzel+</span><button data-mx="premium">Subscribe</button></div>' +
		'</aside>';
	}

	function pageHTML() {
		return '<div class="mx-page">' + saleHTML() +
			'<div class="mx-inner">' + filtersHTML() +
				'<div class="mx-layout"><section class="mx-results">' + resultsHTML() + '</section>' + asideHTML() + '</div>' +
			'</div></div>';
	}

	function render() {
		if (!state.root) return;
		state.root.innerHTML = pageHTML();
		renderDownloads();
	}

	function focusSearch() {
		const input = document.getElementById('mxSearch');
		if (!input) return;
		input.focus();
		input.setSelectionRange(input.value.length, input.value.length);
	}

	async function load() {
		const seq = ++requestSeq;
		const keepFocus = document.activeElement && document.activeElement.id === 'mxSearch';
		state.loading = true;
		state.error = '';
		state.offline = false;
		render();
		try {
			if (state.top) {
				// One request for the whole ranked list; facets keep it to Fabric 1.21.11.
				const facets = [['versions:' + state.version], ['categories:fabric']];
				let url = API + '/search?limit=' + TOP_LIMIT + '&offset=0&index=downloads&facets=' +
					encodeURIComponent(JSON.stringify(facets));
				if (state.query) url += '&query=' + encodeURIComponent(state.query);
				const res = await fetch(url, { cache: 'no-store' });
				if (!res.ok) throw new Error('HTTP ' + res.status);
				const data = await res.json();
				if (seq !== requestSeq) return;
				state.mods = (data.hits || []).map((hit) => hydrate({
					id: hit.project_id, slug: hit.slug, title: hit.title, description: hit.description,
					icon_url: hit.icon_url, downloads: hit.downloads, date_modified: hit.date_modified,
					categories: hit.categories, loaders: [state.loader],
				}, { author: hit.author, verified: false })).filter(Boolean)
					.sort((a, b) => b.downloads - a.downloads)
					.slice(0, TOP_LIMIT);
				state.total = state.mods.length;
				state.totalPages = 1;
				state.page = 1;
			} else {
				const facets = [];
				if (state.version) facets.push(['versions:' + state.version]);
				if (state.loader) facets.push(['categories:' + state.loader]);
				if (state.category) facets.push(['categories:' + state.category]);
				const index = state.sort === 'updated' ? 'updated' : 'downloads';
				let url = API + '/search?limit=10&offset=' + ((state.page - 1) * 10) + '&index=' + index +
					'&facets=' + encodeURIComponent(JSON.stringify(facets));
				if (state.query) url += '&query=' + encodeURIComponent(state.query);
				const res = await fetch(url, { cache: 'no-store' });
				if (!res.ok) throw new Error('HTTP ' + res.status);
				const data = await res.json();
				if (seq !== requestSeq) return;
				state.mods = sortMods((data.hits || []).map((hit) => hydrate({
					id: hit.project_id, slug: hit.slug, title: hit.title, description: hit.description,
					icon_url: hit.icon_url, downloads: hit.downloads, date_modified: hit.date_modified,
					categories: hit.categories, loaders: [state.loader],
				}, { author: hit.author, verified: false })).filter(Boolean));
				state.total = Number(data.total_hits) || state.mods.length;
				state.totalPages = Math.max(1, Math.ceil(state.total / 10));
			}
		} catch (e) {
			if (seq !== requestSeq) return;
			state.mods = sortMods(fallbackMods());
			state.total = state.mods.length;
			state.totalPages = 1;
			state.page = 1;
			state.offline = true;
		}
		state.loading = false;
		render();
		if (keepFocus) requestAnimationFrame(focusSearch);
	}

	function reload() {
		state.page = 1;
		state.mods = null;
		state.loading = true;
		render();
		load();
	}

	async function syncQueue() {
		if (state.synced) return;
		state.synced = true;
		try {
			const res = await fetch('/api/launcher/mods', { cache: 'no-store' });
			if (!res.ok) return;
			const data = await res.json();
			const queue = Array.isArray(data) ? data : (data.mods || []);
			if (!Array.isArray(queue) || !queue.length) return;
			const list = installed();
			let changed = false;
			for (const item of queue) {
				if (!item || !item.id || list.some((mod) => mod.id === item.id)) continue;
				list.push({
					id: item.id,
					title: item.title || item.slug || 'Mod',
					slug: item.slug || '',
					source: item.source || 'modrinth',
					icon: (state.mods || []).find((mod) => mod.slug === item.slug)?.icon || '',
					version: '',
					file: item.file || '',
					bytes: item.bytes || 0,
					queuedAt: item.queuedAt || Date.now(),
				});
				changed = true;
			}
			if (changed) {
				saveInstalled(list);
				renderDownloads();
				if (state.root) render();
			}
		} catch (e) { /* optional sync */ }
	}

	function renderDownloads() {
		const button = document.getElementById('mxDownloadsBtn');
		const pop = document.getElementById('mxDownloadsPop');
		if (!button || !pop) return;
		const recent = recentDownloads();
		const badge = document.getElementById('mxDownloadBadge');
		if (badge) {
			badge.textContent = String(recent.length);
			badge.hidden = recent.length === 0;
		}
		pop.hidden = !state.downloadsOpen;
		const rows = recent.map((mod) => {
			const icon = iconFor(mod);
			return '<div class="mx-dl-row">' +
				'<div class="mx-dl-icon"' + (icon ? ' style="background-image:url(\'' + esc(icon) + '\')"' : '') + '>' +
					(icon ? '' : esc(initial(mod.title))) + '</div>' +
				'<div><div class="mx-dl-name">' + esc(mod.title) + '</div>' +
					'<div class="mx-dl-state">' + ICON.check + 'Done <span>· ' + esc(timeAgo(mod.queuedAt || (Date.now() - 5000))) + '</span></div></div>' +
				'<button class="mx-dl-x" data-mx="dismiss-download:' + esc(mod.id) + '" aria-label="Dismiss">&times;</button>' +
			'</div>';
		}).join('');
		pop.innerHTML = '<div class="mx-dl-head"><div><b>Downloads (' + recent.length + ')</b>' +
			'<span>' + recent.length + ' done</span></div>' +
			'<button class="mx-dl-clear" data-mx="clear-downloads">Clear</button></div>' +
			'<div class="mx-dl-list">' + (rows || '<div class="mx-dl-empty">No downloads yet.</div>') + '</div>';
	}

	function openModal(mod) {
		state.modal = { mod, step: 'deps', selected: 0, error: '' };
		renderModal();
	}

	function closeModal() {
		state.modal = null;
		renderModal();
	}

	async function loadVersions(mod) {
		if (state.versions[mod.id]) {
			renderModal();
			return;
		}
		state.versionsLoading = true;
		renderModal();
		try {
			const url = API + '/project/' + encodeURIComponent(mod.slug || mod.id) +
				'/version?game_versions=' + encodeURIComponent(JSON.stringify([state.version])) +
				'&loaders=' + encodeURIComponent(JSON.stringify(['fabric']));
			const res = await fetch(url, { cache: 'no-store' });
			state.versions[mod.id] = res.ok ? await res.json() : [];
			if (!Array.isArray(state.versions[mod.id])) state.versions[mod.id] = [];
		} catch (e) {
			state.versions[mod.id] = [];
		}
		state.versionsLoading = false;
		renderModal();
	}

	function versionSize(version) {
		const bytes = version && version.files && version.files[0] ? Number(version.files[0].size) : 0;
		if (!bytes) return '';
		if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
		return Math.max(1, Math.round(bytes / 1024)) + ' KB';
	}

	function depsHTML() {
		const mod = state.modal.mod;
		const fabric = installed().find((item) => item.slug === 'fabric-api' || item.id === 'P7dR8mSH');
		const fabricIcon = modIcon({ title: 'Fabric API', icon: (state.mods || []).find((item) => item.slug === 'fabric-api')?.icon || '' });
		return '<div class="mx-modal-head">' + modIcon(mod) + '<h3>Install ' + esc(mod.title) + '</h3></div>' +
			'<div class="mx-warning">' + ICON.warning +
				'<div>Pretzel Client does not review mods from Modrinth or CurseForge.<br>Only install content from sources you trust.</div></div>' +
			'<div class="mx-deps-head">Required Dependencies (1)<span>▴</span></div>' +
			'<div class="mx-dep-row">' + fabricIcon + '<span>Fabric API</span>' +
				'<span class="mx-dep-state' + (fabric ? ' ok' : '') + '">' + (fabric ? '✓ Installed' : 'Required') + '</span></div>' +
			'<p class="mx-note">Could not check this against your mods.</p>' +
			(state.modal.error ? '<div class="mx-modal-error">' + esc(state.modal.error) + '</div>' : '') +
			'<div class="mx-modal-foot"><span class="mx-fabric-badge"><span class="mx-fabric-check">✓</span>Fabric ' + esc(state.version) + '</span>' +
				'<div class="mx-modal-actions"><button class="mx-back" data-mx="close-modal">Back</button>' +
				'<button class="mx-primary" data-mx="versions">' + ICON.download + 'Install</button></div></div>';
	}

	function versionsHTML() {
		const mod = state.modal.mod;
		const list = state.versions[mod.id] || [];
		const selected = Math.min(state.modal.selected || 0, Math.max(0, list.length - 1));
		let body;
		let nextDisabled = false;
		if (state.versionsLoading) {
			body = '<div class="mx-versions-empty"><span class="spinner"></span> Loading compatible versions…</div>';
			nextDisabled = true;
		} else if (!list.length) {
			body = '<div class="mx-versions-empty">No Fabric ' + esc(state.version) + ' builds found for ' + esc(mod.title) + '.</div>';
			nextDisabled = true;
		} else {
			body = list.map((version, index) => {
				const size = versionSize(version);
				return '<label class="mx-version' + (index === selected ? ' selected' : '') + '" data-mx="pick-version:' + index + '">' +
					'<input type="radio" name="mxVersion" ' + (index === selected ? 'checked' : '') + '>' +
					'<span class="mx-radio"></span><span class="mx-version-body">' +
						'<span class="mx-version-name">' + esc(version.name || version.version_number || 'Version') +
							(index === 0 ? '<span class="mx-rec">✦ Recommended</span>' : '') + '</span>' +
						'<span class="mx-version-meta"><span>' + ICON.download + modCount(version.downloads) + '</span>' +
							'<span>·</span><span>' + ICON.clock + timeAgo(version.date_published) + '</span>' +
							(size ? '<span>·</span><span>' + esc(size) + '</span>' : '') + '</span>' +
					'</span></label>';
			}).join('');
		}
		return '<div class="mx-modal-head">' + modIcon(mod) + '<h3>Install ' + esc(mod.title) + '</h3></div>' +
			'<div class="mx-warning">' + ICON.warning +
				'<div>Pretzel Client does not review mods from Modrinth or CurseForge.<br>Only install content from sources you trust.</div></div>' +
			'<div class="mx-versions-head">Compatible Versions (' + list.length + ')<span>Show incompatible</span></div>' +
			'<div class="mx-version-list">' + body + '</div>' +
			(state.modal.error ? '<div class="mx-modal-error">' + esc(state.modal.error) + '</div>' : '') +
			'<p class="mx-note">Could not check this against your mods.</p>' +
			'<div class="mx-modal-foot"><span class="mx-fabric-badge"><span class="mx-fabric-check">✓</span>Fabric ' + esc(state.version) + '</span>' +
				'<div class="mx-modal-actions"><button class="mx-back" data-mx="deps">Back</button>' +
				'<button class="mx-primary" data-mx="install-selected"' + (nextDisabled || state.installing ? ' disabled' : '') + '>' +
					(state.installing ? 'Installing…' : ('Next ' + ICON.download)) + '</button></div></div>';
	}

	function renderModal() {
		let host = document.getElementById('mxModalRoot');
		if (!state.modal) {
			if (host) host.remove();
			return;
		}
		if (!host) {
			host = document.createElement('div');
			host.id = 'mxModalRoot';
			document.body.appendChild(host);
		}
		const mod = state.modal.mod;
		const body = state.modal.step === 'versions' ? versionsHTML() : depsHTML();
		host.innerHTML = '<div class="mx-modal-backdrop" data-mx="close-modal">' +
			'<div class="mx-modal" role="dialog" aria-modal="true" aria-label="Install ' + esc(mod.title) + '">' +
				'<button class="mx-modal-x" data-mx="close-modal" aria-label="Close">&times;</button>' + body +
			'</div></div>';
	}

	async function installSelected() {
		if (!state.modal || state.modal.step !== 'versions' || state.installing) return;
		const mod = state.modal.mod;
		const list = state.versions[mod.id] || [];
		const version = list[state.modal.selected || 0];
		if (!version) return;
		const file = version.files && version.files[0] ? version.files[0] : null;
		if (!file) {
			state.modal.error = 'This version has no download file.';
			renderModal();
			return;
		}
		state.installing = mod.id;
		state.modal.error = '';
		renderModal();
		try {
			const res = await fetch('/api/launcher/mods', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'install',
					mod: {
						id: mod.id, title: mod.title, slug: mod.slug, source: 'modrinth',
						version: version.version_number || version.name || '',
						fileUrl: file.url || '', fileName: file.filename || '',
					},
				}),
			});
			if (!res.ok) throw new Error('HTTP ' + res.status);
			const result = await res.json().catch(() => ({}));
			const next = installed().filter((item) => item.id !== mod.id);
			next.push(Object.assign({}, mod, {
				version: version.version_number || version.name || '',
				file: result.downloaded ? file.filename : '',
				bytes: result.bytes || 0,
				queuedAt: Date.now(),
			}));
			saveInstalled(next);
			state.downloadsClearedAt = 0;
			state.installing = '';
			state.modal = null;
			renderModal();
			installedToast(mod);
			render();
		} catch (e) {
			state.installing = '';
			state.modal.error = 'Could not install this mod. Check the launcher service and try again.';
			renderModal();
		}
	}

	function applyBreadcrumb() {
		const crumbs = document.getElementById('crumbs');
		if (!crumbs) return;
		if (!state.defaultCrumbs) state.defaultCrumbs = crumbs.innerHTML;
		crumbs.innerHTML = '<img class="crumb-logo" src="/pretzel-logo.png" alt="">' +
			'<span class="crumb-name">Pretzel Client</span>' +
			'<span style="color:#555c66;padding:0 2px">›</span>' +
			'<span style="color:#9aa0a9">Explore</span>' +
			'<span style="color:#555c66;padding:0 2px">›</span>' +
			'<span style="color:#eef2f7;font-weight:600">Mods</span>';
	}

	function restoreShell() {
		const crumbs = document.getElementById('crumbs');
		if (crumbs && state.defaultCrumbs) crumbs.innerHTML = state.defaultCrumbs;
		state.root = null;
		document.body.classList.remove('mx-mods-mode');
		if (state.defaultTitle) document.title = state.defaultTitle;
		closeModal();
		state.downloadsOpen = false;
		renderDownloads();
	}

	function watchView() {
		if (observer) observer.disconnect();
		const view = document.getElementById('view');
		if (!view || typeof MutationObserver === 'undefined') return;
		observer = new MutationObserver(() => {
			if (!document.getElementById('pretzel-mods-root')) {
				restoreShell();
				observer.disconnect();
				observer = null;
			}
		});
		observer.observe(view, { childList: true });
	}

	function mount(element) {
		if (!element) return;
		state.root = element;
		if (!state.defaultTitle) state.defaultTitle = document.title;
		document.title = 'Pretzel Client — Mods';
		document.body.classList.add('mx-mods-mode');
		applyBreadcrumb();
		render();
		if (!state.mods && !state.loading) load();
		syncQueue();
		watchView();
	}

	function goPage(page) {
		const max = Math.max(1, state.totalPages || 1);
		const next = Math.max(1, Math.min(max, Number(page) || 1));
		if (next === state.page) return;
		state.page = next;
		state.mods = null;
		state.loading = true;
		render();
		load();
		const view = document.getElementById('view');
		if (view) view.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function setQuery(value) {
		state.query = value;
		state.page = 1;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(reload, 380);
	}

	function click(event) {
		const target = event.target.closest('[data-mx]');
		if (state.downloadsOpen && !event.target.closest('#mxDownloadsPop') && !event.target.closest('#mxDownloadsBtn')) {
			state.downloadsOpen = false;
			renderDownloads();
		}
		if (!target) return;
		const action = target.getAttribute('data-mx');
		if (!action) return;

		if (action === 'close-modal') {
			if (target.classList.contains('mx-modal-backdrop') && event.target !== target) return;
			closeModal();
			return;
		}
		if (action === 'downloads') {
			state.downloadsOpen = !state.downloadsOpen;
			renderDownloads();
			return;
		}
		if (action === 'dismiss-sale') {
			state.sale = false;
			hideSale();
			render();
			return;
		}
		if (action === 'top') {
			state.top = !state.top;
			state.page = 1;
			state.mods = null;
			state.loading = true;
			render();
			load();
			return;
		}
		if (action.startsWith('source:')) {
			state.source = action.slice(7);
			state.page = 1;
			state.mods = null;
			if (state.source === 'modrinth') load();
			else render();
			return;
		}
		if (action.startsWith('category:')) {
			const value = action.slice(9);
			state.category = state.category === value ? '' : value;
			reload();
			return;
		}
		if (action.startsWith('loader:')) {
			state.loader = action.slice(7);
			reload();
			return;
		}
		if (action.startsWith('version:')) {
			state.version = action.slice(8);
			state.versions = {};
			reload();
			return;
		}
		if (action.startsWith('environment:')) {
			const environment = action.slice(12);
			if (environment === 'server') {
				const servers = document.querySelector('[data-action="nav:servers"]');
				if (servers) servers.click();
				return;
			}
			state.environment = environment;
			render();
			return;
		}
		if (action === 'toggle-categories') {
			state.expanded = !state.expanded;
			render();
			return;
		}
		if (action === 'retry') {
			reload();
			return;
		}
		if (action.startsWith('page:')) {
			const value = action.slice(5);
			if (value === 'prev') goPage(state.page - 1);
			else if (value === 'next') goPage(state.page + 1);
			else goPage(Number(value));
			return;
		}
		if (action === 'premium') {
			toast('Pretzel Premium is coming soon — early cosmetics and no ads.');
			return;
		}
		if (action.startsWith('open:') || action.startsWith('view:')) {
			const id = action.slice(action.indexOf(':') + 1);
			const mod = (state.mods || []).find((item) => item.id === id);
			if (mod) openModal(mod);
			return;
		}
		if (action === 'versions') {
			if (!state.modal) return;
			state.modal.step = 'versions';
			state.modal.error = '';
			renderModal();
			loadVersions(state.modal.mod);
			return;
		}
		if (action === 'deps') {
			if (!state.modal) return;
			state.modal.step = 'deps';
			state.modal.error = '';
			renderModal();
			return;
		}
		if (action.startsWith('pick-version:')) {
			if (!state.modal) return;
			state.modal.selected = Number(action.slice(13)) || 0;
			renderModal();
			return;
		}
		if (action === 'install-selected') {
			installSelected();
			return;
		}
		if (action === 'retry-versions') {
			if (!state.modal) return;
			delete state.versions[state.modal.mod.id];
			state.modal.error = '';
			loadVersions(state.modal.mod);
			return;
		}
		if (action.startsWith('dismiss-download:')) {
			state.dismissed.add(action.slice(17));
			renderDownloads();
			return;
		}
		if (action === 'clear-downloads') {
			state.downloadsClearedAt = Date.now();
			renderDownloads();
			return;
		}
	}

	document.addEventListener('click', click);

	document.addEventListener('input', (event) => {
		if (event.target && event.target.id === 'mxSearch') setQuery(event.target.value);
	});

	document.addEventListener('change', (event) => {
		if (!event.target || event.target.id !== 'mxSort') return;
		state.sort = event.target.value;
		reload();
	});

	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			if (state.modal) {
				closeModal();
				return;
			}
			if (state.downloadsOpen) {
				state.downloadsOpen = false;
				renderDownloads();
			}
		}
		if (event.key === 'Enter' && event.target && event.target.id === 'mxSearch') {
			clearTimeout(searchTimer);
			reload();
		}
	});

	window.PretzelMods = { mount };
})();
