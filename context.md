# INKBLADE — Session Handoff Context

Read this first, then read `index.html` before changing anything. Updated
2026-07-07 after the ULTIMATE ARTS + ARCHER STANCE expansion (~7,400 lines).
Everything in `FEATURES_PROMPT.md` — groups 1 through 7, including the
online-duel stretch goal — is built and verified, plus:

- **奥義 ultimate arts** (`ULTS`/`ULT_BEGIN`/`ULT_STEP`, `makeUltRun`,
  `runEntityUlt`): every blade has a unique scripted art (windup telegraph →
  scripted sequence with i-frames/armor → short settle) that flows into the
  classic INK SURGE buff (`game.ult.buffT` PvE / `f.surge` duels). Steppers
  are shared between PvE and duels via actor adapters
  (`playerUltActor`/`fighterUltActor`) and are deterministic. A hit during
  the WINDUP breaks the art and refunds 60% meter. Meter charges from landed
  hits + perfect dodges only; duels reset it every round. Bamboo stalks
  block the lane arts (Issen, Raiwatari). Fudemaru's art is the original
  dash + 5-stroke flurry (`ultBrushSlash`), flashiest, meter pinned full.
- **Progression overhaul** (2026-07-07): **CAMPAIGN** mode — 5 maps ×
  `STAGES_PER_MAP` stages; enemy HP scales `stageMult(n) = 1.15^(n-1)`
  (~×942 at stage 50) but enemy DAMAGE scales `√M(n)` — the player's HP
  ceiling is only 10×, so survivability stays dodges, not spreadsheets
  (TTK checkpoint test guards both directions). **Weapon XP** — every landed hit banks
  `dmg / M(stage)` via `grantWeaponXP` (the ONLY write path); levels give
  ×1.08 cutting weight, capped by rarity (Worn 10 / Pure 20 / Legendary
  30). **Chests** — weapons are FOUND, not bought: seeded rolls
  (`mulberry32(hash2(save.seed, chestsOpened))`, anti-save-scum),
  duplicates melt into XP shards; merchant keeps charms/training and
  sells chest keys. **Tomb of the Fallen** — `startRun('tomb')`,
  ghost-parry trial + breath finale. (2026-07-08: tracks are now FLAT
  stats and the old ×10 / balance-identity math is gone — see the
  REBIRTH section below, which is authoritative.) NONE of it touches
  duels — fighter damage is pinned to raw WEAPONS stats by a harness
  test. Numbers render through `fmtNum`.
- **弓 archer stance** (Q; duel P2: P; online bit 1024): stance toggle with
  a .35s swap lock; hold attack to draw (held state = online bit 2048),
  release to loose (`pArrows`, `playerLooseArrow`/`fighterLooseArrow`).
  Arrows cost stamina (see the design comment above `BOWS`), are blocked by
  bamboo and shield-ashigaru fronts, deal half damage point-blank, and
  enemies rush a drawn bow. Five bows (`BOWS`/`BOW_ORDER`) sold on a new
  merchant tab; `save.bowsOwned`/`save.bowEquipped` are additive save
  fields. PvP arrows run ×.6 damage ×.85 speed, are parryable, deflected by
  active slashes, and never clash. Fire bow leaves `burnZones`.

---

## What this project is

**INKBLADE** (`墨刃`) is a complete 2D ink-wash/parchment samurai arena game in a
**single self-contained `index.html`** — inline CSS, vanilla JS, canvas rendering,
no build step, no assets. The one permitted external dependency is PeerJS,
lazy-loaded from unpkg **only** when a player opens the online-duel option;
the game is fully playable offline without it.

Files in `/Users/kairuki/Desktop/2DGame/`:
- `index.html` — the entire game
- `FEATURES_PROMPT.md` — the expansion spec (now fully implemented)
- `context.md` — this file

## Hard constraints — never violate

