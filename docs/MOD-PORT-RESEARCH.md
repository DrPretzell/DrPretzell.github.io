# Pretzel Client - Modrinth mod port research

Generated 2026-11-22T15:58:48Z from the live Modrinth API. This file is written by `tools/gen-mod-report.ps1`; the
machine-readable version the launcher reads is `launcher/mods-catalog.js`.

## What this is, and what it is not

Pretzel Client is Minecraft 1.21.11 compiled from Java to JavaScript by TeaVM before it is served. A browser
tab has no JVM, so a Modrinth `.jar` cannot be loaded at run time - not by a download button, not by a
storage shim, not by anything the launcher does. The only way a mod runs is if its behaviour is rebuilt in
this client's own Java and compiled into a new build.

Of the **300** projects researched below, **0** run inside the client today. Everything else is classified honestly:

| Verdict | Count | Meaning |
| --- | --- | --- |
| PORTED | 0 | Compiled into this client and tested in the browser. |
| REBUILD PATH | 218 | The behaviour can be reimplemented against this client source. None of these are implemented yet. |
| CANNOT RUN HERE | 82 | Needs a native binary, a GL shader stage, or the Fabric loader itself. |

## Method

1. `GET /v2/search?limit=100&index=downloads&facets=[["project_type:mod"]]` three times (offsets 0/100/200).
2. `GET /v2/projects?ids=[...]` in batches of 50 for the full record of each hit.
3. Take title, summary, icon, downloads, followers, licence id/name, source and issue URLs, loaders,
   last four game versions and categories straight from those responses - nothing is typed by hand.
4. Classify each project: an explicit per-project verdict for the well-known mods, otherwise a
   category-based default (loader library -> cannot run; optimisation/utility -> rebuild path;
   content mod -> rebuild, since blocks/items/assets have to be baked into the build).
5. Write `launcher/mods-catalog.js` for the launcher and this report.

