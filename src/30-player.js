/* ---------- player ---------- */
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
};

const ATK = { startup: .13, active: .10, recover: .24, reach: 60, arc: 2.3, dmg: 12, cost: 18 };
const DODGE = { dur: .34, invStart: .02, invEnd: .25, speed: 560, cost: 26, recover: .14 };
const PARRY = { active: .13, recover: .27, cost: 10 };

// run-scoped blessing check (shrines populate game.blessings)
function hasBless(id) { return !!(game.blessings && game.blessings.includes(id)); }
// equipped-charm check — charms never apply in duels
function charmed(id) { return save.charm === id && game.mode !== 'duel'; }

function playerParryActive() {
  const a = player.action;
  return !!(a && a.type === 'parry' && a.t <= PARRY.active);
}
function startParry() {
  if (player.st < PARRY.cost) {
    addText(player.x, player.y - 24, 'exhausted!', RED, 13);
    return;
  }
  player.st = Math.max(0, player.st - PARRY.cost);
  player.regenDelay = .5;
  player.action = { type: 'parry', t: 0 };
  player.lastParryStart = game.time;
  // reactive-parry bookkeeping for the adaptive layer
  if (enemies.some(e => !e.dead && (e.state === 'windup' || e.state === 'aim')))
    adapt.windupParries++;
}
// every perfect dodge funnels through here: adaptive layer, stats, blessings
function onPerfectDodge() {
  adapt.perfects++;
  save.stats.perfectDodges++;
  addUlt(10);   // a clean read feeds the 奥義 meter
  addText(player.x, player.y - 26, 'perfect dodge!', GOLD, 14);
  if (hasBless('mend')) player.hp = Math.min(player.maxHp, player.hp + 6);
  award('firstPerfect');
}

function resetPlayer() {
  // permanent training tiers set the base statline for every run;
  // The Glass curse halves what the training built
  const frail = game.curses.includes('frail');
  Object.assign(player, {
    x: W / 2, y: H / 2, vx: 0, vy: 0, kbx: 0, kby: 0, face: 0,
    maxHp: Math.max(10, Math.round(upgMaxHp() * tombMult('body') * (frail ? .5 : 1))),
    maxSt: upgMaxSt(), speed: upgSpeed(),
    action: null, iT: 0, riposteT: 0,
    dodgeInv: false, dodgeRecoverT: 0, flashT: 0, regenDelay: 0,
    lastDodgeStart: -99, vHeld: false,
    stance: 'sword', bowDraw: null, bowLatch: false,
    ultArmor: false, ultCounter: false,
  });
  player.hp = player.maxHp; player.st = player.maxSt;
  player.x = ARENA.x + ARENA.w / 2; player.y = ARENA.y + ARENA.h / 2;
}
function refreshPlayerStats() {  // after buying training mid-session
  const hpFrac = player.hp / player.maxHp, stFrac = player.st / player.maxSt;
  player.maxHp = Math.round(upgMaxHp() * tombMult('body'));
  player.maxSt = upgMaxSt(); player.speed = upgSpeed();
  player.hp = Math.round(player.maxHp * Math.max(hpFrac, 0));
  player.st = player.maxSt * stFrac;
}

function playerExhausted() { return player.st <= 0.01; }

