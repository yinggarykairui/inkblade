/* ---------- game state ---------- */
const game = {
  state: 'title',       // title | playing | shop | gameover
  mode: 'level',        // level | infinite | merchant
  level: 1, levelWaves: 3,
  wave: 1, honor: 0, honorEarned: 0, combo: 0, comboPop: 0,
  time: 0, bannerT: 0, bannerDur: 1.6, bannerText: '', clearDelay: 0,
  equipped: 'tetsu',
  ameStacks: 0, desatT: 0, lastHurtAt: -99,
  adminUnlocked: save.adminUnlocked || false,   // the seal holds across reloads
  ultMode: false,         // 滅 — L toggles the brush's black-hole ultimate
  brushSwap: false,       // U swaps fire/storm on the bare tap
  diff: 1, dAggro: 1, dFeint: 0, dHonor: 1, honorMult: 1, curDmgMul: 1,
  stage: 1, rushTime: 0, chaos: false,
  map: 0, cStage: 1,    // campaign: which of the five maps, stage 1..10
  zoom: 1, zoomTarget: 1, flashT: 0,
  lastBossDeath: null, victory: false,
  blessings: [], curses: [],        // run-scoped roguelite layers
  levelDamageTaken: 0,              // for the Untouched achievement
  omamoriUsed: false,               // the charm shatters once per run
  // 奥義 player ultimate — `run` is the scripted art, `buffT` the surge
  // after, `env` the 0..1 color-bleed envelope the renderer rides
  ult: { meter: 0, max: 100, run: null, buffT: 0, env: 0 },
  coop: false,          // 二人 — a second blade walks the endless storm
};
function addHonor(n, x, y, label) {
  game.honor += n;
  save.honor = game.honor;   // the wallet is persistent across runs
  game.honorEarned += n;     // per-run score
  save.stats.honorEarned += Math.max(0, n);
  if (game.honor >= 2000) award('rich');
  if (x !== undefined) addText(x, y, (label ? label + ' +' : '+') + n, GOLD, label ? 14 : 13);
}
function setBanner(txt, dur) {
  game.bannerText = txt; game.bannerT = dur || 1.6; game.bannerDur = dur || 1.6;
}
const overlays = {
  title: document.getElementById('titleOverlay'),
  shop: document.getElementById('shopOverlay'),
  pause: document.getElementById('pauseOverlay'),
  over: document.getElementById('overOverlay'),
  shrine: document.getElementById('shrineOverlay'),
  records: document.getElementById('recordsOverlay'),
  settings: document.getElementById('settingsOverlay'),
  rebirth: document.getElementById('rebirthOverlay'),
};
function pauseGame() {
  // online co-op: a pause is render-only, so mirroring it across the wire
  // is safe — neither sim steps while either scroll hangs
  if (netCoop() && net.started && game.state === 'playing') {
    try { net.conn.send({ t: 'pause' }); } catch (e) {}
  }
  game.state = 'paused';          // render-only: the whole fight freezes
  player.vHeld = false;           // don't let a held brush-cast fire on resume
  showOverlay('pause');
}
function resumeGame() {
  if (netCoop() && net.started && game.state === 'paused') {
    try { net.conn.send({ t: 'resume' }); } catch (e) {}
  }
  game.state = 'playing';
  showOverlay('none');
}
function showOverlay(name) {
  for (const k in overlays) overlays[k].classList.toggle('show', k === name);
}

/* ---------- difficulty + per-wave stat multipliers ----------
   Difficulty N scales foes by 1+(N-1)*0.15 and honor by 1+(N-1)*0.25;
   Infinite Mode compounds a per-wave escalation on top. Telegraph
   visuals never shrink — only timing tightens, within readable bounds. */
// the current GLOBAL stage — feeds M(n) and the weapon-XP normalizer
function curStage() {
  if (game.mode === 'campaign') return game.map * STAGES_PER_MAP + game.cStage;
  if (game.mode === 'infinite') return game.wave;
  return 1;
}
function waveMults() {
  const D = game.diff, base = 1 + (D - 1) * 0.15;
  const m = { hp: base, dmg: base, proj: 1 + (D - 1) * .05, honor: 1 + (D - 1) * .25 };
  // 転生 the world remembers — each cycle the foes harden by 8%, so the
  // ×1.5 of rebirth nets strongly positive without unmaking the game
  const wr = 1 + .08 * rebirthLevel();
  m.hp *= wr; m.dmg *= wr;
  // 二人 two blades share one storm — the foes stand harder for it
  if (game.coop) m.hp *= 1.6;
  if (game.mode === 'campaign') {
    // THE curve, split the ARPG way: enemy HP rides the full 1.15^n (the
    // player's ~805× damage growth chases it), but enemy DAMAGE rides
    // √M — the player's HP ceiling is only 10×, and survivability must
    // stay a matter of dodges, not spreadsheets. Honor rides the full M.
    const M = stageMult(curStage());
    m.hp *= M; m.dmg *= Math.sqrt(M); m.honor *= M;
    m.proj *= Math.min(1.8, 1 + (curStage() - 1) * .01);
  }
  if (game.mode === 'infinite') {
    const w = game.wave;
    m.hp *= Math.pow(1.055, w - 1);
    m.dmg *= Math.pow(1.028, w - 1);
    m.proj *= Math.min(1.6, 1 + (w - 1) * .008);
    m.honor *= 1 + (w - 1) * .10;
  }
  // curses sweeten the pot — each burden multiplies the payout
  // (cycle 7's Sweetened Burdens doubles what every curse pays)
  for (const cid of game.curses) {
    const c = CURSES.find(x => x.id === cid);
    if (c) m.honor *= 1 + c.bonus * (rebirthLevel() >= 7 ? 2 : 1);
  }
  return m;
}

/* ---------- level mode data ---------- */
const LEVEL_DATA = [
  { waves: [['grunt', 'grunt'], ['grunt', 'grunt', 'grunt']] },
  { waves: [['grunt', 'duelist'], ['duelist', 'duelist'], ['grunt', 'duelist', 'duelist']] },
  { waves: [['duelist', 'archer'], ['grunt', 'archer', 'archer'], ['duelist', 'duelist', 'archer']] },
  { waves: [['brute', 'grunt', 'grunt'], ['ashigaru', 'archer', 'grunt'],
            ['brute', 'shinobi', 'duelist']] },
  { waves: [['shinobi', 'duelist', 'archer'], ['ashigaru', 'brute', 'archer'],
            ['brute', 'duelist', 'shinobi', 'ashigaru', 'archer']] },
];
const BOSS_NAMES = ['The Gate Sentinel', 'The Twin Duelists', 'The Ronin Archer',
                    'The Iron Brute', 'The Storm Sovereign'];
const BOSS_REMIX_NAMES = ['Gate Sentinel, Reforged', 'Twin Duelists, Unbound',
  'Ronin Archer, Storm-Touched', 'Iron Brute, Twinned', 'Storm Sovereign, Ascendant'];