1. **Single file**; only PeerJS may come from a CDN, lazily, for online duels.
2. **Aesthetic — the ink/color duality (HARD RULE since the Phase 0–5
   visual refactor)**: base play is strict sumi-e — ink blacks/grays on
   parchment, with exactly two sanctioned accents: CINNABAR for danger
   (always via `teleRGBA`, never decorative) and GOLD for mechanical
   reward (honor, posture, parry, riposte, breaks). Enemies are told
   apart by VALUE and silhouette, never hue; themes by paper tone and
   brushwork. Full color (`WPN_NEON`, `PAL.pigment`) exists ONLY while an
   ultimate burns, gated by `styleFor(owner)`/`ownerSurged()` and faded
   by the 0..1 envelopes (`game.ult.env`, `f.surgeEnv`). New visuals must
   route through `fx(event, data)` recipes (write-only cosmetics — they
   may never mutate sim state) and particle `tint` tokens resolved at
   draw time by `pcol()`. The one UI exception: the ult meter previews
   its blade's neon. The harness's lawfulness audit enforces all of this.
3. **Telegraph fairness**: every attack that can hurt the player is visibly
   telegraphed at every difficulty. Colorblind mode swaps telegraph red for
   high-contrast blue via `teleRGBA()` — route any new danger color through it.
4. **Save migration is additive** (`inkblade_save_v1`): defaults live in
   `defaultSave()`, merging in `loadSave()`. Old saves must never lose data.
5. **Fudemaru stays admin**: outside the honor economy, barred from duels,
   excluded from mastery. The seal (codes `fudemaru` / `筆` /
   `the brush that unwrites`) now PERSISTS across reloads via
   `save.adminUnlocked`; typing the code again closes the seal and reverts
   the blade. `loadSave` only allows `save.equipped === 'fudemaru'` while
   the seal stands.
6. **Online determinism — THE TWO DICE (widened 2026-07-08 for online
   co-op)**: the SIM rolls only through `rand()`/`srandom()` (00-util),
   which reads a shared mulberry32 stream while an online co-op runs
   (`setSimSeed`, seeded in the handshake) and plain `Math.random`
   offline. Cosmetics — 15-fx particles, 80-audio, draw-tree code, and
   any block gated by a local `Math.random()` — must roll `crand()`
   ONLY: a conditional pull on the sim stream silently desyncs the
   lockstep (the sakura petals taught us). `simDraws` is the canary.
   Duels additionally keep the old rule (no unseeded gameplay dice in
   `updateFighter`) and lock to arena 0.

## How to run / test

- **`index.html` is now a BUILD ARTIFACT — never edit it by hand.** Source
  lives in `src/` (18 ordered chunks, one shared lexical scope, see
  `src/MANIFEST.md`); `node build.js` stitches them into `index.html`
  (`--watch` for a dev loop). The build was verified byte-identical to the
  pre-split file, so history and behavior are unchanged. The shipped game is
  still the single self-contained HTML file.
- `open index.html` to play.
- Syntax: `node --check src/<chunk>.js` (each chunk parses standalone), or
  extract the built inline script and `node --check` that.
- Smoke tests exist in the scratchpad from the build session (`harness.js`,
  `harness2.js`): DOM/canvas/localStorage stubs via `vm`, a lexical-scope
  bridge (`globalThis.API = { get game() {...}, ... }`) because top-level
  `let/const` don't land on the vm global, then drive `update(1/60)`/`draw()`.
  harness2 additionally proves **lockstep determinism** by running two
  independent sim contexts through identical input streams and comparing
  state, plus legacy-save migration and export/import round-trips.
  Rebuild these if lost; the bridge trick is the non-obvious part.

---

## Feature inventory (all working, all verified)

### Modes (`menuSel` → `renderMenu()` → `startRun(mode)`)
- **Level Mode** — 5 themed levels + bosses; shrine + merchant + portal after
  each boss; sequential unlock; victory at level 5.
- **Infinite Mode** — endless, compounding waves; shrine every 5th wave;
  merchant portal each arena rotation; records + high scores.
- **Boss Rush** — Gauntlet (timed, best time) and Chaos (endless stacking
  lords, deepest stage).
