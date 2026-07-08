# src/ — chunk contract

`index.html` is a BUILD ARTIFACT. Edit these chunks, then `node build.js`
(or `node build.js --watch`). Build order = the MANIFEST array in build.js;
all chunks share ONE lexical scope, exactly as before the split. Function
declarations hoist across chunks; top-level `const` data and load-time calls
do not — respect the order.

Per-chunk contract — what each file defines (exports) and what it may touch
(consumes). Renderer chunks read everything, mutate nothing. Only 25-save
touches localStorage. Only 60-net touches the wire. Nothing in 30–65 may
touch the DOM (addText/banners are fine — they're canvas FX).

| chunk | defines | consumes |
|---|---|---|
| 00-util | TAU, clamp/lerp/rand, dist, angDiff, inArc, aimLead | — |
| 05-palette | INK/PAPER/CREAM/RED/REDHOT/GOLD, teleRGBA | save.colorblind |
| 10-dom | cv/ctx, W/H, fitCanvas, ARENA, THEMES/setTheme/paintBG, keys, keydown/keyup, touch UI | game, player, duel, net (input routing only) |
| 15-fx | particles/texts/stains, shake/freeze, sparks/puff/slashTrail, inkSplat, boltFX, updateEffects | save.shakeMul |
| 20-data | adapt tracker, token pools, WEAPON_ORDER/WEAPONS, WPN_POSTURE/WPN_NEON, BOW_ORDER/BOWS | save (mastery reads) |
| 25-save | SAVE_KEY, defaultSave/loadSave/persistSave, export/importSave, UPGRADE_DEFS, CHARMS, ACHIEVEMENTS/award, upg* | BOWS, WEAPONS |
| 30-player | player, ATK/DODGE/PARRY, startAttack/Dodge/Parry, damagePlayer, onPerfectDodge, updatePlayer | enemies, game.ult, fx helpers |
| 35-enemies | Enemy + subclasses, bosses, makeElite, orbs, shockwaves | player, damagePlayer, tokens, adapt |
| 40-ults | ULTS/ULT_BEGIN/ULT_STEP, makeUltRun/runEntityUlt, actors, ultWaves, ultCounterTrigger, drawUltRun, ribbons/wings | player, enemies, duel fighters, stalks |
| 45-hazards | BLESSINGS/shrines, stalks/fireZones, portal/merchant, transitions, loot chests (seeded rolls) | player, enemies, game, save (chest stream) |
| 50-archer | projectiles (enemy arrows), toggleStance, pArrows, playerLooseArrow/spawnPArrow, burnZones | player, enemies, duel fighters, stalks |
| 55-duel | brush casts, makeFighter/AI, clash/parry logic, fighter ult/stance/bow, duel rounds | ults, archer, fx |
| 60-net | PeerJS glue, lockstep netFrame, sampleLocalBits/applyBits (BIT MAP LIVES HERE) | duel, keys, menuSel |
| 65-run | game object, addHonor, overlays map, difficulty/waveMults (campaign 1.15^n hp · √M dmg), LEVEL_DATA, CURSES, startRun/waves/rush, campaign stages, the Tomb (tablets/trial), gameOver | everything above |
| 70-ui | shop (all tabs), records, settings, renderMenu, the seal | save, game, menuSel |
| 80-audio | AE graph, playSfx/realPlaySfx, ambient beds, initAudio | themeIndex |
| 90-render | update() dispatcher + draw()/drawPlayer/drawFighter/drawEnemy/HUD/telegraphs | reads all state, mutates none |
| 99-boot | rAF main loop, delta clamp | update, draw, netFrame |

Verification ritual after any change: `node build.js` (which also runs the
boundary LINT — localStorage only in 25-save, DOM only in the UI-facing
chunks), `node --check` each touched chunk, then run the harness (45 tests:
all modes, every blade art and bow, the ink/color lawfulness audit, and
lockstep determinism) against the built index.html.
