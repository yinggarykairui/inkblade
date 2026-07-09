/* ---------- player ----------
   COUCH CO-OP (2026-07-08): the samurai kit is parametrized over an
   entity `pl`. P1 is the classic `player` (save-backed progression,
   charms, kyudo, ults, mouse aim). P2 (`p2`) exists only in co-op
   infinite/rush: duel-style RAW stats — any blade/bow, no progression,
   no 奥義 — driven by arrows + U/I/O/P/, . The solo game runs the same
   single-entity path it always did.                                   */
const player = {
  x: W / 2, y: H / 2, r: 13,
  vx: 0, vy: 0, kbx: 0, kby: 0,
  face: 0,                 // radians; default facing right
  hp: 100, maxHp: 100,
  st: 100, maxSt: 100,
  speed: 235,
  action: null,            // {type:'attack'|'dodge', ...}
  iT: 0,                   // hurt invincibility timer
  dodgeInv: false,         // invincible via roll frames
  dodgeRecoverT: 0,        // punishable window after a roll
  flashT: 0, regenDelay: 0,
  swingDir: 1, attackId: 0,
  lastDodgeStart: -99,
  vHeld: false, vDownAt: 0,
  riposteT: 0,             // open window after a parry: next swing hits 1.5x
  stance: 'sword',         // 'sword' | 'bow' — Q toggles, with a commitment lock
  bowDraw: null,           // {t} while the string is bent
  bowLatch: false,         // the attack key must lift before the next draw
  ultArmor: false,         // scripted-ultimate armor: hits land but don't interrupt
  ultCounter: false,       // Tsukikage's counter-stance is up
  attackBuf: 0, dodgeBuf: 0, parryBuf: 0,
  downed: false,
};
let p2 = null;   // the second blade — created by startRun when co-op is chosen

const ATK = { startup: .13, active: .10, recover: .24, reach: 60, arc: 2.3, dmg: 12, cost: 18 };
const DODGE = { dur: .34, invStart: .02, invEnd: .25, speed: 560, cost: 26, recover: .14 };
const PARRY = { active: .13, recover: .27, cost: 10 };

/* ---- co-op roster helpers — the world asks these, never `player` ---- */
function allPlayers() { const out = [player]; if (p2) out.push(p2); return out; }
function alivePlayers() {
  return allPlayers().filter(P => P.hp > 0 && !P.downed);
}
function nearestPlayerTo(x, y) {
  const list = alivePlayers();
  if (!list.length) return player;
  let best = list[0], bd = Infinity;
  for (const P of list) {
    const d = dist(x, y, P.x, P.y);
    if (d < bd) { bd = d; best = P; }
  }
  return best;
}
// which blade / bow an entity swings — P1 reads the save, P2 its picks
function eqOf(pl) { return pl.p2 ? pl.equipped : game.equipped; }
function wpnOf(pl) { return WEAPONS[eqOf(pl)] || WEAPONS.tetsu; }
function bowOf(pl) { return pl.p2 ? (BOWS[pl.bow] || BOWS.shortbow) : currentBow(); }
// per-entity blade rhythm — P1's rides game state (HUD), P2 keeps its own
function stacksOf(pl) { return pl.p2 ? (pl.ameStacks || 0) : game.ameStacks; }
function setStacks(pl, v) { if (pl.p2) pl.ameStacks = v; else game.ameStacks = v; }
function lastHurtOf(pl) { return pl.p2 ? (pl.lastHurtAt == null ? -99 : pl.lastHurtAt) : game.lastHurtAt; }

// run-scoped blessing check (shrines populate game.blessings).
// BLESSINGS STACK (2026-07-09): taking the same blessing again deepens it
// to tier II, then III — game.blessings simply holds duplicates, and every
// effect site reads its tier through blessVal(id, t1, t2, t3).
function hasBless(id) { return !!(game.blessings && game.blessings.includes(id)); }
function blessCount(id) {
  if (!game.blessings) return 0;
  let n = 0;
  for (const b of game.blessings) if (b === id) n++;
  return n;
}
function blessVal(id, v1, v2, v3) {
  const n = blessCount(id);
  return n >= 3 ? v3 : n === 2 ? v2 : n === 1 ? v1 : 0;
}
// equipped-charm check — charms never apply in duels.
// Cycle 6's Twin Charms opens a second slot (save.charm2).
function charmed(id) {
  if (game.mode === 'duel') return false;
  return save.charm === id || (rebirthLevel() >= 6 && save.charm2 === id);
}