- **1v1 Duel** — local human, **AI duelists** (Ox/Fox/Stone), **Tournament**
  (4 escalating gates → persistent gold headband cosmetic), or **Online**.
  ALL eight blades are selectable in duels regardless of ownership (duels
  are progression-free). Fudemaru joins the blade rows only while the seal
  is open (`game.adminUnlocked`) and fights through `fighterBrushCast` —
  instant unparryable casts (tap = 火 cone 50dmg, roll-tap = 雷 seeking
  bolt 25dmg + stagger), evadable only by i-frames, 0.55s recovery, and
  the duel HUD labels it ADMIN in red. Brush STANCES are per-fighter
  (`f.ultMode`/`f.brushSwap`, toggled via `toggleFighterUlt/Swap`): local
  P1 = L/U, P2 = K/J; online they ride input bits 128/256 so both sims
  flip on the same tick. Ult taps open a duel-native maw
  (`updateDuelHoles`): 1.6s pull on the foe (rolls halve it), 60dmg +
  stagger at collapse, i-frames evade; 0.95s cast recovery; maws clear
  on round reset. All deterministic → lockstep-safe online.
  Input bit map: 1/2/4/8 move · 16 atk · 32 roll · 64 parry ·
  128 ult · 256 swap · 512 meditate (held) · 1024 bow-stance toggle ·
  2048 attack held (drives the bow draw).
  Any of the 5 arenas with live hazards; mutators: sudden death, no stamina,
  giant blades, mirror match.
- **Training Yard** (`startRun('training')`) — rebuilding dummy with rolling
  DPS/total readout, and a TrainerBot drill that telegraphs on a cycle and
  scores dodge/parry reaction in ms (last/best).
- **Merchant visit** — browse the stall from the menu.

### Player kit
Arrows/WASD move · V slash · Shift roll · **C parry** · **M meditate** ·
E interact · Esc pause.
- **Meditation** (hold M; duels: P1 M / P2 `,`; online bit 512): rooted and
  open, but stamina returns 3× faster, even through the post-action regen
  delay. Gold dashed ring + rising motes + 瞑 glyph.
- **Parry** (`PARRY` const, `startParry`, `playerParryActive`): 0.13s window,
  0.27s punishable whiff recovery, costs 10 stamina. Success staggers the
  attacker (`getParried`), refunds stamina, adds +25 posture, opens a 1.3s
  **riposte** window (next swing 1.5×, gold dashed ring). Parrying projectiles
  works (`deflectable !== false`); **heavy** attacks crush parries (half
  damage, "crushed!") — dodge those. Duel parries beat clashes.
- Perfect dodges funnel through `onPerfectDodge()` (adapt + stats + blessings).

### Posture system
Every enemy has `posture/postureMax/postureDrain/brokenT` and a thin gold bar.
Hits add blade-specific posture (`WPN_POSTURE`; Ame fast-chips, Akaoni cracks).
Full bar → `postureBreak()`: 1.5s stagger **that pierces brute armor and drops
the ashigaru shield**, and every hit during `brokenT` crits 1.5×. Drains after
1.2s untouched. Bosses have big pools (120–260).

### Enemies (`ENEMY_TYPES`: grunt, duelist, brute, archer, shinobi, ashigaru)
- **Shinobi** (`vanishprep` state): marks its landing spot behind the player
  with gathering smoke + dashed ring *before* teleporting, then a short
  telegraphed stab. In Level 4–5 tables and infinite pools.
- **Shield Ashigaru**: `shielded` — frontal hits are blocked (posture-only,
  ×1.3), flank it or break it; spear thrust; slow square advance.
- **Elites** (`makeElite`): 10% of non-boss spawns in Infinite (and Level at
  diff ≥5). Gold ring, one affix — `swift` (faster windups/speed), `aura`
  (visible seared ring, tick damage), `stoneguard` (posture drains 30/s),
  `split` (archers: 3-arrow fan). Drop 15–30 honor orbs — the only non-boss
  honor source.
- Adaptive AI now also reads **parry habits** (`adapt.windupParries`,
  `parryHabit()`) → more feints, delayed windups.

### Roguelite layers
- **Shrines** (`BLESSINGS`, `spawnShrine/openShrine/pickBlessing`): after each
  level clear and every 5th infinite wave; pick 1 of 3 run-scoped blessings
  (mend/wind/magnet/reap/thorn/iron/focus/tempo/edge) via `hasBless()`.
- **Curses** (`CURSES`, menu toggles → `game.curses`): noroll ("The Rooted"),
  frail (half HP), mirror (reversed movement), winded (all swings weak);
  each multiplies honor payouts inside `waveMults()`. Shown as red kanji by
  the difficulty tag.