function startAttack() {
  const wpn = currentWeapon();
  // keyboard aim is eight-spoked — the blade forgives. The swing leans
  // toward the nearest foe within a natural turn of the wrist (~55°)
  // and honest striking range. PvE only: duel fighters aim themselves,
  // and nothing here draws from unseeded chance. A mouse aims truly —
  // when the cursor holds the wrist, the blade obeys it exactly.
  if (game.mode !== 'duel' && !mouseAimOn()) {
    let best = null, bestScore = 1e9;
    for (const e of enemies) {
      if (e.dead || e.state === 'spawn') continue;
      const d = dist(player.x, player.y, e.x, e.y);
      if (d - e.r > wpn.reach * 1.7) continue;
      const off = Math.abs(angDiff(player.face,
        Math.atan2(e.y - player.y, e.x - player.x)));
      if (off > .95) continue;
      const score = d + off * 60;   // near and in front beats merely near
      if (score < bestScore) { bestScore = score; best = e; }
    }
    if (best) player.face = Math.atan2(best.y - player.y, best.x - player.x);
  }
  // 奥義 INK SURGE: once the art has opened, the blade overflows
  const surge = ultBuffed();
  // The Hollow curse: the lungs never fill — every swing is a winded swing
  const weak = playerExhausted() || game.curses.includes('winded');
  player.st = Math.max(0, player.st - wpn.stCost);
  player.regenDelay = .6;
  let m = (weak ? 1.65 : 1) * wpn.spdMul;
  // Ame: rhythm stacks quicken successive clean swings
  if (wpn.id === 'ame') m *= 1 - .06 * game.ameStacks;
  // dodge-into-attack window — Shirasagi flow / Raiko charge
  const sinceDodge = game.time - player.lastDodgeStart;
  const flowWin = DODGE.dur + ((wpn.id === 'shirasagi' && isMastered('shirasagi')) ? .75 : .5);
  const dodgeFlow = sinceDodge > 0 && sinceDodge < flowWin;
  const extended = wpn.id === 'shirasagi' && dodgeFlow;
  const charged = wpn.id === 'raiko' && dodgeFlow;
  let dmg = Math.round(wpn.dmg * upgDmgMul() * (weak ? .55 : 1) * (charged ? 1.5 : 1)
                       * (charmed('oni') ? 1.2 : 1) * (hasBless('edge') ? 1.1 : 1)
                       * (surge ? 2 : 1)
                       * rarityMult(wpn.id) * wxpMult(wpn.id));   // the vertical tracks
  let riposte = false;
  if (player.riposteT > 0) {       // the parry's answer — one empowered stroke
    riposte = true;
    player.riposteT = 0;
    dmg = Math.round(dmg * 1.5);
    addText(player.x, player.y - 28, 'riposte!', GOLD, 13);
    sparks(player.x, player.y, player.face, PAL.pigment.imperialGold, 5, .7);
  }
  player.action = {
    type: 'attack', t: 0, weak, wpn, charged, extended, riposte,
    startup: ATK.startup * m,
    active: ATK.active * m * (extended ? 1.7 : 1),
    recover: ATK.recover * m,
    dmg,
    reach: wpn.reach * (surge ? 3 : 1),
    arc: wpn.arc * (charged ? 1.35 : 1) * (surge ? 1.3 : 1),
    landed: false, id: ++player.attackId, dir: player.swingDir,
  };
  player.swingDir *= -1;
  adapt.swings++;
  playSfx('whoosh');
  if (charged) {
    // white-hot, not blue — pigment stays behind the ultimate gate
    addText(player.x, player.y - 28, 'charged!', 'rgba(43,35,32,.75)', 13);
    sparks(player.x, player.y, player.face, 'rgba(240,240,240,.95)', 6, Math.PI);
  }
  if (extended) addText(player.x, player.y - 28, 'flow', 'rgba(43,35,32,.55)', 12);
}
function startDodge(mx, my) {
  if (game.curses.includes('noroll')) {  // The Rooted — the curse holds your feet
    addText(player.x, player.y - 24, '呪 rooted!', RED, 13);
    return;
  }
  if (player.st < 10) {                 // too tired to roll
    addText(player.x, player.y - 24, 'exhausted!', RED, 13);
    return;
  }
  player.st = Math.max(0, player.st - DODGE.cost);
  player.regenDelay = .6;
  let dx = mx, dy = my;
  if (!dx && !dy) { dx = Math.cos(player.face); dy = Math.sin(player.face); }
  const l = Math.hypot(dx, dy) || 1;
  player.action = { type: 'dodge', t: 0, dx: dx / l, dy: dy / l };
  player.face = Math.atan2(dy, dx);
  player.lastDodgeStart = game.time;
  playSfx('dodge');
  // reactive-dodge bookkeeping for the adaptive layer
  if (enemies.some(e => !e.dead && (e.state === 'windup' || e.state === 'aim')))
    adapt.windupDodges++;
  puff(player.x, player.y, 'rgba(43,35,32,.5)', 4);
}

