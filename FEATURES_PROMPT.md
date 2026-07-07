# INKBLADE — Feature Expansion Prompt

Analyze everything that has been built previously in `index.html`, then build on top of it. The game is INKBLADE: a single-file 2D ink/parchment samurai arena game (canvas, no dependencies, no build step). It already has: five story levels with themed arenas and bosses, Infinite Mode, Boss Rush (Gauntlet + Chaos), local 1v1 Duel, a Merchant shop (swords + 5-tier persistent player upgrades), an honor economy where honor drops only as orbs from slain bosses, adaptive enemy AI (the `adapt` object reads dodge habits and hit rates), attack-token squad coordination, a 1–10x difficulty multiplier, and an admin brush (Fudemaru) unlocked via seal code on the title screen.

Hard constraints — do not violate:
- Everything stays in the single `index.html`. No build step. No external assets. The only permitted CDN import is PeerJS, and only for the optional online duel feature.
- Preserve the ink/parchment aesthetic (palette constants INK/PAPER/RED/GOLD, brush-style rendering).
- Fairness rule: every attack that can hurt the player must be visibly telegraphed, at every difficulty.
- Persistence: extend the existing `save` object (localStorage key `inkblade_save_v1`) additively. Existing saves must load without loss — merge new fields with defaults, never wipe.
- Do not regress existing modes, controls, or the Fudemaru admin brush (which stays outside the honor economy entirely).
- After each feature group, syntax-check the script (`node --check`) and smoke-test with a Node DOM/canvas-stub harness (stub `document`, `localStorage`, canvas contexts via Proxy; drive `update(1/60)`/`draw()` directly and assert on game state).

## 1. Combat depth
- **Parry**: a new input (suggest `C` for PvE player; pick free keys for duel fighters). Tapping it during a brief window (~120ms) as an enemy attack's active frames begin deflects the hit: attacker staggers, player gets a riposte window with bonus damage. Costs stamina; whiffed parries leave a punishable recovery. Works in duels (parrying a clash-worthy swing beats it). The adaptive AI should learn parry habits like it learns dodge habits (add feint/delayed-timing counters).
- **Posture break**: enemies get a second thin gold bar that fills as they take hits and drains slowly. Filling it staggers them for a guaranteed critical (1.5x). Fast weak swords (Ame) build posture damage faster; heavy swords (Akaoni) hit posture harder per hit. Bosses have high posture pools.
- **New enemy types**: *Shinobi* — smoke-teleports behind the player (telegraphed by a smoke puff at the destination before arriving), fast weak strikes, low HP. *Shield Ashigaru* — blocks all frontal damage (visible shield arc), must be hit from behind or posture-broken. Add both to Level 4–5 wave tables and the Infinite Mode pools.
- **Elite variants**: ~10% of non-boss spawns in Infinite (and Level Mode at difficulty ≥5) become gold-outlined elites with one random affix (faster feints, split arrows, damage aura, regenerating posture). Elites drop a small honor orb (the only non-boss honor source; keep it modest, ~15–30 base).

## 2. Roguelite run variety
- **Shrine blessings**: after clearing each level (Level Mode) or every 5th wave (Infinite), a small shrine appears near the portal offering a choice of 1 of 3 random temporary blessings for the rest of the run (e.g., heal on perfect dodge, +20% move speed, wider orb magnet, stamina refund on kill, thorns on block). Walking up and pressing E opens the pick UI. Run-scoped, not persistent.
- **Curses**: optional handicaps selected at run start from the main menu (no dodge roll, half max health, mirrored controls, permanent exhaustion), each adding +50–100% to the honor multiplier. Stackable. Show active curses on the HUD next to the difficulty tag.