### Meta progression (all persistent)
- **Charms** (`CHARMS`, third shop tab, one worn, never in duels):
  Omamori (cheat death 1/run), Magnet, Koi (+40% i-frames), Oni (±20%).
- **Sword mastery** (`save.mastery`, `masteryOf/isMastered`, `MASTERY_PERKS`):
  5 boss kills per blade unlock its perk; pips in the sword shop.
- **Achievements** (`ACHIEVEMENTS`, `award()`): 21 red hanko stamps on the
  Records scroll (menu + shop buttons), banner + chime on earn.
- **Stats** (`save.stats`): kills, deaths, perfect dodges, parries, posture
  breaks, elites, lifetime honor, duel wins, per-blade kills → favorite blade.
- **Save export/import**: `exportSave()`/`importSave()` — `INK1.` + base64 in
  the settings panel, validated, sanitized through `loadSave()`.

### Settings (gear `設` on title)
Master/SFX/ambient volume + mute, screen-shake intensity (`save.shakeMul`,
applied inside `shake()`), colorblind telegraphs (`save.colorblind` →
`teleRGBA`), save scroll export/import.

### Audio (`AE`, `initAudio`, `realPlaySfx`, `retuneAmbient`)
All synthesized: whoosh/thunk/clash/parry chime/dodge/bow/bolt/taiko/break/
vanish/tick/buy/achieve/bless/portal/rumble + pentatonic orb ladder that climbs
with pickup streaks. Per-theme ambient beds (wind + rain loops retuned on
`setTheme`) with scattered one-shots (birds, rustle, crackle, thunder) from
`updateAudioAmbient` in the frame loop. Context wakes on first gesture;
`playSfx` is a no-op until then — always safe to call.

### Touch (`touchUI`, canvas listeners, `drawTouchUI`)
Left-half virtual stick; 斬/転/弾 buttons bottom-right; 談 context tap for
merchant/shrine. Drives PvE player and duel P1 through the same buffers; the
brush's hold-cast works via press-and-release on 斬. `touch-action:none`.

### Online duel (`net`, `NET_DELAY = 3`, section "online duel")
Host gets a 5-char room code (`inkblade-<code>` peer id); guest joins; the
match starts itself on handshake. Reliable ordered DataChannel carries only
per-tick input bitmasks (`sampleLocalBits`/`applyBits`); both sides run
`update(1/60)` in lockstep (`netFrame`), stalling honestly when the wire lags.
Ping every 2s → connection dot (green/gold/red + "waiting for the wire…") in
the duel HUD. Disconnect/quit → banner + clean return to menu. Arena locked to
dojo; host's mutators rule. Strict-NAT failures surface as messages, not hangs.
Determinism is covered by a two-context regression test (harness2).

### Other polish
- **Death calligraphy** (`calligraphy`, `paintDeathKanji`): boss kills brush a
  large floor kanji (勝/討/滅/嵐 by context), cleared per arena.
- Gold headband cosmetic on player + duel P1 once the tournament is won.

## Save schema (all additive on the legacy fields)
```
honor, owned, equipped, upgrades{5}, maxLevelCleared, merchantUnlocked,
deepestWave, highScores, bestRushTime, bestChaosStage,
charm, charmsOwned, mastery{}, achievements[], stats{...bladeKills{}},
headband, adminUnlocked, audio{master,sfx,ambient,muted}, shakeMul, colorblind,
bowsOwned[], bowEquipped,       // archer stance — old saves get shortbow free
weaponXP{id:{xp,lvl}}, tomb{body,stance,edge}, maps{unlocked,best[5]},
seed, chestsOpened, chestKey    // progression — maxLevelCleared vouches maps
```

## Menu declutter (2026-07-07, this session)

- **Three doors, not five** (`70-ui.js` renderMenu + template): CAMPAIGN
  groups the old Level Mode (sub-button `campStory`, mode `'level'`) and
  the map campaign (`campConquest`, mode `'campaign'`); INFINITE groups
  endless storm (`infEndless`, `'infinite'`) and both boss rushes
  (`infGauntlet`/`infChaos` → `'rush'` + `menuSel.chaos`) — the old
  chaosRow is gone; 1v1 DUEL stands alone. `menuSel.mode` still speaks
  the old four values, only the menu groups them — startRun/retryRun/net
  untouched.
