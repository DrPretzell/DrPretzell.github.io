'use strict';

const fs = require('fs');

function replaceOnce(source, oldText, newText, label) {
	if (!source.includes(oldText)) throw new Error('Missing patch target: ' + label);
	return source.replace(oldText, newText);
}

let mods = fs.readFileSync('mods.js', 'utf8');

mods = replaceOnce(mods,
	"\t\ttotal: 77948,\n\t\tquery: '',",
	"\t\ttotal: 77948,\n\t\tpage: 1,\n\t\ttotalPages: 1,\n\t\tquery: '',",
	'mods state');

mods = replaceOnce(mods,
	"\tfunction setQuery(value) {\n\t\tstate.query = value;\n\t\tclearTimeout(searchTimer);",
	"\tfunction setQuery(value) {\n\t\tstate.query = value;\n\t\tstate.page = 1;\n\t\tclearTimeout(searchTimer);",
	'setQuery');

mods = replaceOnce(mods,
	"\t\t\tconst curated = state.source === 'modrinth' && !state.query && !state.category &&\n\t\t\t\tstate.loader === 'fabric' && state.version === '1.21.11';",
	"\t\t\t// Always use the live popularity index so paging can reach every project.\n\t\t\tconst curated = false;",
	'curated switch');

mods = replaceOnce(mods,
	"\t\t\t\tconst index = state.sort === 'updated' ? 'updated' : 'downloads';\n\t\t\t\tlet url = API + '/search?limit=20&index=' + index +",
	"\t\t\t\tconst index = state.sort === 'updated' ? 'updated' : 'downloads';\n\t\t\t\tlet url = API + '/search?limit=10&offset=' + ((state.page - 1) * 10) + '&index=' + index +",
	'search paging');

mods = replaceOnce(mods,
	"\t\t\t\tstate.total = Number(data.total_hits) || state.mods.length;\n\t\t\t}\n\t\t} catch (e) {\n\t\t\tif (seq !== requestSeq) return;\n\t\t\tif (curated) {\n\t\t\t\tstate.mods = sortMods(fallbackMods());\n\t\t\t\tstate.offline = true;\n\t\t\t} else {\n\t\t\t\tstate.mods = [];\n\t\t\t\tstate.error = 'Modrinth did not answer. Check your connection and try again.';\n\t\t\t}\n\t\t}",
	"\t\t\t\tstate.total = Number(data.total_hits) || state.mods.length;\n\t\t\t\tstate.totalPages = Math.max(1, Math.ceil(state.total / 10));\n\t\t\t}\n\t\t} catch (e) {\n\t\t\tif (seq !== requestSeq) return;\n\t\t\tstate.mods = sortMods(fallbackMods());\n\t\t\tstate.total = state.mods.length;\n\t\t\tstate.totalPages = 1;\n\t\t\tstate.page = 1;\n\t\t\tstate.offline = true;\n\t\t}",
	'load totals and fallback');

mods = replaceOnce(mods,
	"\tfunction reload() {\n\t\tstate.mods = null;",
	"\tfunction reload() {\n\t\tstate.page = 1;\n\t\tstate.mods = null;",
	'reload page reset');

mods = replaceOnce(mods,
	"\t\tconst list = state.mods || [];\n\t\tif (!list.length) return '<div class=\"mx-empty\">No mods match those filters.</div>';\n\t\treturn list.map(rowHTML).join('') +\n\t\t\t(state.offline ? '<div class=\"mx-offline\">Showing bundled mod info because Modrinth could not be reached.</div>' : '');\n\t}",
	"\t\tconst list = state.mods || [];\n\t\tif (!list.length) return '<div class=\"mx-empty\">No mods match those filters.</div>';\n\t\treturn list.map(rowHTML).join('') + pagerHTML() +\n\t\t\t(state.offline ? '<div class=\"mx-offline\">Showing bundled mod info because Modrinth could not be reached.</div>' : '');\n\t}",
	'results pager');