function samuraiParryActive(pl) {
  const a = pl.action;
  // 虚 hollow lungs steady no guard — the window shrinks to half
  return !!(a && a.type === 'parry' &&
            a.t <= PARRY.active * (pl.hollowT > 0 ? .5 : 1));
}
function playerParryActive() { return samuraiParryActive(player); }
function startParryFor(pl) {
  if (pl.st < PARRY.cost) {
    addText(pl.x, pl.y - 24, 'exhausted!', RED, 13);
    return;
  }
  pl.st = Math.max(0, pl.st - PARRY.cost);
  pl.regenDelay = .5;
  pl.action = { type: 'parry', t: 0 };
  pl.lastParryStart = game.time;
  // reactive-parry bookkeeping for the adaptive layer (P1 teaches it)
  if (!pl.p2 && enemies.some(e => !e.dead && (e.state === 'windup' || e.state === 'aim')))
    adapt.windupParries++;
}
function startParry() { startParryFor(player); }
// every perfect dodge funnels through here: adaptive layer, stats, blessings
function onPerfectDodge(pl) {
  pl = pl || player;
  if (!pl.p2) {
    adapt.perfects++;
    save.stats.perfectDodges++;
    addUlt(10);   // a clean read feeds the 奥義 meter
    award('firstPerfect');
    // a landed roll earns the next lesson: the parry
    hintOnce('parry', 'C — a parry as the blow lands turns it aside and opens a riposte');
  }
  addText(pl.x, pl.y - 26, 'perfect dodge!', GOLD, 14);
  const mendV = blessVal('mend', 6, 10, 14);
  if (mendV) pl.hp = Math.min(pl.maxHp, pl.hp + mendV);
}

function resetPlayer() {
  // permanent training tiers set the base statline for every run;
  // The Glass curse halves what the training built
  const frail = game.curses.includes('frail');
  Object.assign(player, {
    x: W / 2, y: H / 2, vx: 0, vy: 0, kbx: 0, kby: 0, face: 0,
    maxHp: Math.max(10, Math.round((upgMaxHp() + tombHp() + 10 * rebirthLevel())
                                   * rebirthMult() * (frail ? .5 : 1))),
    maxSt: upgMaxSt(), speed: upgSpeed(),
    action: null, iT: 0, riposteT: 0,
    dodgeInv: false, dodgeRecoverT: 0, flashT: 0, regenDelay: 0,
    lastDodgeStart: -99, vHeld: false,
    stance: 'sword', bowDraw: null, bowLatch: false,
    ultArmor: false, ultCounter: false,
    hollowT: 0, hollowSpent: false,   // 虚 — the price of an empty chest
    attackBuf: 0, dodgeBuf: 0, parryBuf: 0,
    downed: false,
    netCtl: null,   // online co-op re-arms this after startRun
  });
  player.hp = player.maxHp; player.st = player.maxSt;
  player.x = ARENA.x + ARENA.w / 2; player.y = ARENA.y + ARENA.h / 2;
}
// the second blade: duel-style raw — any arm, no progression, no 奥義
function makeP2(bladeId, bowId) {
  const frail = game.curses.includes('frail');
  p2 = {
    p2: true, r: 13,
    x: ARENA.x + ARENA.w / 2 + 60, y: ARENA.y + ARENA.h / 2,
    vx: 0, vy: 0, kbx: 0, kby: 0, face: Math.PI,
    maxHp: Math.max(10, Math.round(100 * (frail ? .5 : 1))),
    hp: 100, maxSt: 100, st: 100, speed: 235,
    equipped: WEAPONS[bladeId] && !WEAPONS[bladeId].admin ? bladeId : 'tetsu',
    bow: BOWS[bowId] ? bowId : 'shortbow',
    action: null, iT: 0, riposteT: 0,
    dodgeInv: false, dodgeRecoverT: 0, flashT: 0, regenDelay: 0,
    lastDodgeStart: -99, lastParryStart: -99, lastHurtAt: -99,
    swingDir: 1, attackId: 0, ameStacks: 0,
    resolve: 0,     // 志 — run-scoped: each fallen lord steels the guest blade
    stance: 'sword', bowDraw: null, bowLatch: false,
    ultArmor: false, ultCounter: false,
    hollowT: 0, hollowSpent: false,
    attackBuf: 0, dodgeBuf: 0, parryBuf: 0,
    downed: false, meditating: false,
    netCtl: null,   // online co-op re-arms this after startRun
  };
  p2.hp = p2.maxHp;
  return p2;
}
function refreshPlayerStats() {  // after buying training mid-session
  const hpFrac = player.hp / player.maxHp, stFrac = player.st / player.maxSt;
  // The Glass holds through the whole run — mid-run training can't shed it
  const frail = game.curses.includes('frail');
  player.maxHp = Math.round((upgMaxHp() + tombHp() + 10 * rebirthLevel())
                            * rebirthMult() * (frail ? .5 : 1));
  player.maxSt = upgMaxSt(); player.speed = upgSpeed();
  player.hp = Math.round(player.maxHp * Math.max(hpFrac, 0));
  player.st = player.maxSt * stFrac;
}

