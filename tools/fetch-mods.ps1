# Pretzel Client - builds launcher/mods-catalog.js from the Modrinth API.
#
# This is the repeatable research step: it pulls the most-downloaded Minecraft
# mods on Modrinth, then fetches each project record for its real license,
# source repository, versions, loaders and categories. Nothing is invented;
# every field below comes from https://api.modrinth.com/v2.
#
# The port status is Pretzel's own assessment and is written by PORT_STATUS /
# DEFAULT_STATUS further down. Only a mod listed in PORTED (empty by default)
# counts as running inside the client.
#
# Run:  powershell -NoProfile -ExecutionPolicy Bypass -File tools/fetch-mods.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$outFile = Join-Path $root 'launcher/mods-catalog.js'

$headers = @{ 'User-Agent' = 'PretzelClient/20261122b (github.com/DrPretzell)' }
$facets = [uri]::EscapeDataString('[["project_type:mod"]]')

Write-Host 'Searching Modrinth for the most downloaded mods...'
$hits = @()
foreach ($offset in 0, 100, 200) {
    $url = "https://api.modrinth.com/v2/search?limit=100&offset=$offset&index=downloads&facets=$facets"
    $page = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    $hits += $page.hits
    Start-Sleep -Milliseconds 400
}
Write-Host ("  found {0} search hits" -f $hits.Count)

$ids = @($hits | ForEach-Object { $_.project_id } | Select-Object -Unique)
Write-Host ("  {0} unique projects" -f $ids.Count)

Write-Host 'Fetching project records (license, source repo, versions)...'
$projects = @()
for ($i = 0; $i -lt $ids.Count; $i += 50) {
    $last = [Math]::Min($i + 49, $ids.Count - 1)
    $slice = @($ids[$i..$last])
    $json = ConvertTo-Json -InputObject $slice -Compress
    $url = 'https://api.modrinth.com/v2/projects?ids=' + [uri]::EscapeDataString($json)
    $projects += Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    Start-Sleep -Milliseconds 400
}
Write-Host ("  {0} project records" -f $projects.Count)

# ---------------------------------------------------------------- assessment
# Ported: features that are compiled into this client build and verified in the
# browser. Keep this empty until something is actually shipped and tested.
$PORTED = @{}

# Per-project assessment for the projects that matter most. Status values:
#   planned  - the behaviour can be reimplemented against this client's source
#   no       - cannot run here (native code, GL pipeline, loader/library only)
$PORT_STATUS = @{
    'sodium'            = @('planned', 'Renderer replacement. Chunk-section batching could be rebuilt on the Eaglercraft WebGL renderer; the Fabric renderer itself cannot load.')
    'lithium'           = @('planned', 'Server/world tick optimisations. The tick loop lives in this source, so individual fixes can be reimplemented.')
    'iris'              = @('no',      'Custom GL shader pipeline. This client renders through WebGL2 and has no Iris shader stage to hook.')
    'ferritecore'       = @('planned', 'Memory layout work on block-state and model caches; a smaller version fits this client.')
    'immediatelyfast'   = @('planned', 'Batches immediate-mode GUI/buffer uploads; the same idea applies to this client GUI renderer.')
    'entityculling'     = @('planned', 'Skips drawing entities outside the frustum or behind terrain; implementable in the entity render pass.')
    'entity-culling'    = @('planned', 'Skips drawing entities outside the frustum or behind terrain; implementable in the entity render pass.')
    'modernfix'         = @('planned', 'Startup and memory reductions; only the parts that touch classes this client has.')
    'krypton'           = @('no',      'Rewrites Netty networking. This client uses a WebSocket transport instead.')
    'lazydfu'           = @('no',      'Removes the DataFixerUpper load, which this client does not run at all.')
    'starlight'         = @('planned', 'Light engine rewrite. A simpler light-update path could be rebuilt here.')
    'phosphor'          = @('planned', 'Light engine rewrite; same approach as Starlight.')
    'indium'            = @('no',      'Fabric rendering API extension, no equivalent in this client.')
    'continuity'        = @('no',      'Connected-texture sprite atlas hooks tied to Sodium/Fabric.')
    'what-is-my-fps'    = @('planned', 'A small HUD overlay; trivially implementable with this client HUD code.')
    'appleskin'         = @('planned', 'Hunger/saturation HUD hints, implementable in the GUI pass.')
    'jei'               = @('no',      'Huge item/recipe browser with a bundled asset pipeline and its own loader APIs.')
    'rei'               = @('no',      'Same class of recipe browser; needs an item registry and asset loader this client lacks.')
    'modmenu'           = @('no',      'Fabric mod loader UI. Pretzel has its own mod page.')
    'fabric-api'        = @('no',      'The Fabric loader API itself; there is no loader in a TeaVM build.')
    'cloth-config'      = @('no',      'Config screen library for Fabric mods.')
    'architectury'      = @('no',      'Cross-loader abstraction; nothing to abstract here.')
    'owo-lib'           = @('no',      'Mod library with its own rendering and config stack.')
    'journeymap'        = @('planned', 'Full-screen map and waypoints; a 2D canvas map from chunk data is feasible.')
    'xaeros-minimap'    = @('planned', 'Minimap rendering from loaded chunk data is feasible in this client HUD.')
    'xaeros-world-map'  = @('planned', 'Same chunk-data map, full screen.')
    'sodium-extra'      = @('planned', 'Extra video options on top of the Sodium-style renderer work.')
    'reeses-sodium-options' = @('planned', 'Video settings menu rework; the menu code is in this source.')
    'betterf3'          = @('planned', 'Debug overlay reformat; this client already owns its debug HUD.')
    'gamma-utils'       = @('planned', 'Brightness/fullbright option, a one-line client setting.')
    'capes'             = @('no',      'Account cape service and render mixins; Pretzel cosmetics are handled in its own skin pipeline.')
    'emi'               = @('no',      'Recipe browser, same blockers as JEI.')
    'wthit'             = @('planned', 'Block/entity info overlay from raycast data, implementable.')
    'jade'              = @('planned', 'Block/entity info overlay from raycast data, implementable.')
    'inventory-profiles-next' = @('planned', 'Saves GUI layouts to the account; fits the existing account storage.')
    'mouse-tweaks'      = @('planned', 'Inventory drag/scroll handling; this client owns its input code.')
    'item-scroller'     = @('planned', 'Scroll-wheel hotbar cycling, a small input change.')
    'no-chat-reports'   = @('no',      'Removes a server-side social feature; nothing to patch client side.')
    'vanilla-tweaks'    = @('planned', 'A pile of small vanilla behaviour tweaks, each one local.')
    'cull-leaves'       = @('planned', 'Skips leaf faces that cannot be seen; belongs in the chunk mesher.')
    'moreculling'       = @('planned', 'Culls extra block faces; belongs in the chunk mesher.')
    'memoryleakfix'     = @('planned', 'Targeted leak fixes; only applicable to code this client shares.')
    'fastload'          = @('planned', 'Faster resource load; this client has its own asset pack loader.')
    'fastanim'          = @('planned', 'Cheaper animation maths in the entity renderer.')
    'fastquit'          = @('planned', 'Skips the save-on-quit path; the browser client has no shutdown save.')
    'dynamic-fps'       = @('planned', 'Caps FPS while idle or unfocused, a small loop change.')
    'fps-reducer'       = @('planned', 'Same idle FPS cap idea.')
    'cubes-without-borders' = @('planned', 'Fullscreen/borderless handling; the browser tab controls this instead.')
    'boat-item-view'    = @('planned', 'Holding an item while riding; a renderer tweak.')
}

