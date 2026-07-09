/* ---------- 奥義 ultimate arts — one signature per blade ----------
   A meter fills from landed strokes and perfect dodges; R (PvE) or the
   surge key (duels) unleashes the equipped blade's own art. Every art
   runs on one scripted framework:
     windup  — a clear telegraph; taking a hit here BREAKS the art and
               refunds most of the meter (stuffing a windup is real
               counterplay, in the yard and in the ring),
     active  — the scripted sequence; i-frames or armor per blade,
     recover — a short settle... and then the INK SURGE: the familiar buff
               (bottomless lungs, ×3 reach, ×2 weight, neon ribbons and
               wings) burns for the rest of the duration. The art is the
               opener; the surge is the reward. No free ultimates — a hit
               taken during the windup breaks the whole thing.
   The steppers are shared verbatim between PvE and duels through a tiny
   actor adapter, and never read unseeded randomness for gameplay — the
   online lockstep stays deterministic (particles may still roll dice).
   Bamboo stalks block lane arts (Issen, Thunder Crossing) — position
   play beats raw ink.                                                   */
const ULT_BUFF_PVE = 8;   // seconds of surge once the art has spoken
const ULTS = {
  tetsu:     { kanji: '閃', name: 'ISSEN · ONE FLASH',           windup: .55, recover: .35, guard: 'iframes' },
  ame:       { kanji: '雨', name: 'MURASAME · VILLAGE RAIN',     windup: .45, recover: .3,  guard: 'iframes' },
  shirasagi: { kanji: '舞', name: 'SAGI-MAI · HERON’S DANCE',    windup: .5,  recover: .35, guard: 'iframes' },
  botan:     { kanji: '吹', name: 'HANAFUBUKI · PETAL BLIZZARD', windup: .5,  recover: .3,  guard: 'armor' },
  kurogane:  { kanji: '墜', name: 'KARASU-OTOSHI · CROW FALL',   windup: .7,  recover: .45, guard: 'iframes', heavy: true },
  tsukikage: { kanji: '月', name: 'TSUKI NO KOTAE · MOON’S ANSWER', windup: .3, recover: .3, guard: 'none' },
  akaoni:    { kanji: '鬼', name: 'ONIGURUMA · DEMON’S WHEEL',   windup: .65, recover: .45, guard: 'armor', heavy: true },
  raiko:     { kanji: '雷', name: 'RAIWATARI · THUNDER CROSSING', windup: .5, recover: .3,  guard: 'iframes' },
  // the brush's art is the original: the lunging five-stroke unwriting.
  // Refactored onto the shared framework, still deliberately the flashiest.
  fudemaru:  { kanji: '墨', name: 'BOKUMETSU · THE UNWRITING STROKE', windup: .35, recover: .3, guard: 'iframes', admin: true },
};
function ultActive() { return (!!game.ult.run || game.ult.buffT > 0) && game.mode !== 'duel'; }
function ultBuffed() { return game.ult.buffT > 0 && game.mode !== 'duel'; }
function ultReady() {
  if (game.mode === 'duel' || game.ult.run || game.ult.buffT > 0) return false;
  // the brush never waits — always charged, as its ledger entry promises
  return game.equipped === 'fudemaru' || game.ult.meter >= game.ult.max;
}
function addUlt(n) {
  // even a sealed meter fills — wanting is the engine of the cycle
  if (game.ult.run || game.ult.buffT > 0 || game.mode === 'duel') return;
  game.ult.meter = Math.min(game.ult.max, game.ult.meter + n);
  if (game.ult.meter >= game.ult.max)
    hintOnce('art', 'R — the meter is full: speak the blade’s 奥義 art');
}
function activateUlt() {
  if (game.state !== 'playing' || player.hp <= 0 || game.mode === 'duel') return;
  // the ART answers any full meter, from the first hour — what the first
  // rebirth opens is the INK SURGE that follows it (see updateSamurai)
  if (!ultReady()) return;
  // the art always ends on steel: a drawn bow snaps back to the blade
  if (player.stance === 'bow') { player.stance = 'sword'; player.bowDraw = null; }
  game.ult.meter = game.equipped === 'fudemaru' ? game.ult.max : 0;
  player.action = null;
  game.ult.run = makeUltRun(game.equipped, player);
  ultAnnounce(player, game.equipped);
}
// prune the neon ribbon; burn down the surge; pin the brush's meter
function updateUlt(dt) {
  ultTrail = ultTrail.filter(p => game.time - p.t < .22);
  if (game.ult.buffT > 0) {
    game.ult.buffT = Math.max(0, game.ult.buffT - dt);
    if (game.ult.buffT === 0) {   // the ink settles
      game.ult.meter = 0;
      setBanner('奥義 fades', 1.0);
      shake(4);
      ultFadeFX(player);
    }
  }
  // the color envelope: pigment bleeds in over .35s, drains out over .5s —
  // wings, ribbons and the paper veil all ride this one number
  const target = (game.ult.run || game.ult.buffT > 0) ? 1 : 0;
  game.ult.env = clamp((game.ult.env || 0) + (target ? dt / .35 : -dt / .5), 0, 1);
  if (game.equipped === 'fudemaru' && !game.ult.run && game.mode !== 'duel')
    game.ult.meter = game.ult.max;
}
// a hit during the windup shatters the art — most of the ink flows back
function ultWindupBroken() {
  game.ult.run = null;
  player.ultArmor = false; player.ultCounter = false;
  game.ult.meter = Math.min(game.ult.max, game.ult.meter + game.ult.max * .6);
  addText(player.x, player.y - 40, '奥義 broken!', RED, 14);
}