- **"太易 TOO EASY?" drawer** (`btnTooEasy`/`advBox`, `advOpen` let in
  70-ui): starting level, campaign map, difficulty and curses all hide
  behind it; hidden entirely for duels. Defaults when never opened:
  level 1, map 0, diff 1, no curses.
- **Shop overlap fix**: the global `canvas{width:100%...}` rule is now
  scoped to `#cv` — it was stretching the 64×22 weapon-icon canvases to
  full row width and shoving the description into the EQUIP button. The
  right-hand column in every shop row now carries `.si-right`
  (flex:none) instead of an inline textAlign.
- **Click-to-unravel rollers** (`10-dom.js` roller block + template CSS):
  on overflowing overlays the bottom dowel pulses gold and a click
  scrolls the overlay 65% of a screen (smooth); the top dowel rewinds.
  Hint classes (`unravel`) refresh on scroll/resize + a 400ms interval.
- Verified with `menu_harness.js` (39 checks: grouping, drawer, all
  startRun modes, shop right column, aim assist, homing, mouse aim) —
  rebuild it in the scratchpad if lost; it's the standard vm +
  API-bridge stub harness.

## Aim overhaul (2026-07-07, same session)

Keyboard input is eight-spoked but `player.face` was always a free
float — these features widen the INPUT, rendering needed nothing:

- **Melee soft-aim** (`startAttack`, 30-player): the swing snaps to the
  nearest living foe within ~55° (.95 rad) of facing and reach×1.7,
  scored `d + off*60`. PvE only, deterministic, skipped while mouse
  aim is live (the cursor aims truly).
- **導矢 homing arrows** (`ARROW_HOME`/`homePArrow`, 50-archer): PvE
  player arrows bend toward the nearest foe inside a 25° half-cone
  (range 460, turn 3.4 rad/s); while `ultBuffed()` the cone opens to
  90° and turn 8. Speed preserved; **PvP arrows never home** (duels
  stay reads; lockstep untouched). Hooked in `updatePArrows` before
  integration, `if (!a.pvp)`.
- **Mouse aim toggle** (`save.mouseAim`, settings checkbox `setMouse`):
  `mouse`/`mouseAimOn()`/`mouseWorld()` in 10-dom (mouseWorld undoes
  the boss-camera zoom). Cursor owns `player.face` (movement stays
  WASD), click = V-key doorway (brush hold included, bow reads
  `mouse.down` as held), dry-brush reticle drawn screen-space in
  90-render. PvE only — `mouseAimOn()` refuses duels and touch.

## 転生 REBIRTH + tomb flat-stat rework (2026-07-08) — SUPERSEDES THE OLD BALANCE IDENTITY

The tomb's ×10 multiplier tracks and the "world ×942 vs player ×805"
identity are GONE. New shape:

- **Tomb = flat stats, uncapped** (25-save helpers): edge → `tombAtk()`
  +1 attack/step, body → `tombHp()` +6 HP/step, stance →
  `tombPosture()` +2 posture/step (also +1% riposte window/step in
  getParried). `baseCrit()` is a flat 1.5. `tombCost` = 300×(1+.35S)
  — steady slope. Trial unchanged (parry ghosts + breath, shaky .8).
  Flat gains fade against the world's exponential curve BY DESIGN —
  that wall is what makes rebirth matter.
- **転生 rebirth is the only player exponential**: `save.rebirth.level`,
  `rebirthMult()` = 1.5^level on PvE damage (startAttack,
  playerLooseArrow) and max HP (+10 flat HP & +1 flat atk per level
  too). Gate: `maxLevelCleared >= 5` EACH cycle (resets). `doRebirth()`
  in 25-save rebuilds the save from defaultSave() + keeps: swords/bows
  + weaponXP + mastery, achievements/stats/records, kyudo, headband,
  seal, settings, seed+chestsOpened (chest stream never re-rolls).
  Burns: honor, upgrades, tomb, charms (until cycle 5), maps/levels,
  merchantUnlocked (until cycle 2). Perk ladder `REBIRTH_PERKS`:
  1 ults · 2 merchant open · 3 start 誉1000 · 4 start chest key ·
  5 heirloom charms.
- **奥義 gated behind cycle 1** (`ultUnlocked()` in 25-save): addUlt +
  activateUlt no-op at cycle 0 with a sealed 封 meter in the HUD.
  Duels NEVER route through these (fighter ults untouched); the open
  seal (admin) exempts.