# Anything without a per-project assessment gets a category-based verdict.
function Get-Assessment($p) {
    $slug = [string]$p.slug
    if ($PORTED.ContainsKey($slug)) { return @('ported', $PORTED[$slug]) }
    if ($PORT_STATUS.ContainsKey($slug)) { return $PORT_STATUS[$slug] }
    $cats = @($p.categories)
    if ($cats -contains 'library') { return @('no', 'Mod-loader library: its whole purpose is the Fabric/NeoForge loader, which does not exist in a TeaVM build.') }
    if ($cats -contains 'optimization') { return @('planned', 'Performance mod: the same optimisations have to be rewritten against this client source; the jar cannot load.') }
    if ($cats -contains 'utility') { return @('planned', 'Utility mod: behaviour can be rebuilt with this client GUI/input code.') }
    if ($cats -contains 'storage' -or $cats -contains 'technology' -or $cats -contains 'adventure' -or $cats -contains 'worldgen' -or $cats -contains 'mobs') {
        return @('planned', 'Content mod: needs its blocks/items/assets baked into the client build, which is a rewrite rather than a port.')
    }
    return @('planned', 'Feature would have to be reimplemented against this client source; a Java jar cannot execute in the browser.')
}

$entries = New-Object System.Collections.ArrayList
foreach ($p in $projects) {
    $assessment = Get-Assessment $p
    $versions = @($p.game_versions)
    $entry = [ordered]@{
        id          = [string]$p.id
        slug        = [string]$p.slug
        title       = [string]$p.title
        description = [string]$p.description
        icon        = [string]$p.icon_url
        downloads   = [int64]$p.downloads
        follows     = [int64]$p.followers
        license     = [string]$p.license.id
        licenseName = [string]$p.license.name
        source      = [string]$p.source_url
        issues      = [string]$p.issues_url
        categories  = @($p.categories)
        loaders     = @($p.loaders | Where-Object { $_ -ne 'minecraft' })
        versions    = @($versions | Select-Object -Last 4)
        newest      = if ($versions.Count) { [string]$versions[-1] } else { '' }
        status      = [string]$assessment[0]
        note        = [string]$assessment[1]
    }
    [void]$entries.Add($entry)
}

$sorted = @($entries | Sort-Object -Property @{ Expression = { $_.downloads }; Descending = $true })
$counts = [ordered]@{}
foreach ($status in 'ported', 'planned', 'no') {
    $counts[$status] = @($sorted | Where-Object { $_.status -eq $status }).Count
}

$payload = [ordered]@{
    schema    = 'pretzel.mod-catalog.v1'
    generated = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    source    = 'https://api.modrinth.com/v2'
    client    = 'Pretzel Client'
    gameVersion = '1.21.11'
    counts    = $counts
    mods      = $sorted
}

$js = "// Pretzel Client - Modrinth research catalog.`n" +
      "// Generated by tools/fetch-mods.ps1 from api.modrinth.com/v2. Do not edit by hand.`n" +
      "// status: 'ported' = compiled into this client and tested, 'planned' = behaviour can be`n" +
      "// reimplemented in this client source, 'no' = cannot run in a TeaVM browser build.`n" +
      "window.PRETZEL_MOD_CATALOG = " + ($payload | ConvertTo-Json -Depth 8 -Compress) + ";`n"

[System.IO.File]::WriteAllText($outFile, $js, (New-Object System.Text.UTF8Encoding($false)))
Write-Host ("Wrote {0} projects to {1} (ported {2}, planned {3}, no {4})" -f $sorted.Count, $outFile, $counts['ported'], $counts['planned'], $counts['no'])