mods = replaceOnce(mods,
	"\tfunction resultsHTML() {",
	"\tfunction pageNumbers(current, total) {\n\t\tconst wanted = new Set([1, total, current - 2, current - 1, current, current + 1, current + 2]);\n\t\tconst numbers = Array.from(wanted).filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);\n\t\tconst result = [];\n\t\tfor (let i = 0; i < numbers.length; i++) {\n\t\t\tif (i && numbers[i] - numbers[i - 1] > 1) result.push('…');\n\t\t\tresult.push(numbers[i]);\n\t\t}\n\t\treturn result;\n\t}\n\n\tfunction pagerHTML() {\n\t\tif (state.loading || state.source === 'curseforge' || state.error || !state.total) return '';\n\t\tconst pages = Math.max(1, state.totalPages || Math.ceil(state.total / 10));\n\t\tconst start = (state.page - 1) * 10 + 1;\n\t\tconst end = Math.min(state.page * 10, state.total);\n\t\tconst buttons = pageNumbers(state.page, pages).map((n) => n === '…'\n\t\t\t? '<span class=\"mx-page-dots\">…</span>'\n\t\t\t: '<button class=\"mx-page-btn' + (n === state.page ? ' on' : '') + '\" data-mx=\"page:' + n + '\"' +\n\t\t\t\t(n === state.page ? ' aria-current=\"page\"' : '') + '>' + n + '</button>').join('');\n\t\treturn '<div class=\"mx-pager\">' +\n\t\t\t'<div class=\"mx-pager-count\">Showing ' + start.toLocaleString() + '–' + end.toLocaleString() + ' of ' + Number(state.total).toLocaleString() + ' mods</div>' +\n\t\t\t'<div class=\"mx-pager-controls\"><button class=\"mx-page-arrow\" data-mx=\"page:prev\"' + (state.page <= 1 ? ' disabled' : '') + ' aria-label=\"Previous page\">‹</button>' +\n\t\t\t\tbuttons +\n\t\t\t\t'<button class=\"mx-page-arrow\" data-mx=\"page:next\"' + (state.page >= pages ? ' disabled' : '') + ' aria-label=\"Next page\">›</button></div>' +\n\t\t\t'<div class=\"mx-page-label\">Page ' + state.page.toLocaleString() + ' of ' + pages.toLocaleString() + '</div>' +\n\t\t'</div>';\n\t}\n\n\tfunction resultsHTML() {",
	'pager functions');

mods = replaceOnce(mods,
	"\t\tif (action.startsWith('source:')) {\n\t\t\tstate.source = action.slice(7);\n\t\t\tstate.mods = null;",
	"\t\tif (action.startsWith('source:')) {\n\t\t\tstate.source = action.slice(7);\n\t\t\tstate.page = 1;\n\t\t\tstate.mods = null;",
	'source page reset');

mods = replaceOnce(mods,
	"\t\tif (action.startsWith('environment:')) {\n\t\t\tstate.environment = action.slice(12);\n\t\t\trender();\n\t\t\treturn;\n\t\t}",
	"\t\tif (action.startsWith('environment:')) {\n\t\t\tconst environment = action.slice(12);\n\t\t\tif (environment === 'server') {\n\t\t\t\tconst servers = document.querySelector('[data-action=\"nav:servers\"]');\n\t\t\t\tif (servers) servers.click();\n\t\t\t\treturn;\n\t\t\t}\n\t\t\tstate.environment = environment;\n\t\t\trender();\n\t\t\treturn;\n\t\t}",
	'server navigation');

mods = replaceOnce(mods,
	"\t\tif (action === 'retry') {\n\t\t\treload();\n\t\t\treturn;\n\t\t}",
	"\t\tif (action === 'retry') {\n\t\t\treload();\n\t\t\treturn;\n\t\t}\n\t\tif (action.startsWith('page:')) {\n\t\t\tconst value = action.slice(5);\n\t\t\tif (value === 'prev') goPage(state.page - 1);\n\t\t\telse if (value === 'next') goPage(state.page + 1);\n\t\t\telse goPage(Number(value));\n\t\t\treturn;\n\t\t}",
	'page action');

mods = replaceOnce(mods,
	"\tfunction setQuery(value) {",
	"\tfunction goPage(page) {\n\t\tconst max = Math.max(1, state.totalPages || 1);\n\t\tconst next = Math.max(1, Math.min(max, Number(page) || 1));\n\t\tif (next === state.page) return;\n\t\tstate.page = next;\n\t\tstate.mods = null;\n\t\tstate.loading = true;\n\t\trender();\n\t\tload();\n\t\tconst view = document.getElementById('view');\n\t\tif (view) view.scrollTo({ top: 0, behavior: 'smooth' });\n\t}\n\n\tfunction setQuery(value) {",
	'goPage function');