Re-run both steps with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/fetch-mods.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/gen-mod-report.ps1
```

## Licences and attribution

Only the licence *identifiers Modrinth publishes* are recorded here; no mod source has been copied into
this repository. Every project above is either reimplemented from its described behaviour or, where the
licence allows it (MIT/Apache-2.0/BSD and the LGPL cases that permit linking), studied and attributed.
GPL-3.0 projects - Sodium, Lithium, Iris and most of the Fabric performance family are in that group -
are **not** copied: their behaviour is reimplemented, not vendored, and their names stay in this report
as the reference the reimplementation is measured against.

## The projects the brief named

| Project | Licence | Source | Verdict | Note |
| --- | --- | --- | --- | --- |
| Sodium | LicenseRef-Polyform-Shield-1.0.0 | https://github.com/CaffeineMC/sodium | planned | Renderer replacement. Chunk-section batching could be rebuilt on the Eaglercraft WebGL renderer; the Fabric renderer itself cannot load. |
| Lithium | LGPL-3.0-only | https://github.com/caffeinemc/lithium-fabric | planned | Server/world tick optimisations. The tick loop lives in this source, so individual fixes can be reimplemented. |
| Iris Shaders | LGPL-3.0-only | https://github.com/IrisShaders/Iris | no | Custom GL shader pipeline. This client renders through WebGL2 and has no Iris shader stage to hook. |
| ImmediatelyFast | LGPL-3.0-or-later | https://github.com/RaphiMC/ImmediatelyFast | planned | Batches immediate-mode GUI/buffer uploads; the same idea applies to this client GUI renderer. |
| Entity Culling | LicenseRef-tr7zw-Protective-License | https://github.com/tr7zw/EntityCulling | planned | Skips drawing entities outside the frustum or behind terrain; implementable in the entity render pass. |
| Krypton | LGPL-3.0-only | https://github.com/astei/krypton | no | Rewrites Netty networking. This client uses a WebSocket transport instead. |
| Starlight (Fabric) | LGPL-3.0-only | https://github.com/PaperMC/Starlight | planned | Light engine rewrite. A simpler light-update path could be rebuilt here. |
| Indium | Apache-2.0 | https://github.com/comp500/Indium | no | Fabric rendering API extension, no equivalent in this client. |
| ModernFix | LGPL-3.0-only | https://github.com/embeddedt/ModernFix | planned | Startup and memory reductions; only the parts that touch classes this client has. |
| Sodium Extra | LGPL-3.0-only | https://github.com/FlashyReese/sodium-extra-fabric | planned | Extra video options on top of the Sodium-style renderer work. |
| Reese's Sodium Options | MIT | https://github.com/FlashyReese/reeses-sodium-options | planned | Video settings menu rework; the menu code is in this source. |

## Top 40 by downloads

| # | Project | Licence | Loaders | Newest MC | Downloads | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Fabric API | Apache-2.0 | fabric | 26w14a | 290,988,111 | no |
| 2 | Sodium | LicenseRef-Polyform-Shield-1.0.0 | fabric/neoforge/quilt | 26.3-rc-2 | 255,548,492 | planned |
| 3 | Iris Shaders | LGPL-3.0-only | fabric/neoforge/quilt | 26.3 | 196,996,426 | no |
| 4 | Entity Culling | LicenseRef-tr7zw-Protective-License | babric/fabric/forge/neoforge/quilt | b1.7.3 | 191,707,709 | planned |
| 5 | Cloth Config API | LGPL-3.0-only | fabric/forge/neoforge | 26.3 | 188,221,863 | no |
| 6 | FerriteCore | MIT | fabric/forge/neoforge/quilt | 26.3 | 169,699,133 | planned |
| 7 | Mod Menu | MIT | fabric/quilt | 26.4-snapshot-9 | 163,291,497 | no |
| 8 | Lithium | LGPL-3.0-only | fabric/neoforge/quilt | 26.3 | 145,731,658 | planned |
| 9 | ImmediatelyFast | LGPL-3.0-or-later | fabric/forge/neoforge/quilt | 26.3 | 139,782,615 | planned |
| 10 | YetAnotherConfigLib (YACL) | LGPL-3.0-or-later | fabric/forge/neoforge/quilt | 26.4-snapshot-7 | 136,988,997 | no |
| 11 | Fabric Language Kotlin | Apache-2.0 | fabric | 3D-Shareware-v1.34 | 132,589,906 | no |
| 12 | Xaero's Minimap | LicenseRef-All-Rights-Reserved | fabric/forge/neoforge/quilt | 26.3-rc-3 | 121,828,883 | planned |
| 13 | [ETF] Entity Texture Features | LGPL-3.0-only | fabric/forge/neoforge/quilt | 26.3 | 112,859,905 | planned |
| 14 | Architectury API | LGPL-3.0-only | fabric/forge/neoforge/quilt | 26.3 | 109,901,071 | no |
| 15 | Sodium Extra | LGPL-3.0-only | fabric/neoforge/quilt | 26.3 | 108,454,826 | planned |
| 16 | Xaero's World Map | LicenseRef-All-Rights-Reserved | fabric/forge/neoforge/quilt | 26.3-rc-3 | 106,999,119 | planned |
| 17 | [EMF] Entity Model Features | LGPL-3.0-only | fabric/forge/neoforge/quilt | 26.3 | 106,998,482 | planned |
| 18 | VeinMiner | AGPL-3.0-only | bukkit/datapack/fabric/folia/forge/neoforge/paper/purpur/quilt/spigot | 26.3 | 106,520,435 | planned |
| 19 | AppleSkin | Unlicense | fabric/forge/neoforge/quilt | 26.3 | 100,286,346 | planned |
| 20 | Not Enough Animations | LicenseRef-tr7zw-Protective-License | fabric/forge/neoforge | 26.3 | 95,650,221 | planned |
| 21 | Reese's Sodium Options | MIT | fabric/neoforge/quilt | 26.3 | 89,667,024 | planned |
| 22 | Just Enough Items (JEI) | MIT | fabric/forge/neoforge | 26.3 | 86,712,616 | no |
| 23 | 3D Skin Layers | LicenseRef-tr7zw-Protective-License | fabric/forge/neoforge/quilt | 26.3 | 85,635,313 | planned |
| 24 | ModernFix | LGPL-3.0-only | fabric/forge/neoforge | 26.1.2 | 85,122,495 | planned |
| 25 | Continuity | LGPL-3.0-only | fabric/forge/neoforge/quilt | 26.3 | 80,932,676 | no |
| 26 | Geckolib | MIT | fabric/forge/neoforge/quilt | 26.3 | 78,492,154 | no |
| 27 | VeinMiner Hotkey | LGPL-3.0-only | fabric/neoforge/quilt | 26.3 | 78,243,177 | planned |
| 28 | Simple Voice Chat | LicenseRef-All-Rights-Reserved | bukkit/bungeecord/fabric/folia/forge/neoforge/paper/purpur/quilt/spigot/velocity/waterfall | 26w14a | 77,720,603 | planned |
| 29 | Text Placeholder API | LGPL-3.0-only | fabric/quilt | 26w14a | 76,627,019 | no |
| 30 | More Culling | GPL-3.0-only | fabric/neoforge/quilt | 26.3 | 76,020,203 | planned |
| 31 | Jade ð | CC-BY-NC-SA-4.0 | fabric/forge/neoforge/quilt | 26w14a | 74,882,325 | planned |
| 32 | Zoomify (Zoom) | LGPL-3.0-only | fabric/neoforge/quilt | 26.4-snapshot-1 | 73,469,794 | planned |
| 33 | Dynamic FPS | MIT | fabric/forge/neoforge/quilt | 26w14a | 73,079,611 | planned |
| 34 | Forge Config API Port | MPL-2.0 | fabric/forge/neoforge | 26.3 | 72,444,287 | no |
| 35 | Collective | LicenseRef-All-Rights-Reserved | fabric/forge/neoforge/quilt | 26.3 | 71,881,318 | no |
| 36 | FancyMenu | LicenseRef-DSMSLv3.1 | fabric/forge/neoforge | 26.3 | 70,989,690 | planned |
| 37 | Puzzles Lib | MPL-2.0 | fabric/forge/neoforge | 26.3 | 67,478,585 | no |
| 38 | Konkrete | Apache-2.0 | fabric/forge/neoforge | 26.3 | 66,608,212 | no |
| 39 | Mouse Tweaks | BSD-3-Clause | fabric/forge/modloader/neoforge | b1.7.3 | 65,505,813 | planned |
| 40 | Balm | LicenseRef-All-Rights-Reserved | fabric/forge/neoforge | 26.3 | 65,243,164 | no |

## What gets rebuilt first, and why

Ordered by how much a browser client actually gains per hour of link time. Each item is a Java change in
`1.21.11-master/1.21.11-master/src/game`, followed by a TeaVM link (2-3 h on this machine).

1. **Frustum/occlusion entity culling** (Entity Culling, MoreCulling) - skip entities and block faces that
   cannot be seen. Biggest frame-time win in a browser, and the render loop is ours.
2. **Chunk-section draw batching** (Sodium-style) - merge per-section draws and drop redundant state
   changes in the chunk renderer. The single largest CPU win for a JS/WebGL renderer.
3. **Idle/focus FPS cap** (Dynamic FPS) - a few lines in the frame loop; saves battery and keeps the tab
   responsive when the game is in the background.
4. **HUD/info overlays** (What Is My FPS, Jade/WTHIT, AppleSkin, BetterF3) - self-contained GUI work with
   no engine risk, easy to verify.
5. **Client options** (Gamma Utils, Mouse Tweaks, Item Scroller, Inventory Profiles) - input and settings
   changes that reuse the existing option and account storage.

Everything else in the REBUILD PATH column needs the item/block/asset pipeline (JEI-class browsers,
content mods, world generation) and is a project per mod, not a patch.

## Limitations

- No Modrinth project below is running in the client yet; PORTED is empty until a rebuild ships and is tested.
- The verdicts are engineering judgements, not automated compatibility tests: they look at loaders,
  categories and, for the well-known mods, the actual architecture of the mod.
- A rebuild is a reimplementation of behaviour, not a binary port; results will not be feature-identical.
- Downloading a jar in the launcher stores and verifies the file in the account's own IndexedDB bucket.
  It never executes, and the page says so.