## 3. Progression & meta
- **Charms**: a third Merchant tab. One equippable charm slot (persistent). Examples: Omamori (survive a killing blow once per run), Magnet Charm (orb pull radius x2), Koi Charm (+1 dodge i-frame), Oni Charm (+20% damage, +20% damage taken). 300–800 honor each.
- **Sword mastery**: each sword tracks boss kills while equipped (persistent). At 5 boss kills the sword gains a small mastery perk (e.g., Tetsu: +10% posture damage; Ame: 6 tempo stacks max). Show mastery progress as pips in the shop.
- **Achievement scroll**: a kanji-stamp wall viewable from the Merchant stall and main menu. ~20 achievements (first parry, gauntlet under 5:00, chaos stage 10, win a duel without rolling, clear a level untouched, etc.). Local, persistent, stamped in red hanko style.
- **Stats page**: lifetime kills, deaths, perfect dodges, parries, favorite blade, total honor earned. Persistent; accessible from the menu.
- **Save export/import**: a settings option that serializes the save to a compact base64 string for copy-paste, and imports one (with validation) to restore progress on another machine.

## 4. Duel expansion (local 1v1 exists — build on it)
- **AI duelist**: a solo duel option where P2 is a bot built on the existing `adapt` tracker — it reads the human's dodge/attack timing and feints/punishes accordingly. Three personalities: Aggressor, Trickster (feint-heavy), Stone (counter/turtle).
- **Arena select**: duels can be fought in any of the five themed arenas with live hazards (fire zones, bamboo stalks, narrow bridge).
- **Mutators**: toggle row on the duel setup — sudden death (1 hit), no stamina costs, giant blades (1.5x reach), mirror match.
- **Tournament**: single-player bracket of 4 AI duelists with escalating skill and different blades/personalities; winning awards a unique cosmetic headband color (persistent).

## 5. Audio (highest priority for perceived quality)
Procedural WebAudio only — no audio files. Synthesize: sword whoosh (filtered noise sweep), hit thunk, clash ring, dodge whoosh, parry chime, bow release, boss death taiko hit, orb pickup chime (pentatonic, rising with combo), portal hum, black hole rumble, UI ticks. Ambient loops per theme: birds/wind (dojo), rustling (grove), rain (bridge), fire crackle (watchtower), thunder (shrine). Master/SFX/ambient volume sliders + mute, persisted in the save. Audio context must resume on first user gesture (browser autoplay policy).

## 6. Polish & accessibility
- **Settings panel** (gear icon on title screen): volume sliders, screen-shake intensity, colorblind-safe telegraph color option (swap red arcs to high-contrast blue/orange), and save export/import.
- **Death calligraphy**: boss kills paint a large semi-transparent brushed kanji onto the arena floor for the rest of the run (e.g., 滅, 討, 勝 chosen by context).
- **Touch controls**: on touchscreen devices show a virtual joystick (left thumb) and attack/dodge/parry buttons (right thumb); interact prompts become tap targets. The game must be playable on a phone in landscape.
- **Training room**: reachable from the menu — a dummy that logs DPS and shows damage numbers, plus a telegraph-reaction trainer that flashes windups and scores reaction time.

## 7. Optional stretch — Online Duel (build last, only if everything above is solid)
PeerJS (free public broker) + WebRTC DataChannel, lockstep input-sync: exchange only per-frame inputs, both clients run identical simulations with ~3 frames of input delay. Host generates a short room code; guest enters it on the duel screen. Requirements: route all gameplay-relevant randomness in duel mode through a shared seeded PRNG (cosmetic particles may stay on `Math.random`); handle disconnect gracefully (banner + return to menu); show a simple connection-quality indicator. Accept that strict-NAT users may fail to connect without a TURN server — surface a clear error message rather than hanging.

## Engineering integration notes
- Enemy behavior hooks: FSM subclasses of `Enemy` (see Grunt/Duelist/Brute/Archer and the boss classes); tempo scales via `eAggro()`; squad pressure via `meleeTokens`/`rangedTokens`; per-wave stat tuning via `tuneEnemy()` + `waveMults()`.
- New spawnable types must be registered in `ENEMY_TYPES`, the `LEVEL_DATA` wave tables, and `genInfiniteComp()` pools.
- Menu/mode plumbing: `menuSel` + `renderMenu()` + `startRun(mode)`; HUD in `drawHUD()`; per-mode update branches at the top of `update()`.
- Persistent fields go on `save` with defaults in the literal so old saves merge cleanly; call `persistSave()` on every meaningful change.
- Keep the duel deterministic-friendly: no gameplay decisions from unseeded randomness inside `updateFighter`.

Work through the groups in order (1 → 6, then 7), verifying each before moving on.
