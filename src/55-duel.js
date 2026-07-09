/* ---------- Fudemaru — the admin brush ----------
   No stamina, no phases, no telegraphs: V-release casts a symbol chosen
   by hold duration and dodge context. Deliberately outside the balance
   curve — a sandbox toy, flagged on the HUD whenever it's unsealed.      */
let storm = null;   // pending 雷 chain: {targets, idx, t, from}

function castGlyph(ch, color) {
  particles.push({ kind: 'glyph', ch, color,
    x: player.x + Math.cos(player.face) * 80,
    y: player.y + Math.sin(player.face) * 80,
    vx: 0, vy: -12, t: 0, life: 1.1, size: 46, misted: false });
}
function brushSwipe() {
  slashTrail(player.x, player.y, 62, player.face - .9, player.face + .9,
    'rgba(43,35,32,.65)', 9);
  for (let i = 0; i < 5; i++) {
    const a = player.face + rand(-.8, .8);
    particles.push({ kind: 'dot',
      x: player.x + Math.cos(a) * rand(30, 65), y: player.y + Math.sin(a) * rand(30, 65),
      vx: rand(-30, 30), vy: rand(20, 70), t: 0, life: rand(.25, .45),
      color: 'rgba(43,35,32,.6)', rad: rand(1.5, 3) });
  }
}
function castSymbol(hold) {
  if (game.state !== 'playing' || game.equipped !== 'fudemaru' || game.mode === 'duel') return;
  const sinceDodge = game.time - player.lastDodgeStart;
  const flow = sinceDodge > 0 && sinceDodge < DODGE.dur + .5;
  brushSwipe();
  if (hold >= 1.0) castLife();
  else if (hold >= .45) castVoid();
  else if (game.ultMode) castBlackHole();          // 滅 — L-toggled ultimate
  else {
    // U swaps which spell sits on the bare tap: fire by default, storm when swapped
    const stormTap = game.brushSwap ? !flow : flow;
    if (stormTap) castStorm(); else castFire();
  }
}
function toggleUlt() {
  if (game.mode === 'duel') return;   // duel fighters carry their own toggles
  if (game.equipped !== 'fudemaru' || game.state !== 'playing') return;
  game.ultMode = !game.ultMode;
  if (game.ultMode) {
    addText(player.x, player.y - 34, '滅 ULTIMATE UNBOUND', '#7a6cc0', 16);
    particles.push({ kind: 'ring', x: player.x, y: player.y, t: 0, life: .6,
      color: 'rgba(122,108,192,.7)', r0: 16, r1: 220, w: 3.5 });
    shake(4);
  } else {
    addText(player.x, player.y - 34, 'ultimate sealed', 'rgba(43,35,32,.6)', 13);
  }
}
function toggleBrushSwap() {
  if (game.mode === 'duel') return;   // duel fighters carry their own toggles
  if (game.equipped !== 'fudemaru' || game.state !== 'playing') return;
  game.brushSwap = !game.brushSwap;
  addText(player.x, player.y - 34,
    game.brushSwap ? '雷 storm on tap · 火 fire on dodge-tap'
                   : '火 fire on tap · 雷 storm on dodge-tap', '#5b78c9', 13);
}
/* 滅 — the ultimate: a black hole that swallows the whole map.
   Grows for ~1.6s, dragging every foe toward the maw, then collapses
   and unwrites everything left standing. Deliberately absurd — admin. */
let blackholes = [];
function forceKill(e) {
  if (e.dead) return;
  e.hp = 0;
  e.die();
}
function castBlackHole() {
  castGlyph('滅', '#7a6cc0');
  const d = 180;
  const x = clamp(player.x + Math.cos(player.face) * d, ARENA.x + 60, ARENA.x + ARENA.w - 60);
  const y = clamp(player.y + Math.sin(player.face) * d, ARENA.y + 60, ARENA.y + ARENA.h - 60);
  blackholes.push({ x, y, t: 0, dur: 1.6, r: 10, done: false });
  shake(5); freeze(.06);
  playSfx('rumble');
}
function updateBlackholes(dt) {
  for (const b of blackholes) {
    b.t += dt;
    const p = clamp(b.t / b.dur, 0, 1);
    b.r = 10 + p * 150;
    shake(1.5 + p * 3);
    // everything falls toward the maw
    for (const e of enemies) {
      if (e.dead) continue;
      const ang = Math.atan2(b.y - e.y, b.x - e.x);
      const pull = 260 + 520 * p;
      e.x += Math.cos(ang) * pull * dt;
      e.y += Math.sin(ang) * pull * dt;
      e.frozenT = Math.max(e.frozenT, .1);   // too busy falling to fight
      if (dist(e.x, e.y, b.x, b.y) < b.r * .5) forceKill(e);
    }
    for (const pr of projectiles)
      if (dist(pr.x, pr.y, b.x, b.y) < b.r) pr.dead = true;
    // spiralling debris pulled inward
    if (Math.random() < dt * 80) {
      const a = rand(0, TAU), d0 = b.r * 1.5 + rand(20, 120);
      particles.push({ kind: 'line',
        x: b.x + Math.cos(a) * d0, y: b.y + Math.sin(a) * d0,
        vx: -Math.cos(a + .6) * 220, vy: -Math.sin(a + .6) * 220,
        t: 0, life: .35, color: '#7a6cc0', w: 1.8 });
    }
    if (b.t >= b.dur && !b.done) {
      b.done = true;
      // collapse — the map is unwritten
      for (const e of enemies) forceKill(e);
      projectiles = []; shockwaves = [];
      particles.push({ kind: 'ring', x: b.x, y: b.y, t: 0, life: .7,
        color: 'rgba(122,108,192,.85)', r0: 20, r1: 680, w: 6 });
      particles.push({ kind: 'ring', x: b.x, y: b.y, t: 0, life: .5,
        color: 'rgba(43,35,32,.8)', r0: 10, r1: 440, w: 10 });
      particles.push({ kind: 'glyph', ch: '滅', color: '#e8e4f4',
        x: b.x, y: b.y, vx: 0, vy: -16, t: 0, life: 1.2, size: 74, misted: false });
      inkSplat(b.x, b.y);
      shake(14); freeze(.18);
      game.flashT = .3;
      playSfx('taiko');
    }
  }
  blackholes = blackholes.filter(b => b.t < b.dur + .1);
}
function castFire() {
  castGlyph('火', RED);
  const range = 170, arc = 1.5;
  for (const e of enemies) {
    if (e.dead || e.state === 'spawn') continue;
    if (inArc(player.x, player.y, player.face, range + e.r, arc, e.x, e.y, e.r)) {
      const ang = Math.atan2(e.y - player.y, e.x - player.x);
      // small foes are unwritten outright; brutes merely burn
      if (e instanceof Brute) e.hurt(45, ang, .45, 8, player, 'fudemaru');
      else e.hurt(9999, ang, undefined, 8, player, 'fudemaru');
    }
  }
  for (let i = 0; i < 26; i++) {
    const a = player.face + rand(-arc / 2, arc / 2), d = rand(20, range);
    particles.push({ kind: 'dot',
      x: player.x + Math.cos(a) * d, y: player.y + Math.sin(a) * d,
      vx: Math.cos(a) * rand(40, 120), vy: Math.sin(a) * rand(40, 120) - 30,
      t: 0, life: rand(.3, .6),
      color: Math.random() < .6 ? 'rgba(181,52,42,.8)' : 'rgba(43,35,32,.6)',
      rad: rand(2, 5) });
  }
  shake(4); freeze(.05);
}
function castStorm() {
  castGlyph('雷', '#5b78c9');
  const pool = enemies.filter(e => !e.dead && e.state !== 'spawn');
  if (!pool.length) return;
  // nearest-next ordering — the bolt walks the whole arena
  const order = [];
  let from = { x: player.x, y: player.y };
  while (pool.length) {
    let bi = 0, bd = Infinity;
    pool.forEach((e, i) => {
      const d = dist(from.x, from.y, e.x, e.y);
      if (d < bd) { bd = d; bi = i; }
    });
    const e = pool.splice(bi, 1)[0];
    order.push(e); from = e;
  }
  storm = { targets: order, idx: 0, t: 0, from: { x: player.x, y: player.y } };
}
function castVoid() {
  castGlyph('無', INK);
  for (const p of projectiles) {
    if (!p.dead) { p.dead = true; puff(p.x, p.y, 'rgba(43,35,32,.5)', 3); }
  }
  for (const e of enemies) if (!e.dead) e.frozenT = 4;
  particles.push({ kind: 'ring', x: player.x, y: player.y, t: 0, life: .5,
    color: 'rgba(43,35,32,.5)', r0: 20, r1: 340, w: 3 });
  freeze(.06); shake(3);
}
function castLife() {
  castGlyph('命', GOLD);
  player.hp = player.maxHp;
  player.st = player.maxSt;
  player.iT = 4;    // true invincibility, telegraphed by the usual blink
  particles.push({ kind: 'ring', x: player.x, y: player.y, t: 0, life: .55,
    color: 'rgba(168,132,58,.6)', r0: 14, r1: 120, w: 2.5 });
  spawnPetals(player.x, player.y, 8);
}
function updateStorm(dt) {
  if (!storm) return;
  storm.t += dt;
  while (storm && storm.t >= .07) {
    storm.t -= .07;
    const e = storm.targets[storm.idx++];
    if (e && !e.dead) {
      boltFX(storm.from.x, storm.from.y, e.x, e.y);
      e.hurt(24, Math.atan2(e.y - storm.from.y, e.x - storm.from.x), .45, 8,
             player, 'fudemaru');
      storm.from = { x: e.x, y: e.y };
      shake(2); freeze(.02);
    }
    if (storm.idx >= storm.targets.length) storm = null;
  }
}