function playerExhausted() { return player.st <= 0.01; }
function exhaustedOf(pl) { return pl.st <= 0.01; }

function startAttackFor(pl) {
  const wpn = wpnOf(pl);
  // keyboard aim is eight-spoked — the blade forgives. The swing leans
  // toward the nearest foe within a natural turn of the wrist (~55°)
  // and honest striking range. PvE only: duel fighters aim themselves,
  // and nothing here draws from unseeded chance. A mouse aims truly —
  // when the cursor holds the wrist, the blade obeys it exactly.
  if (game.mode !== 'duel' && !(!pl.p2 && mouseAimOn())) {
    let best = null, bestScore = 1e9;
    for (const e of enemies) {
      if (e.dead || e.state === 'spawn') continue;
      const d = dist(pl.x, pl.y, e.x, e.y);
      if (d - e.r > wpn.reach * 1.7) continue;
      const off = Math.abs(angDiff(pl.face,
        Math.atan2(e.y - pl.y, e.x - pl.x)));
      if (off > .95) continue;
      const score = d + off * 60;   // near and in front beats merely near
      if (score < bestScore) { bestScore = score; best = e; }
    }
    if (best) pl.face = Math.atan2(best.y - pl.y, best.x - pl.x);
  }
  // 奥義 INK SURGE: once the art has opened, the blade overflows (P1 only)
  const surge = !pl.p2 && ultBuffed();
  // The Hollow curse: the lungs never fill — every swing is a winded swing
  const weak = exhaustedOf(pl) || game.curses.includes('winded');
  pl.st = Math.max(0, pl.st - wpn.stCost);
  pl.regenDelay = .6;
  let m = (weak ? 1.65 : 1) * wpn.spdMul;
  // Ame: rhythm stacks quicken successive clean swings
  if (wpn.id === 'ame') m *= 1 - .06 * stacksOf(pl);
  // dodge-into-attack window — Shirasagi flow / Raiko charge
  const sinceDodge = game.time - pl.lastDodgeStart;
  const flowWin = DODGE.dur + ((wpn.id === 'shirasagi' && !pl.p2 && isMastered('shirasagi')) ? .75 : .5);
  const dodgeFlow = sinceDodge > 0 && sinceDodge < flowWin;
  const extended = wpn.id === 'shirasagi' && dodgeFlow;
  const charged = wpn.id === 'raiko' && dodgeFlow;
  // the tomb ADDS attack — truly flat, added AFTER the vertical multipliers
  // so a step is always worth its face and never rides rarity/temper/surge;
  // rebirth is the only exponential. The second blade is duel-raw: the
  // steel alone, no ledger behind it
  const edgeMul = 1 + blessVal('edge', .10, .18, .26);
  let dmg = pl.p2
    ? Math.round(wpn.dmg * (weak ? .55 : 1) * (charged ? 1.5 : 1)
                 * edgeMul
                 * (1 + .15 * (pl.resolve || 0)))   // 志 the lords remember

    : Math.round((wpn.dmg + rebirthLevel())
                 * upgDmgMul() * playerLvlMult() * (weak ? .55 : 1)
                 * (charged ? 1.5 : 1)
                 * (charmed('oni') ? 1.2 : 1) * edgeMul
                 * (surge ? 2 : 1) * rebirthMult()
                 * rarityMult(wpn.id) * wxpMult(wpn.id))    // the vertical tracks
      + tombAtk();                                          // the flat one
  let riposte = false;
  if (pl.riposteT > 0) {       // the parry's answer — one empowered stroke
    riposte = true;
    pl.riposteT = 0;
    dmg = Math.round(dmg * 1.5);
    addText(pl.x, pl.y - 28, 'riposte!', GOLD, 13);
    sparks(pl.x, pl.y, pl.face, PAL.pigment.imperialGold, 5, .7);
  }
  pl.action = {
    type: 'attack', t: 0, weak, wpn, charged, extended, riposte,
    startup: ATK.startup * m,
    active: ATK.active * m * (extended ? 1.7 : 1),
    recover: ATK.recover * m,
    dmg,
    reach: wpn.reach * (surge ? 3 : 1),
    arc: wpn.arc * (charged ? 1.35 : 1) * (surge ? 1.3 : 1),
    landed: false, id: ++pl.attackId, dir: pl.swingDir,
  };
  pl.swingDir *= -1;
  if (!pl.p2) adapt.swings++;
  playSfx('whoosh');
  if (charged) {
    // white-hot, not blue — pigment stays behind the ultimate gate
    addText(pl.x, pl.y - 28, 'charged!', 'rgba(43,35,32,.75)', 13);
    sparks(pl.x, pl.y, pl.face, 'rgba(240,240,240,.95)', 6, Math.PI);
  }
  if (extended) addText(pl.x, pl.y - 28, 'flow', 'rgba(43,35,32,.55)', 12);
}
function startAttack() { startAttackFor(player); }
function startDodgeFor(pl, mx, my) {
  if (game.curses.includes('noroll')) {  // The Rooted — the curse holds your feet
    addText(pl.x, pl.y - 24, '呪 rooted!', RED, 13);
    return;
  }
  if (pl.st < 10) {                 // too tired to roll
    addText(pl.x, pl.y - 24, 'exhausted!', RED, 13);
    return;
  }
  pl.st = Math.max(0, pl.st - DODGE.cost);
  pl.regenDelay = .6;
  let dx = mx, dy = my;
  if (!dx && !dy) { dx = Math.cos(pl.face); dy = Math.sin(pl.face); }
  const l = Math.hypot(dx, dy) || 1;
  pl.action = { type: 'dodge', t: 0, dx: dx / l, dy: dy / l };
  pl.face = Math.atan2(dy, dx);
  pl.lastDodgeStart = game.time;
  playSfx('dodge');
  // reactive-dodge bookkeeping for the adaptive layer
  if (!pl.p2 && enemies.some(e => !e.dead && (e.state === 'windup' || e.state === 'aim')))
    adapt.windupDodges++;
  puff(pl.x, pl.y, 'rgba(43,35,32,.5)', 4);
}
function startDodge(mx, my) { startDodgeFor(player, mx, my); }