/* --- the shared framework --- */
function makeUltRun(blade, e) {
  const u = { blade, def: ULTS[blade], phase: 'windup', t: 0, s: {} };
  u.s.face = e.face;                       // the art commits to a line
  if (blade === 'kurogane') {              // Crow Fall marks its crater early
    u.s.tx = clamp(e.x + Math.cos(e.face) * 120, ARENA.x + 40, ARENA.x + ARENA.w - 40);
    u.s.ty = clamp(e.y + Math.sin(e.face) * 120, ARENA.y + 40, ARENA.y + ARENA.h - 40);
  }
  return u;
}
function ultAnnounce(e, blade) {
  const def = ULTS[blade], nz = weaponNeon(blade);
  if (game.mode === 'duel') addText(e.x, e.y - 44, '奥義 — ' + def.name, nz[0], 15);
  else setBanner('奥義 — ' + def.name, 1.9);
  // the kanji flourish — the art signs its name before it strikes
  particles.push({ kind: 'glyph', ch: def.kanji, color: nz[0],
    x: e.x, y: e.y - 30, vx: 0, vy: -26, t: 0, life: 1.0, size: 64, misted: false });
  for (let i = 0; i < 3; i++)
    particles.push({ kind: 'ring', x: e.x, y: e.y, t: 0, life: .5 + i * .12,
      color: nz[i % 2], r0: 12, r1: 170 + i * 70, w: 3.5 });
  // the color explosion: pigment bleeds outward from the caster like wet
  // ink hitting paper — the world turns colored from THIS point outward
  particles.push({ kind: 'bleed', x: e.x, y: e.y, t: 0, life: .5,
    color: nz[0], r0: 14, r1: 340 });
  particles.push({ kind: 'bleed', x: e.x, y: e.y, t: 0, life: .65,
    color: nz[1], r0: 8, r1: 220 });
  freeze(.1); shake(10);
  playSfx('surge');
}
// how far the world is into the color explosion right now (0..1) —
// deterministic (dt-integrated from sim state), read only by render/audio
function surgeSceneEnv() {
  if (game.mode === 'duel')
    return duel ? Math.max(duel.p1.surgeEnv || 0, duel.p2.surgeEnv || 0) : 0;
  return game.ult.env || 0;
}
// the surge fades: the pigment is swallowed back into the brush
function ultFadeFX(e) {
  inkSplat(e.x, e.y);
  particles.push({ kind: 'ring', x: e.x, y: e.y, t: 0, life: .45,
    color: 'rgba(43,35,32,.6)', r0: 150, r1: 8, w: 3 });   // a ring closing IN
  playSfx('vanish');
}
// one frame of an entity's ultimate; returns true when the run is spent
function runEntityUlt(u, A, dt) {
  const e = A.e;
  e.ultArmor = (u.phase === 'active' && u.def.guard === 'armor');
  e.ultCounter = (u.phase === 'active' && u.blade === 'tsukikage' && !u.s.fired);
  if (u.phase === 'active' && u.def.guard === 'iframes') e.iT = Math.max(e.iT, .06);
  u.t += dt;
  if (u.phase === 'windup') {
    if (u.t >= u.def.windup) {
      u.phase = 'active'; u.t = 0;
      const b = ULT_BEGIN[u.blade];
      if (b) b(u, A);
    }
  } else if (u.phase === 'active') {
    if (ULT_STEP[u.blade](u, A, dt)) { u.phase = 'recover'; u.t = 0; }
  } else if (u.t >= (u.s.recoverOverride || u.def.recover)) {
    e.ultArmor = false; e.ultCounter = false;
    return true;
  }
  return false;
}
/* actor adapters: the steppers speak one language in both modes */
function playerUltActor() {
  return {
    e: player, pvp: false,
    foes() { return enemies.filter(t => !t.dead && t.state !== 'spawn'); },
    dmg(mul) {
      return Math.max(1, Math.round((currentWeapon().dmg || 14) * upgDmgMul() * mul
        * rarityMult(game.equipped) * wxpMult(game.equipped)));
    },
    hit(t, dmg, ang, o) {
      o = o || {};
      game.combo++; game.comboPop = .25; game.lastComboAt = game.time;
      t.hurt(dmg, ang, o.stagger, o.posture != null ? o.posture : 14,
             player, game.equipped);
      if (o.knock && !t.dead) { t.kbx += Math.cos(ang) * o.knock; t.kby += Math.sin(ang) * o.knock; }
      sparks(t.x, t.y, ang, weaponNeon(game.equipped)[0], 8);
    },
    unwrite(t, ang) {   // the brush's privilege: lords burn, the rest vanish
      game.combo++; game.comboPop = .25; game.lastComboAt = game.time;
      if (t.isBoss) t.hurt(55, ang, .6, 40, player, 'fudemaru'); else forceKill(t);
    },
  };
}
function fighterUltActor(f) {
  return {
    e: f, pvp: true,
    foes() { return [f.foe]; },
    // PvP ult strokes run reduced — an art opens a round, it must not end one
    dmg(mul) { return Math.max(1, Math.round(WEAPONS[f.blade].dmg * 1.6 * .6 * mul)); },
    hit(t, dmg, ang, o) {
      o = o || {};
      if (t.dodgeInv) {   // every scripted stroke can be rolled through
        addText(t.x, t.y - 26, 'perfect dodge!', GOLD, 14);
        addFighterUlt(t, 10);
        return;
      }
      if (t.iT > 0) return;
      damageFighter(t, dmg, ang);
      if (o.stagger && t.hp > 0) t.staggerT = Math.max(t.staggerT, o.stagger);
      if (o.knock && t.hp > 0) { t.kbx += Math.cos(ang) * o.knock; t.kby += Math.sin(ang) * o.knock; }
    },
    unwrite(t, ang) { this.hit(t, 60, ang, { stagger: .8 }); },   // defensive only
  };
}
// deterministic nearest foe — no dice, lockstep-safe
function ultNearestFoe(A, x, y) {
  let best = null, bd = Infinity;
  for (const t of A.foes()) {
    const d = dist(x, y, t.x, t.y);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}
// how far a lane art may travel: walls close it, standing bamboo blocks it
function ultLaneLength(x, y, ang, max) {
  let L = max;
  const cs = Math.cos(ang), sn = Math.sin(ang);
  if (cs > .0001) L = Math.min(L, (ARENA.x + ARENA.w - 24 - x) / cs);
  if (cs < -.0001) L = Math.min(L, (ARENA.x + 24 - x) / cs);
  if (sn > .0001) L = Math.min(L, (ARENA.y + ARENA.h - 24 - y) / sn);
  if (sn < -.0001) L = Math.min(L, (ARENA.y + 24 - y) / sn);
  L = Math.max(40, L);
  for (const st of stalks) {
    if (st.dead) continue;
    const ax = st.x - x, ay = st.y - y;
    const along = ax * cs + ay * sn;
    const perp = Math.abs(-ax * sn + ay * cs);
    if (along > 20 && along < L && perp < st.r + 22) L = Math.max(40, along - 26);
  }
  return L;
}
// 月ノ答 — the counter bites: negate the blow, step through the moonlight,
// answer with one massive stroke. Shared by both modes via the actor.
function ultCounterTrigger(u, A, ang) {
  const e = A.e;
  u.s.fired = true;
  e.ultCounter = false;
  freeze(.12); shake(8);
  playSfx('parry');
  game.desatT = Math.max(game.desatT, .25);
  addText(e.x, e.y - 34, '月 answered!', '#aab4e8', 15);
  const t = ultNearestFoe(A, e.x, e.y);
  if (t && dist(e.x, e.y, t.x, t.y) < 340) {
    const a2 = Math.atan2(t.y - e.y, t.x - e.x);
    puff(e.x, e.y, 'rgba(129,140,248,.5)', 8);
    e.x = clamp(t.x + Math.cos(a2) * 46, ARENA.x + 20, ARENA.x + ARENA.w - 20);
    e.y = clamp(t.y + Math.sin(a2) * 46, ARENA.y + 20, ARENA.y + ARENA.h - 20);
    e.face = Math.atan2(t.y - e.y, t.x - e.x);
    slashTrail(e.x, e.y, 90, e.face - .8, e.face + .8, '#c7d2fe', 7);
    A.hit(t, A.dmg(5), e.face, { stagger: 1.0, posture: 45, knock: 300 });
  }
  u.phase = 'recover'; u.t = 0; u.s.recoverOverride = .35;
}

/* --- active-phase setup, per blade --- */
const ULT_BEGIN = {
  tetsu(u, A) {
    const e = A.e;
    u.s.L = ultLaneLength(e.x, e.y, u.s.face, 340);
    u.s.trav = 0; u.s.pause = 0; u.s.hitList = [];
    e.face = u.s.face;
  },
  ame(u) { u.s.strikes = 0; u.s.next = 0; },
  shirasagi(u) { u.s.stage = 0; u.s.t2 = 0; },
  botan(u) { u.s.ticks = 0; u.s.next = .05; },
  kurogane(u) { u.s.stage = 0; u.s.t2 = 0; },
  tsukikage(u) { u.s.fired = false; u.s.left = 1.2; },
  akaoni(u, A) { u.s.cleaves = 0; u.s.next = 0; A.e.face = u.s.face; },
  raiko(u, A) {
    const e = A.e;
    u.s.L = ultLaneLength(e.x, e.y, u.s.face, 900);   // shown by the telegraph too
    ultWaves.push({ x: e.x + Math.cos(u.s.face) * 20, y: e.y + Math.sin(u.s.face) * 20,
      ang: u.s.face, r: 46, speed: 480, dmg: A.dmg(2.5),
      pvp: A.pvp, owner: e, dead: false, hit: [] });
    boltFX(e.x - Math.cos(u.s.face) * 30, e.y - Math.sin(u.s.face) * 30,
           e.x + Math.cos(u.s.face) * 60, e.y + Math.sin(u.s.face) * 60);
    playSfx('bolt');
    shake(6);
  },
  fudemaru(u, A) {
    const e = A.e;
    u.s.dash = { t: 0, dur: .72, hits: 5, done: 0,
                 dx: Math.cos(u.s.face), dy: Math.sin(u.s.face) };
    inkSplat(e.x, e.y);
  },
};
/* --- the scripted sequences; return true when the active phase is done --- */
const ULT_STEP = {
  // 一閃 — sheathe, then a single flash down the lane; the cut lands late
  tetsu(u, A, dt) {
    const e = A.e, s = u.s, nz = weaponNeon('tetsu');
    if (s.trav < s.L) {
      const step = Math.min(1500 * dt, s.L - s.trav);
      e.x += Math.cos(s.face) * step; e.y += Math.sin(s.face) * step;
      s.trav += step;
      ultTrail.push({ x: e.x, y: e.y, t: game.time });
      for (const t of A.foes()) {
        if (s.hitList.includes(t)) continue;
        if (dist(e.x, e.y, t.x, t.y) < 42 + t.r) {
          s.hitList.push(t);
          A.hit(t, A.dmg(4), s.face, { stagger: .5, posture: 30, knock: 200 });
        }
      }
      return false;
    }
    s.pause += dt;
    if (!s.flashed && s.pause >= .2) {
      s.flashed = true;   // the swordsman stops; only then does the lane split
      slashTrail(e.x - Math.cos(s.face) * s.L * .5, e.y - Math.sin(s.face) * s.L * .5,
        s.L * .5, s.face - .05, s.face + .05, nz[0], 6);
      particles.push({ kind: 'ring', x: e.x, y: e.y, t: 0, life: .35,
        color: '#ffffff', r0: 8, r1: 60, w: 3 });
      freeze(.12); shake(8);
      playSfx('clash');
    }
    return s.pause >= .38;
  },
  // 村雨 — the rain visits three marks in a blink each
  ame(u, A, dt) {
    const e = A.e, s = u.s, nz = weaponNeon('ame');
    s.next -= dt;
    if (s.strikes >= 3) return s.next <= -.12;
    if (s.next <= 0) {
      const foes = A.foes();
      if (!foes.length) return true;
      const sorted = foes.slice().sort((a, b) =>
        dist(e.x, e.y, a.x, a.y) - dist(e.x, e.y, b.x, b.y));
      const t = sorted[s.strikes % sorted.length];
      puff(e.x, e.y, 'rgba(56,189,248,.45)', 6);
      const base = Math.atan2(e.y - t.y, e.x - t.x) + (s.strikes - 1) * 2.1;
      e.x = clamp(t.x + Math.cos(base) * 40, ARENA.x + 18, ARENA.x + ARENA.w - 18);
      e.y = clamp(t.y + Math.sin(base) * 40, ARENA.y + 18, ARENA.y + ARENA.h - 18);
      e.face = Math.atan2(t.y - e.y, t.x - e.x);
      ultTrail.push({ x: e.x, y: e.y, t: game.time });
      slashTrail(e.x, e.y, 60, e.face - .7, e.face + .7, nz[0], 5);
      for (let i = 0; i < 5; i++)
        particles.push({ kind: 'line', x: t.x + crand(-16, 16), y: t.y - crand(10, 40),
          vx: 0, vy: 210, t: 0, life: .25, color: 'rgba(56,189,248,.8)', w: 1.4 });
      A.hit(t, A.dmg(2), e.face, { posture: 13 });
      freeze(.05); shake(4);
      playSfx('whoosh');
      s.strikes++; s.next = .2;
    }
    return false;
  },
  // 鷺舞 — rising cut, weightless glide, diving finisher
  shirasagi(u, A, dt) {
    const e = A.e, s = u.s, nz = weaponNeon('shirasagi');
    s.t2 += dt;
    if (s.stage === 0) {
      if (!s.rose) {
        s.rose = true;
        for (const t of A.foes())
          if (dist(e.x, e.y, t.x, t.y) < 72 + t.r)
            A.hit(t, A.dmg(1.5), Math.atan2(t.y - e.y, t.x - e.x), { posture: 10, knock: 260 });
        particles.push({ kind: 'ring', x: e.x, y: e.y, t: 0, life: .4,
          color: 'rgba(252,250,244,.9)', r0: 12, r1: 90, w: 3 });
        playSfx('whoosh');
      }
      if (s.t2 >= .18) { s.stage = 1; s.t2 = 0; }
    } else if (s.stage === 1) {
      e.x += Math.cos(s.face) * 680 * dt;
      e.y += Math.sin(s.face) * 680 * dt;
      clampArena(e);
      ultTrail.push({ x: e.x, y: e.y - 18, t: game.time });
      if (Math.random() < dt * 30)   // shed quills — cosmetic dice only
        particles.push({ kind: 'petal', x: e.x, y: e.y - 16, vx: crand(-20, 20), vy: crand(10, 40),
          t: 0, life: .6, color: '#fcfaf4', rad: 2, spin: crand(0, TAU) });
      if (s.t2 >= .35) { s.stage = 2; s.t2 = 0; }
    } else {
      if (!s.dove) {
        s.dove = true;
        for (const t of A.foes())
          if (dist(e.x, e.y, t.x, t.y) < 95 + t.r)
            A.hit(t, A.dmg(3), Math.atan2(t.y - e.y, t.x - e.x), { stagger: .4, posture: 24, knock: 420 });
        particles.push({ kind: 'ring', x: e.x, y: e.y, t: 0, life: .5, color: nz[0], r0: 16, r1: 130, w: 4 });
        spawnPetals(e.x, e.y, 8);
        freeze(.1); shake(9);
        playSfx('taiko');
      }
      if (s.t2 >= .2) return true;
    }
    return false;
  },
  // 花吹雪 — a turning storm of petals; armored, never untouchable
  botan(u, A, dt) {
    const e = A.e, s = u.s, nz = weaponNeon('botan');
    s.next -= dt;
    e.face += 9 * dt;
    if (s.next <= 0 && s.ticks < 4) {
      s.ticks++; s.next = .3;
      for (const t of A.foes())
        if (dist(e.x, e.y, t.x, t.y) < 115 + t.r)
          A.hit(t, A.dmg(1.2), Math.atan2(t.y - e.y, t.x - e.x), { posture: 9, knock: 180 });
      spawnPetals(e.x, e.y, 12);
      particles.push({ kind: 'ring', x: e.x, y: e.y, t: 0, life: .35, color: nz[0], r0: 40, r1: 118, w: 3 });
      slashTrail(e.x, e.y, 110, e.face - 1.2, e.face + 1.2, nz[1], 5);
      shake(4); freeze(.03);
      playSfx('whoosh');
    }
    return s.ticks >= 4 && s.next <= 0;
  },
  // 鴉墜 — the crow climbs, then falls on the marked crater
  kurogane(u, A, dt) {
    const e = A.e, s = u.s, nz = weaponNeon('kurogane');
    s.t2 += dt;
    if (s.stage === 0) {
      if (s.t2 >= .32) {
        s.stage = 1; s.t2 = 0;
        e.x = s.tx; e.y = s.ty;
        for (const t of A.foes())
          if (dist(e.x, e.y, t.x, t.y) < 130 + t.r)
            A.hit(t, A.dmg(3), Math.atan2(t.y - e.y, t.x - e.x), { stagger: .6, posture: 40, knock: 520 });
        inkSplat(e.x, e.y);
        particles.push({ kind: 'ring', x: e.x, y: e.y, t: 0, life: .55, color: nz[0], r0: 20, r1: 190, w: 5 });
        particles.push({ kind: 'ring', x: e.x, y: e.y, t: 0, life: .4, color: 'rgba(43,35,32,.8)', r0: 12, r1: 140, w: 7 });
        freeze(.13); shake(13);
        playSfx('taiko');
      }
    } else {
      if (!s.waved && s.t2 >= .15) {   // the aftershock rolls further out
        s.waved = true;
        for (const t of A.foes()) {
          const d = dist(e.x, e.y, t.x, t.y);
          if (d >= 130 + t.r && d < 215 + t.r)
            A.hit(t, A.dmg(1), Math.atan2(t.y - e.y, t.x - e.x), { posture: 14, knock: 380 });
        }
        particles.push({ kind: 'ring', x: e.x, y: e.y, t: 0, life: .5,
          color: 'rgba(139,92,246,.6)', r0: 130, r1: 230, w: 4 });
        playSfx('rumble');
      }
      if (s.t2 >= .45) return true;
    }
    return false;
  },
  // 月ノ答 — a raised stance; strike it and be answered (see ultCounterTrigger)
  tsukikage(u, A, dt) {
    const e = A.e, s = u.s;
    if (s.fired) { s.t2 = (s.t2 || 0) + dt; return s.t2 >= .12; }
    s.left -= dt;
    if (s.left <= 0) {
      s.fired = true;
      for (const t of A.foes())
        if (inArc(e.x, e.y, e.face, 105 + t.r, 2.6, t.x, t.y, t.r))
          A.hit(t, A.dmg(1.5), Math.atan2(t.y - e.y, t.x - e.x), { posture: 14 });
      slashTrail(e.x, e.y, 100, e.face - 1.2, e.face + 1.2, '#c7d2fe', 6);
      playSfx('whoosh');
    }
    return false;
  },
  // 鬼車 — three advancing cleaves, each one a doorway slammed shut
  akaoni(u, A, dt) {
    const e = A.e, s = u.s, nz = weaponNeon('akaoni');
    s.next -= dt;
    if (s.cleaves >= 3) return s.next <= -.15;
    if (s.next <= 0) {
      s.cleaves++; s.next = .3;
      const t0 = ultNearestFoe(A, e.x, e.y);
      if (t0) e.face += clamp(angDiff(e.face, Math.atan2(t0.y - e.y, t0.x - e.x)), -.4, .4);
      e.x = clamp(e.x + Math.cos(e.face) * 62, ARENA.x + 20, ARENA.x + ARENA.w - 20);
      e.y = clamp(e.y + Math.sin(e.face) * 62, ARENA.y + 20, ARENA.y + ARENA.h - 20);
      for (const t of A.foes())
        if (inArc(e.x, e.y, e.face, 118 + t.r, 2.4, t.x, t.y, t.r))
          A.hit(t, A.dmg(1.7), Math.atan2(t.y - e.y, t.x - e.x), { stagger: .7, posture: 30, knock: 300 });
      slashTrail(e.x, e.y, 112, e.face - 1.1, e.face + 1.1, s.cleaves % 2 ? nz[0] : nz[1], 8);
      ultTrail.push({ x: e.x + Math.cos(e.face) * 90, y: e.y + Math.sin(e.face) * 90, t: game.time });
      freeze(.06); shake(7);
      playSfx('whoosh');
    }
    return false;
  },
  // 雷渡 — the crescent flies on its own; the caster only bows it out
  raiko(u, A, dt) { return u.t >= .25; },
  // 墨滅 — the brush's original art: the lunge and its five strokes,
  // now trailing ink the whole way. Still the flashiest thing in the game.
  fudemaru(u, A, dt) {
    const e = A.e, s = u.s;
    const dash = s.dash;
    dash.t += dt;
    e.x += dash.dx * 620 * dt;
    e.y += dash.dy * 620 * dt;
    clampArena(e);
    ultTrail.push({ x: e.x + dash.dx * 22, y: e.y + dash.dy * 22, t: game.time });
    if (Math.random() < dt * 60)   // ink rains off the bristles — cosmetic
      particles.push({ kind: 'dot', x: e.x + crand(-14, 14), y: e.y + crand(-14, 14),
        vx: crand(-30, 30), vy: crand(20, 80), t: 0, life: crand(.3, .6),
        color: 'rgba(43,35,32,.65)', rad: crand(1.5, 3.5) });
    // five slashes spaced evenly across the lunge — the original timing, kept
    while (dash.done < dash.hits &&
           dash.t >= dash.dur * (dash.done + 1) / (dash.hits + 1)) {
      ultBrushSlash(dash.done, A);
      dash.done++;
    }
    return dash.t >= dash.dur;
  },
};
// one flurry stroke of 墨滅 — a scripted arc independent of any action
function ultBrushSlash(i, A) {
  const e = A.e, nz = weaponNeon('fudemaru');
  const reach = 210, arc = Math.min(TAU, 2.4);
  const face = e.face + (i - 2) * .32;   // fan the strokes around the lunge
  e.face = face;
  for (let k = 0; k <= 4; k++) {         // write the sweep into the ribbon
    const a = face - .5 + k * .25;
    ultTrail.push({ x: e.x + Math.cos(a) * reach, y: e.y + Math.sin(a) * reach, t: game.time });
  }
  slashTrail(e.x, e.y, reach - 8, face - .5, face + .5, nz[1], 6);
  particles.push({ kind: 'glyph', ch: '墨', color: nz[i % 2],
    x: e.x + Math.cos(face) * 120, y: e.y + Math.sin(face) * 120,
    vx: 0, vy: -18, t: 0, life: .7, size: 34, misted: false });
  for (const t of A.foes()) {
    if (inArc(e.x, e.y, face, reach + 4, arc, t.x, t.y, t.r)) {
      const ang = Math.atan2(t.y - e.y, t.x - e.x);
      A.unwrite(t, ang);
      inkSplat(t.x, t.y);
      sparks(t.x, t.y, ang, nz[0], 8);
      freeze(.03);
    }
  }
  shake(5);
  playSfx('whoosh');
}
/* --- 雷渡 crescents: owner-aware, deterministic, blocked by bamboo --- */
let ultWaves = [];
function updateUltWaves(dt) {
  for (const w of ultWaves) {
    if (w.dead) continue;
    w.x += Math.cos(w.ang) * w.speed * dt;
    w.y += Math.sin(w.ang) * w.speed * dt;
    if (w.x < ARENA.x - 20 || w.x > ARENA.x + ARENA.w + 20 ||
        w.y < ARENA.y - 20 || w.y > ARENA.y + ARENA.h + 20) { w.dead = true; continue; }
    for (const st of stalks) {   // bamboo grounds the storm
      if (st.dead) continue;
      if (dist(w.x, w.y, st.x, st.y) < w.r * .7 + st.r) {
        st.hp -= 2;
        if (st.hp <= 0) { st.dead = true; puff(st.x, st.y, 'rgba(96,94,82,.7)', 10); }
        w.dead = true;
        sparks(st.x, st.y, w.ang, '#8fb4ff', 10, Math.PI);
        break;
      }
    }
    if (w.dead) continue;
    if (w.pvp) {
      const foe = w.owner.foe;
      if (foe && !w.hit.includes(foe) && dist(w.x, w.y, foe.x, foe.y) < w.r + foe.r) {
        w.hit.push(foe);
        if (foe.dodgeInv) { addText(foe.x, foe.y - 26, 'perfect dodge!', GOLD, 14); addFighterUlt(foe, 10); }
        else if (foe.iT <= 0) {
          damageFighter(foe, w.dmg, w.ang);
          if (foe.hp > 0) foe.staggerT = Math.max(foe.staggerT, .5);
        }
      }
    } else {
      for (const t of enemies) {
        if (t.dead || t.state === 'spawn' || w.hit.includes(t)) continue;
        if (dist(w.x, w.y, t.x, t.y) < w.r + t.r) {
          w.hit.push(t);
          t.hurt(w.dmg, w.ang, .45, 20, w.owner, 'raiko');
          boltFX(w.x, w.y, t.x, t.y);
        }
      }
    }
    if (Math.random() < dt * 30)   // crackle — cosmetic
      particles.push({ kind: 'line', x: w.x + crand(-w.r, w.r), y: w.y + crand(-w.r, w.r),
        vx: crand(-80, 80), vy: crand(-80, 80), t: 0, life: .12, color: '#9fc2ff', w: 1.4 });
  }
  ultWaves = ultWaves.filter(w => !w.dead);
}
/* --- windup telegraphs + stance visuals, drawn under the body ---
   Every shape that promises damage runs through teleRGBA so the
   colorblind palette holds in the ring as well as the yard.          */
function drawUltRun(u, e) {
  const s = u.s, nz = weaponNeon(u.blade);
  if (u.phase === 'windup') {
    const p = clamp(u.t / u.def.windup, 0, 1);
    ctx.save();
    if (u.blade === 'tetsu' || u.blade === 'raiko') {
      // lane arts: the full flight path, sharpening as it commits
      const L = ultLaneLength(e.x, e.y, s.face, u.blade === 'tetsu' ? 340 : 900);
      ctx.strokeStyle = teleRGBA(.18 + p * .5);
      ctx.lineWidth = p > .7 ? 3 : 1.6;
      ctx.setLineDash(p > .7 ? [] : [6, 7]);
      for (const off of [-30, 30]) {
        ctx.beginPath();
        ctx.moveTo(e.x - Math.sin(s.face) * off, e.y + Math.cos(s.face) * off);
        ctx.lineTo(e.x + Math.cos(s.face) * L - Math.sin(s.face) * off,
                   e.y + Math.sin(s.face) * L + Math.cos(s.face) * off);
        ctx.stroke();
      }
    } else if (u.blade === 'kurogane') {
      // the crater, marked and pulsing — the heaviest warning in the game
      const pulse = (Math.sin(game.time * 16) * .5 + .5) * .25;
      if (p > .55) {
        ctx.fillStyle = teleRGBA(.16 + pulse);
        ctx.beginPath(); ctx.arc(s.tx, s.ty, 130, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = teleRGBA(.35 + p * .5 + pulse);
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(s.tx, s.ty, 130 * (.5 + .5 * p), 0, TAU); ctx.stroke();
    } else if (u.blade === 'botan' || u.blade === 'ame') {
      const r = u.blade === 'botan' ? 115 : 60;
      if (p > .68 && u.blade === 'botan') {
        ctx.fillStyle = teleRGBA(.14);
        ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = teleRGBA(.3 + p * .5);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, r * (.55 + .45 * p), 0, TAU); ctx.stroke();
    } else if (u.blade === 'akaoni') {
      const pulse = (Math.sin(game.time * 16) * .5 + .5) * .25;
      ctx.strokeStyle = teleRGBA(.3 + p * .45 + pulse);
      for (let i = 0; i < 3; i++) {
        ctx.lineWidth = 3 - i * .6;
        ctx.beginPath();
        ctx.arc(e.x + Math.cos(s.face) * i * 62, e.y + Math.sin(s.face) * i * 62,
                118 * (.5 + .5 * p), s.face - 1.2, s.face + 1.2);
        ctx.stroke();
      }
    } else if (u.blade === 'shirasagi') {
      ctx.strokeStyle = teleRGBA(.3 + p * .4);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, 72 * (.5 + .5 * p), 0, TAU); ctx.stroke();
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + Math.cos(s.face) * 240, e.y + Math.sin(s.face) * 240);
      ctx.stroke();
    } else if (u.blade === 'fudemaru') {
      ctx.strokeStyle = teleRGBA(.35 + p * .45);
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + Math.cos(s.face) * 460, e.y + Math.sin(s.face) * 460);
      ctx.stroke();
    }
    // tsukikage's windup is a breath — its stance below is the telegraph
    ctx.restore();
    ctx.setLineDash([]);
  } else if (u.phase === 'active' && u.blade === 'tsukikage' && !s.fired) {
    // the raised counter — a crescent moon anyone can read (and refuse)
    const br = .55 + Math.sin(game.time * 9) * .2;
    ctx.save();
    ctx.strokeStyle = `rgba(170,180,232,${br})`;
    ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 13, e.face - 1.4, e.face + 1.4); ctx.stroke();
    ctx.strokeStyle = teleRGBA(.4 * br);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 18, e.face - 1.1, e.face + 1.1); ctx.stroke();
    ctx.restore();
  } else if (u.phase === 'recover') {
    // spent — a gray ring of stillness; this is the punish window
    ctx.save();
    ctx.strokeStyle = 'rgba(43,35,32,.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 6]);
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 10, 0, TAU); ctx.stroke();
    ctx.restore();
    ctx.setLineDash([]);
  }
}
function drawNeonRibbon(trail, nz, env) {   // layered neon ribbon over a point path
  if (trail.length < 2) return;
  if (env !== undefined && env <= .01) return;
  const all = trail.map(p =>
    ({ x: p.x, y: p.y, a: clamp(1 - (game.time - p.t) / .22, 0, 1) }));
  // split where the path jumps (roll → slash fan) so no seam bridges them
  const segs = [];
  let cur = [all[0]];
  for (let i = 1; i < all.length; i++) {
    if (Math.hypot(all[i].x - cur[cur.length - 1].x,
                   all[i].y - cur[cur.length - 1].y) > 70) {
      if (cur.length > 1) segs.push(cur);
      cur = [];
    }
    cur.push(all[i]);
  }
  if (cur.length > 1) segs.push(cur);
  for (const s of segs) drawRibbonSeg(s, nz, env === undefined ? 1 : env);
}
function drawRibbonSeg(pts, nz, env) {
  env = env === undefined ? 1 : env;
  // ribbon polygon: offset along local normals, width tapers with age
  const left = [], right = [];
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(pts.length - 1, i + 1)];
    const dx = p1.x - p0.x, dy = p1.y - p0.y;
    const l = Math.hypot(dx, dy) || 1;
    const w = 13 * pts[i].a;
    left.push({ x: pts[i].x - dy / l * w, y: pts[i].y + dx / l * w });
    right.push({ x: pts[i].x + dy / l * w, y: pts[i].y - dx / l * w });
  }
  const ribbon = () => {
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
    ctx.closePath();
  };
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowBlur = 35;
  ctx.shadowColor = nz[0];
  ctx.globalAlpha = .5 * env; ctx.fillStyle = nz[0];
  ribbon(); ctx.fill();
  ctx.shadowColor = nz[1];
  ctx.globalAlpha = .4 * env; ctx.fillStyle = nz[1];
  ribbon(); ctx.fill();
  // razor-sharp solid white core along the centerline
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowBlur = 0;
  ctx.globalAlpha = .95 * env;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.restore();
  // never leak glow state into the rest of the frame
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
}
// neon roll — dashed motion streaks behind a surging roll, in the blade's temper
function neonRollStreaks(x, y, dx, dy, r, nz) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.setLineDash([9, 7]);
  ctx.shadowBlur = 16;
  for (let i = -1; i <= 1; i++) {   // three dashes fanned across the roll line
    const px = -dy * i * 8, py = dx * i * 8;
    ctx.shadowColor = i === 0 ? nz[0] : nz[1];
    ctx.strokeStyle = i === 0 ? nz[0] : nz[1];
    ctx.lineWidth = i === 0 ? 3.5 : 2.2;
    ctx.globalAlpha = i === 0 ? .9 : .6;
    ctx.beginPath();
    ctx.moveTo(x - dx * (r + 2) + px, y - dy * (r + 2) + py);
    ctx.lineTo(x - dx * (r + 26 + Math.abs(i) * 8) + px,
               y - dy * (r + 26 + Math.abs(i) * 8) + py);
    ctx.stroke();
  }
  // razor white core dash down the middle
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6; ctx.globalAlpha = .95;
  ctx.setLineDash([7, 9]);
  ctx.beginPath();
  ctx.moveTo(x - dx * (r + 4), y - dy * (r + 4));
  ctx.lineTo(x - dx * (r + 22), y - dy * (r + 22));
  ctx.stroke();
  // restore() alone: the callers' hurt-blink alpha must survive this
  ctx.restore();
}
/* 奥義 wings — raid-boss plumage, one silhouette per blade. Pure spectacle:
   drawn behind the body, and nothing about them touches play. */