/* ---------- 1v1 duel ----------
   Two local fighters, best of three. Attack startup frames are the
   telegraphs; simultaneous active blades in range clash — sparks and
   mutual knockback instead of a random trade. PvP damage runs ~1.6x
   weapon damage so rounds stay sharp. Training upgrades don't apply:
   a duel is settled by blades and reads alone.                        */
let duel = null;

/* --- the AI duelist: three temperaments built on the adapt philosophy —
   it reads the human's habits (rolls on reaction? swings often?) and
   shifts its own timing, feints, and parries to punish them.           */
const AI_PERSONAS = {
  aggressor: { name: 'THE OX',    blade: 'kurogane',  hue: '#57504a',
    prefDist: 78,  atkCd: [.5, 1.1],  parry: .08, react: .26, bait: .08 },
  trickster: { name: 'THE FOX',   blade: 'shirasagi', hue: '#6c6a5e',
    prefDist: 118, atkCd: [.8, 1.6],  parry: .18, react: .21, bait: .5 },
  stone:     { name: 'THE STONE', blade: 'tetsu',     hue: '#4d4a46',
    prefDist: 96,  atkCd: [1.2, 2.2], parry: .42, react: .16, bait: .12 },
};
const TOURNAMENT = [
  { persona: 'aggressor', skill: .45, blade: 'tetsu',
    name: 'THE OX',     title: 'FIRST GATE — THE OX' },
  { persona: 'trickster', skill: .65, blade: 'shirasagi',
    name: 'THE FOX',    title: 'SECOND GATE — THE FOX' },
  { persona: 'stone',     skill: .85, blade: 'kurogane',
    name: 'THE STONE',  title: 'THIRD GATE — THE STONE' },
  { persona: 'trickster', skill: 1,   blade: 'raiko',
    name: 'THE KENSEI', title: 'FINAL GATE — THE KENSEI' },
];
function makeAIFighter(personaId, skill, blade, x, y, face) {
  const p = AI_PERSONAS[personaId];
  const f = makeFighter(p.name, blade || p.blade, x, y, face, p.hue, null);
  f.ai = {
    p, skill,
    mx: 0, my: 0,
    atkCd: rand(p.atkCd[0], p.atkCd[1]),
    orbit: Math.random() < .5 ? 1 : -1, orbitT: rand(1, 2.5),
    pending: null,          // {kind:'attack'|'parry'|'dodge', t, dx, dy}
    bait: 0, baitCd: rand(1.2, 2.4),
    // reads on the human, adapt-style
    myStartups: 0, foeReactRolls: 0, foeRolls: 0, foeAttacks: 0,
    prevFoeAction: null, delayBias: 0, holdT: 0,
  };
  return f;
}
function updateFighterAI(f, dt) {
  const ai = f.ai, p = ai.p, foe = f.foe;
  const skill = ai.skill;
  const d = dist(f.x, f.y, foe.x, foe.y);
  const ang = Math.atan2(foe.y - f.y, foe.x - f.x);
  const wpn = WEAPONS[f.blade];
  const myReach = wpn.reach * (duelMut().giant ? 1.5 : 1) * (fighterSurged(f) ? 3 : 1);
  // a full 奥義 bar is spent the moment the foe is in striking distance
  if (!fighterSurged(f) && !f.ultRun && f.surgeMeter >= FSURGE.max && d < 300)
    activateFighterUlt(f);

  /* --- reads: watch the human's new actions --- */
  const fa = foe.action;
  if (fa !== ai.prevFoeAction) {
    if (fa && fa.type === 'dodge') {
      ai.foeRolls++;
      // rolled while my blade was in startup? they read telegraphs — delay mine
      const mine = f.action;
      if (mine && mine.type === 'attack' && mine.t < mine.startup) ai.foeReactRolls++;
    }
    if (fa && fa.type === 'attack') ai.foeAttacks++;
    ai.prevFoeAction = fa;
  }
  // habitual telegraph-rollers get attacks held past their reaction
  ai.delayBias = (ai.myStartups > 2 && ai.foeReactRolls / Math.max(1, ai.myStartups) > .4)
    ? .3 : 0;

  /* --- scheduled reaction fires --- */
  if (ai.pending) {
    ai.pending.t -= dt;
    if (ai.pending.t <= 0) {
      const pd = ai.pending;
      ai.pending = null;
      if (pd.kind === 'parry') f.parryBuf = .1;
      else if (pd.kind === 'dodge') {
        ai.mx = pd.dx; ai.my = pd.dy;
        f.dodgeBuf = .1;
      } else if (pd.kind === 'attack') {
        f.attackBuf = .1;
        ai.myStartups++;
      }
    }
  }

  /* --- movement: hold the ring, dodge hazards, flip orbits --- */
  ai.orbitT -= dt;
  if (ai.orbitT <= 0) { ai.orbit *= -1; ai.orbitT = rand(1.2, 2.6); }
  let target = p.prefDist;
  if (f.st < 25) target += 70;            // winded — buy air
  if (foe.staggerT > 0) target = 40;      // they're wide open — close!
  if (foe.bowDraw) target = 36;           // a bent string begs for steel — rush it
  if (ai.bait > 0) {                      // the feint: a step in, a step out
    ai.bait -= dt;
    target = ai.bait > .25 ? 55 : p.prefDist + 40;
  }
  const radial = clamp((d - target) * .04, -1, 1);
  let vx = Math.cos(ang) * radial + Math.cos(ang + Math.PI / 2) * ai.orbit * .6;
  let vy = Math.sin(ang) * radial + Math.sin(ang + Math.PI / 2) * ai.orbit * .6;
  for (const fz of fireZones) {           // respect the flames
    const fd = dist(f.x, f.y, fz.x, fz.y);
    if (fd < fz.r + 34) {
      const away = Math.atan2(f.y - fz.y, f.x - fz.x);
      vx += Math.cos(away) * 1.6; vy += Math.sin(away) * 1.6;
    }
  }
  const vl = Math.hypot(vx, vy) || 1;
  ai.mx = vx / vl; ai.my = vy / vl;

  if (f.action || f.staggerT > 0 || ai.pending) return;

  /* --- defense: react to the human's startup with parry or roll --- */
  const react = p.react * lerp(1.5, .7, skill);
  // an 奥義 windup reads like a giant telegraph — roll off the line
  if (foe.ultRun && foe.ultRun.phase === 'windup') {
    const ra = ang + Math.PI + (ai.orbit > 0 ? .8 : -.8);
    ai.pending = { kind: 'dodge', t: react, dx: Math.cos(ra), dy: Math.sin(ra) };
    return;
  }
  if (fa && fa.type === 'attack' && fa.t < fa.startup &&
      d < (fa.reach || 60) + 40) {
    const roll = Math.random();
    if (roll < p.parry * lerp(.5, 1.6, skill)) {
      ai.pending = { kind: 'parry', t: react };
      return;
    } else if (roll < .75 * skill + .15) {
      // roll through or past the swing
      const side = Math.random() < .5 ? 1 : -1;
      const ra = ang + Math.PI + side * rand(.4, 1.1);
      ai.pending = { kind: 'dodge', t: react, dx: Math.cos(ra), dy: Math.sin(ra) };
      return;
    }
  }

  /* --- punish windows: recovery frames and staggers get the blade --- */
  const foePunishable = foe.staggerT > 0 || foe.dodgeRecoverT > 0 ||
    (fa && fa.type === 'attack' && fa.t > fa.startup + fa.active) ||
    (fa && fa.type === 'parry' && fa.t > PARRY.active);
  if (foePunishable && d < myReach + 14 && f.st > wpn.stCost) {
    ai.pending = { kind: 'attack', t: .05 };
    ai.atkCd = rand(p.atkCd[0], p.atkCd[1]) * lerp(1.4, .8, skill);
    return;
  }

  /* --- offense: paced attacks, feint-baits from the trickster --- */
  ai.atkCd -= dt;
  ai.baitCd -= dt;
  if (ai.bait <= 0 && ai.baitCd <= 0 && d < p.prefDist + 60 &&
      Math.random() < p.bait) {
    ai.bait = .5;                          // fake the entry, watch them flinch
    ai.baitCd = rand(1.6, 3);
    return;
  }
  if (ai.atkCd <= 0 && d < myReach + 8 && f.st > wpn.stCost * .6 &&
      !foe.dodgeInv) {
    ai.pending = { kind: 'attack', t: .04 + ai.delayBias };
    ai.atkCd = rand(p.atkCd[0], p.atkCd[1]) * lerp(1.4, .8, skill);
  }
}
function makeFighter(name, blade, x, y, face, hue, controls) {
  return {
    name, blade, hue, controls,
    x, y, r: 13, vx: 0, vy: 0, kbx: 0, kby: 0, face,
    hp: 100, maxHp: 100, st: 100, maxSt: 100, speed: 235,
    action: null, iT: 0, dodgeInv: false, dodgeRecoverT: 0,
    flashT: 0, regenDelay: 0, swingDir: 1, attackId: 0,
    lastDodgeStart: -99, attackBuf: 0, dodgeBuf: 0, parryBuf: 0,
    riposteT: 0, staggerT: 0, rolls: 0, ai: null,
    ultMode: false, brushSwap: false, meditating: false,
    surge: 0, surgeMeter: 0, surgeEnv: 0, ultTrail: [],   // 奥義 — per-fighter ink surge
    ultRun: null, ultArmor: false, ultCounter: false,   // the scripted art
    stance: 'sword', bow: 'shortbow', bowDraw: null, bowLatch: false,
    wins: 0, foe: null, hitByAtk: 0, spawnX: x, spawnY: y, spawnFace: face,
  };
}
function duelMut() { return (duel && duel.mut) || {}; }
/* the brush in the ring: no stamina, no startup, no parry can turn it —
   only i-frames save the victim. Tap burns a cone; roll-tap sends the
   bolt to find them anywhere. Deliberately a cheat; the seal is the gate. */