function wallSpot() {
  let x, y, tries = 0;
  do {
    const side = Math.floor(rand(0, 4));
    if (side === 0) { x = rand(ARENA.x + 40, ARENA.x + ARENA.w - 40); y = ARENA.y + 40; }
    else if (side === 1) { x = rand(ARENA.x + 40, ARENA.x + ARENA.w - 40); y = ARENA.y + ARENA.h - 40; }
    else if (side === 2) { x = ARENA.x + 40; y = rand(ARENA.y + 40, ARENA.y + ARENA.h - 40); }
    else { x = ARENA.x + ARENA.w - 40; y = rand(ARENA.y + 40, ARENA.y + ARENA.h - 40); }
  } while (allPlayers().some(P => dist(x, y, P.x, P.y) < 220) && ++tries < 20);
  return { x, y };
}
function spawnComp(comp, meleeCap) {
  enemies = []; projectiles = []; shockwaves = [];
  meleeTokens = makeTokenPool(meleeCap, .9);
  rangedTokens = makeTokenPool(1, .7);
  const m = waveMults();
  game.honorMult = m.honor; game.curDmgMul = m.dmg;
  // elites walk the endless storm — and the trial itself at difficulty 5+
  const eliteOk = game.mode === 'infinite' ||
                  (game.mode === 'campaign' && game.cStage >= 3) ||
                  (game.mode === 'level' && game.diff >= 5);
  for (const type of comp) {
    const spot = wallSpot();
    const e = new ENEMY_TYPES[type](spot.x, spot.y);
    if (eliteOk && srandom() < .1) makeElite(e);
    tuneEnemy(e, m);
    enemies.push(e);
  }
  game.bannerT = Math.max(game.bannerT, 1.2);
}
function spawnBosses(list, extra, cap) {
  enemies = []; projectiles = []; shockwaves = [];
  meleeTokens = makeTokenPool(cap || Math.max(1, Math.min(list.length, 2)), .8);
  rangedTokens = makeTokenPool(1, .6);
  const m = waveMults();
  if (extra) { m.hp *= extra.hp; m.dmg *= extra.dmg; }
  game.honorMult = m.honor; game.curDmgMul = m.dmg;
  for (const b of list) { tuneEnemy(b, m); enemies.push(b); }
}
function makeLevelBossList(level) {
  const cx = ARENA.x + ARENA.w / 2, ty = ARENA.y + 90;
  switch (level) {
    case 1: return [new GateSentinel(cx, ty)];
    case 2: return [new TwinDuelist(ARENA.x + 110, ARENA.y + ARENA.h / 2),
                    new TwinDuelist(ARENA.x + ARENA.w - 110, ARENA.y + ARENA.h / 2)];
    case 3: return [new RoninArcher(cx, ty)];
    case 4: return [new IronBrute(cx, ty)];
    default: return [new StormSovereign(cx, ty)];
  }
}
function makeRemixBossList(idx) {
  const cx = ARENA.x + ARENA.w / 2, ty = ARENA.y + 90;
  switch (idx) {
    case 0: { const b = new GateSentinel(cx, ty);
      b.reforged = true; b.bossName = BOSS_REMIX_NAMES[0]; return [b]; }
    case 1: {
      const list = [new TwinDuelist(ARENA.x + 110, ARENA.y + ARENA.h / 2),
                    new TwinDuelist(ARENA.x + ARENA.w - 110, ARENA.y + ARENA.h / 2),
                    new TwinDuelist(cx, ARENA.y + 80)];
      for (const b of list) { b.coordinated = true; b.bossName = BOSS_REMIX_NAMES[1]; }
      return list;
    }
    case 2: { const b = new RoninArcher(cx, ty);
      b.stormTouched = true; b.bossName = BOSS_REMIX_NAMES[2]; return [b]; }
    case 3: {
      const list = [new IronBrute(ARENA.x + 150, ARENA.y + ARENA.h / 2),
                    new IronBrute(ARENA.x + ARENA.w - 150, ARENA.y + ARENA.h / 2)];
      for (const b of list) b.bossName = BOSS_REMIX_NAMES[3];
      return list;
    }
    default: { const b = new StormSovereign(cx, ty);
      b.ascendant = true; b.bossName = BOSS_REMIX_NAMES[4]; return [b]; }
  }
}
function genInfiniteComp(w) {
  const arenaIdx = Math.floor((w - 1) / 5) % 5;
  const pools = [
    ['grunt', 'grunt', 'grunt', 'duelist'],
    ['grunt', 'duelist', 'duelist', 'shinobi'],
    ['duelist', 'archer', 'archer', 'grunt', 'shinobi'],
    ['brute', 'grunt', 'duelist', 'archer', 'ashigaru'],
    ['grunt', 'duelist', 'shinobi', 'archer', 'brute', 'ashigaru'],
  ][arenaIdx];
  const count = Math.min(3 + Math.floor(w / 4), 9);
  const comp = [];
  if (arenaIdx >= 3 && w >= 8 && srandom() < .5) comp.push('brute');
  // the deep storm learns the road's tricks: past wave 20 the skill
  // checks walk the waves too — one at a time, never a wall of them
  if (w >= 20 && srandom() < .35)
    comp.push(srandom() < .6 ? 'mirror' : 'duelmaster');
  while (comp.length < count) comp.push(pools[Math.floor(srandom() * pools.length)]);
  return comp;
}

/* ---------- curses: self-chosen handicaps, priced in honor ---------- */
// bonuses priced by what each burden actually costs a SKILLED hand:
// a parry player barely misses the roll, but nobody escapes mirrored feet
const CURSES = [
  { id: 'noroll', kanji: '根', name: 'The Rooted',   bonus: .75,
    desc: 'no dodge roll — parry or perish' },
  { id: 'frail',  kanji: '硝', name: 'The Glass',    bonus: .75,
    desc: 'half max health' },
  { id: 'mirror', kanji: '鏡', name: 'The Reversed', bonus: 1.0,
    desc: 'movement controls are mirrored' },
  { id: 'winded', kanji: '虚', name: 'The Hollow',   bonus: 1.0,
    desc: 'every swing is a winded swing — slow and weak' },
];

/* ---------- run flow ---------- */
const menuSel = { mode: 'level', diff: 1, level: 1, chaos: false, map: 0,
                  coop: false, coopOnline: false,
                  p1Blade: 'tetsu', p2Blade: 'tetsu', curses: [],
                  p1Bow: 'shortbow', p2Bow: 'shortbow',
                  duelOpp: 'human', duelArena: 0,
                  mut: { sudden: false, nostam: false, giant: false, mirror: false, surge: false } };

