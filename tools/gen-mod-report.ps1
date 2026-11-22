# Pretzel Client - writes docs/MOD-PORT-RESEARCH.md from launcher/mods-catalog.js.
#
# Reads the catalog produced by tools/fetch-mods.ps1 (which is straight from the
# Modrinth API) and writes the human-readable research report: method, totals,
# the compatibility taxonomy, the top projects with licence and source, the
# named projects the brief called out, and the order features would be rebuilt.
#
# Run:  powershell -NoProfile -ExecutionPolicy Bypass -File tools/gen-mod-report.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$catalogFile = Join-Path $root 'launcher/mods-catalog.js'
$outFile = Join-Path (Split-Path -Parent $root) 'docs/MOD-PORT-RESEARCH.md'

$text = [IO.File]::ReadAllText($catalogFile)
$json = $text.Substring($text.IndexOf('{')).TrimEnd()
$json = $json.Substring(0, $json.LastIndexOf('}') + 1)
$catalog = $json | ConvertFrom-Json

$mods = @($catalog.mods)
$planned = @($mods | Where-Object { $_.status -eq 'planned' })
$no = @($mods | Where-Object { $_.status -eq 'no' })
$ported = @($mods | Where-Object { $_.status -eq 'ported' })

function Cell($value) { if ($null -eq $value -or $value -eq '') { '-' } else { ([string]$value).Replace('|', '/') } }

$sb = New-Object System.Text.StringBuilder
function Add([string]$line) { [void]$sb.AppendLine($line) }