/* --- 奥義 in the ring: per-fighter surge, deterministic for lockstep ---
   The meter fills from blood given and taken; L (P1) / K (P2) — the same
   keys that flip the brush stances — unleash it on a plain blade. The
   'surge' mutator pins it on for the whole match.                        */
const FSURGE = { dur: 6, max: 100 };
function fighterSurged(f) { return f.surge > 0; }
function addFighterUlt(f, n) {
  if (fighterSurged(f) || f.ultRun || duelMut().surge || WEAPONS[f.blade].admin) return;
  f.surgeMeter = Math.min(FSURGE.max, f.surgeMeter + n);
}
/* the 奥義 in the ring: a full meter unleashes the blade's scripted art
   (same steppers as PvE, through the fighter actor), and the art flows
   into the familiar surge. Duel discipline: the meter resets each round
   and charges only from strokes LANDED and perfect dodges — spam cannot
   decide a duel; the windup can be stuffed for a 60% refund; every
   scripted stroke can be rolled through; bamboo blocks the lane arts.  */
function activateFighterUlt(f) {
  if (fighterSurged(f) || f.ultRun || f.surgeMeter < FSURGE.max) return;
  f.surgeMeter = 0;
  f.action = null;
  if (f.stance === 'bow') { f.stance = 'sword'; f.bowDraw = null; }   // the art ends on steel
  f.ultRun = makeUltRun(f.blade, f);
  ultAnnounce(f, f.blade);
}
// per-fighter brush stances — replicated through the lockstep pipeline
// online, so both simulations flip them on the same tick
function toggleFighterUlt(f) {
  if (!WEAPONS[f.blade].admin) { activateFighterUlt(f); return; }   // plain blades: the 奥義 art
  f.ultMode = !f.ultMode;
  addText(f.x, f.y - 34, f.ultMode ? '滅 ULTIMATE UNBOUND' : 'ultimate sealed',
          f.ultMode ? '#7a6cc0' : 'rgba(43,35,32,.6)', 14);
  if (f.ultMode) shake(3);
}
function toggleFighterSwap(f) {
  if (!WEAPONS[f.blade].admin) return;
  f.brushSwap = !f.brushSwap;
  addText(f.x, f.y - 34, f.brushSwap ? '雷 on tap · 火 on roll-tap'
                                     : '火 on tap · 雷 on roll-tap', '#5b78c9', 13);
}
// 弓 stance in the ring — same commitment lock, same lockstep discipline
function toggleFighterStance(f) {
  if (WEAPONS[f.blade].admin) {
    addText(f.x, f.y - 34, '筆 the brush needs no bow', RED, 13);
    return;
  }
  if (f.action || f.ultRun || f.staggerT > 0) return;
  f.stance = f.stance === 'bow' ? 'sword' : 'bow';
  f.bowDraw = null;
  f.action = { type: 'swap', t: 0, dur: .35 };
  const bow = BOWS[f.bow] || BOWS.shortbow;
  addText(f.x, f.y - 30,
    f.stance === 'bow' ? `弓 ${bow.kanji} ${bow.name} strung` : '刀 blade drawn', INK, 13);
  puff(f.x, f.y, 'rgba(43,35,32,.4)', 5);
  playSfx('whoosh');
}
// release the fighter's string — mirrors playerLooseArrow without upgrades
function fighterLooseArrow(f, heldT) {
  const bow = BOWS[f.bow] || BOWS.shortbow;
  const power = clamp(heldT / bow.draw, .35, 1);
  const weak = f.st <= .01;
  if (!duelMut().nostam && !fighterSurged(f)) f.st = Math.max(0, f.st - bow.stCost);
  f.regenDelay = .6;
  const n = bow.burst || (bow.split && power >= .95 ? bow.split : 1);
  for (let i = 0; i < n; i++) {
    const fan = !bow.burst && n > 1 ? (i - (n - 1) / 2) * .2 : 0;
    spawnPArrow(f, true, bow, f.face + fan,
      Math.max(1, Math.round(bow.dmg * power * 1.6 * (weak ? .55 : 1))),
      bow.speed * (.7 + .3 * power) * .85,   // PvP shafts fly slower — dodgeable on read
      bow.burst ? i * .09 : 0);
  }
  playSfx('bow');
  fx('arrowLoose', { owner: f, x: f.x + Math.cos(f.face) * 18,
                     y: f.y + Math.sin(f.face) * 18, ang: f.face });
}
function fighterBrushCast(f) {
  const foe = f.foe;
  const sinceDodge = game.time - f.lastDodgeStart;
  const flow = sinceDodge > 0 && sinceDodge < DODGE.dur + .5;
  const ang = Math.atan2(foe.y - f.y, foe.x - f.x);
  slashTrail(f.x, f.y, 62, f.face - .9, f.face + .9, 'rgba(43,35,32,.65)', 9);
  const glyph = (ch, color) => particles.push({ kind: 'glyph', ch, color,
    x: f.x + Math.cos(f.face) * 80, y: f.y + Math.sin(f.face) * 80,
    vx: 0, vy: -12, t: 0, life: 1.1, size: 46, misted: false });
  let recover = .55;
  if (f.ultMode) {
    // 滅 — the maw opens in the ring; the growing pull IS the telegraph
    recover = .95;
    glyph('滅', '#7a6cc0');
    const hx = clamp(f.x + Math.cos(f.face) * 180, ARENA.x + 60, ARENA.x + ARENA.w - 60);
    const hy = clamp(f.y + Math.sin(f.face) * 180, ARENA.y + 60, ARENA.y + ARENA.h - 60);
    blackholes.push({ x: hx, y: hy, t: 0, dur: 1.6, r: 10, done: false, owner: f });
    playSfx('rumble');
    freeze(.05); shake(4);
    f.action = { type: 'attack', t: 0, startup: 0, active: 0, recover,
      dmg: 0, reach: 0, arc: 0, id: ++f.attackId, dir: f.swingDir,
      clashed: true, dodgeAwarded: false };
    f.regenDelay = .3;
    return;
  }
  const stormCast = f.brushSwap ? !flow : flow;
  if (stormCast) {
    // 雷 — the bolt crosses the whole ring
    glyph('雷', '#5b78c9');
    boltFX(f.x, f.y, foe.x, foe.y);
    playSfx('bolt');
    if (foe.dodgeInv) addText(foe.x, foe.y - 26, 'perfect dodge!', GOLD, 14);
    else if (foe.iT <= 0) {
      damageFighter(foe, 25, ang);
      foe.staggerT = Math.max(foe.staggerT, .6);
    }
    freeze(.05); shake(4);
  } else {
    // 火 — a cone of flame; roll through it or burn
    glyph('火', RED);
    for (let i = 0; i < 22; i++) {
      const a = f.face + rand(-.75, .75), d = rand(20, 165);
      particles.push({ kind: 'dot',
        x: f.x + Math.cos(a) * d, y: f.y + Math.sin(a) * d,
        vx: Math.cos(a) * rand(40, 120), vy: Math.sin(a) * rand(40, 120) - 30,
        t: 0, life: rand(.3, .6),
        color: Math.random() < .6 ? 'rgba(181,52,42,.8)' : 'rgba(43,35,32,.6)',
        rad: rand(2, 5) });
    }
    playSfx('rumble');
    if (inArc(f.x, f.y, f.face, 170 + foe.r, 1.5, foe.x, foe.y, foe.r)) {
      if (foe.dodgeInv) addText(foe.x, foe.y - 26, 'perfect dodge!', GOLD, 14);
      else if (foe.iT <= 0) damageFighter(foe, 50, ang);
    }
    freeze(.06); shake(5);
  }
  // a beat of recovery so the brush cannot be mashed every frame
  f.action = { type: 'attack', t: 0, startup: 0, active: 0, recover,
    dmg: 0, reach: 0, arc: 0, id: ++f.attackId, dir: f.swingDir,
    clashed: true, dodgeAwarded: false };
  f.regenDelay = .3;
}
/* the maw, fighter-native: drags the OTHER duelist for 1.6s, then
   collapses — 60 damage and a stagger to anyone still inside. Rolls
   halve the pull and i-frames evade the collapse. Deterministic:
   no randomness touches position or damage.                        */