function damageSamurai(pl, dmg, ang, heavy, srcName) {
  if (pl.downed || pl.iT > 0 || pl.dodgeInv || game.state !== 'playing') return false;
  // 月ノ答 — the counter-stance drinks the blow and answers it (P1's art)
  if (pl.ultCounter && game.ult.run && !pl.p2) {
    ultCounterTrigger(game.ult.run, playerUltActor(), ang); return false;
  }
  if (!pl.p2 && charmed('oni')) dmg = Math.round(dmg * 1.2);   // the Oni exacts its price
  if (pl.hollowT > 0) dmg = Math.round(dmg * 1.25);   // 虚 an empty chest guards nothing
  // telegraph fairness holds even against the deep curve: no single blow
  // takes more than 40% of a samurai's health — three mistakes, never one
  dmg = Math.min(dmg, Math.max(10, Math.round(pl.maxHp * .4)));
  // remember the blow — the death scroll names what ended the trial
  game.lastHitDesc = { name: srcName || 'a blow', dmg };
  pl.hp -= dmg;
  game.levelDamageTaken += dmg;
  pl.iT = .9; pl.flashT = .3;
  playSfx('hurt');
  // an ultimate stuffed in its windup dies — but refunds most of the ink
  if (!pl.p2 && game.ult.run && game.ult.run.phase === 'windup') ultWindupBroken();
  if (pl.ultArmor) {   // scripted armor: the blow lands, the art continues
    pl.kbx += Math.cos(ang) * 80; pl.kby += Math.sin(ang) * 80;
  } else {
    pl.kbx += Math.cos(ang) * (heavy ? 420 : 260);
    pl.kby += Math.sin(ang) * (heavy ? 420 : 260);
    pl.action = null;   // hits interrupt whatever the samurai was doing
    pl.bowDraw = null;  // the string slips
  }
  game.combo = 0;
  setStacks(pl, 0);
  // Botan's clean state forgives chip scratches — only a real wound
  // (>5% of max health) resets the 2s clean-hit clock
  if (dmg > pl.maxHp * .05) {
    if (pl.p2) pl.lastHurtAt = game.time; else game.lastHurtAt = game.time;
  }
  if (!pl.p2) adapt.taken++;
  shake(heavy ? 8 : 4.5); freeze(heavy ? .09 : .05);
  sparks(pl.x, pl.y, ang, RED, 8);
  addText(pl.x, pl.y - 26, '-' + fmtNum(dmg), RED, 16);
  if (pl.hp <= 0) {
    // Omamori: the charm takes the blow that would have ended the trial
    if (!pl.p2 && charmed('omamori') && !game.omamoriUsed) {
      game.omamoriUsed = true;
      pl.hp = 1;
      pl.iT = 1.6;
      game.flashT = .25;
      addText(pl.x, pl.y - 44, '守 the charm shatters', GOLD, 15);
      particles.push({ kind: 'ring', x: pl.x, y: pl.y, t: 0, life: .6,
        color: 'rgba(168,132,58,.7)', r0: 12, r1: 160, w: 3 });
      freeze(.12); shake(6);
      playSfx('parry');
    } else if (game.coop && alivePlayers().some(P => P !== pl)) {
      // co-op: the fallen kneels — clear the wave and they stand again
      pl.hp = 0;
      pl.downed = true;
      pl.action = null; pl.bowDraw = null; pl.meditating = false;
      addText(pl.x, pl.y - 40, '倒 fallen — clear the wave', RED, 14);
      inkSplat(pl.x, pl.y);
      setBanner('a blade falls — finish the wave to raise them', 2.2);
    } else {
      pl.hp = 0;
      gameOver();
    }
  }
  return true;
}
function damagePlayer(dmg, ang, heavy, srcName) {
  return damageSamurai(player, dmg, ang, heavy, srcName);
}
// wave cleared: the fallen stand back up at half strength
function reviveDowned() {
  for (const P of allPlayers()) {
    if (!P.downed) continue;
    P.downed = false;
    P.hp = Math.max(1, Math.round(P.maxHp * .5));
    P.st = P.maxSt;
    P.iT = 1.2;
    addText(P.x, P.y - 30, '再 they stand again', GOLD, 14);
    particles.push({ kind: 'ring', x: P.x, y: P.y, t: 0, life: .6,
      color: 'rgba(168,132,58,.7)', r0: 10, r1: 90, w: 3 });
    playSfx('bless');
  }
}
// does any samurai hold a bent bow? (enemies press a drawn archer)
function playerDrawing() {
  return allPlayers().some(P => !P.downed && P.stance === 'bow' && !!P.bowDraw);
}