function beginRun() {
  if (menuSel.mode === 'duel' && menuSel.duelOpp === 'online') {
    if (!net || !net.started)
      netStatus('host a room or join one — the duel starts when the line connects', true);
    return;
  }
  if (menuSel.coopOnline && (menuSel.mode === 'infinite' || menuSel.mode === 'rush')) {
    // the online storm starts itself on handshake, never from this button
    if (!net || !net.started) {
      netMsgEl = 'coopNetMsg';
      netStatus('host a room or join one — the storm begins when the line connects', true);
    }
    return;
  }
  startRun(menuSel.mode);
}
function retryRun() {
  if (net) { returnToMenu(); return; }   // an online duel can't be replayed solo
  if (game.mode === 'level') menuSel.level = clamp(game.level, 1, save.maxLevelCleared + 1);
  if (game.mode === 'rush') menuSel.chaos = game.chaos;
  startRun(game.mode);
}
function startRun(mode) {
  game.mode = mode;
  game.diff = menuSel.diff;
  game.dAggro = 1 + (game.diff - 1) * .04;
  game.dFeint = (game.diff - 1) * .02;
  game.dHonor = 1 + (game.diff - 1) * .25;
  // roguelite layers: curses chosen on the menu; blessings earned at shrines
  game.curses = (mode === 'duel' || mode === 'merchant' || mode === 'training')
    ? [] : menuSel.curses.slice();
  game.blessings = [];
  game.shrineN = 0;          // bargain-shrine cadence restarts each run
  game.omamoriUsed = false;
  game.levelDamageTaken = 0;
  game.honor = save.honor;
  game.equipped = (game.equipped === 'fudemaru' && game.adminUnlocked)
    ? 'fudemaru' : save.equipped;
  game.honorEarned = 0; game.combo = 0; game.time = 0;
  game.ameStacks = 0; game.desatT = 0; game.lastHurtAt = -99;
  game.zoom = 1; game.zoomTarget = 1; game.flashT = 0;
  game.victory = false; game.lastBossDeath = null;
  game.ult = { meter: 0, max: 100, run: null, buffT: 0, env: 0 };
  adapt.reset();
  particles = []; texts = []; stains = []; projectiles = []; shockwaves = [];
  ultTrail = []; ultWaves = []; pArrows = []; burnZones = [];
  blackholes = []; orbs = []; chests = [];
  portal = null; merchant = null; transition = null; storm = null; duel = null;
  shrine = null; game.kyudo = null; kyudoStand = null;
  shakeMag = 0; hitStop = 0;
  enemies = [];
  // 二人 co-op — the second blade stands only in the endless storm and
  // the boss rushes; every other door remains a solo trial. P2 is
  // duel-style raw: menu picks, no progression, and never a save write.
  // Couch arms via the menu; online arms via the live net session.
  game.coop = (!!menuSel.coop || netCoop()) && (mode === 'infinite' || mode === 'rush');
  p2 = game.coop ? makeP2(menuSel.p2Blade, menuSel.p2Bow) : null;
  if (mode === 'level') {
    game.level = menuSel.level;
    loadLevel(game.level);
  } else if (mode === 'infinite') {
    game.wave = 1;
    setTheme(0);
    resetPlayer();
    startInfiniteWave(true);
  } else if (mode === 'campaign') {
    game.map = clamp(menuSel.map | 0, 0, (save.maps.unlocked || 1) - 1);
    game.cStage = 1;
    setTheme(game.map);
    resetPlayer();
    startCampaignStage(true);
  } else if (mode === 'rush') {
    game.chaos = menuSel.chaos;
    game.stage = 1; game.rushTime = 0;
    setTheme(0);
    resetPlayer();
    startRushStage();
  } else if (mode === 'ascension') {
    // 転生の道 — the Road of Rebirth: the five lords, back to back, risen
    // to match the player's own might. Fell them all and the cycle turns;
    // fall, and nothing is lost but the walk.
    game.stage = 1;
    setTheme(0);
    resetPlayer();
    startAscensionStage();
  } else if (mode === 'duel') {
    setTheme(menuSel.duelArena);   // any themed ground, hazards live
    resetPlayer();          // parked off to the side, never drawn in duels
    player.x = -999; player.y = -999;
    startDuelMatch(0);
  } else if (mode === 'tomb') {
    setTheme(4);            // the storm shrine's stone underlies the tomb…
    paintTombDressing();    // …and the tomb dressing closes the earth overhead
    resetPlayer();
    game.tomb = { phase: 'choose', track: null, round: 0, scars: 0, toll: 0, t: 0 };
    tombTablets = [
      { track: 'body',   x: ARENA.x + ARENA.w * .25, y: ARENA.y + 140 },
      { track: 'stance', x: ARENA.x + ARENA.w * .5,  y: ARENA.y + 115 },
      { track: 'edge',   x: ARENA.x + ARENA.w * .75, y: ARENA.y + 140 },
    ];
    // the rebirth altar waits apart from the stat tablets, in the east
    tombAltar = { x: ARENA.x + ARENA.w * .9, y: ARENA.y + ARENA.h * .5 };
    player.x = ARENA.x + ARENA.w / 2; player.y = ARENA.y + ARENA.h - 130;
    setBanner('墓 the Tomb of the Fallen — offer honor at an ancestor tablet', 2.8);
  } else if (mode === 'training') {
    setTheme(0);
    resetPlayer();
    game.training = { log: [], total: 0, lastReact: null, bestReact: null };
    const cy = ARENA.y + ARENA.h / 2;
    enemies.push(new TrainingDummy(ARENA.x + ARENA.w * .68, cy));
    enemies.push(new TrainerBot(ARENA.x + ARENA.w * .3, cy - 120));
    kyudoStand = { x: ARENA.x + ARENA.w * .85, y: ARENA.y + ARENA.h - 120 };
    setBanner('稽古 the training yard — the dummy, the drill, and the archery rite', 2.6);
  } else {                    // a quiet visit to the stall
    setTheme(0);
    resetPlayer();
    merchant = { x: ARENA.x + ARENA.w / 2, y: ARENA.y + 130 };
    player.x = ARENA.x + ARENA.w / 2; player.y = ARENA.y + ARENA.h - 130;
    setBanner('視 the merchant’s stall', 2);
  }
  game.state = 'playing';
  showOverlay('none');
}
function loadLevel(n) {
  bankOrbs();
  game.level = n; game.wave = 1;
  game.levelDamageTaken = 0;        // a fresh chance at Untouched
  game.levelWaves = LEVEL_DATA[n - 1].waves.length + 1;
  setTheme(n - 1);
  resetPlayer();
  portal = null; merchant = null; shrine = null;
  game.zoom = 1; game.zoomTarget = 1;
  adapt.decay();
  spawnLevelWave();
  setBanner(`${THEMES[n - 1].kanji} ${THEMES[n - 1].name}`, 2.2);
}
function spawnLevelWave() {
  const ld = LEVEL_DATA[game.level - 1];
  if (game.wave <= ld.waves.length) {
    spawnComp(ld.waves[game.wave - 1], game.level >= 3 ? 2 : 1);
  } else {
    spawnBosses(makeLevelBossList(game.level));
    setBanner('— ' + BOSS_NAMES[game.level - 1] + ' —', 2.4);
  }
}
function startInfiniteWave(first) {
  bankOrbs();
  const w = game.wave;
  const arenaIdx = Math.floor((w - 1) / 5) % 5;
  if (arenaIdx !== themeIndex || first) setTheme(arenaIdx);
  portal = null;
  if (!first) for (const P of allPlayers()) {
    P.hp = Math.min(P.maxHp, P.hp + 20); P.st = P.maxSt;
  }
  if (w % 5 === 0) {
    const bossIdx = (w / 5 - 1) % 5;
    const lap = Math.floor((w / 5 - 1) / 5);       // each boss lap stacks a further bump
    spawnBosses(makeRemixBossList(bossIdx), { hp: 1 + .45 * lap, dmg: 1 + .18 * lap });
    setBanner('— ' + BOSS_REMIX_NAMES[bossIdx] + ' —', 2.2);
  } else {
    spawnComp(genInfiniteComp(w), w >= 6 ? 2 : 1);
    if ((w - 1) % 5 === 0)
      setBanner(`${THEMES[arenaIdx].kanji} ${THEMES[arenaIdx].name} — wave ${w}`, 2);
    else setBanner(`— wave ${w} —`, 1.6);
  }
  // the stall portal opens at the start of every arena rotation —
  // but not online: the shop's DOM clicks don't ride the tick pipeline
  if (save.merchantUnlocked && (w - 1) % 5 === 0 && !netCoop())
    spawnPortal(ARENA.x + 56, ARENA.y + 56, 'merchant');
  // every THIRD wave survived, a shrine stands in the far corner — the
  // storm's in-run build engine: deepen a blessing or diversify, every
  // few minutes a real decision (2026-07-09: was every 5th)
  if (w > 1 && (w - 1) % 3 === 0)
    spawnShrine(ARENA.x + ARENA.w - 60, ARENA.y + 60);
}
/* ---------- boss rush ----------
   Gauntlet: the five lords one at a time, in their own arenas, against
   the clock. Chaos: the lords come together — stage k fields min(1+k,8)
   of them at once, remixed after the first lap, endless until you fall. */