function updateDuelHoles(dt) {
  for (const b of blackholes) {
    b.t += dt;
    const p = clamp(b.t / b.dur, 0, 1);
    b.r = 10 + p * 130;
    shake(1 + p * 2.5);
    const foe = b.owner === duel.p1 ? duel.p2 : duel.p1;
    const d = dist(foe.x, foe.y, b.x, b.y);
    if (d > 1) {
      const ang = Math.atan2(b.y - foe.y, b.x - foe.x);
      const rolling = foe.action && foe.action.type === 'dodge';
      const pull = (200 + 380 * p) * (rolling ? .45 : 1);
      foe.x += Math.cos(ang) * pull * dt;
      foe.y += Math.sin(ang) * pull * dt;
      clampArena(foe);
    }
    if (b.t >= b.dur && !b.done) {
      b.done = true;
      particles.push({ kind: 'ring', x: b.x, y: b.y, t: 0, life: .6,
        color: 'rgba(122,108,192,.85)', r0: 20, r1: 420, w: 5 });
      particles.push({ kind: 'glyph', ch: '滅', color: '#e8e4f4',
        x: b.x, y: b.y, vx: 0, vy: -16, t: 0, life: 1.1, size: 60, misted: false });
      inkSplat(b.x, b.y);
      shake(11); freeze(.14);
      playSfx('taiko');
      if (dist(foe.x, foe.y, b.x, b.y) < b.r * .9) {
        if (foe.dodgeInv) addText(foe.x, foe.y - 26, 'perfect dodge!', GOLD, 14);
        else if (foe.iT <= 0) {
          damageFighter(foe, 60, Math.atan2(foe.y - b.y, foe.x - b.x));
          foe.staggerT = Math.max(foe.staggerT, .8);
        }
      }
    }
  }
  blackholes = blackholes.filter(b => b.t < b.dur + .1);
}
function startFighterAttack(f) {
  const wpn = WEAPONS[f.blade];
  if (wpn.admin) { fighterBrushCast(f); return; }
  const mut = duelMut();
  const surged = fighterSurged(f);
  const weak = f.st <= .01;
  if (!mut.nostam && !surged) f.st = Math.max(0, f.st - wpn.stCost);
  f.regenDelay = .6;
  const m = (weak ? 1.65 : 1) * wpn.spdMul;
  let dmg = Math.round(wpn.dmg * 1.6 * (weak ? .55 : 1) * (surged ? 2 : 1));
  let riposte = false;
  if (f.riposteT > 0) {
    riposte = true; f.riposteT = 0;
    dmg = Math.round(dmg * 1.5);
    addText(f.x, f.y - 28, 'riposte!', GOLD, 13);
    sparks(f.x, f.y, f.face, PAL.pigment.imperialGold, 5, .7);
  }
  f.action = {
    type: 'attack', t: 0, weak, riposte,
    startup: ATK.startup * m, active: ATK.active * m, recover: ATK.recover * m,
    dmg,
    reach: wpn.reach * (mut.giant ? 1.5 : 1) * (surged ? 3 : 1),
    arc: wpn.arc * (mut.giant ? 1.15 : 1) * (surged ? 1.3 : 1),
    id: ++f.attackId, dir: f.swingDir, clashed: false, dodgeAwarded: false,
  };
  f.swingDir *= -1;
  playSfx('whoosh');
}
function startFighterParry(f) {
  const cost = (duelMut().nostam || fighterSurged(f)) ? 0 : PARRY.cost;
  if (f.st < cost) { addText(f.x, f.y - 24, 'exhausted!', RED, 13); return; }
  f.st = Math.max(0, f.st - cost);
  f.regenDelay = .5;
  f.action = { type: 'parry', t: 0 };
}
function fighterParryActive(f) {
  const a = f.action;
  return !!(a && a.type === 'parry' && a.t <= PARRY.active);
}
function startFighterDodge(f, mx, my) {
  if (f.st < 10 && !fighterSurged(f)) { addText(f.x, f.y - 24, 'exhausted!', RED, 13); return; }
  if (!duelMut().nostam && !fighterSurged(f)) f.st = Math.max(0, f.st - DODGE.cost);
  f.rolls++;
  f.regenDelay = .6;
  let dx = mx, dy = my;
  if (!dx && !dy) { dx = Math.cos(f.face); dy = Math.sin(f.face); }
  const l = Math.hypot(dx, dy) || 1;
  f.action = { type: 'dodge', t: 0, dx: dx / l, dy: dy / l };
  f.face = Math.atan2(dy, dx);
  f.lastDodgeStart = game.time;
  playSfx('dodge');
  puff(f.x, f.y, 'rgba(43,35,32,.5)', 4);
}
function damageFighter(f, dmg, ang) {
  if (f.iT > 0 || f.dodgeInv) return;
  // 月ノ答 — the raised counter drinks the blow and answers it
  if (f.ultCounter && f.ultRun) { ultCounterTrigger(f.ultRun, fighterUltActor(f), ang); return; }
  f.hp -= dmg;
  f.iT = .9; f.flashT = .3;
  playSfx('hurt');
  // an art stuffed in its windup shatters — most of the meter flows back
  if (f.ultRun && f.ultRun.phase === 'windup') {
    f.ultRun = null;
    f.ultArmor = false; f.ultCounter = false;
    f.surgeMeter = Math.min(FSURGE.max, f.surgeMeter + FSURGE.max * .6);
    addText(f.x, f.y - 40, '奥義 broken!', RED, 14);
  }
  if (f.ultArmor) {   // scripted armor: the blow lands, the art continues
    f.kbx += Math.cos(ang) * 70; f.kby += Math.sin(ang) * 70;
  } else {
    f.kbx += Math.cos(ang) * 300; f.kby += Math.sin(ang) * 300;
    f.action = null;
    f.bowDraw = null;   // the string slips
  }
  shake(5); freeze(.06);
  sparks(f.x, f.y, ang, RED, 8);
  addText(f.x, f.y - 26, '-' + dmg, RED, 16);
  if (f.hp <= 0) { f.hp = 0; duelRoundWon(f.foe, f); }
}
function duelRoundWon(w, l) {
  if (duel.pauseT > 0) return;
  inkSplat(l.x, l.y);
  w.wins++;
  duel.matchOver = w.wins >= 2;
  duel.pauseT = 2;
  setBanner(duel.matchOver ? w.name + ' WINS THE DUEL'
                           : w.name + ' takes round ' + duel.round, 2);
  shake(8); freeze(.12);
}
function resetDuelRound() {
  blackholes = [];   // any half-grown maw dies with the round
  pArrows = []; burnZones = []; ultWaves = [];   // loose shafts and storms too
  for (const f of [duel.p1, duel.p2]) {
    f.x = f.spawnX; f.y = f.spawnY; f.face = f.spawnFace;
    f.hp = f.maxHp; f.st = f.maxSt;
    f.action = null; f.iT = 0; f.kbx = f.kby = 0;
    f.attackBuf = f.dodgeBuf = 0; f.dodgeInv = false; f.hitByAtk = 0;
    f.surge = 0; f.ultTrail = [];
    // a fresh round cuts the surge AND empties the meter — an 奥義 must be
    // earned inside the round it decides; ultimate spam cannot take a duel
    f.surgeMeter = 0; f.surgeEnv = 0;
    f.ultRun = null; f.ultArmor = false; f.ultCounter = false;
    f.stance = 'sword'; f.bowDraw = null; f.bowLatch = false;
  }
  setBanner('— ROUND ' + duel.round + ' —', 1.6);
}
function startDuelMatch(tournamentRound) {
  const cy = ARENA.y + ARENA.h / 2;
  const mut = Object.assign({}, menuSel.mut);
  const opp = menuSel.duelOpp;
  const p1Blade = menuSel.p1Blade;
  const p1 = makeFighter('PLAYER 1', p1Blade, ARENA.x + 200, cy, 0,
    save.headband === 'gold' ? GOLD : RED,
    { left: 'a', right: 'd', up: 'w', down: 's' });
  let p2, tour = null;
  if (opp === 'tournament') {
    const spec = TOURNAMENT[tournamentRound];
    p2 = makeAIFighter(spec.persona, spec.skill,
      mut.mirror ? p1Blade : spec.blade,
      ARENA.x + ARENA.w - 200, cy, Math.PI);
    p2.name = spec.name;
    tour = { round: tournamentRound };
  } else if (opp === 'online') {
    // both fighters run on the lockstep pipeline — no local controls
    p2 = makeFighter('CHALLENGER', menuSel.p2Blade,
      ARENA.x + ARENA.w - 200, cy, Math.PI, '#3f3831', null);
  } else if (opp !== 'human') {
    p2 = makeAIFighter(opp, .75, mut.mirror ? p1Blade : null,
      ARENA.x + ARENA.w - 200, cy, Math.PI);
  } else {
    p2 = makeFighter('PLAYER 2', mut.mirror ? p1Blade : menuSel.p2Blade,
      ARENA.x + ARENA.w - 200, cy, Math.PI, '#3f3831',
      { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' });
  }
  // bows ride the loadout: duels are progression-free, any bow may be strung
  p1.bow = BOWS[menuSel.p1Bow] ? menuSel.p1Bow : 'shortbow';
  p2.bow = mut.mirror ? p1.bow
         : BOWS[menuSel.p2Bow] ? menuSel.p2Bow : 'shortbow';
  if (mut.sudden) {                        // one clean hit decides each round
    p1.hp = p1.maxHp = 1;
    p2.hp = p2.maxHp = 1;
  }
  // against a bot the lone human may fight from either half of the keyboard
  if (p2.ai) p1.controls2 =
    { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' };
  duel = { round: 1, pauseT: 0, matchOver: false, p1, p2, mut, tournament: tour };
  p1.foe = p2; p2.foe = p1;
  setBanner(tour ? '冠 ' + TOURNAMENT[tournamentRound].title
                 : '決闘 — ROUND 1 · first to 2', 2.2);
}
function endDuelMatch() {
  const w = duel.p1.wins > duel.p2.wins ? duel.p1 : duel.p2;
  const humanWon = !w.ai;
  const t = duel.tournament;
  if (humanWon) {
    save.stats.duelWins++;
    if (w.rolls === 0) award('duelist');   // a duel won on planted feet
  }
  persistSave();
  // tournament: advance the bracket or crown the champion
  if (t && w === duel.p1) {
    if (t.round < TOURNAMENT.length - 1) {
      startDuelMatch(t.round + 1);
      return;
    }
    save.headband = 'gold';
    award('crowned');
    persistSave();
    game.state = 'gameover';
    const ttl = document.getElementById('overTitle');
    ttl.textContent = '冠 CHAMPION OF THE DOJO';
    ttl.style.color = 'var(--gold)';
    document.getElementById('overStats').innerHTML =
      'all four gates felled —<br>the <b>gold headband</b> is yours, worn in every trial to come';
    document.getElementById('overScores').innerHTML = '';
    showOverlay('over');
    return;
  }
  game.state = 'gameover';
  const ttl = document.getElementById('overTitle');
  if (t) {
    ttl.textContent = 'ELIMINATED';
    ttl.style.color = 'var(--red)';
    document.getElementById('overStats').innerHTML =
      `felled at the <b>${['first', 'second', 'third', 'final'][t.round]} gate</b> by <b>${w.name}</b>`;
  } else {
    ttl.textContent = '勝 ' + w.name + ' WINS';
    ttl.style.color = 'var(--gold)';
    document.getElementById('overStats').innerHTML =
      `決闘 complete — <b>${duel.p1.wins}–${duel.p2.wins}</b><br>` +
      `${WEAPONS[duel.p1.blade].name} vs ${WEAPONS[duel.p2.blade].name}`;
  }
  document.getElementById('overScores').innerHTML = '';
  showOverlay('over');
}
function updateFighter(f, dt) {
  f.iT = Math.max(0, f.iT - dt);
  f.flashT = Math.max(0, f.flashT - dt);
  f.dodgeRecoverT = Math.max(0, f.dodgeRecoverT - dt);
  f.riposteT = Math.max(0, f.riposteT - dt);
  f.staggerT = Math.max(0, f.staggerT - dt);
  f.attackBuf = Math.max(0, f.attackBuf - dt);
  f.dodgeBuf = Math.max(0, f.dodgeBuf - dt);
  f.parryBuf = Math.max(0, f.parryBuf - dt);
  f.dodgeInv = false;
  f.regenDelay = Math.max(0, f.regenDelay - dt);
  if (!f.action && f.regenDelay <= 0)
    f.st = Math.min(f.maxSt, f.st + 26 * dt);
  // 奥義 surge: the eternal mutator pins it on; otherwise it burns down
  if (duelMut().surge) f.surge = 1;
  else if (f.surge > 0) {
    f.surge = Math.max(0, f.surge - dt);
    if (f.surge === 0) {
      addText(f.x, f.y - 30, '奥義 fades', 'rgba(43,35,32,.6)', 12);
      ultFadeFX(f);   // the pigment drains back into the blade
    }
  }
  if (fighterSurged(f)) f.st = f.maxSt;   // the surge never tires
  // color envelope — deterministic (dt-integrated), read only by render/audio
  const envTarget = (fighterSurged(f) || f.ultRun) ? 1 : 0;
  f.surgeEnv = clamp((f.surgeEnv || 0) + (envTarget ? dt / .35 : -dt / .5), 0, 1);
  // a scripted 奥義 owns the fighter: no inputs until the art is spoken,
  // then it flows into the surge — deterministic, so lockstep-safe
  if (f.ultRun) {
    f.meditating = false;
    f.bowDraw = null;
    if (runEntityUlt(f.ultRun, fighterUltActor(f), dt)) {
      f.ultRun = null;
      f.surge = Math.max(f.surge, FSURGE.dur);
    }
    f.kbx *= Math.exp(-8 * dt); f.kby *= Math.exp(-8 * dt);
    f.x += f.kbx * dt; f.y += f.kby * dt;
    clampArena(f);
    return;
  }
  f.ultArmor = false; f.ultCounter = false;
  // the AI duelist writes its own inputs each frame
  if (f.ai) updateFighterAI(f, dt);
  const c = f.controls, c2 = f.controls2;   // controls2: the solo human owns both sets
  let mx, my;
  if (f.ai) { mx = f.ai.mx; my = f.ai.my; }
  else if (f.netCtl) { mx = f.netCtl.mx; my = f.netCtl.my; }
  else {
    mx = ((keys[c.right] || (c2 && keys[c2.right])) ? 1 : 0) -
         ((keys[c.left]  || (c2 && keys[c2.left]))  ? 1 : 0);
    my = ((keys[c.down]  || (c2 && keys[c2.down]))  ? 1 : 0) -
         ((keys[c.up]    || (c2 && keys[c2.up]))    ? 1 : 0);
    if (f === (duel && duel.p1) && touch.active) { mx = touch.mx; my = touch.my; }
  }
  if (mx || my) {
    const l = Math.hypot(mx, my); mx /= l; my /= l;
    if (!f.action && f.staggerT <= 0) f.face = Math.atan2(my, mx);
  }
  if (f.staggerT > 0) { mx = 0; my = 0; }   // parried wide open — helpless
  else if (!f.action) {
    // the bow has no swing — with the string out, attack taps do nothing
    if (f.attackBuf > 0) {
      f.attackBuf = 0;
      if (f.stance === 'sword' || WEAPONS[f.blade].admin) startFighterAttack(f);
    }
    else if (f.parryBuf > 0) { f.parryBuf = 0; f.bowDraw = null; startFighterParry(f); }
    else if (f.dodgeBuf > 0) { f.dodgeBuf = 0; f.bowDraw = null; startFighterDodge(f, mx, my); }
  }

  // 弓 drawn in the ring: hold attack to bend the string, release to loose.
  // Held state rides input bit 2048 online, so both sims bend on the same tick.
  if (f.stance === 'bow' && !WEAPONS[f.blade].admin) {
    const held = f.ai ? false
      : f.netCtl ? !!f.netCtl.atkHeld
      : f === (duel && duel.p1)
        ? (!!keys.v || !!(c2 && keys.u) || touchUI.pressed.atk !== undefined)
        : !!keys.u;
    if (f.bowDraw && (f.action || f.staggerT > 0)) f.bowDraw = null;
    if (!f.action && f.staggerT <= 0) {
      const bow = BOWS[f.bow] || BOWS.shortbow;
      if (f.bowDraw) {
        f.bowDraw.t += dt;
        f.regenDelay = Math.max(f.regenDelay, .35);
        if (!held) { fighterLooseArrow(f, f.bowDraw.t); f.bowDraw = null; }
      } else if (held && !f.bowLatch) {
        f.bowLatch = true;
        if (f.st >= bow.stCost || duelMut().nostam || fighterSurged(f)) f.bowDraw = { t: 0 };
        else addText(f.x, f.y - 24, 'exhausted!', RED, 13);
      }
    }
    if (!held) f.bowLatch = false;
  } else f.bowDraw = null;
  // 瞑 meditation: kneel and breathe — the gauge refills three times as
  // fast, but the feet are planted and the guard is down
  f.meditating = !f.action && f.staggerT <= 0 && !f.bowDraw &&
    (f.ai ? false
     : f.netCtl ? !!f.netCtl.med
     : (f === duel.p1 ? !!(keys.m || (c2 && keys[','])) : !!keys[',']));
  if (f.meditating) {
    mx = 0; my = 0;
    f.st = Math.min(f.maxSt, f.st + 26 * (f.regenDelay <= 0 ? 2 : 3) * dt);
    if (Math.random() < dt * 7)
      particles.push({ kind: 'dot', x: f.x + rand(-8, 8), y: f.y - f.r,
        vx: 0, vy: -34, t: 0, life: .8, color: 'rgba(168,132,58,.55)', rad: 1.8 });
  }
  let vx = 0, vy = 0;
  const a = f.action;
  if (a) {
    a.t += dt;
    if (a.type === 'attack') {
      vx = mx * f.speed * .15; vy = my * f.speed * .15;
      const activeStart = a.startup, activeEnd = a.startup + a.active;
      if (a.t >= activeStart && a.t < activeEnd) {
        const p = (a.t - activeStart) / a.active;
        const bladeAng = f.face + lerp(-1.15, 1.15, p) * a.dir;
        const surged = fighterSurged(f);
        if (surged)
          f.ultTrail.push({ x: f.x + Math.cos(bladeAng) * a.reach,
                            y: f.y + Math.sin(bladeAng) * a.reach, t: game.time });
        // one event, two worlds: ink stroke in base, WPN_NEON under the surge
        fx('slash', { owner: f, x: f.x, y: f.y, reach: a.reach, ang: bladeAng,
                      dir: a.dir, weak: a.weak, bladeId: f.blade,
                      tipX: f.x + Math.cos(bladeAng) * a.reach,
                      tipY: f.y + Math.sin(bladeAng) * a.reach });
        const foe = f.foe, fa = foe.action;
        // parry beats the blade: a clash-worthy swing turned aside instead
        if (!a.clashed && fighterParryActive(foe) &&
            inArc(f.x, f.y, f.face, a.reach + 4, a.arc, foe.x, foe.y, foe.r)) {
          a.clashed = true;
          f.action = null;
          f.staggerT = 1.0;
          const away = Math.atan2(f.y - foe.y, f.x - foe.x);
          f.kbx += Math.cos(away) * 420; f.kby += Math.sin(away) * 420;
          foe.riposteT = 1.2;
          foe.st = Math.min(foe.maxSt, foe.st + 12);
          const mxp = (f.x + foe.x) / 2, myp = (f.y + foe.y) / 2;
          sparks(mxp, myp, away, PAL.pigment.imperialGold, 12, Math.PI);
          addText(mxp, myp - 20, '弾 parried!', GOLD, 15);
          freeze(.1); shake(5);
          playSfx('parry');
        }
        // blade clash — both active (with a 3-frame grace so simultaneous
        // presses clash instead of rewarding whoever updates first),
        // both in each other's reach and arc
        else if (!a.clashed && fa && fa.type === 'attack' &&
            fa.t >= fa.startup - .05 && fa.t < fa.startup + fa.active &&
            inArc(f.x, f.y, f.face, a.reach + 6, a.arc, foe.x, foe.y, foe.r) &&
            inArc(foe.x, foe.y, foe.face, fa.reach + 6, fa.arc, f.x, f.y, f.r)) {
          a.clashed = true; fa.clashed = true;
          a.t = a.startup + a.active;         // both blades bounce to recovery
          fa.t = fa.startup + fa.active;
          const angAB = Math.atan2(foe.y - f.y, foe.x - f.x);
          f.kbx -= Math.cos(angAB) * 380; f.kby -= Math.sin(angAB) * 380;
          foe.kbx += Math.cos(angAB) * 380; foe.kby += Math.sin(angAB) * 380;
          const mxp = (f.x + foe.x) / 2, myp = (f.y + foe.y) / 2;
          sparks(mxp, myp, angAB + Math.PI / 2, GOLD, 12, Math.PI);
          addText(mxp, myp - 20, 'clash!', GOLD, 15);
          freeze(.08); shake(5);
          playSfx('clash');
        } else if (foe.hitByAtk !== a.id &&
                   inArc(f.x, f.y, f.face, a.reach + 4, a.arc, foe.x, foe.y, foe.r)) {
          if (foe.dodgeInv) {
            if (!a.dodgeAwarded) {
              a.dodgeAwarded = true;
              addText(foe.x, foe.y - 26, 'perfect dodge!', GOLD, 14);
              addFighterUlt(foe, 12);   // a clean read feeds the 奥義
            }
          } else if (foe.iT <= 0) {
            foe.hitByAtk = a.id;
            damageFighter(foe, a.dmg, Math.atan2(foe.y - f.y, foe.x - f.x));
            addFighterUlt(f, a.dmg * .8);   // drawn blood feeds the attacker's
          }
        }
        // bamboo in the way gets cut down
        for (const st of stalks) {
          if (st.dead || st.hitBy === a.id) continue;
          if (inArc(f.x, f.y, f.face, a.reach + 6, a.arc, st.x, st.y, st.r)) {
            st.hitBy = a.id;
            st.hp--;
            sparks(st.x, st.y, f.face, '#6a675c', 5);
            if (st.hp <= 0) {
              st.dead = true;
              puff(st.x, st.y, 'rgba(96,94,82,.7)', 10);
              shake(2);
            }
          }
        }
      }
      if (f.action && a.t >= a.startup + a.active + a.recover) f.action = null;
    } else if (a.type === 'dodge') {
      const p = a.t / DODGE.dur;
      const sp = DODGE.speed * (1 - p * .62);
      vx = a.dx * sp; vy = a.dy * sp;
      if (fighterSurged(f)) f.ultTrail.push({ x: f.x, y: f.y, t: game.time });
      f.dodgeInv = a.t >= DODGE.invStart && a.t <= DODGE.invEnd;
      if (a.t >= DODGE.dur) { f.action = null; f.dodgeRecoverT = DODGE.recover; }
    } else if (a.type === 'parry') {
      if (a.t >= PARRY.active + PARRY.recover) f.action = null;
    } else if (a.type === 'swap') {
      vx = mx * f.speed * .25; vy = my * f.speed * .25;
      if (a.t >= a.dur) f.action = null;
    }
  } else {
    const spd = f.speed * (f.bowDraw ? .42 : 1);   // a bent string roots the feet
    vx = mx * spd; vy = my * spd;
  }
  f.kbx *= Math.exp(-8 * dt); f.kby *= Math.exp(-8 * dt);
  f.x += (vx + f.kbx) * dt;
  f.y += (vy + f.kby) * dt;
  clampArena(f);
}
function drawFighter(f) {
  drawShadow(f.x, f.y, f.r);
  if (f.ultRun) drawUltRun(f.ultRun, f);   // the foe reads the art before it lands
  if (f.surgeEnv > 0) drawUltWings(f.x, f.y, f.face, f.blade, f.r, f.surgeEnv);
  if (f.iT > 0 && Math.sin(game.time * 40) > 0) ctx.globalAlpha = .45;
  const rolling = f.action && f.action.type === 'dodge';
  if (rolling) {
    if (fighterSurged(f)) {
      neonRollStreaks(f.x, f.y, f.action.dx, f.action.dy, f.r, weaponNeon(f.blade));
    } else {
      ctx.strokeStyle = 'rgba(43,35,32,.3)'; ctx.lineWidth = 2;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(f.x - f.action.dx * i * 9, f.y - f.action.dy * i * 9, f.r - i * 2, 0, TAU);
        ctx.stroke();
      }
    }
  }
  // 奥義 aura — a slow-turning neon ring the foe can read at a glance
  if (fighterSurged(f)) {
    const nz = weaponNeon(f.blade);
    ctx.save();
    ctx.shadowBlur = 10; ctx.shadowColor = nz[0];
    ctx.strokeStyle = nz[0];
    ctx.globalAlpha = .5 + .2 * Math.sin(game.time * 6);
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 7]);
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r + 8, game.time * 1.5, game.time * 1.5 + TAU - .6);
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = f.flashT > 0 ? REDHOT : CREAM;
  ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill(); ctx.stroke();
  // meditation ring
  if (f.meditating) {
    const br = .5 + Math.sin(game.time * 3) * .12;
    ctx.strokeStyle = `rgba(168,132,58,${br * .6})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 6]);
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r + 12 + Math.sin(game.time * 3) * 2, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(168,132,58,${br})`;
    ctx.font = '13px Georgia,serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('瞑', f.x, f.y - f.r - 24);
  }
  // parry guard / stagger daze
  if (f.action && f.action.type === 'parry') {
    const active = f.action.t <= PARRY.active;
    ctx.strokeStyle = active ? GOLD : 'rgba(43,35,32,.35)';
    ctx.lineWidth = active ? 4 : 2.5;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r + 9, f.face - .95, f.face + .95);
    ctx.stroke();
  }
  if (f.staggerT > 0) {
    ctx.fillStyle = 'rgba(43,35,32,.6)';
    for (let i = 0; i < 3; i++) {
      const oa = game.time * 5 + i * TAU / 3;
      ctx.beginPath();
      ctx.arc(f.x + Math.cos(oa) * (f.r + 7), f.y - f.r - 6 + Math.sin(oa) * 3, 1.8, 0, TAU);
      ctx.fill();
    }
  }
  // headband in the fighter's colour
  ctx.strokeStyle = f.hue; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(f.x, f.y, f.r - 3, f.face + 2.4, f.face + 3.9); ctx.stroke();
  ctx.lineWidth = 2;
  const bx = f.x - Math.cos(f.face) * (f.r - 1), by = f.y - Math.sin(f.face) * (f.r - 1);
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.quadraticCurveTo(
    bx - Math.cos(f.face) * 7 + Math.sin(game.time * 7) * 3,
    by - Math.sin(f.face) * 7 + Math.cos(game.time * 7) * 3,
    bx - Math.cos(f.face) * 13, by - Math.sin(f.face) * 13 + Math.sin(game.time * 7) * 2);
  ctx.stroke();
  ctx.fillStyle = INK;
  const ex = Math.cos(f.face), ey = Math.sin(f.face);
  ctx.beginPath();
  ctx.arc(f.x + ex * 6 - ey * 3.5, f.y + ey * 6 + ex * 3.5, 1.6, 0, TAU);
  ctx.arc(f.x + ex * 6 + ey * 3.5, f.y + ey * 6 - ex * 3.5, 1.6, 0, TAU);
  ctx.fill();
  // blade
  const a = f.action, wpn = WEAPONS[f.blade];
  ctx.lineCap = 'round';
  let bladeAng = f.face + .55, bladeLen = 26;
  if (a && a.type === 'attack') {
    if (a.t < a.startup) {
      bladeAng = f.face - 1.5 * a.dir;
      const tp = a.t / a.startup;
      ctx.save();
      ctx.strokeStyle = `rgba(43,35,32,${.2 + tp * .35})`; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(f.x, f.y, a.reach, f.face - a.arc / 2, f.face + a.arc / 2);
      ctx.stroke();
      ctx.restore();
      bladeLen = 30;
    } else if (a.t < a.startup + a.active) {
      const tp = (a.t - a.startup) / a.active;
      bladeAng = f.face + lerp(-1.15, 1.15, tp) * a.dir;
      bladeLen = a.reach - f.r + 4;
    } else {
      bladeAng = f.face + 1.15 * a.dir;
      bladeLen = 28;
    }
  }
  if (f.stance === 'bow' && !wpn.admin) {
    drawEntityBow(f, BOWS[f.bow] || BOWS.shortbow, f.bowDraw, true);
  } else drawBlade(f, bladeAng, bladeLen, wpn, a);
  ctx.globalAlpha = 1;
}
/* the bow at rest and at full bend — shared by yard and ring. In a duel
   the aim line is a live telegraph, so it runs through teleRGBA.        */
