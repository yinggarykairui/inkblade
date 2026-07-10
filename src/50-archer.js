/* ---------- projectiles ---------- */
let projectiles = [];
function updateProjectiles(dt) {
  for (const p of projectiles) {
    if (p.dead) continue;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.x < ARENA.x || p.x > ARENA.x + ARENA.w ||
        p.y < ARENA.y || p.y > ARENA.y + ARENA.h) {
      p.dead = true;
      puff(clamp(p.x, ARENA.x, ARENA.x + ARENA.w), clamp(p.y, ARENA.y, ARENA.y + ARENA.h),
           'rgba(43,35,32,.4)', 3);
      continue;
    }
    // an enemy shaft threatens every blade on the field
    for (const P of alivePlayers()) {
      if (p.dead) break;
      if (dist(p.x, p.y, P.x, P.y) >= P.r + 4) continue;
      if (!P.p2 && P.ultCounter && game.ult.run) {
        // 月ノ答 — even an arrow is answered
        p.dead = true;
        ultCounterTrigger(game.ult.run, playerUltActor(), Math.atan2(p.vy, p.vx));
      } else if (P.dodgeInv) {
        if (!p.dodgeAwarded) {
          p.dodgeAwarded = true;
          onPerfectDodge(P);
        }
      } else if (samuraiParryActive(P) && p.deflectable !== false) {
        // the guard meets the arrow — turned to splinters
        p.dead = true;
        if (!P.p2) { save.stats.parries++; award('deflect'); }
        P.riposteT = Math.max(P.riposteT, .9);
        sparks(p.x, p.y, Math.atan2(-p.vy, -p.vx), PAL.pigment.imperialGold, 8);
        addText(p.x, p.y - 14, '弾 parried!', GOLD, 13);
        freeze(.05);
        playSfx('parry');
      } else if (P.iT <= 0) {
        const ang = Math.atan2(p.vy, p.vx);
        if (damageSamurai(P, p.dmg || 9, ang, p.kind === 'charged',
              p.kind === 'charged' ? 'a charged shot'
              : p.kind === 'bolt' ? 'storm lightning' : 'an arrow')) {
          p.dead = true;
          if (p.chain) {   // storm-touched: the shot discharges on impact
            boltFX(p.x - p.vx * .06, p.y - p.vy * .06, P.x, P.y);
            shake(3);
          }
        }
      }
    }
  }
  projectiles = projectiles.filter(p => !p.dead);
}

/* ---------- 弓 the archer stance ----------
   One key (Q; P2 uses P) trades blade for bow, behind a short animation
   lock so the swap is a commitment. Hold attack to draw — the visible
   bend of the bow IS the telegraph — release to loose. Telegraph
   fairness holds: an arrow is a projectile with travel time, dodgeable
   and parryable like any archer's shaft. Point-blank shots run half
   damage and enemies press a drawn bow hard: archery is a positioning
   tool, never a turret. Fires through the same deterministic paths in
   duels (held input bit), so online lockstep is safe.                  */
let pArrows = [];      // arrows loosed by the player or by duelists
let burnZones = [];    // fire-bow ground patches, owner-aware

/* 導矢 guided shafts — eight-spoked keyboard aim makes the bow cruel to
   love, so PvE arrows lean toward a foe already near their line: a
   gentle bend inside a ~25° cone, widening to 90° while the ink surge
   burns. DUELS home too now (2026-07-09) — but FLAT and gentler: a fixed
   ~10° cone, slower bend, dead inside point-blank, never trained (no
   kyudo) and never surge-widened. The counterplay stack answers it:
   roll i-frames, the parry, an active slash's deflect, bamboo cover.
   Both seeks are fully deterministic (no dice) — lockstep-safe.       */