function makeChaosBoss(lap) {
  const spot = wallSpot();
  const r = Math.floor(rand(0, 5));
  let b;
  if (r === 0) { b = new GateSentinel(spot.x, spot.y);
    if (lap >= 1) { b.reforged = true; b.bossName = BOSS_REMIX_NAMES[0]; } }
  else if (r === 1) { b = new TwinDuelist(spot.x, spot.y);
    if (lap >= 1) { b.coordinated = true; b.bossName = BOSS_REMIX_NAMES[1]; } }
  else if (r === 2) { b = new RoninArcher(spot.x, spot.y);
    if (lap >= 1) { b.stormTouched = true; b.bossName = BOSS_REMIX_NAMES[2]; } }
  else if (r === 3) { b = new IronBrute(spot.x, spot.y);
    if (lap >= 1) b.bossName = BOSS_REMIX_NAMES[3]; }
  else { b = new StormSovereign(spot.x, spot.y);
    if (lap >= 1) { b.ascendant = true; b.bossName = BOSS_REMIX_NAMES[4]; } }
  return b;
}
function startRushStage() {
  bankOrbs();
  const k = game.stage;
  if (game.chaos) {
    setTheme((k - 1) % 5);
    const lap = Math.floor((k - 1) / 5);
    const n = Math.min(1 + k, 8);
    const list = [];
    for (let i = 0; i < n; i++) list.push(makeChaosBoss(lap));
    spawnBosses(list, { hp: 1 + .10 * (k - 1), dmg: 1 + .05 * (k - 1) }, 3);
    setBanner(`亂 CHAOS — STAGE ${k} · ${n} ${n === 1 ? 'lord' : 'lords'}`, 2.2);
  } else {
    setTheme(k - 1);
    spawnBosses(makeLevelBossList(k));
    setBanner('— ' + BOSS_NAMES[k - 1] + ' —', 2.2);
  }
}
/* ---------- 転生の道 the Road of Rebirth ----------
   Confirming a rebirth no longer flips a switch — it opens a TRIAL: the
   five story lords in their arenas, one after another. The road rises to
   meet the reborn: lords scale with rebirthMult itself, so every walk
   fights like the first (the arsenal's growth is the only edge kept).
   From cycle 1 on, the lords come in their REMIXED forms; the final gate
   is always the Storm Sovereign, Ascendant.                             */