function drawEntityBow(e, bow, draw, pvp) {
  const a = e.face;
  const bx = e.x + Math.cos(a) * (e.r + 5), by = e.y + Math.sin(a) * (e.r + 5);
  // the visible bend matches the true draw: 弓道 quickens the player's,
  // never a duelist's (pvp arms read raw stats)
  const power = draw ? clamp(draw.t / (bow.draw * (pvp ? 1 : kyudoDrawMul())), 0, 1) : 0;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = bow.legendary ? GOLD : INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.arc(bx, by, 13, a - 1.25, a + 1.25); ctx.stroke();
  const t1x = bx + Math.cos(a - 1.25) * 13, t1y = by + Math.sin(a - 1.25) * 13;
  const t2x = bx + Math.cos(a + 1.25) * 13, t2y = by + Math.sin(a + 1.25) * 13;
  const nx = bx - Math.cos(a) * power * 9, ny = by - Math.sin(a) * power * 9;
  ctx.strokeStyle = 'rgba(43,35,32,.8)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(t1x, t1y); ctx.lineTo(nx, ny); ctx.lineTo(t2x, t2y); ctx.stroke();
  if (draw) {
    // the nocked shaft — plain ink until the owner's world is in color
    const es = styleFor(e);
    ctx.strokeStyle = es.glow ? es.stroke : INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(nx, ny);
    ctx.lineTo(nx + Math.cos(a) * 18, ny + Math.sin(a) * 18);
    ctx.stroke();
    // aim line sharpens with the draw — the shot's honest warning
    const len = 60 + power * 120;
    ctx.strokeStyle = pvp ? teleRGBA(.15 + power * .4)
                          : `rgba(43,35,32,${.12 + power * .3})`;
    ctx.lineWidth = power >= 1 ? 2 : 1.2;
    ctx.setLineDash(power >= 1 ? [] : [4, 6]);
    ctx.beginPath();
    ctx.moveTo(bx + Math.cos(a) * 8, by + Math.sin(a) * 8);
    ctx.lineTo(bx + Math.cos(a) * len, by + Math.sin(a) * len);
    ctx.stroke();
    ctx.setLineDash([]);
    // draw-power ring: a full bend glints gold
    ctx.strokeStyle = power >= 1 ? GOLD : 'rgba(43,35,32,.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r + 8, -Math.PI / 2, -Math.PI / 2 + power * TAU);
    ctx.stroke();
  }
  ctx.restore();
}
function drawDuelHUD() {
  ctx.textBaseline = 'middle';
  const bw = 190, bh = 13;
  for (const [f, x0] of [[duel.p1, 30], [duel.p2, W - 30 - bw]]) {
    ctx.font = '14px Georgia,serif'; ctx.textAlign = 'left';
    ctx.fillStyle = f.hue;
    ctx.fillText(f.name, x0, 16);
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.strokeRect(x0, 26, bw, bh);
    ctx.fillStyle = 'rgba(43,35,32,.12)'; ctx.fillRect(x0, 26, bw, bh);
    ctx.fillStyle = f.hue;
    ctx.fillRect(x0 + 1, 27, (bw - 2) * clamp(f.hp / f.maxHp, 0, 1), bh - 2);
    ctx.strokeRect(x0, 47, bw, bh);
    ctx.fillStyle = 'rgba(43,35,32,.12)'; ctx.fillRect(x0, 47, bw, bh);
    ctx.fillStyle = '#857b6c';
    ctx.fillRect(x0 + 1, 48, (bw - 2) * clamp(f.st / f.maxSt, 0, 1), bh - 2);
    const w = WEAPONS[f.blade];
    // 奥 surge bar — a full bar begs for the key; an active surge drains
    if (!w.admin) {
      const nz = weaponNeon(f.blade);
      const sFrac = fighterSurged(f)
        ? (duelMut().surge ? 1 : clamp(f.surge / FSURGE.dur, 0, 1))
        : clamp(f.surgeMeter / FSURGE.max, 0, 1);
      ctx.strokeRect(x0, 68, bw, 7);
      ctx.fillStyle = 'rgba(43,35,32,.12)'; ctx.fillRect(x0, 68, bw, 7);
      ctx.save();
      if (fighterSurged(f) || sFrac >= 1) {
        ctx.shadowBlur = 8 + 4 * Math.sin(game.time * 8);
        ctx.shadowColor = nz[0];
      }
      ctx.fillStyle = nz[0];
      ctx.fillRect(x0 + 1, 69, (bw - 2) * sFrac, 5);
      ctx.restore();
      ctx.shadowBlur = 0;
    }
    ctx.font = 'italic 12px Georgia,serif';
    // the brush is never allowed to masquerade — admin reads in red
    ctx.fillStyle = w.admin ? RED : INK;
    ctx.fillText(`${w.kanji} ${w.name}${w.admin ? ' · ADMIN' : ''}` +
      `${f.stance === 'bow' ? ' · 弓 ' + (BOWS[f.bow] || BOWS.shortbow).name : ''}` +
      `${f.ultMode ? ' · 滅' : ''}${f.brushSwap ? ' · 雷tap' : ''}` +
      `${fighterSurged(f) && !w.admin ? ' · 奥義' : ''}`, x0, w.admin ? 70 : 87);
  }
  ctx.font = '20px Georgia,serif'; ctx.textAlign = 'center'; ctx.fillStyle = INK;
  ctx.fillText('決闘 ROUND ' + duel.round, W / 2, 26);
  ctx.font = 'bold 18px Georgia,serif'; ctx.fillStyle = GOLD;
  ctx.fillText(duel.p1.wins + ' — ' + duel.p2.wins, W / 2, 50);
  // connection quality — a single honest dot
  if (net && net.started) {
    const rtt = net.rtt || 0;
    // wire health in the sanctioned tongue: ink = good, gold = fair, red = bad
    ctx.fillStyle = net.stall ? RED : rtt < 120 ? INK : rtt < 250 ? GOLD : RED;
    ctx.beginPath(); ctx.arc(W / 2 + 70, 24, 5, 0, TAU); ctx.fill();
    ctx.font = 'italic 10px Georgia,serif'; ctx.fillStyle = 'rgba(43,35,32,.6)';
    ctx.textAlign = 'left';
    ctx.fillText(net.stall ? 'waiting for the wire…'
                           : Math.round(rtt) + 'ms · d' + net.delay, W / 2 + 80, 25);
    ctx.textAlign = 'center';
  }
  if (game.time < 6) {
    ctx.font = 'italic 11px Georgia,serif'; ctx.fillStyle = 'rgba(43,35,32,.55)';
    ctx.fillText(duel.p2.ai || duel.p2.netCtl
      ? 'move WASD or arrows · slash V or U · roll B or I · parry N or O · Q bow · M meditate · Space 奥義 when the bar burns'
      : 'P1: WASD · V slash · B roll · N parry · Q bow · Space 奥義      P2: arrows · U slash · I roll · O parry · P bow · K 奥義',
      W / 2, H - 20);
    if (WEAPONS[duel.p1.blade].admin || WEAPONS[duel.p2.blade].admin) {
      ctx.fillStyle = RED;
      ctx.fillText(net && net.started
        ? 'brush stances: L — ultimate · Y — swap tap spell'
        : 'brush stances: P1 L/Y · P2 K/J — ultimate / swap tap spell', W / 2, H - 34);
    }
  }
  // mutators in play
  if (duel.mut && (duel.mut.sudden || duel.mut.nostam || duel.mut.giant ||
                   duel.mut.mirror || duel.mut.surge)) {
    ctx.font = 'italic 11px Georgia,serif'; ctx.fillStyle = RED;
    const tags = [];
    if (duel.mut.sudden) tags.push('一撃');
    if (duel.mut.nostam) tags.push('無尽');
    if (duel.mut.giant) tags.push('大刀');
    if (duel.mut.mirror) tags.push('鏡');
    if (duel.mut.surge) tags.push('奥義');
    ctx.fillText(tags.join(' · '), W / 2, 70);
  }
}