function damagePlayer(dmg, ang, heavy) {
  if (player.iT > 0 || player.dodgeInv || game.state !== 'playing') return false;
  // 月ノ答 — the counter-stance drinks the blow and answers it
  if (player.ultCounter && game.ult.run) { ultCounterTrigger(game.ult.run, playerUltActor(), ang); return false; }
  if (charmed('oni')) dmg = Math.round(dmg * 1.2);   // the Oni exacts its price
  player.hp -= dmg;
  game.levelDamageTaken += dmg;
  player.iT = .9; player.flashT = .3;
  playSfx('hurt');
  // an ultimate stuffed in its windup dies — but refunds most of the ink
  if (game.ult.run && game.ult.run.phase === 'windup') ultWindupBroken();
  if (player.ultArmor) {   // scripted armor: the blow lands, the art continues
    player.kbx += Math.cos(ang) * 80; player.kby += Math.sin(ang) * 80;
  } else {
    player.kbx += Math.cos(ang) * (heavy ? 420 : 260);
    player.kby += Math.sin(ang) * (heavy ? 420 : 260);
    player.action = null;   // hits interrupt whatever the player was doing
    player.bowDraw = null;  // the string slips
  }
  game.combo = 0;
  game.ameStacks = 0;
  game.lastHurtAt = game.time;
  adapt.taken++;
  shake(heavy ? 8 : 4.5); freeze(heavy ? .09 : .05);
  sparks(player.x, player.y, ang, RED, 8);
  addText(player.x, player.y - 26, '-' + fmtNum(dmg), RED, 16);
  if (player.hp <= 0) {
    // Omamori: the charm takes the blow that would have ended the trial
    if (charmed('omamori') && !game.omamoriUsed) {
      game.omamoriUsed = true;
      player.hp = 1;
      player.iT = 1.6;
      game.flashT = .25;
      addText(player.x, player.y - 44, '守 the charm shatters', GOLD, 15);
      particles.push({ kind: 'ring', x: player.x, y: player.y, t: 0, life: .6,
        color: 'rgba(168,132,58,.7)', r0: 12, r1: 160, w: 3 });
      freeze(.12); shake(6);
      playSfx('parry');
    } else {
      player.hp = 0;
      gameOver();
    }
  }
  return true;
}