mods = replaceOnce(mods,
	"\t\t\t\t'<button class=\"mx-env' + (state.environment === 'server' ? ' on' : '') + '\" data-mx=\"environment:server\">' + ICON.server + 'Server</button>' +",
	"\t\t\t\t'<button class=\"mx-env\" data-mx=\"environment:server\" title=\"Open the Servers section\">' + ICON.server + 'Server</button>' +",
	'server button title');

fs.writeFileSync('mods.js', mods);

let css = fs.readFileSync('mods.css', 'utf8');
css += '\n\n/* mod pagination */\n.mx-pager { display: flex; flex-direction: column; align-items: center; gap: 9px; padding: 20px 0 6px; border-top: 1px solid #1c1f25; margin-top: -1px; }\n.mx-pager-count { color: #8d939c; font-size: 10.5px; }\n.mx-pager-controls { display: flex; align-items: center; justify-content: center; gap: 4px; flex-wrap: wrap; }\n.mx-page-btn, .mx-page-arrow { min-width: 30px; height: 30px; padding: 0 7px; border: 1px solid #292d35; border-radius: 6px; background: #171a20; color: #aeb3bc; font: inherit; font-size: 10.5px; cursor: pointer; }\n.mx-page-btn:hover, .mx-page-arrow:hover:not(:disabled) { border-color: #3d434d; color: #f0f2f5; }\n.mx-page-btn.on { border-color: #3f7c58; background: #14241b; color: #9ce7ba; }\n.mx-page-arrow:disabled { opacity: .35; cursor: not-allowed; }\n.mx-page-dots { min-width: 20px; color: #6f757e; font-size: 11px; text-align: center; }\n.mx-page-label { color: #737a85; font-size: 10px; }\n';
fs.writeFileSync('mods.css', css);

let launcher = fs.readFileSync('launcher.js', 'utf8');

launcher = replaceOnce(launcher,
	"async function loadServers(force) {\n\tif (state.servers && !force) return;\n\ttry {\n\t\tconst res = await fetch('/api/launcher/servers', { cache: 'no-store' });\n\t\tif (!res.ok) throw new Error('HTTP ' + res.status);\n\t\tconst data = await res.json();\n\t\tstate.servers = Array.isArray(data.servers) ? data.servers : [];\n\t\tstate.serverError = state.servers.length ? '' : 'The server list came back empty.';\n\t} catch (e) {\n\t\tstate.servers = [];\n\t\tstate.serverError = 'Could not reach the server list.';\n\t}\n\tif (state.view === 'servers') renderView();\n}",
	"async function loadServers(force) {\n\tconst manual = read('pretzel.manualServers.v1', []);\n\tconst manualList = Array.isArray(manual) ? manual : [];\n\tif (state.servers && !force) {\n\t\tstate.servers = state.servers.filter((s) => !s.manual).concat(manualList);\n\t\treturn;\n\t}\n\ttry {\n\t\tconst res = await fetch('/api/launcher/servers', { cache: 'no-store' });\n\t\tif (!res.ok) throw new Error('HTTP ' + res.status);\n\t\tconst data = await res.json();\n\t\tstate.servers = (Array.isArray(data.servers) ? data.servers : []).concat(manualList);\n\t\tstate.serverError = state.servers.length ? '' : 'The server list came back empty.';\n\t} catch (e) {\n\t\tstate.servers = manualList;\n\t\tstate.serverError = state.servers.length ? '' : 'Could not reach the server list.';\n\t}\n\tif (state.view === 'servers') renderView();\n}",
	'loadServers manual merge');

launcher = replaceOnce(launcher,
	"\t\t\t\t\t: state.modal.type === 'server' ? serverModalBody()\n\t\t\t\t\t\t: state.modal.type === 'post' ? postModalBody()",
	"\t\t\t\t\t: state.modal.type === 'server' ? serverModalBody()\n\t\t\t\t\t\t: state.modal.type === 'add-server' ? addServerModalBody()\n\t\t\t\t\t\t\t: state.modal.type === 'post' ? postModalBody()",
	'modal add-server body');