const ARROW_HOME = {
  base: 15 * Math.PI / 180,       // untrained seek half-cone
  perRank: 1.5 * Math.PI / 180,   // each 弓道 rank widens it — 30° at rank 10
  arcSurge: 90 * Math.PI / 180,   // …while the 奥義 surge burns
  turn: 3.4,                      // rad/s of bend, base
  turnSurge: 8,
  range: 460,
};
function homePArrow(a, dt) {
  // the rite judges the naked eye — no guidance while the straw waits
  if (game.kyudo && game.kyudo.on) return;
  // 蔓 the vine does not miss: full-sky seek, no cone, no range — the
  // shaft turns as hard as it must until something is struck
  if (a.bowId === 'riana') {
    let best = null, bd = 1e9;
    for (const e of enemies) {
      if (e.dead || e.state === 'spawn' || a.hit.includes(e)) continue;
      const d = dist(a.x, a.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) return;
    const head = Math.atan2(a.vy, a.vx);
    const bend = clamp(angDiff(head, Math.atan2(best.y - a.y, best.x - a.x)),
                       -14 * dt, 14 * dt);
    const sp = Math.hypot(a.vx, a.vy);
    a.vx = Math.cos(head + bend) * sp;
    a.vy = Math.sin(head + bend) * sp;
    return;
  }
  // P1's surge and kyudo ranks guide only P1's shafts; P2 flies untrained
  const own2 = !!(a.owner && a.owner.p2);
  const surged = !own2 && ultBuffed();
  const cone = surged ? ARROW_HOME.arcSurge
    : ARROW_HOME.base + (own2 ? 0 : ARROW_HOME.perRank * kyudoRank());
  const head = Math.atan2(a.vy, a.vx);
  let best = null, bestD = ARROW_HOME.range;
  for (const e of enemies) {
    if (e.dead || e.state === 'spawn' || a.hit.includes(e)) continue;
    const d = dist(a.x, a.y, e.x, e.y);
    if (d >= bestD) continue;
    if (Math.abs(angDiff(head, Math.atan2(e.y - a.y, e.x - a.x))) > cone) continue;
    bestD = d; best = e;
  }
  if (!best) return;
  const want = Math.atan2(best.y - a.y, best.x - a.x);
  const maxTurn = (surged ? ARROW_HOME.turnSurge : ARROW_HOME.turn) * dt;
  const bend = clamp(angDiff(head, want), -maxTurn, maxTurn);
  const speed = Math.hypot(a.vx, a.vy);
  a.vx = Math.cos(head + bend) * speed;
  a.vy = Math.sin(head + bend) * speed;
}

// the duel's magnet: one foe, one flat cone, one honest bend
// (蔓 the admin vine ignores the cone — both hands chose an admin ring)
function homeDuelArrow(a, dt) {
  const foe = a.owner && a.owner.foe;
  if (!foe || foe.hp <= 0) return;
  const vine = a.bowId === 'riana';
  if (!vine && a.travel < 60) return;            // point-blank stays a read
  const head = Math.atan2(a.vy, a.vx);
  const off = angDiff(head, Math.atan2(foe.y - a.y, foe.x - a.x));
  if (!vine && Math.abs(off) > 10 * Math.PI / 180) return;   // outside the cone: no magnet
  const rate = vine ? 14 : 2.2;
  const bend = clamp(off, -rate * dt, rate * dt);
  const sp = Math.hypot(a.vx, a.vy);
  a.vx = Math.cos(head + bend) * sp;
  a.vy = Math.sin(head + bend) * sp;
}
function toggleStanceFor(pl) {   // PvE only; duel fighters carry their own toggles
  if (game.state !== 'playing' || game.mode === 'duel') return;
  if (eqOf(pl) === 'fudemaru') {
    addText(pl.x, pl.y - 34, '筆 the brush needs no bow', RED, 13);
    return;
  }
  if (pl.action || (!pl.p2 && game.ult.run) || pl.downed) return;
  pl.stance = pl.stance === 'bow' ? 'sword' : 'bow';
  pl.bowDraw = null;
  pl.action = { type: 'swap', t: 0, dur: .35 };
  const bow = bowOf(pl);
  addText(pl.x, pl.y - 30,
    pl.stance === 'bow' ? `弓 ${bow.kanji} ${bow.name} strung` : '刀 blade drawn', INK, 13);
  puff(pl.x, pl.y, 'rgba(43,35,32,.4)', 5);
  playSfx('whoosh');
}
function toggleStance() { toggleStanceFor(player); }

function playerLooseArrow(bow, heldT, pl) {
  pl = pl || player;
  // 弓道 ranks quicken the draw and cheapen its wind — for P1. The
  // second blade shoots duel-raw: no kyudo, no ledger, steel alone.
  const drawMul = pl.p2 ? 1 : kyudoDrawMul();
  const stamMul = pl.p2 ? 1 : kyudoStamMul();
  const power = clamp(heldT / (bow.draw * drawMul), .35, 1);
  const weak = exhaustedOf(pl) || game.curses.includes('winded');
  pl.st = Math.max(0, pl.st - bow.stCost * stamMul);
  pl.regenDelay = .6;
  const dmgMul = (pl.p2 ? 1 + .15 * (pl.resolve || 0)   // 志 resolve stacks
                 : upgDmgMul() * playerLvlMult()
                   * (charmed('oni') ? 1.2 : 1) * rebirthMult()
                   * rarityMult(bow.id) * wxpMult(bow.id))
               * (weak ? .55 : 1) * (1 + blessVal('edge', .10, .18, .26));
  const baseDmg = pl.p2 ? bow.dmg : bow.dmg + rebirthLevel();
  // repeater: every release is a burst; stormbow: a FULL draw splits in three
  const n = bow.burst || (bow.split && power >= .95 ? bow.split : 1);
  for (let i = 0; i < n; i++) {
    const fan = !bow.burst && n > 1 ? (i - (n - 1) / 2) * .2 : 0;
    // the tomb's flat attack lands AFTER the multipliers, same law as the blade
    spawnPArrow(pl, false, bow, pl.face + fan,
      Math.max(1, Math.round(baseDmg * power * dmgMul) + (pl.p2 ? 0 : tombAtk())),
      bow.speed * (.7 + .3 * power),
      bow.burst ? i * .09 : 0);
  }
  playSfx('bow');
  fx('arrowLoose', { owner: pl, x: pl.x + Math.cos(pl.face) * 18,
                     y: pl.y + Math.sin(pl.face) * 18, ang: pl.face });
}
function spawnPArrow(owner, pvp, bow, ang, dmg, speed, delay) {
  pArrows.push({
    x: owner.x + Math.cos(ang) * (owner.r + 4),
    y: owner.y + Math.sin(ang) * (owner.r + 4),
    vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
    dmg, pierce: bow.pierce || 0, burn: !!bow.burn, bowId: bow.id,
    owner, pvp, delay: delay || 0, travel: 0, dead: false, hit: [], dodged: false,
    trail: [],   // cosmetic flight ribbon — written here, read only by the renderer
  });
}
function updatePArrows(dt) {
  for (const a of pArrows) {
    if (a.dead) continue;
    if (a.delay > 0) { a.delay -= dt; if (a.delay > 0) continue; }
    if (a.pvp) homeDuelArrow(a, dt);   // the flat duel magnet
    else homePArrow(a, dt);            // the trained PvE seek
    a.x += a.vx * dt; a.y += a.vy * dt;
    a.travel += Math.hypot(a.vx, a.vy) * dt;
    a.trail.push({ x: a.x, y: a.y });          // drying-ink wake (cosmetic)
    if (a.trail.length > 9) a.trail.shift();
    if (a.x < ARENA.x || a.x > ARENA.x + ARENA.w ||
        a.y < ARENA.y || a.y > ARENA.y + ARENA.h) {
      a.dead = true;
      puff(clamp(a.x, ARENA.x, ARENA.x + ARENA.w), clamp(a.y, ARENA.y, ARENA.y + ARENA.h),
           'rgba(43,35,32,.4)', 3);
      continue;
    }
    // standing bamboo eats arrows — cover is cover for both sides
    for (const st of stalks) {
      if (st.dead) continue;
      if (dist(a.x, a.y, st.x, st.y) < st.r + 3) {
        a.dead = true;
        st.hp--;
        sparks(st.x, st.y, Math.atan2(a.vy, a.vx), '#6a675c', 4);
        if (st.hp <= 0) { st.dead = true; puff(st.x, st.y, 'rgba(96,94,82,.7)', 8); }
        break;
      }
    }
    if (a.dead) continue;
    if (a.pvp) {
      const foe = a.owner.foe;
      if (!foe) { a.dead = true; continue; }
      const fa = foe.action;
      // a live sword slash bats the shaft out of the air — spark and gone
      if (fa && fa.type === 'attack' && fa.t >= fa.startup && fa.t < fa.startup + fa.active &&
          inArc(foe.x, foe.y, foe.face, fa.reach + 10, fa.arc, a.x, a.y, 4)) {
        a.dead = true;
        sparks(a.x, a.y, Math.atan2(-a.vy, -a.vx), GOLD, 8);
        addText(a.x, a.y - 12, 'deflected!', GOLD, 12);
        playSfx('clash');
        continue;
      }
      if (dist(a.x, a.y, foe.x, foe.y) < foe.r + 5) {
        if (foe.ultCounter && foe.ultRun) {   // the moon answers arrows too
          a.dead = true;
          ultCounterTrigger(foe.ultRun, fighterUltActor(foe), Math.atan2(a.vy, a.vx));
          continue;
        }
        if (fighterParryActive(foe)) {
          a.dead = true;
          foe.riposteT = Math.max(foe.riposteT, 1.0);
          sparks(a.x, a.y, Math.atan2(-a.vy, -a.vx), PAL.pigment.imperialGold, 8);
          addText(a.x, a.y - 12, '弾 parried!', GOLD, 13);
          playSfx('parry');
          continue;
        }
        if (foe.dodgeInv) {
          if (!a.dodged) {
            a.dodged = true;
            addText(foe.x, foe.y - 26, 'perfect dodge!', GOLD, 14);
            addFighterUlt(foe, 8);
          }
        } else if (foe.iT <= 0) {
          a.dead = true;
          // PvP arrows run at ×.8 (was ×.6 — a double tax from the days
          // before homing, when they almost never landed); point-blank
          // still halves — steel stays king up close. A FULL longbow draw
          // now punishes like a heavy blade; taps stay honest chip.
          const dmg = Math.max(1, Math.round(a.dmg * .8 * (a.travel < 85 ? .5 : 1)));
          damageFighter(foe, dmg, Math.atan2(a.vy, a.vx));
          if (a.bowId === 'riana' && foe.hp > 0)   // the vine staggers in the ring too
            foe.staggerT = Math.max(foe.staggerT, .5);
          fx('arrowImpact', { owner: a.owner, x: a.x, y: a.y,
                              ang: Math.atan2(a.vy, a.vx), bowId: a.bowId });
          addFighterUlt(a.owner, dmg * .4);   // bows feed the 奥義 at a reduced rate
          if (a.burn) spawnBurn(a.x, a.y, a.owner, true);
        }
      }
    } else {
      for (const e of enemies) {
        if (e.dead || e.state === 'spawn' || a.hit.includes(e)) continue;
        if (dist(a.x, a.y, e.x, e.y) < e.r + 4) {
          a.hit.push(e);
          const vine = a.bowId === 'riana';
          const pb = !vine && a.travel < 85;
          // shield ashigaru turn frontal shafts aside — flank or break them
          // (the vine parts every shield: each of its hits is an ultimate)
          const blocked = !vine && e.shielded && e.brokenT <= 0 &&
            Math.abs(angDiff(e.face, e.angTo())) < 1.15;
          e.hurt(Math.max(1, Math.round(a.dmg * (pb ? .5 : 1))),
                 Math.atan2(a.vy, a.vx), vine ? .5 : undefined,
                 vine ? 40 : 6, a.owner || player, a.bowId);
          if (vine) {   // the ultimate lands: lightning walks, the vine signs
            chainLightning(e.x, e.y, 2);
            particles.push({ kind: 'glyph', ch: '蔓', color: '#39ff88',
              x: e.x, y: e.y - e.r - 10, vx: 0, vy: -22, t: 0, life: .7,
              size: 26, misted: false });
            particles.push({ kind: 'ring', x: e.x, y: e.y, t: 0, life: .4,
              color: 'rgba(57,255,136,.7)', r0: 8, r1: 66, w: 3 });
            freeze(.04); shake(3);
          }
          fx('arrowImpact', { owner: a.owner, x: a.x, y: a.y,
                              ang: Math.atan2(a.vy, a.vx), bowId: a.bowId });
          if (!(a.owner && a.owner.p2)) {   // P2 is progression-free
            grantWeaponXP(a.bowId, a.dmg / stageMult(curStage()));
            addUlt(2);   // bows feed the 奥義 at a reduced rate
          }
          if (pb) addText(e.x, e.y - e.r - 24, 'too close!', 'rgba(43,35,32,.6)', 11);
          if (a.burn) spawnBurn(a.x, a.y, a.owner || player, false);
          if (blocked || a.pierce <= 0) a.dead = true;
          else a.pierce--;   // the longbow's shaft carries on
          break;
        }
      }
    }
  }
  pArrows = pArrows.filter(a => !a.dead);
}
// 火矢 — the ground remembers: a brief burn patch where the shaft lands
function spawnBurn(x, y, owner, pvp) {
  burnZones.push({ x: clamp(x, ARENA.x + 20, ARENA.x + ARENA.w - 20),
                   y: clamp(y, ARENA.y + 20, ARENA.y + ARENA.h - 20),
                   r: 46, t: 0, dur: 2.2, tick: .1, owner, pvp });
  playSfx('rumble');
}
function updateBurnZones(dt) {
  for (const b of burnZones) {
    b.t += dt; b.tick -= dt;
    if (Math.random() < dt * 14)   // rising smoke — gray ink in base, the
      // owner's pigment under a surge; the tint resolves fresh at draw time
      particles.push({ kind: 'dot', x: b.x + crand(-b.r, b.r) * .8, y: b.y + crand(-b.r, b.r) * .6,
        vx: crand(-10, 10), vy: crand(-60, -25), t: 0, life: crand(.4, .9),
        tint: Math.random() < .6 ? 'wash' : 'faint', owner: b.owner, rad: crand(1.5, 2.6) });
    if (b.tick <= 0) {
      b.tick = .4;
      if (b.pvp) {
        const foe = b.owner.foe;
        if (foe && foe.iT <= 0 && !foe.dodgeInv && dist(foe.x, foe.y, b.x, b.y) < b.r) {
          damageFighter(foe, 3, Math.atan2(foe.y - b.y, foe.x - b.x));
          if (foe.hp > 0) addText(foe.x, foe.y - 40, 'burned!', PAL.pigment.cinnabar, 11);
          fx('burn', { x: foe.x, y: foe.y });
        }
      } else {
        for (const e of enemies) {
          if (e.dead || e.state === 'spawn') continue;
          if (dist(e.x, e.y, b.x, b.y) < b.r + e.r * .4) {
            e.hurt(4, Math.atan2(e.y - b.y, e.x - b.x), undefined, 3,
                   b.owner || player, 'firebow');
            fx('burn', { x: e.x, y: e.y });
          }
        }
      }
    }
  }
  burnZones = burnZones.filter(b => b.t < b.dur);
}

