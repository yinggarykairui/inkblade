# INKBLADE — Session Handoff Context

Read this first, then read `index.html` before changing anything. Updated
2026-07-06 after the full feature expansion (index.html now ~5,990 lines).
Everything in `FEATURES_PROMPT.md` — groups 1 through 7, including the
online-duel stretch goal — is built and verified.

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
2. **Aesthetic**: palette constants `INK/PAPER/CREAM/RED/REDHOT/GOLD`; red is
   danger/telegraphs, gold is honor/posture/legendary. Brush-style rendering.
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
6. **Online determinism**: nothing in `updateFighter` or the duel update branch
   may make gameplay decisions from unseeded `Math.random` (cosmetic particles
   are fine). Online duels lock to arena 0 for this reason.

## How to run / test

- `open index.html`.
- Syntax: extract inline script, `node --check`.
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
  128 ult · 256 swap · 512 meditate (held).
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
headband, adminUnlocked, audio{master,sfx,ambient,muted}, shakeMul, colorblind
```

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