/* per-entity input — P1 owns WASD (and arrows when alone), touch and the
   mouse; P2 owns the arrows and the duel-style U/I/O/P/, row */
function gatherInput(pl) {
  let mx, my, held, med;
  if (pl.netCtl) {
    // 網 online co-op: both blades are fed exclusively by the tick-stamped
    // bitmask — local keys never touch an entity directly
    return { mx: pl.netCtl.mx || 0, my: pl.netCtl.my || 0,
             held: !!pl.netCtl.atkHeld, med: !!pl.netCtl.med };
  }
  if (pl.p2) {
    mx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
    my = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);
    held = !!keys.u;
    med = !!keys[','];
  } else if (game.coop) {
    mx = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
    my = (keys.s ? 1 : 0) - (keys.w ? 1 : 0);
    if (touch.active) { mx = touch.mx; my = touch.my; }
    held = !!keys.v || touchUI.pressed.atk !== undefined || mouse.down;
    med = !!keys.m;
  } else {
    mx = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
    my = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);
    if (touch.active) { mx = touch.mx; my = touch.my; }
    held = !!keys.v || touchUI.pressed.atk !== undefined || mouse.down;
    med = !!keys.m;
  }
  return { mx, my, held, med };
}

function updatePlayer(dt) {
  updateSamurai(player, dt);
  if (p2 && game.coop) updateSamurai(p2, dt);
}
function updateSamurai(pl, dt) {
  // timers
  pl.iT = Math.max(0, pl.iT - dt);
  pl.flashT = Math.max(0, pl.flashT - dt);
  pl.dodgeRecoverT = Math.max(0, pl.dodgeRecoverT - dt);
  // the fallen kneel and wait — timers tick, nothing else
  if (pl.downed) {
    pl.kbx *= Math.exp(-8 * dt); pl.kby *= Math.exp(-8 * dt);
    pl.vx = 0; pl.vy = 0;
    pl.dodgeInv = false;
    return;
  }
  // 虚 HOLLOW — running the lungs dry has a price: 2s of halved parry
  // window, heavy rolls, +25% damage taken. It re-arms only after the
  // chest refills past 15, so meditation is the honest answer.
  pl.hollowT = Math.max(0, (pl.hollowT || 0) - dt);
  if (pl.st <= 0.01 && !pl.hollowSpent) {
    pl.hollowSpent = true;
    pl.hollowT = 2;
    if (!pl.p2) hintOnce('breathe', 'M — hold to breathe: stillness refills the lungs three times as fast');
    addText(pl.x, pl.y - 32, '虚 hollow!', RED, 14);
    particles.push({ kind: 'ring', x: pl.x, y: pl.y, t: 0, life: .5,
      color: 'rgba(43,35,32,.5)', r0: 10, r1: 46, w: 2 });
    playSfx('tick');
  }
  if (pl.st > 15) pl.hollowSpent = false;
  pl.riposteT = Math.max(0, pl.riposteT - dt);
  pl.attackBuf = Math.max(0, (pl.attackBuf || 0) - dt);
  pl.dodgeBuf = Math.max(0, (pl.dodgeBuf || 0) - dt);
  pl.parryBuf = Math.max(0, (pl.parryBuf || 0) - dt);
  pl.dodgeInv = false;

  // a scripted 奥義 owns the body: no inputs, no stances — only the art (P1)
  if (!pl.p2 && game.ult.run) {
    pl.meditating = false;
    pl.bowDraw = null;
    if (runEntityUlt(game.ult.run, playerUltActor(), dt)) {
      game.ult.run = null;
      if (ultUnlocked()) {
        game.ult.buffT = ULT_BUFF_PVE;   // the art spoken, the surge answers
        game.ult.meter = game.ult.max;   // stays full visually; HUD drains it as duration
      } else {
        // before the first rebirth the art speaks alone — no surge follows
        game.ult.meter = 0;
        setBanner('the art is spoken — 転生 be reborn to wake the INK SURGE', 2.2);
      }
    }
    pl.kbx *= Math.exp(-8 * dt); pl.kby *= Math.exp(-8 * dt);
    pl.x += pl.kbx * dt; pl.y += pl.kby * dt;
    pl.vx = 0; pl.vy = 0;
    clampArena(pl);
    return;
  }
  pl.ultArmor = false; pl.ultCounter = false;

  // 奥義 INK SURGE: while the surge runs the lungs never empty (P1)
  if (!pl.p2 && ultBuffed()) pl.st = pl.maxSt;

  // stamina regen (pauses briefly after any action) — a HOT COMBO (10+)
  // keeps the lungs fuller: aggression between bosses pays in tempo
  pl.regenDelay = Math.max(0, pl.regenDelay - dt);
  const regenRate = (pl.p2 ? 20 : upgRegen())
    * (1 + blessVal('tempo', .25, .45, .65))
    * (game.combo >= 10 ? 1.15 : 1);
  if (!pl.action && pl.regenDelay <= 0)
    pl.st = Math.min(pl.maxSt, pl.st + regenRate * dt);

  // directional input
  const inp = gatherInput(pl);
  let mx = inp.mx, my = inp.my;
  if (game.curses.includes('mirror')) { mx = -mx; my = -my; }   // The Reversed
  if (mx || my) {
    const l = Math.hypot(mx, my); mx /= l; my /= l;   // normalized diagonals
    if (!pl.action) pl.face = Math.atan2(my, mx);
  }
  // mouse aim: the cursor owns the facing — full 360°, WASD keeps the feet
  if (!pl.p2 && mouseAimOn() && !pl.action) {
    const mw = mouseWorld();
    pl.face = Math.atan2(mw.y - pl.y, mw.x - pl.x);
  }

  // consume buffered actions — the bow has no swing; its draw is held, not tapped
  if (!pl.action) {
    if (pl.attackBuf > 0 && pl.stance === 'sword') { pl.attackBuf = 0; startAttackFor(pl); }
    else if (pl.parryBuf > 0) { pl.parryBuf = 0; pl.bowDraw = null; startParryFor(pl); }
    else if (pl.dodgeBuf > 0) { pl.dodgeBuf = 0; pl.bowDraw = null; startDodgeFor(pl, mx, my); }
  }

  // 弓 archer stance: hold the attack key to bend the string, release to loose.
  // The lengthening draw IS the telegraph — and the archer slows to hold it.
  if (pl.stance === 'bow' && eqOf(pl) !== 'fudemaru') {
    const held = inp.held;
    if (pl.bowDraw && pl.action) pl.bowDraw = null;   // rolls drop the string
    if (!pl.action) {
      const bow = bowOf(pl);
      if (pl.bowDraw) {
        pl.bowDraw.t += dt;
        pl.regenDelay = Math.max(pl.regenDelay, .35);
        if (!held) { playerLooseArrow(bow, pl.bowDraw.t, pl); pl.bowDraw = null; }
      } else if (held && !pl.bowLatch) {
        pl.bowLatch = true;
        const stamMul = pl.p2 ? 1 : kyudoStamMul();
        if (pl.st >= bow.stCost * stamMul) pl.bowDraw = { t: 0 };
        else addText(pl.x, pl.y - 24, 'exhausted!', RED, 13);
      }
    }
    if (!held) pl.bowLatch = false;
  } else pl.bowDraw = null;

  // 瞑 meditation: stand still, breathe — stamina returns three times as
  // fast, even through the post-action pause, but you are rooted and open
  pl.meditating = !pl.action && !pl.bowDraw && inp.med;
  if (pl.meditating) {
    mx = 0; my = 0;
    pl.st = Math.min(pl.maxSt,
      pl.st + regenRate * (pl.regenDelay <= 0 ? 2 : 3) * dt);
    if (Math.random() < dt * 7)
      particles.push({ kind: 'dot', x: pl.x + crand(-8, 8), y: pl.y - pl.r,
        vx: 0, vy: -34, t: 0, life: .8, color: 'rgba(168,132,58,.55)', rad: 1.8 });
  }

  // movement
  let vx = 0, vy = 0;
  const a = pl.action;
  if (a) {
    a.t += dt;
    if (a.type === 'attack') {
      vx = mx * pl.speed * .15; vy = my * pl.speed * .15;  // rooted-ish
      const wpn = a.wpn;
      const activeStart = a.startup, activeEnd = a.startup + a.active;
      if (a.t >= activeStart && a.t < activeEnd) {
        // sweep the blade across the arc this frame
        const p = (a.t - activeStart) / a.active;
        const swing = lerp(-1.15, 1.15, p) * a.dir;
        const bladeAng = pl.face + swing;
        const tipX = pl.x + Math.cos(bladeAng) * a.reach;
        const tipY = pl.y + Math.sin(bladeAng) * a.reach;
        // 奥義: the tip writes a neon ribbon across the frames (P1)
        if (!pl.p2 && ultActive()) ultTrail.push({ x: tipX, y: tipY, t: game.time });
        // swing dressing — the fx director paints ink or neon by state
        fx('slash', { owner: pl, x: pl.x, y: pl.y, reach: a.reach,
                      ang: bladeAng, dir: a.dir, weak: a.weak, charged: a.charged,
                      bladeId: wpn.id, tipX, tipY });
        for (const e of enemies) {
          if (e.dead || e.hitBy === a.id || e.state === 'spawn') continue;
          if (inArc(pl.x, pl.y, pl.face, a.reach + 4, a.arc, e.x, e.y, e.r)) {
            e.hitBy = a.id;
            a.landed = true;
            const ang = Math.atan2(e.y - pl.y, e.x - pl.x);
            const wasWinding = e.state === 'windup' || e.state === 'aim';
            game.combo++;
            game.comboPop = .25;
            game.lastComboAt = game.time;
            if (game.combo >= 15) award('combo15');
            let dmg = a.dmg;
            // broken stance: every stroke lands as a critical
            if (e.brokenT > 0) {
              dmg = Math.round(dmg * baseCrit());   // a clean 1.5× — skill's payoff
              addText(e.x, e.y - e.r - 34, 'critical!', GOLD, 13);
            }
            // Botan: damage-free style strikes harder (60% once mastered)
            if (wpn.id === 'botan' && game.time - lastHurtOf(pl) > 2) {
              dmg = Math.round(dmg * (!pl.p2 && isMastered('botan') ? 1.6 : 1.4));
              addText(e.x, e.y - e.r - 24, 'clean!', GOLD, 13);
              spawnPetals(e.x, e.y, 6, 'wash', pl);   // ink petals; neon under surge
            }
            let pDmg = WPN_POSTURE[wpn.id] || 8;
            if (wpn.id === 'tetsu' && !pl.p2 && isMastered('tetsu')) pDmg *= 1.15;
            // Kurogane: every 3rd combo hit is a crushing crow strike
            if (wpn.id === 'kurogane' && game.combo % 3 === 0) {
              dmg = Math.round(dmg * 1.5);
              if (!pl.p2 && isMastered('kurogane')) pDmg += 10;
              addText(e.x, e.y - e.r - 24, 'crow strike!', INK, 14);
              puff(e.x, e.y, 'rgba(43,35,32,.7)', 12);
              freeze(.09); shake(6);
            }
            const stagger = wpn.stagger
              ? wpn.stagger + (wpn.id === 'akaoni' && !pl.p2 && isMastered('akaoni') ? .3 : 0)
              : undefined;
            e.hurt(dmg, ang, stagger,
                   Math.round(pDmg + (pl.p2 ? 0 : tombPosture())), pl, wpn.id);
            if (!pl.p2) {
              addUlt(3.5);   // landed strokes fill the 奥義 meter
              // weapon XP, normalized by the world curve — honest fights feed the blade
              grantWeaponXP(wpn.id, dmg / stageMult(curStage()));
            }
            // Tsukikage: the light dims; true punishes refund stamina
            if (wpn.id === 'tsukikage') {
              game.desatT = .13;
              if (wasWinding) {
                pl.st = Math.min(pl.maxSt, pl.st + wpn.stCost + 6);
                if (!pl.p2 && isMastered('tsukikage'))
                  pl.hp = Math.min(pl.maxHp, pl.hp + 4);
                addText(pl.x, pl.y - 30, 'punish +気', '#6b78a8', 13);
              }
            }
            // Raiko: killing blows arc lightning to a nearby foe (twice, mastered)
            if (wpn.id === 'raiko' && e.dead)
              chainLightning(e.x, e.y, !pl.p2 && isMastered('raiko') ? 2 : 1);
            if (a.riposte && e.dead) award('riposte');
            sparks(e.x, e.y, ang, INK, 7);
            freeze(.045); shake(2);
          }
        }
        // deflect arrows caught in the swing (charged shots cannot be blocked)
        for (const pr of projectiles) {
          if (pr.dead || pr.deflectable === false) continue;
          if (inArc(pl.x, pl.y, pl.face, a.reach + 8, a.arc, pr.x, pr.y, 4)) {
            pr.dead = true;
            sparks(pr.x, pr.y, pl.face, GOLD, 6);
            addText(pr.x, pr.y, 'deflect!', GOLD, 13);
            freeze(.03);
          }
        }
        // knock down bamboo stalks caught in the swing
        for (const st of stalks) {
          if (st.dead || st.hitBy === a.id) continue;
          if (inArc(pl.x, pl.y, pl.face, a.reach + 6, a.arc, st.x, st.y, st.r)) {
            st.hitBy = a.id;
            st.hp--;
            sparks(st.x, st.y, pl.face, '#6a675c', 5);
            if (st.hp <= 0) {
              st.dead = true;
              puff(st.x, st.y, 'rgba(96,94,82,.7)', 10);
              addText(st.x, st.y - 16, 'crack!', '#6a675c', 12);
              shake(2);
            }
          }
        }
      }
      if (a.t >= a.startup + a.active + a.recover) {
        if (a.landed && !pl.p2) adapt.landedSwings++;
        // Ame: clean swings build tempo, a whiff drops it all (6 stacks mastered)
        if (wpn.id === 'ame')
          setStacks(pl, a.landed
            ? Math.min(!pl.p2 && isMastered('ame') ? 6 : 5, stacksOf(pl) + 1) : 0);
        pl.action = null;
      }
    } else if (a.type === 'dodge') {
      const p = a.t / DODGE.dur;
      // hollow legs roll heavy — the escape is a step, not a leap
      const sp = DODGE.speed * (1 - p * .62) * (pl.hollowT > 0 ? .7 : 1);
      vx = a.dx * sp; vy = a.dy * sp;
      if (!pl.p2 && ultActive()) ultTrail.push({ x: pl.x, y: pl.y, t: game.time });
      // Koi charm: the fish slips through — 40% wider i-frame window (P1)
      const invEnd = DODGE.invEnd * (!pl.p2 && charmed('koi') ? 1.4 : 1);
      pl.dodgeInv = a.t >= DODGE.invStart && a.t <= Math.min(invEnd, DODGE.dur);
      if (a.t >= DODGE.dur) {
        pl.action = null;
        pl.dodgeRecoverT = DODGE.recover;   // punishable if predictable
      }
    } else if (a.type === 'parry') {
      // planted: a raised guard, then a punishable recovery
      if (a.t >= PARRY.active + PARRY.recover) pl.action = null;
    } else if (a.type === 'swap') {
      // stance change: a real commitment — slow feet until the grip settles
      vx = mx * pl.speed * .25; vy = my * pl.speed * .25;
      if (a.t >= a.dur) pl.action = null;
    }
  } else {
    const spd = pl.speed * (1 + blessVal('wind', .18, .28, .36))
              * (pl.bowDraw ? .42 : 1);   // a bent string roots the feet
    vx = mx * spd; vy = my * spd;
  }

  // Raiko hums with static even at rest — gray ink until the surge burns
  if (!pl.action && eqOf(pl) === 'raiko' && Math.random() < dt * 4) {
    const ba = pl.face + .55;
    particles.push({ kind: 'line',
      x: pl.x + Math.cos(ba) * (pl.r + 26),
      y: pl.y + Math.sin(ba) * (pl.r + 26),
      vx: crand(-60, 60), vy: crand(-60, 60),
      t: 0, life: .15, tint: 'faint', owner: pl, w: 1.2 });
  }
  // Fudemaru: bristles drip ink that never quite lands; spirit never tires
  if (!pl.p2 && game.equipped === 'fudemaru') {
    pl.st = pl.maxSt;
    if (!pl.action && Math.random() < dt * 2.5) {
      const ba = pl.face + .55;
      particles.push({ kind: 'dot',
        x: pl.x + Math.cos(ba) * (pl.r + 44),
        y: pl.y + Math.sin(ba) * (pl.r + 44),
        vx: 0, vy: 60, t: 0, life: .28, color: 'rgba(43,35,32,.6)', rad: 2 });
    }
  }

  // knockback decay
  pl.kbx *= Math.exp(-8 * dt); pl.kby *= Math.exp(-8 * dt);
  pl.x += (vx + pl.kbx) * dt;
  pl.y += (vy + pl.kby) * dt;
  pl.vx = vx; pl.vy = vy;    // exposed for archer prediction
  clampArena(pl);
}