- **UI**: rebirth altar (`tombAltar`, east side of the tomb, torii) →
  `openRebirth()` scroll overlay (#rebirthOverlay, perk rows, armed
  double-click confirm; read-only when opened from the title's 転生
  button, which appears once the gate has ever opened). Stat wall
  (S&S-style bars: attack/vitality/posture + ×mult) drawn top-left in
  tomb choose phase. Records + menu records show cycle.
- Old saves: tomb step counts persist but are reinterpreted as flat
  steps; everyone starts at cycle 0 → ults sealed until first rebirth.

### Rebirth companions (same day, second pass)

- **Ult sandbox**: the sealed meter now FILLS everywhere (grayed ashen
  bar behind 封 in the HUD); `activateUlt` allows `mode === 'training'`
  even at cycle 0 — the yard is where you learn arts before earning
  them. Real trials still refuse.
- **The world remembers**: `waveMults()` scales enemy hp+dmg by
  `1 + .08 × rebirthLevel()` — keeps ×1.5/cycle from unmaking the game.
- **虚 HOLLOW** (30-player): hitting 0 stamina → `player.hollowT = 2`:
  parry window ×.5 (playerParryActive), dodge speed ×.7, damage taken
  ×1.25 (damagePlayer). Re-arms only after st > 15 (`hollowSpent`).
  Gray dashed ring + 虚 glyph in drawPlayer. PvE only — fighters
  untouched.
- **Perks 6–10** (REBIRTH_PERKS + implementations): 6 Twin Charms
  (`save.charm2`, `charmed()` checks both, shop WEAR fills the free
  slot, HUD shows both), 7 Sweetened Burdens (curse honor ×2 in
  waveMults), 8 Remembered Roads (doRebirth grants maps.unlocked ≥ 2),
  9 Patient Ancestor (tomb trial allows 1 scar), 10 Golden Stroke
  (gold arc on the player at cycle ≥ 10, drawPlayer).
- **Record cycle tags**: `save.recCycles` {wave,rush,chaos} +
  `cycle` field on highScores entries; set at the four record sites in
  65-run, shown in menu records and scoreListHTML, kept by doRebirth.
- **Home portal**: victory (level 5 clear, or campaign map clear) now
  spawns `spawnPortal(..., 'home')` beside the merchant — gold rift,
  '帰 the road home', steps into `returnToMenu()`. No more
  Esc→abandon after winning.

## 二人 COUCH CO-OP (2026-07-08)

A second local samurai for INFINITE and both BOSS RUSHES only — every
other door stays solo. Started bottom-up in one session (entity kit →
enemies → input), finished top-down in the next (run flow → menu →
render/HUD → world sweeps).

- **Scope & flow** (65-run): `menuSel.coop` → `game.coop` is armed in
  `startRun` only for `infinite`/`rush`; `p2 = makeP2(menuSel.p2Blade,
  menuSel.p2Bow)` (30-player) or null. `returnToMenu` clears both.
  Between-wave heals run over `allPlayers()`; `wallSpot` keeps spawn
  distance from every blade; `waveMults` hp ×1.6 while two stand.
- **P1 is untouched**: save-backed progression, charms, kyudo, 奥義,
  mouse aim. In co-op, `gatherInput` gives P1 WASD only — the arrows
  belong to P2 (solo keeps both, exactly as before).
- **P2 is duel-raw** (`pl.p2` flag): any non-admin blade + any bow
  straight from the menu (`menuSel.p2Blade/p2Bow`, shared with the duel
  pickers), flat 100/100 statline (frail curse respected), own
  ame-stacks/riposte/hollow state, and **never a save write** — every
  XP/ult-meter/stats/mastery/adapt site is guarded by `!pl.p2`.
  The brush refuses the second hand (`makeP2` falls back to tetsu).
- **Keys**: arrows move · U slash · I roll · O parry · P bow stance ·
  `,` meditate (10-dom keydown row mirrors the duel P2 binds). In
  co-op PvE, U no longer toggles brush swap.
