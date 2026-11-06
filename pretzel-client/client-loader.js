'use strict';

(function () {
  var BUILD = '20261106d';
  var PARTS = ['/pretzel-client/classes.part0?v=' + BUILD, '/pretzel-client/classes.part1?v=' + BUILD, '/pretzel-client/classes.part2?v=' + BUILD, '/pretzel-client/classes.part3?v=' + BUILD, '/pretzel-client/classes.part4?v=' + BUILD];
  var ASSETS_URL = '/pretzel-client/assets.zip?v=' + BUILD;
  var booted = false;
  var stage = 'boot';
  var statusEl = document.getElementById('status');
  var statusText = document.getElementById('statusText');
  var fillEl = document.getElementById('fill');
  var pctEl = document.getElementById('pct');
  var phaseLabel = document.getElementById('phaseLabel');
  var phaseEl = document.getElementById('phase');
  var retryEl = document.getElementById('retry');
  var detailEl = document.getElementById('errDetail');

  function setBar(percent, label, phase) {
    var pct = Math.max(0, Math.min(100, percent));
    fillEl.style.width = pct + '%';
    pctEl.textContent = Math.round(pct) + '%';
    if (label) phaseLabel.textContent = label;
    if (phase) phaseEl.textContent = phase;
  }

  function setStatus(kind, text) {
    statusEl.className = kind;
    statusText.textContent = text;
  }

  function describeError(e) {
    if (!e) return 'unknown error';
    if (typeof e === 'string') return e;
    if (e.stack) return String(e.stack);
    if (e.message) return String(e.message);
    try { return JSON.stringify(e); } catch (err) { return String(e); }
  }

  // Records the stage the client died in and the exact exception, so the
  // screen no longer hides the cause behind a generic "did not start".
  function fail(message, e) {
    setStatus('is-offline', '\u2715 Modded client did not start');
    setBar(0, 'Modded client \u2014 stopped at "' + stage + '"', message);
    if (detailEl) {
      detailEl.style.display = 'block';
      detailEl.textContent = message + '\n\nstage: ' + stage +
        (e ? '\n\n' + describeError(e) : '') +
        '\n\nurl: ' + location.href +
        '\nbuild: ' + BUILD +
        '\nua: ' + navigator.userAgent;
    }
    retryEl.style.display = 'inline-block';
    document.body.classList.remove('playing');
  }

  // Errors thrown by the linked bundle happen in a browser callback, outside
  // the promise chain, so they need their own listeners to be reported.
  window.addEventListener('error', function (event) {
    if (booted && event && event.error) return;
    var err = event && (event.error || event.message);
    fail('Uncaught error while running the client' + (event && event.filename ? ' (' + event.filename + ':' + event.lineno + ':' + event.colno + ')' : ''), err);
  });
  window.addEventListener('unhandledrejection', function (event) {
    if (booted) return;
    fail('Unhandled promise rejection while starting the client', event && event.reason);
  });

  async function fetchChunk(url, label, startPercent, endPercent) {
    var res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(label + ' failed (' + res.status + ' ' + res.statusText + ')');
    var total = Number(res.headers.get('Content-Length')) || 0;
    if (!res.body || !res.body.getReader) {
      var whole = new Uint8Array(await res.arrayBuffer());
      setBar(endPercent, 'Downloading modded client', label + ' — ' + (whole.length / 1048576).toFixed(1) + ' MB');
      return whole;
    }
    var reader = res.body.getReader();
    var chunks = [];
    var got = 0;
    for (;;) {
      var step = await reader.read();
      if (step.done) break;
      chunks.push(step.value);
      got += step.value.length;
      var percent = total > 0 ? startPercent + (got / total) * (endPercent - startPercent) : startPercent;
      setBar(percent, 'Downloading modded client', label + ' — ' + (got / 1048576).toFixed(1) + (total > 0 ? ' / ' + (total / 1048576).toFixed(1) : '') + ' MB');
    }
    return new Uint8Array(await new Blob(chunks).arrayBuffer());
  }

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = url;
      script.onload = function () { resolve(); };
      script.onerror = function () {
        reject(new Error('the modded client bundle failed to parse (malformed or truncated chunk)'));
      };
      document.body.appendChild(script);
    });
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function readLocalAccount() {
    try {
      var accounts = JSON.parse(localStorage.getItem('pretzel.accounts.v1') || '[]');
      var session = JSON.parse(localStorage.getItem('pretzel.session.v1') || 'null');
      if (!session || !session.username) return null;
      return accounts.find(function (item) {
        return String(item.username || '').toLowerCase() === String(session.username).toLowerCase();
      }) || null;
    } catch (e) {
      return null;
    }
  }

  async function hydrateAccount() {
    var account = readLocalAccount();
    if (!account) return;

    // The friends list the title screen renders comes from the launcher's
    // local account record, so hand it to the client before main() runs.
    var friends = Array.isArray(account.friends) ? account.friends : [];
    var friendNames = friends.map(function (friend) {
      if (typeof friend === 'string') return friend;
      return friend && (friend.username || friend.name);
    }).filter(function (name) {
      return typeof name === 'string' && name.length > 0;
    });

    var skin = account.skin || '';
    // The client reads this as a single newline-separated string.
    window.__PRETZEL_ACCOUNT = { name: account.username, skinBase64: '', friendNames: friendNames.join('\n') };
    if (!skin) {
      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = controller ? setTimeout(function () { controller.abort(); }, 3500) : null;
      try {
        var res = await fetch('https://mc-heads.net/skin/' + encodeURIComponent(account.username), {
          cache: 'force-cache',
          signal: controller ? controller.signal : undefined
        });
        if (res.ok) skin = await blobToDataUrl(await res.blob());
      } catch (e) { /* keep the generated/default skin if the provider is unavailable */ }
      if (timer) clearTimeout(timer);
    }
    if (skin && skin.indexOf(',') >= 0) {
      window.__PRETZEL_ACCOUNT.skinBase64 = skin.slice(skin.indexOf(',') + 1);
    }
  }

  async function run() {
    retryEl.style.display = 'none';
    if (detailEl) detailEl.style.display = 'none';
    setStatus('', 'Loading modded client\u2026');
    setBar(0, 'Modded client', 'Downloading the modded client, not the vanilla prebuilt\u2026');

    stage = 'download';
    var parts = [];
    for (var i = 0; i < PARTS.length; i++) {
      parts.push(await fetchChunk(PARTS[i], 'Client chunk ' + (i + 1) + ' of ' + PARTS.length, (i / PARTS.length) * 82, ((i + 1) / PARTS.length) * 82));
    }

    stage = 'assets';
    setBar(84, 'Installing assets', 'Installing the client asset pack\u2026');
    var assetRes = await fetch(ASSETS_URL, { cache: 'no-store' });
    if (!assetRes.ok) throw new Error('asset pack failed (' + assetRes.status + ' ' + assetRes.statusText + ')');
    window.__EAGLER_ZIP = new Int8Array(await assetRes.arrayBuffer());

    stage = 'account';
    await hydrateAccount();

    stage = 'parse';
    setBar(94, 'Starting modded client', 'The modded client is ready. Starting\u2026');
    var blob = new Blob(parts, { type: 'text/javascript' });
    var blobUrl = URL.createObjectURL(blob);
    try {
      await loadScript(blobUrl);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }

    stage = 'link';
    if (typeof window.main !== 'function') throw new Error('the modded client bundle loaded but did not export main()');
    if (booted) return;
    booted = true;
    setStatus('is-ready', '\u2713 Modded client loaded');
    setBar(100, 'Starting modded client', 'Starting Pretzel Client\u2026');
    document.body.classList.add('playing');
    await new Promise(function (resolve) { setTimeout(resolve, 140); });

    stage = 'main';
    try {
      window.main([]);
    } catch (e) {
      fail('Startup failed: ' + ((e && e.message) || e), e);
      throw e;
    }
  }

  retryEl.addEventListener('click', function () { location.reload(); });
  run().catch(function (e) {
    console.error('[modded client]', e);
    if (detailEl && detailEl.style.display === 'block') return; // a runtime listener already reported the exact cause
    fail(String((e && e.message) || e), e);
  });
})();