function ascensionMults() {
  const lvl = rebirthLevel();
  // THE ROAD OUTPACES THE WALKER (2026-07-09b): lords DOUBLE each cycle
  // against the player's ×1.5 — a steady relative climb — while the real
  // difficulty comes from SKILL CHECKS, not sponges: surging lords
  // (ultimate states) and the retinue (mirror guards, duelmasters) join
  // from cycle 1. Numbers gate less; hands gate more.
  const wr = 1 + .08 * lvl;   // waveMults already applies this — divide out
  return { hp: Math.max(1, Math.pow(2, lvl) * .85 / wr),
           dmg: Math.max(1, Math.pow(1.35, lvl) / wr) };
}
function startAscensionStage() {
  bankOrbs();
  const k = game.stage, lvl = rebirthLevel();
  setTheme(k - 1);
  // first walk: the lords as the story knew them, but the last gate is
  // always ascendant; every later cycle remixes the whole road
  const remixed = lvl >= 1 || k === 5;
  spawnBosses(remixed ? makeRemixBossList(k - 1) : makeLevelBossList(k),
              ascensionMults());
  if (lvl >= 1) {
    // cycle 1+: the lords carry ULTIMATE STATES (奥 surge at half health,
    // snuffed by a posture break) and bring their RETINUE — the skill
    // checks that no arsenal can shortcut
    for (const b of enemies) b.ascSurge = true;
    const guards = Math.min(2, lvl);                       // 鏡 posture check
    const masters = lvl >= 2 ? Math.min(2, lvl - 1) : 0;   // 要 parry check
    const rm = { hp: Math.pow(1.35, lvl), dmg: Math.pow(1.12, lvl), proj: 1 };
    for (let i = 0; i < guards + masters; i++) {
      const spot = wallSpot();
      const e = i < guards ? new MirrorGuard(spot.x, spot.y)
                           : new Duelmaster(spot.x, spot.y);
      tuneEnemy(e, rm);
      enemies.push(e);
    }
  }
  const name = (remixed ? BOSS_REMIX_NAMES : BOSS_NAMES)[k - 1];
  setBanner(k === 1 ? `転生の道 — the road opens · ${name} (1/5)`
          : k < 5 ? `転生の道 — ${name} bars the road (${k}/5)`
          : `転生の道 — the final gate · ${name}`, 2.8);
}
function ascensionComplete() {
  bankOrbs();
  // the toll is paid at the FAR end — a failed walk never wastes the stone
  save.ascStones = Math.max(0, (save.ascStones || 0) - 1);
  doRebirth();
  game.honor = save.honor;
  game.equipped = save.equipped;
  game.adminUnlocked = save.adminUnlocked;
  playSfx('achieve');
  returnToMenu();
  setBanner(`転生 the road is walked — cycle ${rebirthLevel()} · might ×${rebirthMult().toFixed(2)}`, 4);
}
function fmtTime(t) {
  const m = Math.floor(t / 60), sec = t - m * 60;
  return m + ':' + (sec < 10 ? '0' : '') + sec.toFixed(1);
}
function rushComplete() {
  bankOrbs();
  const first = save.bestRushTime == null;
  if (first || game.rushTime < save.bestRushTime) {
    save.bestRushTime = game.rushTime;
    save.recCycles.rush = rebirthLevel();   // records remember their cycle
  }
  if (game.rushTime < 300) award('gauntletFast');
  persistSave();
  game.state = 'gameover';
  const t = document.getElementById('overTitle');
  t.textContent = '完 GAUNTLET CLEARED';
  t.style.color = 'var(--gold)';
  document.getElementById('overStats').innerHTML =
    `All five lords felled in <b>${fmtTime(game.rushTime)}</b> (×${game.diff})` +
    ` wielding <b>${WEAPONS[game.equipped].name}</b><br>` +
    `best: <b>${fmtTime(save.bestRushTime)}</b>${first ? ' — a first clear' : ''}` +
    ` · honor earned: <b>${game.honorEarned}</b>`;
  document.getElementById('overScores').innerHTML = '';
  document.getElementById('btnTrainOver').style.display = 'none';
  showOverlay('over');
}
/* ---------- 墓 the Tomb of the Fallen ----------
   The macro honor sink: offer a toll at an ancestor tablet, survive the
   trial, and a base stat takes one FLAT, uncapped step (applied after
   the damage multipliers — see 25-save). Toll scales
   Cost(S) = 300 × 1.5^S PER TRACK; a hit-scarred trial refunds 60% —
   the same "the ink flows back" language as a broken 奥義 windup.       */
let tombTablets = [];
let tombAltar = null;   // 転生 — the fourth stone, where lives end and begin
const TOMB_TRACKS = {
  body:   { kanji: '体', name: 'Iron Body',    desc: '+6 health each step' },
  stance: { kanji: '姿', name: 'Set Stance',   desc: '+2 posture damage each step' },
  edge:   { kanji: '刃', name: 'Killing Edge', desc: '+1 attack each step' },
};
// the current flat total a track has bought — shown on tablets and the stat wall
function tombFlatLabel(track) {
  return track === 'body' ? `+${tombHp()} health`
       : track === 'stance' ? `+${tombPosture()} posture`
       : `+${tombAtk()} attack`;
}
function tombSessions() {
  return (save.tomb.body || 0) + (save.tomb.stance || 0) + (save.tomb.edge || 0);
}
function startTombTrial(track) {
  // steps are uncapped now — flat gains, ever-dearer, never a wall
  const cost = tombCost(track);
  if (game.honor < cost) {
    addText(player.x, player.y - 30, `the tablet asks 誉 ${fmtNum(cost)}`, RED, 13);
    return;
  }
  game.honor -= cost; save.honor = game.honor;
  game.tomb.phase = 'ghosts';
  game.tomb.track = track;
  game.tomb.toll = cost;
  game.tomb.round = 1;
  game.tomb.scars = 0;
  game.tomb.t = 0;
  spawnTombGhosts(2);
  setBanner('round 1 — turn every flicker aside', 2);
  playSfx('bless');
}
function spawnTombGhosts(n) {
  const windup = Math.max(.28, .55 - tombSessions() * .012);   // S tightens the ghosts
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i - (n - 1) / 2) * .9;
    const g = new TombGhost(player.x + Math.cos(a) * 240, player.y + Math.sin(a) * 240,
                            windup + i * .04);
    g.setState('approach');
    enemies.push(g);
  }
}
function tombGhostDown(parried) {
  if (!parried) game.tomb.scars++;
}
function updateTomb(dt) {
  const T = game.tomb;
  if (!T || T.phase === 'choose') return;
  T.t += dt;
  if (T.phase === 'ghosts') {
    if (T.t > 24) { tombFail('the incense burned out'); return; }
    if (!enemies.some(e => !e.dead)) {
      // cycle 9's Patient Ancestor forgives a single scar
      if (T.scars > (rebirthLevel() >= 9 ? 1 : 0)) { tombFail('the ghosts drew blood'); return; }
      if (T.round < 3) {
        T.round++;
        T.t = 0;
        spawnTombGhosts(T.round + 1);   // 2 → 3 → 4 flickers
        setBanner(`round ${T.round} — turn every flicker aside`, 1.8);
      } else {
        T.phase = 'breath';
        T.t = 0;
        T.pressed = false;
        T.mLatch = true;         // M held through the fight must lift first
        T.ph = rand(0, TAU);     // the needle never starts centered
        setBanner('still the breath — press M inside the gold band', 2.4);
      }
    }
  } else if (T.phase === 'breath') {
    // the needle drifts on two beats from a random phase; one press decides
    // the banking — and only a press MADE here counts: a hand already
    // resting on M when the breath begins must lift and press anew
    T.needle = Math.sin(T.t * 2.1 + T.ph) * .8 + Math.sin(T.t * 3.7 + T.ph * 1.7) * .2;
    if (!keys.m) T.mLatch = false;
    if (!T.pressed && keys.m && !T.mLatch) {
      T.pressed = true;
      const off = Math.abs(T.needle);
      const grade = off < .18 ? 1 : off < .42 ? .8 : 0;
      if (grade === 0) { tombFail('the breath broke'); return; }
      save.tomb[T.track] = (save.tomb[T.track] || 0) + grade;
      refreshPlayerStats();
      persistSave();
      const tr = TOMB_TRACKS[T.track];
      setBanner(`${tr.kanji} ${tr.name} — ${grade === 1 ? 'a full step' : 'a shaky step'} ` +
        `(${save.tomb[T.track].toFixed(1)} steps · ${tombFlatLabel(T.track)})`, 3);
      particles.push({ kind: 'ring', x: player.x, y: player.y, t: 0, life: .6,
        color: 'rgba(245,194,66,.85)', r0: 12, r1: 160, w: 3 });
      playSfx('achieve');
      if (save.tomb[T.track] >= 10) award('tombTen');
      T.phase = 'choose';
    }
    if (T.t > 8 && !T.pressed) { tombFail('the breath was never taken'); }
  }
}
function tombFail(why) {
  const back = Math.round(game.tomb.toll * .6);
  addHonor(back);
  setBanner(`the trial fails — ${why} · 誉 ${fmtNum(back)} flows back`, 2.8);
  for (const e of enemies) if (e.ghost) e.die();
  enemies = enemies.filter(e => !e.dead);
  game.tomb.phase = 'choose';
  playSfx('vanish');
}