Add '# Pretzel Client - Modrinth mod port research'
Add ''
Add ("Generated {0} from the live Modrinth API. This file is written by ``tools/gen-mod-report.ps1``; the" -f $catalog.generated)
Add 'machine-readable version the launcher reads is `launcher/mods-catalog.js`.'
Add ''
Add '## What this is, and what it is not'
Add ''
Add 'Pretzel Client is Minecraft 1.21.11 compiled from Java to JavaScript by TeaVM before it is served. A browser'
Add 'tab has no JVM, so a Modrinth `.jar` cannot be loaded at run time - not by a download button, not by a'
Add 'storage shim, not by anything the launcher does. The only way a mod runs is if its behaviour is rebuilt in'
Add 'this client''s own Java and compiled into a new build.'
Add ''
Add ("Of the **{0}** projects researched below, **{1}** run inside the client today. Everything else is classified honestly:" -f $mods.Count, $ported.Count)
Add ''
Add '| Verdict | Count | Meaning |'
Add '| --- | --- | --- |'
Add ("| PORTED | {0} | Compiled into this client and tested in the browser. |" -f $ported.Count)
Add ("| REBUILD PATH | {0} | The behaviour can be reimplemented against this client source. None of these are implemented yet. |" -f $planned.Count)
Add ("| CANNOT RUN HERE | {0} | Needs a native binary, a GL shader stage, or the Fabric loader itself. |" -f $no.Count)
Add ''
Add '## Method'
Add ''
Add '1. `GET /v2/search?limit=100&index=downloads&facets=[["project_type:mod"]]` three times (offsets 0/100/200).'
Add '2. `GET /v2/projects?ids=[...]` in batches of 50 for the full record of each hit.'
Add '3. Take title, summary, icon, downloads, followers, licence id/name, source and issue URLs, loaders,'
Add '   last four game versions and categories straight from those responses - nothing is typed by hand.'
Add '4. Classify each project: an explicit per-project verdict for the well-known mods, otherwise a'
Add '   category-based default (loader library -> cannot run; optimisation/utility -> rebuild path;'
Add '   content mod -> rebuild, since blocks/items/assets have to be baked into the build).'
Add '5. Write `launcher/mods-catalog.js` for the launcher and this report.'
Add ''
Add 'Re-run both steps with:'
Add ''
Add '```powershell'
Add 'powershell -NoProfile -ExecutionPolicy Bypass -File tools/fetch-mods.ps1'
Add 'powershell -NoProfile -ExecutionPolicy Bypass -File tools/gen-mod-report.ps1'
Add '```'
Add ''
Add '## Licences and attribution'
Add ''
Add 'Only the licence *identifiers Modrinth publishes* are recorded here; no mod source has been copied into'
Add 'this repository. Every project above is either reimplemented from its described behaviour or, where the'
Add 'licence allows it (MIT/Apache-2.0/BSD and the LGPL cases that permit linking), studied and attributed.'
Add 'GPL-3.0 projects - Sodium, Lithium, Iris and most of the Fabric performance family are in that group -'
Add 'are **not** copied: their behaviour is reimplemented, not vendored, and their names stay in this report'
Add 'as the reference the reimplementation is measured against.'
Add ''
Add '## The projects the brief named'
Add ''
$named = 'sodium', 'lithium', 'iris', 'ferritecore', 'immediatelyfast', 'entityculling', 'krypton', 'starlight', 'phosphor', 'indium', 'modernfix', 'sodium-extra', 'reeses-sodium-options'
Add '| Project | Licence | Source | Verdict | Note |'
Add '| --- | --- | --- | --- | --- |'
foreach ($slug in $named) {
    $m = $mods | Where-Object { $_.slug -eq $slug } | Select-Object -First 1
    if ($m) {
        Add ("| {0} | {1} | {2} | {3} | {4} |" -f (Cell $m.title), (Cell $m.license), (Cell $m.source), (Cell $m.status), (Cell $m.note))
    }
}
Add ''
Add '## Top 40 by downloads'
Add ''
Add '| # | Project | Licence | Loaders | Newest MC | Downloads | Verdict |'
Add '| --- | --- | --- | --- | --- | --- | --- |'
$i = 0
foreach ($m in ($mods | Select-Object -First 40)) {
    $i++
    Add ("| {0} | {1} | {2} | {3} | {4} | {5:N0} | {6} |" -f $i, (Cell $m.title), (Cell $m.license), (Cell (($m.loaders) -join '/')), (Cell $m.newest), $m.downloads, (Cell $m.status))
}
Add ''
Add '## What gets rebuilt first, and why'
Add ''
Add 'Ordered by how much a browser client actually gains per hour of link time. Each item is a Java change in'
Add '`1.21.11-master/1.21.11-master/src/game`, followed by a TeaVM link (2-3 h on this machine).'
Add ''
Add '1. **Frustum/occlusion entity culling** (Entity Culling, MoreCulling) - skip entities and block faces that'
Add '   cannot be seen. Biggest frame-time win in a browser, and the render loop is ours.'
Add '2. **Chunk-section draw batching** (Sodium-style) - merge per-section draws and drop redundant state'
Add '   changes in the chunk renderer. The single largest CPU win for a JS/WebGL renderer.'
Add '3. **Idle/focus FPS cap** (Dynamic FPS) - a few lines in the frame loop; saves battery and keeps the tab'
Add '   responsive when the game is in the background.'
Add '4. **HUD/info overlays** (What Is My FPS, Jade/WTHIT, AppleSkin, BetterF3) - self-contained GUI work with'
Add '   no engine risk, easy to verify.'
Add '5. **Client options** (Gamma Utils, Mouse Tweaks, Item Scroller, Inventory Profiles) - input and settings'
Add '   changes that reuse the existing option and account storage.'
Add ''
Add 'Everything else in the REBUILD PATH column needs the item/block/asset pipeline (JEI-class browsers,'
Add 'content mods, world generation) and is a project per mod, not a patch.'
Add ''
Add '## Limitations'
Add ''
Add '- No Modrinth project below is running in the client yet; PORTED is empty until a rebuild ships and is tested.'
Add '- The verdicts are engineering judgements, not automated compatibility tests: they look at loaders,'
Add '  categories and, for the well-known mods, the actual architecture of the mod.'
Add '- A rebuild is a reimplementation of behaviour, not a binary port; results will not be feature-identical.'
Add '- Downloading a jar in the launcher stores and verifies the file in the account''s own IndexedDB bucket.'
Add '  It never executes, and the page says so.'

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $outFile) | Out-Null
[IO.File]::WriteAllText($outFile, $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))
Write-Host ("Wrote {0} ({1} projects, {2} rebuild path, {3} cannot run)" -f $outFile, $mods.Count, $planned.Count, $no.Count)