let wingEnvMul = 1;   // set per-call by drawUltWings; read by wingStroke
function drawUltWings(x, y, face, bladeId, r, env) {
  wingEnvMul = env === undefined ? 1 : env;
  if (wingEnvMul <= .01) return;
  const nz = weaponNeon(bladeId);
  const flap = Math.sin(game.time * 2.8) * .13 + Math.sin(game.time * 7.3) * .04;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(face + Math.PI);            // they sprout from the back
  ctx.scale(.6 + .4 * wingEnvMul, .6 + .4 * wingEnvMul);   // unfurl with the bleed
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(1, side);                  // mirror the second wing
    ctx.rotate(-.5 - flap);              // resting sweep + slow flap
    drawWing(bladeId, nz, r);
    ctx.restore();
  }
  ctx.restore();
}
// stroke the current path as one glowing wing member
function wingStroke(color, w, alpha, blur) {
  ctx.globalCompositeOperation = 'lighter';
  ctx.shadowBlur = blur; ctx.shadowColor = color;
  ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.globalAlpha = alpha * wingEnvMul;
  ctx.stroke();
}
function drawWing(bladeId, nz, r) {
  const R = r + 4;                       // root sits just off the body
  if (bladeId === 'tetsu') {
    // 鉄 — a fan of plain straight blades, an armory unsheathed
    for (let i = 0; i < 4; i++) {
      const a = -.05 - i * .24, L = R + 42 - i * 7;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R);
      ctx.lineTo(Math.cos(a) * L, Math.sin(a) * L);
      wingStroke(nz[i % 2], 3, .55, 14);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (R + 4), Math.sin(a) * (R + 4));
      ctx.lineTo(Math.cos(a) * (L - 3), Math.sin(a) * (L - 3));
      wingStroke('#ffffff', 1, .8, 0);
    }
  } else if (bladeId === 'ame') {
    // 雨 — sheets of rain swept back off the shoulders
    for (let i = 0; i < 6; i++) {
      const a = -.02 - i * .15, L = R + 40 - i * 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (R + i * 2), Math.sin(a) * (R + i * 2));
      ctx.lineTo(Math.cos(a) * L, Math.sin(a) * L);
      wingStroke(nz[i % 2], 1.4, .6, 10);
    }
  } else if (bladeId === 'shirasagi') {
    // 白鷺 — long heron quills, each a curved feather
    for (let i = 0; i < 5; i++) {
      const a = -.05 - i * .2, L = R + 44 - i * 5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R);
      ctx.quadraticCurveTo(Math.cos(a - .28) * L * .6, Math.sin(a - .28) * L * .6,
                           Math.cos(a) * L, Math.sin(a) * L);
      wingStroke(i % 2 ? nz[1] : '#ffffff', 2.2, .6, 12);
    }
  } else if (bladeId === 'botan') {
    // 牡丹 — moth wings of layered petals
    for (let i = 0; i < 3; i++) {
      const a = -.25 - i * .3;
      const d = R + 16 + i * 3, rx = 17 - i * 3, ry = 8 - i * 1.5;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, rx, ry, a, 0, TAU);
      wingStroke(nz[i % 2], 1.8, .55, 12);
      ctx.globalAlpha = .12; ctx.fillStyle = nz[i % 2]; ctx.fill();
    }
  } else if (bladeId === 'kurogane') {
    // 黒鉄 — the crow's silhouette, ink-dark under a violet rim
    ctx.beginPath();
    ctx.moveTo(R, 0);
    ctx.lineTo(R + 18, -10); ctx.lineTo(R + 40, -8);
    ctx.lineTo(R + 26, -2); ctx.lineTo(R + 46, 4);
    ctx.lineTo(R + 24, 7); ctx.lineTo(R + 34, 16);
    ctx.lineTo(R + 10, 10);
    ctx.closePath();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = .55; ctx.fillStyle = '#14100d'; ctx.fill();
    wingStroke(nz[0], 1.6, .7, 12);
  } else if (bladeId === 'tsukikage') {
    // 月影 — twin crescent moons hanging off the shoulders
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, R + 14 + i * 12, -.9, .35);
      wingStroke(nz[i % 2], 2.6 - i * .8, .6, 13);
    }
    ctx.beginPath();
    ctx.arc(0, 0, R + 20, -.75, .2);
    wingStroke('#ffffff', .9, .8, 0);
  } else if (bladeId === 'akaoni') {
    // 赤鬼 — the demon's membrane, three clawed fingers
    ctx.beginPath();
    ctx.moveTo(R, 0);
    ctx.lineTo(R + 20, -16);
    ctx.quadraticCurveTo(R + 26, -4, R + 44, -10);
    ctx.quadraticCurveTo(R + 34, 2, R + 48, 6);
    ctx.quadraticCurveTo(R + 28, 8, R + 30, 20);
    ctx.quadraticCurveTo(R + 12, 12, R, 6);
    ctx.closePath();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = .4; ctx.fillStyle = '#3a0d0a'; ctx.fill();
    wingStroke(nz[0], 1.8, .75, 14);
  } else if (bladeId === 'raiko') {
    // 雷光 — wings of forked lightning
    for (let i = 0; i < 3; i++) {
      const a = -.1 - i * .3;
      let px = Math.cos(a) * R, py = Math.sin(a) * R;
      ctx.beginPath();
      ctx.moveTo(px, py);
      for (let s = 1; s <= 3; s++) {
        px += Math.cos(a) * 13 - Math.sin(a) * (s % 2 ? 5 : -5);
        py += Math.sin(a) * 13 + Math.cos(a) * (s % 2 ? 5 : -5);
        ctx.lineTo(px, py);
      }
      wingStroke(i === 1 ? '#ffffff' : nz[i % 2], 1.8, .7, 13);
    }
  } else {
    // 筆 — two broad ink strokes, the brush's own calligraphy
    for (let i = 0; i < 2; i++) {
      const a = -.15 - i * .4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R);
      ctx.quadraticCurveTo(Math.cos(a - .3) * (R + 26), Math.sin(a - .3) * (R + 26),
                           Math.cos(a) * (R + 44), Math.sin(a) * (R + 44));
      wingStroke(nz[i % 2], 4 - i * 1.5, .55, 14);
    }
  }
}