/* ---------- 弓道 the archery rite ----------
   Swords-and-souls training: the skill IS the stat. A free 45s round at
   the yard's straw rings — hit fast, hit center, don't let one fade.
   Beating a rank threshold raises save.kyudo.rank (never lowered), and
   ranks widen the arrows' seek cone (15°→30°), quicken the draw and
   cheapen its wind (25-save helpers). While the rite runs, homing is
   OFF — the straw judges the naked eye. Training-yard only; duels and
   the balance identity never feel it.                                  */
const KYUDO = {
  dur: 45,           // one stick of incense
  targetLife: 7,     // a straw ring waits only so long
  driftAt: 12,       // past this score the rings begin to wander
  bullR: 9,          // the 正鵠 center, worth double
  thresholds: [8, 11, 14, 17, 20, 23, 26, 29, 32, 35],   // score → rank 1..10
};
let kyudoStand = null;   // the wooden stand in the training yard
function kyudoRankFor(score) {
  let r = 0;
  for (let i = 0; i < KYUDO.thresholds.length; i++)
    if (score >= KYUDO.thresholds[i]) r = i + 1;
  return r;
}
function startKyudoRite() {
  if (game.kyudo && game.kyudo.on) return;
  if (game.equipped === 'fudemaru') {
    addText(player.x, player.y - 34, '筆 the brush needs no bow', RED, 13);
    return;
  }
  // the rite is shot, not sliced — string the bow for the archer
  if (player.stance !== 'bow') {
    player.stance = 'bow'; player.bowDraw = null; player.action = null;
  }
  // the yard clears for the rite: fixtures step aside, the archer takes
  // the mark, and a shooting line holds them — straw is struck, not strolled to
  enemies = [];
  pArrows = [];
  const lineX = ARENA.x + 170;
  player.x = ARENA.x + 90;
  player.y = ARENA.y + ARENA.h / 2;
  player.face = 0;
  player.kbx = player.kby = 0;
  game.kyudo = { on: true, t: 0, score: 0, streak: 0, target: null,
                 spawnT: .8, lineX };
  setBanner('弓道 the archery rite — loose from behind the line before the incense fades', 2.8);
  playSfx('bless');
}
function spawnKyudoTarget() {
  const K = game.kyudo, m = 70;
  // straw rises only downrange — the far three-fifths of the yard
  K.target = {
    x: rand(ARENA.x + ARENA.w * .42, ARENA.x + ARENA.w - m),
    y: rand(ARENA.y + m, ARENA.y + ARENA.h - m),
    r: 24, t: 0,
    drift: K.score >= KYUDO.driftAt ? rand(30, 46) : 0,
    ph: rand(0, TAU),
  };
}
function updateKyudo(dt) {
  const K = game.kyudo;
  if (!K || !K.on) return;
  K.t += dt;
  // the line is the discipline — no strolling up to the straw
  if (player.x > K.lineX - player.r) { player.x = K.lineX - player.r; player.kbx = 0; }
  if (K.t >= KYUDO.dur) { endKyudoRite(); return; }
  if (!K.target) {
    K.spawnT -= dt;
    if (K.spawnT <= 0) spawnKyudoTarget();
    return;
  }
  const tg = K.target;
  tg.t += dt;
  if (tg.drift) {   // late rings wander like lanterns in wind
    tg.x += Math.cos(tg.ph + tg.t * 1.3) * tg.drift * dt;
    tg.y += Math.sin(tg.ph * 1.7 + tg.t * .9) * tg.drift * dt * .6;
    tg.x = clamp(tg.x, ARENA.x + 40, ARENA.x + ARENA.w - 40);
    tg.y = clamp(tg.y, ARENA.y + 40, ARENA.y + ARENA.h - 40);
  }
  if (tg.t > KYUDO.targetLife) {
    K.streak = 0;
    puff(tg.x, tg.y, 'rgba(43,35,32,.35)', 6);
    addText(tg.x, tg.y, 'faded…', 'rgba(43,35,32,.5)', 12);
    K.target = null; K.spawnT = .5;
    return;
  }
  for (const a of pArrows) {
    if (a.dead || a.pvp || a.delay > 0) continue;
    if (dist(a.x, a.y, tg.x, tg.y) < tg.r + 3) {
      a.dead = true;
      const bull = dist(a.x, a.y, tg.x, tg.y) < KYUDO.bullR;
      K.score += bull ? 2 : 1;
      K.streak++;
      addText(tg.x, tg.y - 30, bull ? '正鵠! +2' : '+1', GOLD, bull ? 15 : 13);
      sparks(tg.x, tg.y, Math.atan2(a.vy, a.vx), GOLD, bull ? 10 : 6);
      playSfx(bull ? 'parry' : 'thunk');
      K.target = null; K.spawnT = .45;
      break;
    }
  }
}
function endKyudoRite() {
  const K = game.kyudo;
  K.on = false; K.target = null;
  // the yard remembers itself — dummy and drill bot return to their posts
  const cy = ARENA.y + ARENA.h / 2;
  enemies.push(new TrainingDummy(ARENA.x + ARENA.w * .68, cy));
  enemies.push(new TrainerBot(ARENA.x + ARENA.w * .3, cy - 120));
  const oldRank = save.kyudo.rank || 0;
  const newRank = Math.max(oldRank, kyudoRankFor(K.score));   // never lowered
  const isBest = K.score > (save.kyudo.best || 0);
  if (isBest) save.kyudo.best = K.score;
  save.kyudo.rank = newRank;
  persistSave();
  if (newRank > oldRank) {
    setBanner(`弓道 rank ${newRank}/10 — shafts seek within ${15 + newRank * 1.5}°` +
      ' · the draw quickens · the lungs spend less', 3.4);
    particles.push({ kind: 'ring', x: player.x, y: player.y, t: 0, life: .6,
      color: 'rgba(245,194,66,.85)', r0: 12, r1: 160, w: 3 });
    playSfx('achieve');
  } else {
    setBanner(`the rite ends — ${K.score} rings` +
      (isBest ? ' · a personal best' : ` · rank ${oldRank}/10 holds`), 3);
  }
}