function updatePlayer(dt) {
  // timers
  player.iT = Math.max(0, player.iT - dt);
  player.flashT = Math.max(0, player.flashT - dt);
  player.dodgeRecoverT = Math.max(0, player.dodgeRecoverT - dt);
  player.riposteT = Math.max(0, player.riposteT - dt);
  attackBuf = Math.max(0, attackBuf - dt);
  dodgeBuf = Math.max(0, dodgeBuf - dt);
  parryBuf = Math.max(0, parryBuf - dt);
  player.dodgeInv = false;

  // a scripted 奥義 owns the body: no inputs, no stances — only the art
  if (game.ult.run) {
    player.meditating = false;
    player.bowDraw = null;
    if (runEntityUlt(game.ult.run, playerUltActor(), dt)) {
      game.ult.run = null;
      game.ult.buffT = ULT_BUFF_PVE;   // the art spoken, the surge answers
      game.ult.meter = game.ult.max;   // stays full visually; HUD drains it as duration
    }
    player.kbx *= Math.exp(-8 * dt); player.kby *= Math.exp(-8 * dt);
    player.x += player.kbx * dt; player.y += player.kby * dt;
    player.vx = 0; player.vy = 0;
    clampArena(player);
    return;
  }
  player.ultArmor = false; player.ultCounter = false;

  // 奥義 INK SURGE: while the surge runs the lungs never empty
  if (ultBuffed()) player.st = player.maxSt;

  // stamina regen (pauses briefly after any action)
  player.regenDelay = Math.max(0, player.regenDelay - dt);
  if (!player.action && player.regenDelay <= 0)
    player.st = Math.min(player.maxSt,
      player.st + upgRegen() * (hasBless('tempo') ? 1.25 : 1) * dt);

  // directional input
  let mx = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
  let my = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);
  if (touch.active) { mx = touch.mx; my = touch.my; }
  if (game.curses.includes('mirror')) { mx = -mx; my = -my; }   // The Reversed
  if (mx || my) {
    const l = Math.hypot(mx, my); mx /= l; my /= l;   // normalized diagonals
    if (!player.action) player.face = Math.atan2(my, mx);
  }
  // mouse aim: the cursor owns the facing — full 360°, WASD keeps the feet
  if (mouseAimOn() && !player.action) {
    const mw = mouseWorld();
    player.face = Math.atan2(mw.y - player.y, mw.x - player.x);
  }

  // consume buffered actions — the bow has no swing; its draw is held, not tapped
  if (!player.action) {
    if (attackBuf > 0 && player.stance === 'sword') { attackBuf = 0; startAttack(); }
    else if (parryBuf > 0) { parryBuf = 0; player.bowDraw = null; startParry(); }
    else if (dodgeBuf > 0) { dodgeBuf = 0; player.bowDraw = null; startDodge(mx, my); }
  }

  // 弓 archer stance: hold the attack key to bend the string, release to loose.
  // The lengthening draw IS the telegraph — and the archer slows to hold it.
  if (player.stance === 'bow' && game.equipped !== 'fudemaru') {
    const held = !!keys.v || touchUI.pressed.atk !== undefined || mouse.down;
    if (player.bowDraw && player.action) player.bowDraw = null;   // rolls drop the string
    if (!player.action) {
      const bow = currentBow();
      if (player.bowDraw) {
        player.bowDraw.t += dt;
        player.regenDelay = Math.max(player.regenDelay, .35);
        if (!held) { playerLooseArrow(bow, player.bowDraw.t); player.bowDraw = null; }
      } else if (held && !player.bowLatch) {
        player.bowLatch = true;
        if (player.st >= bow.stCost * kyudoStamMul()) player.bowDraw = { t: 0 };
        else addText(player.x, player.y - 24, 'exhausted!', RED, 13);
      }
    }
    if (!held) player.bowLatch = false;
  } else player.bowDraw = null;

  // 瞑 meditation: stand still, breathe — stamina returns three times as
  // fast, even through the post-action pause, but you are rooted and open
  player.meditating = !player.action && !player.bowDraw && !!keys.m;
  if (player.meditating) {
    mx = 0; my = 0;
    player.st = Math.min(player.maxSt,
      player.st + upgRegen() * (hasBless('tempo') ? 1.25 : 1) *
      (player.regenDelay <= 0 ? 2 : 3) * dt);
    if (Math.random() < dt * 7)
      particles.push({ kind: 'dot', x: player.x + rand(-8, 8), y: player.y - player.r,
        vx: 0, vy: -34, t: 0, life: .8, color: 'rgba(168,132,58,.55)', rad: 1.8 });
  }

  // movement
  let vx = 0, vy = 0;
  const a = player.action;
  if (a) {
    a.t += dt;
    if (a.type === 'attack') {
      vx = mx * player.speed * .15; vy = my * player.speed * .15;  // rooted-ish
      const wpn = a.wpn;
      const activeStart = a.startup, activeEnd = a.startup + a.active;
      if (a.t >= activeStart && a.t < activeEnd) {
        // sweep the blade across the arc this frame
        const p = (a.t - activeStart) / a.active;
        const swing = lerp(-1.15, 1.15, p) * a.dir;
        const bladeAng = player.face + swing;
        const tipX = player.x + Math.cos(bladeAng) * a.reach;
        const tipY = player.y + Math.sin(bladeAng) * a.reach;
        // 奥義: the tip writes a neon ribbon across the frames
        if (ultActive()) ultTrail.push({ x: tipX, y: tipY, t: game.time });
        // swing dressing — the fx director paints ink or neon by state
        fx('slash', { owner: player, x: player.x, y: player.y, reach: a.reach,
                      ang: bladeAng, dir: a.dir, weak: a.weak, charged: a.charged,
                      bladeId: wpn.id, tipX, tipY });
        for (const e of enemies) {
          if (e.dead || e.hitBy === a.id || e.state === 'spawn') continue;
          if (inArc(player.x, player.y, player.face, a.reach + 4, a.arc, e.x, e.y, e.r)) {
            e.hitBy = a.id;
            a.landed = true;
            const ang = Math.atan2(e.y - player.y, e.x - player.x);
            const wasWinding = e.state === 'windup' || e.state === 'aim';
            game.combo++;
            game.comboPop = .25;
            if (game.combo >= 15) award('combo15');
            let dmg = a.dmg;
            // broken stance: every stroke lands as a critical
            if (e.brokenT > 0) {
              dmg = Math.round(dmg * baseCrit());   // 1.5× → 3.0× via the Tomb's Edge track
              addText(e.x, e.y - e.r - 34, 'critical!', GOLD, 13);
            }
            // Botan: damage-free style strikes harder (60% once mastered)
            if (wpn.id === 'botan' && game.time - game.lastHurtAt > 2) {
              dmg = Math.round(dmg * (isMastered('botan') ? 1.6 : 1.4));
              addText(e.x, e.y - e.r - 24, 'clean!', GOLD, 13);
              spawnPetals(e.x, e.y, 6, 'wash', player);   // ink petals; neon under surge
            }
            let pDmg = WPN_POSTURE[wpn.id] || 8;
            if (wpn.id === 'tetsu' && isMastered('tetsu')) pDmg *= 1.15;
            // Kurogane: every 3rd combo hit is a crushing crow strike
            if (wpn.id === 'kurogane' && game.combo % 3 === 0) {
              dmg = Math.round(dmg * 1.5);
              if (isMastered('kurogane')) pDmg += 10;
              addText(e.x, e.y - e.r - 24, 'crow strike!', INK, 14);
              puff(e.x, e.y, 'rgba(43,35,32,.7)', 12);
              freeze(.09); shake(6);
            }
            const stagger = wpn.stagger
              ? wpn.stagger + (wpn.id === 'akaoni' && isMastered('akaoni') ? .3 : 0)
              : undefined;
            e.hurt(dmg, ang, stagger, Math.round(pDmg * tombMult('stance')));
            addUlt(3.5);   // landed strokes fill the 奥義 meter
            // weapon XP, normalized by the world curve — honest fights feed the blade
            grantWeaponXP(wpn.id, dmg / stageMult(curStage()));
            // Tsukikage: the light dims; true punishes refund stamina
            if (wpn.id === 'tsukikage') {
              game.desatT = .13;
              if (wasWinding) {
                player.st = Math.min(player.maxSt, player.st + wpn.stCost + 6);
                if (isMastered('tsukikage'))
                  player.hp = Math.min(player.maxHp, player.hp + 4);
                addText(player.x, player.y - 30, 'punish +気', '#6b78a8', 13);
              }
            }
            // Raiko: killing blows arc lightning to a nearby foe (twice, mastered)
            if (wpn.id === 'raiko' && e.dead) chainLightning(e.x, e.y, isMastered('raiko') ? 2 : 1);
            if (a.riposte && e.dead) award('riposte');
            sparks(e.x, e.y, ang, INK, 7);
            freeze(.045); shake(2);
          }
        }
        // deflect arrows caught in the swing (charged shots cannot be blocked)
        for (const pr of projectiles) {
          if (pr.dead || pr.deflectable === false) continue;
          if (inArc(player.x, player.y, player.face, a.reach + 8, a.arc, pr.x, pr.y, 4)) {
            pr.dead = true;
            sparks(pr.x, pr.y, player.face, GOLD, 6);
            addText(pr.x, pr.y, 'deflect!', GOLD, 13);
            freeze(.03);
          }
        }
        // knock down bamboo stalks caught in the swing
        for (const st of stalks) {
          if (st.dead || st.hitBy === a.id) continue;
          if (inArc(player.x, player.y, player.face, a.reach + 6, a.arc, st.x, st.y, st.r)) {
            st.hitBy = a.id;
            st.hp--;
            sparks(st.x, st.y, player.face, '#6a675c', 5);
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
        if (a.landed) adapt.landedSwings++;
        // Ame: clean swings build tempo, a whiff drops it all (6 stacks mastered)
        if (wpn.id === 'ame')
          game.ameStacks = a.landed
            ? Math.min(isMastered('ame') ? 6 : 5, game.ameStacks + 1) : 0;
        player.action = null;
      }
    } else if (a.type === 'dodge') {
      const p = a.t / DODGE.dur;
      const sp = DODGE.speed * (1 - p * .62);
      vx = a.dx * sp; vy = a.dy * sp;
      if (ultActive()) ultTrail.push({ x: player.x, y: player.y, t: game.time });
      // Koi charm: the fish slips through — 40% wider i-frame window
      const invEnd = DODGE.invEnd * (charmed('koi') ? 1.4 : 1);
      player.dodgeInv = a.t >= DODGE.invStart && a.t <= Math.min(invEnd, DODGE.dur);
      if (a.t >= DODGE.dur) {
        player.action = null;
        player.dodgeRecoverT = DODGE.recover;   // punishable if predictable
      }
    } else if (a.type === 'parry') {
      // planted: a raised guard, then a punishable recovery
      if (a.t >= PARRY.active + PARRY.recover) player.action = null;
    } else if (a.type === 'swap') {
      // stance change: a real commitment — slow feet until the grip settles
      vx = mx * player.speed * .25; vy = my * player.speed * .25;
      if (a.t >= a.dur) player.action = null;
    }
  } else {
    const spd = player.speed * (hasBless('wind') ? 1.18 : 1)
              * (player.bowDraw ? .42 : 1);   // a bent string roots the feet
    vx = mx * spd; vy = my * spd;
  }

  // Raiko hums with static even at rest — gray ink until the surge burns
  if (!player.action && game.equipped === 'raiko' && Math.random() < dt * 4) {
    const ba = player.face + .55;
    particles.push({ kind: 'line',
      x: player.x + Math.cos(ba) * (player.r + 26),
      y: player.y + Math.sin(ba) * (player.r + 26),
      vx: rand(-60, 60), vy: rand(-60, 60),
      t: 0, life: .15, tint: 'faint', owner: player, w: 1.2 });
  }
  // Fudemaru: bristles drip ink that never quite lands; spirit never tires
  if (game.equipped === 'fudemaru') {
    player.st = player.maxSt;
    if (!player.action && Math.random() < dt * 2.5) {
      const ba = player.face + .55;
      particles.push({ kind: 'dot',
        x: player.x + Math.cos(ba) * (player.r + 44),
        y: player.y + Math.sin(ba) * (player.r + 44),
        vx: 0, vy: 60, t: 0, life: .28, color: 'rgba(43,35,32,.6)', rad: 2 });
    }
  }

  // knockback decay
  player.kbx *= Math.exp(-8 * dt); player.kby *= Math.exp(-8 * dt);
  player.x += (vx + player.kbx) * dt;
  player.y += (vy + player.kby) * dt;
  player.vx = vx; player.vy = vy;    // exposed for archer prediction
  clampArena(player);
}