- **World asks the roster, never `player`**: `allPlayers` /
  `alivePlayers` / `nearestPlayerTo` (30-player); every enemy
  distance/angle/pursuit question routes through `Enemy.tgt()` (the
  CO-OP CHOKEPOINT comment in 35-enemies) — including the Ronin
  Archer's charged lead, the Sovereign's volley lead + punish/bait
  reads. Shockwaves, fire zones and enemy arrows threaten every alive
  blade; orbs magnet to and are collected by the nearest blade into
  the one shared wallet; the 'iron' blessing blesses the party.
  Tomb ghosts and the TrainerBot still speak to `player` — those modes
  are solo by construction.
- **Downed, not dead**: a fatal blow with a partner standing kneels
  the blade (`downed`, damageSamurai) — timers tick, nothing else;
  wave clear calls `reviveDowned()` (half HP, full stamina, 1.2s iT).
  Both down → gameOver as ever.
- **Render/HUD** (90-render): `drawPlayer(pl)` is parametrized —
  P2 wears an ink-gray headband (value, not hue), kneels faded under a
  倒 glyph when downed, and P1-only bleeds (ult wings/run, rebirth
  gold, neon roll streaks) are `!p.p2`-gated. HUD adds a slim 弐
  hp/stamina stack under P1's bars and P2's arm bottom-right.
- **Menu** (70-ui + template): a "company" row (一人 ALONE / 二人
  CO-OP) under the storm-style buttons, unfolding P2 blade + bow rows.
- Verified by `coop_harness.js` in the scratchpad (24 checks: solo
  regression, arming rules, arrow movement + U-buffer swing, downed →
  kneel → real-update-loop revive → wave 2, both-down gameOver, rush
  entry, no save writes, admin refusal). Standard vm + API-bridge stub
  harness — rebuild it if lost.

## 網 ONLINE CO-OP (2026-07-08, same day as couch co-op)

Two houses, one storm: PvE co-op over a room code, built on the duel
netcode + the couch co-op entities. Host plays P1 with their full
progression; the guest drives P2 (duel-raw). Infinite + both rushes.

- **Session kinds** (60-net): `net.kind` 'duel'|'coop' —
  `hostGame/joinGame` generalize the old pair (`hostCoop/joinCoop`
  wrappers; `netMsgEl` picks which menu box speaks). A kind-mismatched
  join is refused politely (`kindErr`). Handshake: join (guest's
  blade/bow) → probe/probeAck (RTT sizes the delay) → `coopStart`
  carrying **seed + the host's entire save + mode/chaos/diff/curses**
  → both sides run `startOnlineCoop` → identical `startRun`.
- **Three legs of determinism**:
  1. `setSimSeed(cfg.seed)` — every sim roll from one stream (hard
     rule 6, the two dice).
  2. `borrowSave(cfg.save)` (25-save) — the guest's sim runs on the
     host's ledger so P1's statline matches. Mid-run save writes are
     SIM STATE and land on the borrowed copy on both sims identically;
     `persistSave` is a no-op while borrowed; `restoreSave()` at the
     END of returnToMenu (after bankOrbs/persist, before resetPlayer)
     hands the guest their own ledger back untouched.
  3. Every action rides the tick-stamped bitmask — when
     `net.coop && started`, 10-dom routes v/Shift/C/R/Q/E to
     `net.pend`, touch taps likewise, `gatherInput` reads `pl.netCtl`
     first, and mouse aim refuses (`mouseAimOn`).
- **Bit map additions**: 4096 = interact (E) — P1/host only; 128 = 奥義
  (activateUlt, P1 only); 1024 = bow stance via `toggleStanceFor`;
  256 (brush swap) is meaningless in co-op. `applyBits` branches on
  `net.coop` (samurai tongue) vs duels (fighter tongue). netFrame's
  actors: host `player`/remote `p2`, guest mirrored. The step loop
  breaks when `game.state` leaves 'playing' (a synced interact opened
  a scroll) AND netFrame refuses to run at all outside 'playing' —
  both sims freeze on the same tick, whoever calls.
- **Shrines pause both sims**: the host's E opens the scroll at the
  same tick on both (interact bit); only the host's cards answer
  clicks; the pick crosses as `{t:'bless', id}` (queued in
  `net.blessQ` if it beats the guest's sim to the shrine — unordered
  wire), `blessClose` mirrors walking away; guests' Esc is ignored
  there. **Pauses mirror** (`{t:'pause'}/{t:'resume'}` in
  pauseGame/resumeGame — render-only, so tick skew is harmless).