/* ---------- campaign: five maps, ten stages, one climbing curve ---------- */
function genCampaignComp(map, stage) {
  // deterministic-ish flavor pools per map; weight grows with the stage
  const pools = [
    ['grunt', 'grunt', 'duelist', 'archer'],                 // 庭 yard
    ['grunt', 'duelist', 'archer', 'shinobi'],               // 竹 grove
    ['duelist', 'archer', 'ashigaru', 'grunt'],              // 橋 bridge
    ['brute', 'grunt', 'ashigaru', 'archer', 'shinobi'],     // 炎 watchtower
    ['duelist', 'shinobi', 'brute', 'archer', 'ashigaru'],   // 嵐 shrine
  ];
  const pool = pools[map] || pools[0];
  const n = Math.min(9, 3 + Math.floor(stage * .6) + Math.floor(map * .5));
  const comp = [];
  for (let i = 0; i < n; i++) comp.push(pool[(i * 2 + stage + map) % pool.length]);
  return comp;
}
function startCampaignStage(first) {
  bankOrbs();
  portal = null; shrine = null; merchant = null;
  game.lastBossDeath = null;
  if (!first) {
    player.hp = Math.min(player.maxHp, player.hp + Math.round(player.maxHp * .25));
    player.st = player.maxSt;
  }
  adapt.decay();
  if (game.cStage >= STAGES_PER_MAP) {          // the map's lord waits at 10
    spawnBosses(makeLevelBossList(game.map + 1));
    setBanner(`${THEMES[game.map].kanji} — ${BOSS_NAMES[game.map]}`, 2.6);
  } else {
    spawnComp(genCampaignComp(game.map, game.cStage), game.map >= 2 ? 2 : 1);
    setBanner(`${THEMES[game.map].kanji} MAP ${game.map + 1} — STAGE ${game.cStage}/${STAGES_PER_MAP}`, 2);
  }
}
function onWaveCleared() {
  adapt.decay();
  // the first cleared wave earns the archery lesson — a calm moment for it
  hintOnce('bow', 'Q — trade blade for bow: hold V to bend the string, release to loose');
  if (game.coop) reviveDowned();   // the fallen stand once the wave breaks
  if (game.mode === 'campaign') {
    save.maps.best[game.map] = Math.max(save.maps.best[game.map] || 0, game.cStage);
    const p = game.lastBossDeath ||
      { x: ARENA.x + ARENA.w / 2, y: ARENA.y + ARENA.h / 2 };
    if (game.cStage >= STAGES_PER_MAP) {        // the lord has fallen
      rollChest(p, 1);                          // lords always leave a chest, tier-biased
      save.maps.unlocked = Math.max(save.maps.unlocked || 1,
        Math.min(MAP_COUNT, game.map + 2));
      save.merchantUnlocked = true;
      game.victory = true;
      merchant = clearSpot(clamp(p.x + 150, ARENA.x + 90, ARENA.x + ARENA.w - 90),
                           clamp(p.y, ARENA.y + 90, ARENA.y + ARENA.h - 90));
      spawnPortal(p.x - 150, p.y, 'home');   // the road home stands open
      setBanner(game.map + 1 < MAP_COUNT
        ? 'the map is cleared — a deeper one unfurls'
        : 'the fifth map falls silent — the ledger is complete', 3.2);
      if (game.map + 1 >= MAP_COUNT) award('trialAll');
    } else {
      // stage chest roll: 18% + 1.5% per stage into the map
      if (srandom() < .18 + game.cStage * .015) rollChest(p, 0);
      spawnPortal(p.x, p.y, 'next');
      const side = p.x > ARENA.x + ARENA.w / 2 ? -1 : 1;
      if (game.cStage % 4 === 0)
        spawnShrine(portal.x - side * 150,
                    portal.y + (portal.y > ARENA.y + ARENA.h / 2 ? -110 : 110));
      if (game.cStage % 5 === 0)
        merchant = clearSpot(clamp(portal.x + side * 170, ARENA.x + 70, ARENA.x + ARENA.w - 70),
                             clamp(portal.y, ARENA.y + 70, ARENA.y + ARENA.h - 70));
    }
    persistSave();
  } else if (game.mode === 'level') {
    if (game.wave >= game.levelWaves) {          // the boss has fallen
      const firstClear = game.level > (save.maxLevelCleared || 0);
      save.maxLevelCleared = Math.max(save.maxLevelCleared, game.level);
      if (game.level === 1) award('trial1');
      if (game.level >= 5) award('trialAll');
      if (game.levelDamageTaken <= 0) award('untouched');
      if (game.curses.length) award('defiant');
      const p = game.lastBossDeath ||
        { x: ARENA.x + ARENA.w / 2, y: ARENA.y + ARENA.h / 2 };
      // the story lords pay in lacquer: a first clear is ALWAYS honored
      // (lord-biased roll); revisits keep a smaller promise
      if (firstClear) rollChest(p, 1);
      else if (srandom() < .25) rollChest(p, 0);
      if (game.level >= 5) {
        // the game's only friendly face — and, at last, the road home
        save.merchantUnlocked = true;
        game.victory = true;
        const side = p.x > ARENA.x + ARENA.w / 2 ? -1 : 1;
        merchant = clearSpot(clamp(p.x, ARENA.x + 90, ARENA.x + ARENA.w - 90),
                             clamp(p.y, ARENA.y + 90, ARENA.y + ARENA.h - 90));
        spawnPortal(p.x + side * 170, p.y, 'home');
        setBanner('the storm breaks — the trial is complete · the road home stands open', 3.2);
      } else {
        spawnPortal(p.x, p.y, 'next');
        // the merchant sets up beside every rift — trade before you step through
        const side = p.x > ARENA.x + ARENA.w / 2 ? -1 : 1;
        merchant = clearSpot(clamp(portal.x + side * 170, ARENA.x + 70, ARENA.x + ARENA.w - 70),
                             clamp(portal.y, ARENA.y + 70, ARENA.y + ARENA.h - 70));
        // a wayside shrine appears after every cleared level
        spawnShrine(portal.x - side * 150,
                    portal.y + (portal.y > ARENA.y + ARENA.h / 2 ? -110 : 110));
        setBanner('a rift opens — the merchant and a shrine wait beside it', 2.4);
      }
      persistSave();
    } else {
      player.hp = Math.min(player.maxHp, player.hp + 30);
      player.st = player.maxSt;
      game.wave++;
      spawnLevelWave();
      persistSave();
    }
  } else if (game.mode === 'rush') {
    for (const P of allPlayers()) {
      P.hp = Math.min(P.maxHp, P.hp + (game.chaos ? 35 : 50));
      P.st = P.maxSt;
    }
    // the rushes pay as they go — a chest rolled here rides into the next
    // stage's arena, opened between swings
    {
      const p = game.lastBossDeath ||
        { x: ARENA.x + ARENA.w / 2, y: ARENA.y + ARENA.h / 2 };
      if (!game.chaos) {
        // gauntlet lords 1–4 may leave lacquer (stage 5 ends on the scroll)
        if (game.stage < 5 && srandom() < .3) rollChest(p, 1);
      } else {
        const lap = Math.floor((game.stage - 1) / 5);
        if (game.stage % 5 === 0) rollChest(p, Math.min(2, 1 + lap));
        else if (srandom() < .15) rollChest(p, Math.min(2, lap));
      }
    }
    game.stage++;
    if (game.chaos && game.stage >= 10) award('chaos10');
    persistSave();
    if (!game.chaos && game.stage > 5) rushComplete();
    else startRushStage();
  } else if (game.mode === 'ascension') {
    if (game.stage >= 5) { ascensionComplete(); return; }   // the road is walked
    player.hp = Math.min(player.maxHp, player.hp + 40);
    player.st = player.maxSt;
    const p = game.lastBossDeath ||
      { x: ARENA.x + ARENA.w / 2, y: ARENA.y + ARENA.h / 2 };
    if (srandom() < .3) rollChest(p, 1);   // the road's lords may pay lacquer
    game.stage++;
    startAscensionStage();
  } else if (game.mode === 'infinite') {
    if (game.wave > save.deepestWave) {
      save.deepestWave = game.wave;
      save.recCycles.wave = rebirthLevel();
    }
    if (game.wave >= 20) award('wave20');
    // the storm pays in lacquer too: every fifth-wave lord may leave a
    // chest, every full arena rotation guarantees one, and the tier bias
    // deepens with the wave (sim-stream dice — both online sims agree)
    if (game.wave % 5 === 0) {
      const p = game.lastBossDeath ||
        { x: ARENA.x + ARENA.w / 2, y: ARENA.y + ARENA.h / 2 };
      const bias = Math.min(2, Math.floor(game.wave / 20));
      if (game.wave % 25 === 0) rollChest(p, Math.max(1, bias));
      else if (srandom() < .4) rollChest(p, bias);
    }
    persistSave();
    game.wave++;
    startInfiniteWave(false);
  }
}
function gameOver() {
  bankOrbs();
  // 教訓 lesson honor — the wounds left on a still-standing lord pay
  // half-rate: every attempt banks real progress, but a kill always pays
  // strictly more, so dying on purpose is never the better trade
  let lesson = 0;
  for (const e of enemies) {
    if (!e.isBoss || e.dead) continue;
    lesson += clamp(1 - e.hp / e.maxHp, 0, 1) * e.honorKill * .5;
  }
  lesson = Math.round(lesson * (game.honorMult || 1));
  if (lesson > 0) addHonor(lesson);
  // the merchant finds you at your lowest — growth arrives WITH defeat,
  // not after victory: the first fall opens the stall for good
  const stallJustOpened = !save.merchantUnlocked;
  if (stallJustOpened) save.merchantUnlocked = true;
  game.state = 'gameover';
  save.stats.deaths++;
  inkSplat(player.x, player.y);
  playSfx('taiko');
  const ttl = document.getElementById('overTitle');
  ttl.textContent = 'FELLED';
  ttl.style.color = 'var(--red)';
  let statLine;
  if (game.mode === 'rush') {
    if (game.chaos) {
      if (game.stage > save.bestChaosStage) {
        save.bestChaosStage = game.stage;
        save.recCycles.chaos = rebirthLevel();
      }
      statLine = `You fell on chaos stage <b>${game.stage}</b> (×${game.diff})`;
    } else {
      statLine = `You fell to <b>${BOSS_NAMES[Math.min(game.stage, 5) - 1]}</b> — stage <b>${Math.min(game.stage, 5)}/5</b> (×${game.diff})`;
    }
  } else if (game.mode === 'infinite') {
    if (game.wave > save.deepestWave) {
      save.deepestWave = game.wave;
      save.recCycles.wave = rebirthLevel();
    }
    save.highScores.push({ wave: game.wave, honor: game.honorEarned,
                           diff: game.diff, cycle: rebirthLevel(),
                           date: new Date().toISOString().slice(0, 10) });
    save.highScores.sort((a, b) => b.wave - a.wave || b.honor - a.honor);
    save.highScores = save.highScores.slice(0, 5);
    statLine = `You fell on wave <b>${game.wave}</b> of the endless storm (×${game.diff})`;
  } else if (game.mode === 'ascension') {
    statLine = `The road refused you — lord <b>${Math.min(game.stage, 5)}/5</b> holds the pass.` +
      ` <i>Nothing is lost; walk again when ready</i>`;
  } else {
    statLine = `You fell in <b>Level ${game.level}</b>, wave <b>${game.wave}/${game.levelWaves}</b> (×${game.diff})`;
  }
  persistSave();
  // the recap names the killer — the lesson survives the ink
  const fb = game.lastHitDesc
    ? `<br>felled by <b>${game.lastHitDesc.name}</b> (−${fmtNum(game.lastHitDesc.dmg)})` : '';
  const lessonLine = lesson > 0
    ? `<br>教訓 the lord remembers your strokes — <b>誉 ${fmtNum(lesson)}</b> for the wounds you left` : '';
  const stallLine = stallJustOpened
    ? `<br><i>the merchant hears of your fall — the stall stands open</i>` : '';
  document.getElementById('overStats').innerHTML =
    statLine + ` wielding <b>${WEAPONS[game.equipped].name}</b>` + fb + lessonLine + stallLine + `<br>` +
    `Honor earned this run: <b>${game.honorEarned}</b> · wallet: <b>誉 ${game.honor}</b> <i>(kept)</i>`;
  // die → paid → one click → stronger → retry: the TRAIN door is right here
  const tb = document.getElementById('btnTrainOver');
  tb.style.display = 'inline-block';
  tb.textContent = `修 TRAIN — 誉 ${fmtNum(game.honor)}`;
  document.getElementById('overScores').innerHTML =
    game.mode === 'infinite' ? scoreListHTML() : '';
  showOverlay('over');
}
function scoreListHTML() {
  if (!save.highScores.length) return '';
  let h = `deepest wave reached: <b>${save.deepestWave}</b><br>`;
  save.highScores.forEach((sc, i) => {
    h += `${i + 1}. wave <b>${sc.wave}</b> · 誉 ${sc.honor} · ×${sc.diff}` +
         `${sc.cycle ? ' · c' + sc.cycle : ''} · ${sc.date}<br>`;
  });
  return h;
}
function returnToMenu() {
  if (net) {
    try { net.conn && net.conn.send({ t: 'quit' }); } catch (e) {}
    netCleanup();
  }
  bankOrbs();
  persistSave();
  game.state = 'title';
  game.victory = false;
  portal = null; merchant = null; transition = null; storm = null; duel = null;
  shrine = null; game.kyudo = null; kyudoStand = null;
  enemies = []; projectiles = []; shockwaves = []; blackholes = [];
  p2 = null; game.coop = false;   // the second blade bows out at the door
  restoreSave();   // an online-co-op guest gets their own ledger back
  game.honor = save.honor;
  setTheme(0);
  resetPlayer();
  renderMenu();
  showOverlay('title');
}