launcher = replaceOnce(launcher,
	"function postModalBody() {",
	"function addServerModalBody() {\n\treturn '' +\n\t'<div class=\"modal-head\"><h3>Add a server</h3><p>Add a custom server to your Servers section.</p></div>' +\n\t'<form data-form=\"add-server\">' +\n\t\t'<div class=\"field\"><label for=\"addServerName\">Server name</label>' +\n\t\t\t'<input class=\"input\" id=\"addServerName\" name=\"addServerName\" maxlength=\"48\" placeholder=\"My Server\"></div>' +\n\t\t'<div class=\"field\"><label for=\"addServerAddress\">Server address</label>' +\n\t\t\t'<input class=\"input\" id=\"addServerAddress\" name=\"addServerAddress\" maxlength=\"128\" placeholder=\"play.example.net\"></div>' +\n\t\t'<div class=\"field\"><label for=\"addServerDesc\">Description</label>' +\n\t\t\t'<input class=\"input\" id=\"addServerDesc\" name=\"addServerDesc\" maxlength=\"180\" placeholder=\"Optional description\"></div>' +\n\t\t(state.authError ? '<p class=\"form-error\">' + esc(state.authError) + '</p>' : '') +\n\t\t'<button class=\"btn gold\" type=\"submit\">Add Server</button>' +\n\t'</form>';\n}\n\nfunction postModalBody() {",
	'addServerModalBody');

launcher = replaceOnce(launcher,
	"\t'<div class=\"page-head\"><div><h1>Servers</h1>' +\n\t\t'<p>' + (state.servers ? state.servers.length + ' Eaglercraft servers from the top list' : 'Live Eaglercraft server list') + '</p></div></div>' +",
	"\t'<div class=\"page-head\"><div><h1>Servers</h1>' +\n\t\t'<p>' + (state.servers ? state.servers.length + ' servers in your list' : 'Live Eaglercraft server list') + '</p></div>' +\n\t\t'<button class=\"btn ghost-gold\" data-action=\"add-server\" style=\"width:auto;height:36px;padding:0 16px\">Add Server</button></div>' +",
	'servers Add Server button');

launcher = replaceOnce(launcher,
	"\tif (action === 'reload-servers') {",
	"\tif (action === 'add-server') {\n\t\tstate.authError = '';\n\t\topenModal({ type: 'add-server' });\n\t\treturn;\n\t}\n\tif (action === 'reload-servers') {",
	'add-server action');

launcher = replaceOnce(launcher,
	"\t\tif (kind === 'news') {",
	"\t\tif (kind === 'add-server') {\n\t\t\tconst name = form.addServerName.value.trim();\n\t\t\tconst address = form.addServerAddress.value.trim();\n\t\t\tconst description = form.addServerDesc.value.trim();\n\t\t\tif (!name) throw new Error('Give the server a name.');\n\t\t\tif (!address) throw new Error('Add the server address.');\n\t\t\tconst manual = read('pretzel.manualServers.v1', []);\n\t\t\tconst list = Array.isArray(manual) ? manual : [];\n\t\t\tlist.push({\n\t\t\t\tid: 'manual-' + Date.now(),\n\t\t\t\tname,\n\t\t\t\taddress,\n\t\t\t\tdescription,\n\t\t\t\ttags: ['Custom'],\n\t\t\t\tplayers: 0,\n\t\t\t\tmanual: true,\n\t\t\t\tbanner: '',\n\t\t\t\ticon: '',\n\t\t\t});\n\t\t\twrite('pretzel.manualServers.v1', list);\n\t\t\tawait loadServers(true);\n\t\t\tstate.view = 'servers';\n\t\t\tcloseModal();\n\t\t\ttoast(name + ' added to your servers', 'good');\n\t\t\trender();\n\t\t\treturn;\n\t\t}\n\t\tif (kind === 'news') {",
	'add-server submit');

launcher = replaceOnce(launcher,
	"'<button class=\"btn join\" data-action=\"join:' + esc(server.id) + '\">Join</button>' +",
	"'<button class=\"btn join\" data-action=\"join:' + esc(server.id) + '\">Join Server</button>' +",
	'join label');

fs.writeFileSync('launcher.js', launcher);
console.log('pagination, server navigation and add-server patches applied');