- **Not online**: the merchant portal never opens (DOM shop clicks
  don't ride ticks — guard in startInfiniteWave), and the brush is
  coerced to tetsu (its casts ride keyups). Fudemaru, chests and
  campaign stay solo/couch territory.
- **Desync insurance**: `coopChecksum()` (positions/hp/st/honor,
  ×64-rounded through hash2) exchanged every 300 ticks
  (`ckLocal/ckRemote`, `netCkCompare`) — a mismatch severs the line
  honestly ("the sims drifted apart"). `simDraws` (00-util) counts
  seeded rolls as a debugging canary. HUD: connection dot + host/guest
  + ms under the 弐 stack; "waiting for the wire…" while stalled.
- **Drops**: `netDropped` returns co-op to the menu like duels;
  `netCleanup` clears the seed; retryRun already routes to menu.
- Verified by `netcoop_harness.js` in the scratchpad: TWO vm contexts
  joined by a stubbed PeerJS wire (JSON-cloned messages), the real
  handshake, then 1000+ ticks driven through netFrame with per-tick
  aligned state dumps compared across wave transitions, a synced
  shrine pick, quit/restore, plus an online-duel regression (22
  checks). HARNESS GOTCHA: out-of-band mutations (killWave, teleports)
  must land at EQUAL ticks on both sims (`syncTicks()`) — the lockstep
  skews by a tick during catch-up bursts, and mutating skewed sims
  fabricates "desyncs".

## 弓道 Archery Rite (2026-07-07, same session)

Swords-and-souls-style bow training in the yard: `kyudoStand` (E to
start, 45s), one straw ring at a time (`game.kyudo`), hit +1 / center
正鵠 +2, rings drift past score 12, fade after 7s. Rank thresholds
[8,11,14,17,20,23,26,29,32,35] → `save.kyudo.rank` 1–10 (monotonic,
never lowered; `save.kyudo.best` kept). Ranks (25-save helpers, PvE
only): seek cone `ARROW_HOME.base 15° + perRank 1.5°` → 30°,
`kyudoDrawMul()`/`kyudoStamMul()` −1.5%/rank on draw time and draw
stamina (bow-gate in 30-player, loose in 50-archer, visible bend in
`drawEntityBow` via the pvp flag — fighters stay raw). Homing is OFF
during the rite (`homePArrow` early-return). Rite code in 65-run
(KYUDO/startKyudoRite/updateKyudo/endKyudoRite), interact in
tryInteract, draw in `drawKyudo` + HUD line + records row. The rite is
a proper range: starting it clears the yard (dummy/bot removed), parks
the archer at a mark and clamps them behind a dashed shooting line
(`K.lineX`, 射 glyph); targets spawn only downrange (x ≥ 42% width);
`endKyudoRite` re-seats the fixtures. USER PLAN noted for later:
punish low stamina harder.

## Known quirks / gotchas
- Overlay panels are themed as hanging scrolls: the `.overlay` is the scroll
  container (`align-items:flex-start` + `.panel{margin:auto}` so short panels
  center and tall ones scroll from the top), so the scrollbar sits at the
  stage edge OUTSIDE the parchment and never covers words. A JS block after
  `fitCanvas()` injects `.roller` dowel bars into every `.panel` at load —
  new overlays get them automatically, but content appended with
  `appendChild` after load lands *below* the bottom roller (use insertBefore
  if it matters). Never add nested `max-height`/`overflow` scroll regions
  inside a panel.
- `game.honor` and `save.honor` mirror in `addHonor`; spending must touch both.
- Enemies in `spawn` state ignore `hurt()` — tests must `setState` first.
- `let/const` at script top level don't reach the vm global — use the bridge.
- `retryRun` during an online duel routes to `returnToMenu` (no solo replay).
- The Training fixtures override `die()` to never die; wave-clear checks skip
  `training`/`merchant` modes.
- Fudemaru input is keyup-driven (hold picks the symbol); pause and blur clear
  `vHeld` so a held cast can't fire on resume.

## Suggested next ideas (not committed)
Estate/base-building siege mode; leaderboard-free score sharing via save
scroll; more charms; a second legendary blade earned from chaos stage 15+.
