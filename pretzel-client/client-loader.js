'use strict';

(function () {
  var PARTS = ['/pretzel-client/classes.part0', '/pretzel-client/classes.part1', '/pretzel-client/classes.part2', '/pretzel-client/classes.part3'];
  var ASSETS_URL = '/pretzel-client/assets.zip';
  var booted = false;
  var statusEl = document.getElementById('status');
  var statusText = document.getElementById('statusText');
  var fillEl = document.getElementById('fill');
  var pctEl = document.getElementById('pct');
  var phaseLabel = document.getElementById('phaseLabel');
  var phaseEl = document.getElementById('phase');
  var retryEl = document.getElementById('retry');

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

  function fail(message) {
    setStatus('is-offline', '\u2715 Modded client did not start');
    setBar(0, 'Modded client', message);
    retryEl.style.display = 'inline-block';
    document.body.classList.remove('playing');
  }

  async function fetchChunk(url, label, startPercent, endPercent) {
    var res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(label + ' failed (' + res.status + ')');
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
      script.onerror = function () { reject(new Error('the modded client bundle failed to parse')); };
      document.body.appendChild(script);
    });
  }

  async function run() {
    retryEl.style.display = 'none';
    setStatus('', 'Loading modded client\u2026');
    setBar(0, 'Modded client', 'Downloading the modded client, not the vanilla prebuilt\u2026');

    var parts = [];
    for (var i = 0; i < PARTS.length; i++) {
      parts.push(await fetchChunk(PARTS[i], 'Client chunk ' + (i + 1) + ' of ' + PARTS.length, (i / PARTS.length) * 82, ((i + 1) / PARTS.length) * 82));
    }

    setBar(84, 'Installing assets', 'Installing the client asset pack\u2026');
    var assetRes = await fetch(ASSETS_URL, { cache: 'no-store' });
    if (!assetRes.ok) throw new Error('asset pack failed (' + assetRes.status + ')');
    window.__EAGLER_ZIP = new Int8Array(await assetRes.arrayBuffer());

    setBar(94, 'Starting modded client', 'The modded client is ready. Starting\u2026');
    var blob = new Blob(parts, { type: 'text/javascript' });
    var blobUrl = URL.createObjectURL(blob);
    try {
      await loadScript(blobUrl);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }

    if (typeof window.main !== 'function') throw new Error('the modded client bundle loaded but did not export main()');
    if (booted) return;
    booted = true;
    setStatus('is-ready', '\u2713 Modded client loaded');
    setBar(100, 'Starting modded client', 'Starting Pretzel Client\u2026');
    document.body.classList.add('playing');
    await new Promise(function (resolve) { setTimeout(resolve, 140); });
    try {
      window.main([]);
    } catch (e) {
      fail('Startup failed: ' + ((e && e.message) || e));
      throw e;
    }
  }

  retryEl.addEventListener('click', function () { location.reload(); });
  run().catch(function (e) {
    console.error('[modded client]', e);
    fail(String((e && e.message) || e));
  });
})();
