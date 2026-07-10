/* --- player/duelist arrows: bow identity is stroke LANGUAGE in ink,
   and one of the four arts when the owner's 奥義 burns. The style is
   resolved fresh every frame, so a shaft in flight changes worlds the
   instant the surge ignites — and falls silent again when it fades.  --- */
function drawPArrow(a) {
  const s = styleFor(a.owner);
  const ang = Math.atan2(a.vy, a.vx);
  const cs = Math.cos(ang), sn = Math.sin(ang);
  // 蔓 the vine's shaft — ALWAYS neon, a living green tendril that
  // curls as it seeks, tipped with a glowing bud
  if (a.bowId === 'riana') {
    const nz = weaponNeon('riana');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowBlur = 14; ctx.shadowColor = nz[0];
    if (a.trail && a.trail.length > 1) {
      ctx.strokeStyle = nz[0]; ctx.lineWidth = 2.6;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(a.trail[0].x, a.trail[0].y);
      for (let i = 1; i < a.trail.length; i++) {
        // the tendril's curl — a small weave off the true path
        const t = a.trail[i];
        const off = Math.sin(game.time * 18 + i * 1.7) * 2.2;
        ctx.lineTo(t.x - sn * off, t.y + cs * off);
      }
      ctx.stroke();
    }
    ctx.fillStyle = nz[1];
    ctx.beginPath(); ctx.arc(a.x, a.y, 4, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffffff';                    // the bud's white heart
    ctx.beginPath(); ctx.arc(a.x, a.y, 1.6, 0, TAU); ctx.fill();
    return;
  }
  // flight ribbon — drying ink, or a neon wake under the surge
  if (a.trail && a.trail.length > 1) {
    const pts = [];
    for (let i = 0; i < a.trail.length; i++)
      pts.push({ x: a.trail[i].x, y: a.trail[i].y, a: (i + 1) / a.trail.length });
    brushStroke(pts, { color: s.glow ? s.accent : PAL.ink.faint,
      weight: s.glow ? 3 : 1.8, taper: false, glow: s.glow, flecks: false,
      alpha: s.glow ? .45 : .3 });
  }
  if (!s.glow) {   // strict ink — hue never tells the bows apart, the brush does
    if (a.bowId === 'longbow') {         // one long, heavy committed stroke
      brushStroke([{ x: a.x - cs * 16, y: a.y - sn * 16, a: .5 },
                   { x: a.x + cs * 6, y: a.y + sn * 6, a: 1 }], { weight: 3.4 });
    } else if (a.bowId === 'repeater') { // a thin, hurried flick
      brushStroke([{ x: a.x - cs * 8, y: a.y - sn * 8, a: .4 },
                   { x: a.x + cs * 4, y: a.y + sn * 4, a: 1 }], { weight: 1.5 });
    } else if (a.bowId === 'firebow') {  // a wet blot, trailing a drip
      ctx.fillStyle = PAL.ink.stroke;
      ctx.globalAlpha = .85;
      ctx.beginPath(); ctx.arc(a.x, a.y, 3.4, 0, TAU); ctx.fill();
      ctx.globalAlpha = .4;
      ctx.beginPath(); ctx.arc(a.x - cs * 7, a.y - sn * 7 + 2, 1.6, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (a.bowId === 'stormbow') { // a fanned dry-brush triple
      for (const off of [-3, 0, 3])
        brushStroke([{ x: a.x - cs * 10 - sn * off, y: a.y - sn * 10 + cs * off, a: .35 },
                     { x: a.x + cs * 4 - sn * off, y: a.y + sn * 4 + cs * off, a: .9 }],
          { weight: 1.2, flecks: false });
    } else {                             // shortbow — the honest first stroke
      brushStroke([{ x: a.x - cs * 11, y: a.y - sn * 11, a: .45 },
                   { x: a.x + cs * 5, y: a.y + sn * 5, a: 1 }], { weight: 2.2 });
    }
    return;
  }
  // ULT — the four arts in flight
  const P = PAL.pigment;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  if (a.bowId === 'longbow') {           // Piercing Stroke — ruled geometry
    ctx.shadowBlur = 12; ctx.shadowColor = P.imperialGold;
    ctx.strokeStyle = P.imperialGold; ctx.lineWidth = 2.6; ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(a.x - cs * 24, a.y - sn * 24); ctx.lineTo(a.x + cs * 8, a.y + sn * 8);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x - cs * 20, a.y - sn * 20); ctx.lineTo(a.x + cs * 8, a.y + sn * 8);
    ctx.stroke();
  } else if (a.bowId === 'repeater') {   // Splatter Volley — loaded with pigment
    const col = [P.cinnabar, P.azurite, P.jade][Math.floor(a.travel / 40) % 3];
    ctx.shadowBlur = 10; ctx.shadowColor = col;
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a.x - cs * 9, a.y - sn * 9); ctx.lineTo(a.x + cs * 4, a.y + sn * 4);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(a.x + cs * 5, a.y + sn * 5, 2.6, 0, TAU); ctx.fill();
  } else if (a.bowId === 'firebow') {    // Binding Scroll — script on the wing
    ctx.shadowBlur = 10; ctx.shadowColor = P.jade;
    ctx.strokeStyle = P.jade; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a.x - cs * 10, a.y - sn * 10); ctx.lineTo(a.x + cs * 5, a.y + sn * 5);
    ctx.stroke();
    ctx.fillStyle = P.jade;
    ctx.font = '13px Georgia,serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = .8;
    ctx.fillText('縛', a.x - cs * 16, a.y - sn * 16);
  } else if (a.bowId === 'stormbow') {   // Painted Beast — the winged shaft
    ctx.shadowBlur = 12; ctx.shadowColor = P.cinnabar;
    ctx.strokeStyle = P.cinnabar; ctx.lineWidth = 2.2;
    for (const side of [-1, 1]) {        // fine-line wings off the shaft
      ctx.beginPath();
      ctx.moveTo(a.x - cs * 4, a.y - sn * 4);
      ctx.quadraticCurveTo(
        a.x - cs * 12 - sn * side * 10, a.y - sn * 12 + cs * side * 10,
        a.x - cs * 20 - sn * side * 6, a.y - sn * 20 + cs * side * 6);
      ctx.stroke();
    }
    ctx.strokeStyle = P.imperialGold; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(a.x - cs * 12, a.y - sn * 12); ctx.lineTo(a.x + cs * 6, a.y + sn * 6);
    ctx.stroke();
  } else {                               // shortbow — a plain neon stroke
    ctx.shadowBlur = 10; ctx.shadowColor = s.stroke;
    ctx.strokeStyle = s.stroke; ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(a.x - cs * 11, a.y - sn * 11); ctx.lineTo(a.x + cs * 5, a.y + sn * 5);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
}

/* ---------- update ---------- */
function update(dt) {
  if (game.mode === 'duel') {
    game.time += dt;
    game.bannerT = Math.max(0, game.bannerT - dt);
    for (const f of [duel.p1, duel.p2])   // ribbons fade even through the pause
      f.ultTrail = f.ultTrail.filter(p => game.time - p.t < .22);
    if (duel.pauseT > 0) {
      duel.pauseT -= dt;
      updateEffects(dt);
      if (duel.pauseT <= 0) {
        if (duel.matchOver) endDuelMatch();
        else { duel.round++; resetDuelRound(); }
      }
      return;
    }
    updateFighter(duel.p1, dt);
    updateFighter(duel.p2, dt);
    const fa = duel.p1, fb = duel.p2;
    const dx = fb.x - fa.x, dy = fb.y - fa.y;
    const d = Math.hypot(dx, dy), min = fa.r + fb.r + 2;
    if (d > 0 && d < min) {
      const push = (min - d) / 2;
      fa.x -= dx / d * push; fa.y -= dy / d * push;
      fb.x += dx / d * push; fb.y += dy / d * push;
    }
    // the arena fights back: live hazards on every dueling ground
    for (const fz of fireZones) {
      fz.phase += dt;
      for (const f of [fa, fb]) {
        if (f.iT <= 0 && !f.dodgeInv &&
            dist(f.x, f.y, fz.x, fz.y) < fz.r - 4) {
          damageFighter(f, 5, Math.atan2(f.y - fz.y, f.x - fz.x));
          if (f.hp > 0) { addText(f.x, f.y - 40, 'burned!', PAL.pigment.cinnabar, 12); fx('burn', { x: f.x, y: f.y }); }
        }
      }
    }
    collideStalks();
    updateDuelHoles(dt);
    updatePArrows(dt);
    updateBurnZones(dt);
    updateUltWaves(dt);
    updateAmbient(dt);
    updateEffects(dt);
    return;
  }
  game.time += dt;
  if (game.mode === 'rush') game.rushTime += dt;
  game.bannerT = Math.max(0, game.bannerT - dt);
  game.comboPop = Math.max(0, game.comboPop - dt);
  // the combo is a rhythm, not a ledger — four idle seconds let it drop
  if (game.combo > 0 && game.time - (game.lastComboAt || 0) > 4) game.combo = 0;
  game.desatT = Math.max(0, game.desatT - dt);
  game.flashT = Math.max(0, game.flashT - dt);
  meleeTokens.update(dt); rangedTokens.update(dt);

  updatePlayer(dt);
  updateUlt(dt);
  for (const e of enemies) e.update(dt);
  enemies = enemies.filter(e => !e.dead);
  separateEnemies();
  collideStalks();
  updateProjectiles(dt);
  updatePArrows(dt);
  updateBurnZones(dt);
  updateUltWaves(dt);
  updateShockwaves(dt);
  updateBlackholes(dt);
  updateOrbs(dt);
  updateStorm(dt);
  updateHazards(dt);
  updateAmbient(dt);
  updatePortal(dt);
  updateChests(dt);
  if (game.mode === 'tomb') updateTomb(dt);
  if (game.mode === 'training') updateKyudo(dt);
  if (shrine) shrine.t += dt;
  updateTransition(dt);
  updateEffects(dt);

  // camera eases back while a boss holds the arena
  game.zoomTarget = enemies.some(e => !e.dead && e.isBoss) ? .88 : 1;
  game.zoom = lerp(game.zoom, game.zoomTarget, 1 - Math.exp(-3.2 * dt));

  if (game.state === 'playing' && game.mode !== 'merchant' &&
      game.mode !== 'training' && game.mode !== 'tomb' && !game.victory &&
      enemies.length === 0 && !transition &&
      (!portal || portal.kind === 'merchant')) {
    game.clearDelay += dt;
    if (game.clearDelay > .9) { game.clearDelay = 0; onWaveCleared(); }
  } else game.clearDelay = 0;
}

/* ---------- drawing ---------- */
function drawShadow(x, y, r) {
  ctx.fillStyle = 'rgba(43,35,32,.13)';
  ctx.beginPath();
  ctx.ellipse(x, y + r * .75, r * 1.05, r * .42, 0, 0, TAU);
  ctx.fill();
}
function drawTelegraph(e) {
  // windup: thin arc outline growing → committed: translucent red fill
  const isAim = e.state === 'aim';
  const dur = isAim ? e.aimT : e.wDur;
  const p = clamp(e.stateT / dur, 0, 1);
  if (isAim) {
    // archer: firing line, faint then sharpening
    // charged boss shots project the full flight path — dodge, don't block
    const lineLen = e.chargedShot ? 900 : 120 + p * 60;
    ctx.save();
    ctx.strokeStyle = teleRGBA(.15 + p * .5);
    ctx.lineWidth = p > .75 ? 2.5 : 1.2;
    ctx.setLineDash(p > .75 ? [] : [5, 6]);
    ctx.beginPath();
    ctx.moveTo(e.x + Math.cos(e.face) * (e.r + 4), e.y + Math.sin(e.face) * (e.r + 4));
    ctx.lineTo(e.x + Math.cos(e.face) * lineLen, e.y + Math.sin(e.face) * lineLen);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const range = e.attackRange + e.r, arc = e.attackArc;
  ctx.save();
  ctx.translate(e.x, e.y);
  if (p > .68 && !e.isFeint) {
    // committed — filled danger sector
    ctx.fillStyle = teleRGBA(e.heavy ? .30 : .20);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, range, e.face - arc / 2, e.face + arc / 2);
    ctx.closePath();
    ctx.fill();
  }
  const pulse = e.heavy ? (Math.sin(game.time * 18) * .5 + .5) * .3 : 0;
  ctx.strokeStyle = teleRGBA(.35 + p * .5 + pulse);
  ctx.lineWidth = e.heavy ? 3.5 : 1.8;
  ctx.beginPath();
  ctx.arc(0, 0, range * (0.55 + 0.45 * p), e.face - arc / 2, e.face + arc / 2);
  ctx.stroke();
  ctx.restore();
}
function drawWeapon(e) {
  const a = e.face;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.strokeStyle = INK; ctx.lineCap = 'round';
  let ang = a + .5;   // resting angle
  if (e.state === 'windup' || e.state === 'aim') ang = a - 1.5 + (e.stateT / (e.wDur || e.aimT || 1)) * .3;
  if (e.state === 'attack') ang = lerp(-e.attackArc / 2, e.attackArc / 2, clamp(e.stateT / e.activeDur, 0, 1)) + a;
  if (e.weapon === 'club') {
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * e.r * .6, Math.sin(ang) * e.r * .6);
    ctx.lineTo(Math.cos(ang) * (e.r + 18), Math.sin(ang) * (e.r + 18));
    ctx.stroke();
    // a cruel knot near the head — a club, not a walking stick
    ctx.lineWidth = 2.2;
    const kd = e.r + 12;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * kd - Math.sin(ang) * 4, Math.sin(ang) * kd + Math.cos(ang) * 4);
    ctx.lineTo(Math.cos(ang) * kd + Math.sin(ang) * 4, Math.sin(ang) * kd - Math.cos(ang) * 4);
    ctx.stroke();
  } else if (e.weapon === 'rapier') {
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * e.r * .6, Math.sin(ang) * e.r * .6);
    ctx.lineTo(Math.cos(ang) * (e.r + 30), Math.sin(ang) * (e.r + 30));
    ctx.stroke();
    // the guard — a small cross at the hilt
    ctx.lineWidth = 2.4;
    const gd = e.r * .78;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * gd - Math.sin(ang) * 4.5, Math.sin(ang) * gd + Math.cos(ang) * 4.5);
    ctx.lineTo(Math.cos(ang) * gd + Math.sin(ang) * 4.5, Math.sin(ang) * gd - Math.cos(ang) * 4.5);
    ctx.stroke();
  } else if (e.weapon === 'slab') {
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * e.r * .5, Math.sin(ang) * e.r * .5);
    ctx.lineTo(Math.cos(ang) * (e.r + 26), Math.sin(ang) * (e.r + 26));
    ctx.stroke();
  } else if (e.weapon === 'knife') {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * e.r * .6, Math.sin(ang) * e.r * .6);
    ctx.lineTo(Math.cos(ang) * (e.r + 11), Math.sin(ang) * (e.r + 11));
    ctx.stroke();
  } else if (e.weapon === 'spear') {
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * e.r * .4, Math.sin(ang) * e.r * .4);
    ctx.lineTo(Math.cos(ang) * (e.r + 34), Math.sin(ang) * (e.r + 34));
    ctx.stroke();
    ctx.lineWidth = 4.5;   // the head
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * (e.r + 27), Math.sin(ang) * (e.r + 27));
    ctx.lineTo(Math.cos(ang) * (e.r + 34), Math.sin(ang) * (e.r + 34));
    ctx.stroke();
  } else if (e.weapon === 'bow') {
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * (e.r + 4), Math.sin(a) * (e.r + 4), 11, a - 1.2, a + 1.2);
    ctx.stroke();
    if (e.state === 'aim') {   // drawn string + nocked arrow
      const pull = clamp(e.stateT / e.aimT, 0, 1) * 8;
      ctx.lineWidth = 1;
      const bx = Math.cos(a) * (e.r + 4), by = Math.sin(a) * (e.r + 4);
      const sx = bx - Math.cos(a) * pull, sy = by - Math.sin(a) * pull;
      ctx.beginPath();
      ctx.moveTo(bx + Math.cos(a - 1.2) * 11, by + Math.sin(a - 1.2) * 11);
      ctx.lineTo(sx, sy);
      ctx.lineTo(bx + Math.cos(a + 1.2) * 11, by + Math.sin(a + 1.2) * 11);
      ctx.stroke();
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(a) * 16, sy + Math.sin(a) * 16);
      ctx.stroke();
    }
  }
  ctx.restore();
}
/* ---------- ink-menace bodies (2026-07-09) ----------
   Mobs are no longer clean circles: each is a RAGGED brush blob (stable
   per foe via inkSeed, breathing slightly), wearing a mempo mask whose
   eye slits flare the danger color only while a blow is promised.
   Menace RAMPS with tier — grunts subtle, lords dreadful — so dread is
   also information. Pure render; hitboxes stay e.r circles.           */
function inkBlobPath(x, y, r, seed, st, face) {
  const rng = mulberry32((seed || 1) >>> 0);
  const n = st.n || 12, j = [];
  for (let i = 0; i < n; i++) j.push(rng());
  for (let i = 0; i <= n; i++) {
    const k = i % n, a = (k / n) * TAU;
    let wob = 1 + (j[k] - .5) * .22 * st.rough
            + Math.sin(game.time * 1.5 + k * 2.1) * .02;
    if (st.spike) wob += (k % 2 ? st.spike : -st.spike * .6);
    // the SHAPE is the identity: stretch along the facing (lean fighters)
    // or across it (wide ones) — cos² blends the two axes smoothly
    const c = Math.cos(a - (face || 0));
    const stretch = 1 + ((st.elong || 1) - 1) * c * c
                  + ((st.squish || 1) - 1) * (1 - c * c);
    const rr = r * wob * stretch;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) { ctx.beginPath(); ctx.moveTo(px, py); }
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}
/* one silhouette ARCHETYPE per type — this, not a shared mask, is what
   tells the yard apart at a glance:
   grunt round · duelist LEAN · brute WIDE · archer trim under a big hat ·
   shinobi JAGGED · ashigaru PLATED (few smooth points) · mirror POLISHED ·
   duelmaster lean+ · lords massive and ragged                          */
function bodyStyleOf(e) {
  let st;
  if (e.isBoss)             st = { n: 12, rough: 1.2, elong: 1, squish: 1 };
  else if (e.mirrorAll)     st = { n: 16, rough: .15, elong: 1, squish: 1 };
  else if (e.chainMax)      st = { n: 12, rough: .6, elong: 1.28, squish: .8 };
  else if (e.weapon === 'slab')   st = { n: 10, rough: 1, elong: .88, squish: 1.28 };
  else if (e.weapon === 'rapier') st = { n: 12, rough: .55, elong: 1.3, squish: .78 };
  else if (e.weapon === 'knife')  st = { n: 9, rough: .8, elong: 1, squish: 1, spike: .09 };
  else if (e.weapon === 'spear')  st = { n: 8, rough: .22, elong: 1, squish: 1 };
  else if (e.weapon === 'bow')    st = { n: 12, rough: .4, elong: 1, squish: .92 };
  else                      st = { n: 11, rough: .5, elong: 1, squish: 1 };
  if (e.elite) st.rough += .3;
  return st;
}
// per-type silhouette features — evocative ink strokes, tier-scaled
function drawMenace(e, drawR) {
  const s = e.isBoss ? Math.max(1, e.r / 14) : 1;
  const back = e.face + Math.PI;
  ctx.lineCap = 'round';
  // 鬼 horns: every elite, and the slab-bearers by birthright
  if (e.elite || e.weapon === 'slab') {
    ctx.strokeStyle = 'rgba(24,19,16,.95)';
    ctx.lineWidth = (e.weapon === 'slab' ? 3.5 : 2.6) * s;
    for (const hs of [-1, 1]) {
      const ha = e.face + hs * 1.05;
      const bx = e.x + Math.cos(ha) * drawR * .85;
      const by = e.y + Math.sin(ha) * drawR * .85;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(
        bx + Math.cos(ha + hs * .35) * 9 * s, by + Math.sin(ha + hs * .35) * 9 * s,
        bx + Math.cos(ha - hs * .2) * 14 * s, by + Math.sin(ha - hs * .2) * 14 * s);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = INK;
  if (e.weapon === 'slab') {
    // the brute LOOMS: shoulder mass swelling past the body
    ctx.lineWidth = 5 * s;
    for (const hs of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, drawR * 1.06, back + hs * .25, back + hs * .95, hs < 0);
      ctx.stroke();
    }
  } else if (e.weapon === 'club') {
    // a rough topknot
    ctx.lineWidth = 2.4 * s;
    ctx.beginPath();
    ctx.moveTo(e.x + Math.cos(back) * drawR * .8, e.y + Math.sin(back) * drawR * .8);
    ctx.lineTo(e.x + Math.cos(back + .25) * (drawR + 7 * s),
               e.y + Math.sin(back + .25) * (drawR + 7 * s));
    ctx.stroke();
  } else if (e.weapon === 'rapier') {
    // duelist: a swept crest feather; the duelmaster wears it CROSSED,
    // and the pair flicks wide while the flurry chain is live
    const crossed = !!e.chainMax;
    const flick = crossed && e.chain > 0 ? .3 : 0;
    ctx.lineWidth = 2 * s;
    for (const cs of crossed ? [-1, 1] : [1]) {
      const ca = back + cs * (.35 + flick);
      ctx.beginPath();
      ctx.moveTo(e.x + Math.cos(ca) * drawR * .7, e.y + Math.sin(ca) * drawR * .7);
      ctx.quadraticCurveTo(
        e.x + Math.cos(ca + cs * .3) * (drawR + 8 * s), e.y + Math.sin(ca + cs * .3) * (drawR + 8 * s),
        e.x + Math.cos(ca + cs * .15) * (drawR + 14 * s), e.y + Math.sin(ca + cs * .15) * (drawR + 14 * s));
      ctx.stroke();
    }
  } else if (e.weapon === 'bow') {
    // 笠 the archer's straw hat — BIG, the defining read at a glance
    ctx.strokeStyle = 'rgba(245,234,210,.85)';
    ctx.lineWidth = 5 * s;
    ctx.beginPath();
    ctx.arc(e.x, e.y, drawR * 1.02, back - 1.35, back + 1.35);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(24,19,16,.7)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(e.x, e.y, drawR * 1.18, back - 1.15, back + 1.15);
    ctx.stroke();
  } else if (e.weapon === 'knife') {
    // shinobi: tatters streaming off the back — always half-vanishing
    ctx.strokeStyle = 'rgba(43,35,32,.55)';
    ctx.lineWidth = 1.6;
    for (const ts of [-.35, .2, .55]) {
      const ta = back + ts;
      const flut = Math.sin(game.time * 6 + ts * 9) * 3;
      ctx.beginPath();
      ctx.moveTo(e.x + Math.cos(ta) * drawR * .8, e.y + Math.sin(ta) * drawR * .8);
      ctx.lineTo(e.x + Math.cos(ta) * (drawR + 11) - Math.sin(ta) * flut,
                 e.y + Math.sin(ta) * (drawR + 11) + Math.cos(ta) * flut);
      ctx.stroke();
    }
  } else if (e.shielded) {
    // 陣笠 the ashigaru's flat war hat — wide and heavy over the plates
    ctx.lineWidth = 3.6 * s;
    ctx.beginPath();
    ctx.arc(e.x, e.y, drawR * 1.08, back - 1.0, back + 1.0);
    ctx.stroke();
  }
  if (e.mirrorAll) {
    // the mirror's sheen — a cold highlight that dies when the stance cracks
    ctx.strokeStyle = e.brokenT > 0 ? 'rgba(245,234,210,.15)' : 'rgba(245,234,210,.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x - drawR * .25, e.y - drawR * .25, drawR * .55, -2.4, -1.1);
    ctx.stroke();
  }
}
function drawEnemy(e) {
  const spawnP = e.state === 'spawn' ? clamp(e.stateT / .7, 0, 1) : 1;
  ctx.save();
  ctx.globalAlpha = spawnP;
  drawShadow(e.x, e.y, e.r);
  if (e.state === 'windup' || e.state === 'aim') drawTelegraph(e);
  // shinobi mid-vanish: mark the strike point with a gathering smoke ring —
  // it promises damage, so it speaks the danger color (colorblind-aware)
  if (e.state === 'vanishprep' && e.dest) {
    const p = clamp(e.stateT / .55, 0, 1);
    ctx.strokeStyle = teleRGBA(.25 + p * .5);
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.arc(e.dest.x, e.dest.y, 18 - p * 6, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
  }
  // elite damage aura — the seared ring is always visible
  if (e.affix === 'aura') {
    ctx.strokeStyle = teleRGBA(.4);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 6]);
    ctx.beginPath(); ctx.arc(e.x, e.y, 64, game.time * .6, game.time * .6 + TAU); ctx.stroke();
    ctx.setLineDash([]);
  }
  // body — the value ramp: lords are inked darkest with the heaviest
  // outline, elites sink toward that end; hue never marks a foe.
  // The body is a RAGGED brush blob now, and it INHALES on a windup —
  // a draw-only swell (hitbox untouched) that doubles the telegraph.
  const winding = e.state === 'windup' || e.state === 'aim';
  const drawR = e.r * (winding ? 1.04 : 1);
  ctx.fillStyle = e.flashT > 0 ? REDHOT
    : e.isBoss ? '#332b25'
    : e.elite ? '#4a423a'
    : e.color;
  ctx.strokeStyle = e.isBoss ? '#181310' : INK;
  ctx.lineWidth = e.isBoss ? 5 : e.r > 18 ? 4 : 3;
  ctx.lineJoin = 'round';
  inkBlobPath(e.x, e.y, drawR, e.inkSeed, bodyStyleOf(e), e.face);
  ctx.fill(); ctx.stroke();
  ctx.lineJoin = 'miter';
  // elite mark: the heaviest ink ring in the yard, doubled — pure value.
  // (their reward still reads gold: the honor orbs they shatter into.)
  if (e.elite) {
    ctx.strokeStyle = 'rgba(24,19,16,.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 4.5, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(43,35,32,.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 8, 0, TAU); ctx.stroke();
  }
  // broken stance — the figure reels, gold sparks drifting off
  if (e.brokenT > 0 && Math.random() < .3)
    sparks(e.x + crand(-e.r, e.r), e.y - e.r, -Math.PI / 2, GOLD, 1, .5);
  // eyes for EVERYONE — pale slits at rest, flaring the DANGER color while
  // a blow is promised (teleRGBA — colorblind palette holds for free),
  // violet under an ascendant surge. The 面 mempo MASK band, though, is a
  // costume — and a costume worn by all is a uniform: only the shinobi,
  // the duelmaster and the lords hide their faces now. Everyone else is
  // told apart by SILHOUETTE (bodyStyleOf) and headwear (drawMenace).
  if (!e.ghost && e.weapon !== 'none') {
    if (e.weapon === 'knife' || e.chainMax || e.isBoss) {
      const maskHalf = e.weapon === 'knife' ? 1.35 : .95;
      ctx.strokeStyle = 'rgba(24,19,16,.85)';
      ctx.lineWidth = e.isBoss ? 5.5 : e.r > 18 ? 4.5 : 3.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, drawR * .62, e.face - maskHalf, e.face + maskHalf);
      ctx.stroke();
    }
    // rest-state slits must CONTRAST the body: dark eyes on the pale
    // types (archer, shinobi, grunt), pale eyes on the inked ones
    const lightBody = e.weapon === 'bow' || e.weapon === 'knife' || e.weapon === 'club';
    ctx.strokeStyle = e.surgeT > 0 ? '#7c5cff'
      : winding ? teleRGBA(.95)
      : lightBody && !e.elite && !e.isBoss ? 'rgba(24,19,16,.9)'
      : 'rgba(245,234,210,.85)';
    ctx.lineWidth = winding ? 2.6 : 2;
    ctx.lineCap = 'round';
    for (const s of [-.42, .42]) {
      const ea = e.face + s;
      ctx.beginPath();
      ctx.moveTo(e.x + Math.cos(ea) * drawR * .48, e.y + Math.sin(ea) * drawR * .48);
      ctx.lineTo(e.x + Math.cos(ea) * drawR * .72, e.y + Math.sin(ea) * drawR * .72);
      ctx.stroke();
    }
    drawMenace(e, drawR);
  } else {
    // the old honest notch, for fixtures and flickers
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(e.x + Math.cos(e.face) * e.r * .45, e.y + Math.sin(e.face) * e.r * .45);
    ctx.lineTo(e.x + Math.cos(e.face) * (e.r - 2), e.y + Math.sin(e.face) * (e.r - 2));
    ctx.stroke();
  }
  // ashigaru shield — a raised wall until the stance breaks
  if (e.shielded) {
    const down = e.brokenT > 0;
    ctx.strokeStyle = down ? 'rgba(43,35,32,.25)' : INK;
    ctx.lineWidth = down ? 3 : 5.5;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r + 4, e.face - 1.05, e.face + 1.05);
    ctx.stroke();
  }
  drawWeapon(e);
  // hp bar (only once damaged)
  if (e.hp < e.maxHp) {
    const w = e.r * 2.2;
    ctx.fillStyle = 'rgba(43,35,32,.35)';
    ctx.fillRect(e.x - w / 2, e.y - e.r - 10, w, 4);
    ctx.fillStyle = RED;
    ctx.fillRect(e.x - w / 2, e.y - e.r - 10, w * clamp(e.hp / e.maxHp, 0, 1), 4);
  }
  // posture bar — a thin gold line that fills toward the break
  if (e.posture > 0) {
    const w = e.r * 2.2;
    ctx.fillStyle = 'rgba(43,35,32,.25)';
    ctx.fillRect(e.x - w / 2, e.y - e.r - 5, w, 2.5);
    ctx.fillStyle = e.brokenT > 0 ? REDHOT : GOLD;
    ctx.fillRect(e.x - w / 2, e.y - e.r - 5, w * clamp(e.posture / e.postureMax, 0, 1), 2.5);
  }
  ctx.restore();
}
// glint: a bright bevel line down the edge · hamon: the smith's temper wave
const BLADE_STYLE = {
  tetsu:     { color: INK,       w: 3,   glint: 'rgba(252,250,244,.5)',
               hamon: 'rgba(252,250,244,.28)' },
  ame:       { color: '#7d7f86', w: 1.6, glint: 'rgba(230,232,236,.55)' },
  shirasagi: { color: '#f7f3e8', w: 2.6, outline: true, glint: 'rgba(168,132,58,.4)' },
  botan:     { color: GOLD,      w: 3,   outline: true, glint: 'rgba(255,238,244,.6)' },
  kurogane:  { color: '#1c1815', w: 4,   glint: 'rgba(146,128,118,.45)' },
  tsukikage: { color: '#232030', w: 3,   glint: 'rgba(150,150,160,.5)' },
  akaoni:    { color: '#8f1f18', w: 3.4, glint: 'rgba(255,132,96,.35)',
               hamon: 'rgba(255,90,60,.4)' },
  raiko:     { color: '#575d66', w: 3.4, glint: 'rgba(214,218,224,.5)' },
  fudemaru:  { color: '#1a1512', w: 4 },
};
function drawBlade(p, ang, len, wpn, act) {
  const hx = p.x + Math.cos(ang) * p.r * .7, hy = p.y + Math.sin(ang) * p.r * .7;
  const tx = p.x + Math.cos(ang) * (p.r + len), ty = p.y + Math.sin(ang) * (p.r + len);
  const nx = Math.cos(ang + Math.PI / 2), ny = Math.sin(ang + Math.PI / 2);
  const style = BLADE_STYLE[wpn.id] || BLADE_STYLE.tetsu;
  ctx.lineCap = 'round';
  if (wpn.id === 'fudemaru') {
    // a calligrapher's brush, twice any blade's length
    const L = len * 1.8 + 10;
    const bx = p.x + Math.cos(ang) * (p.r + L), by = p.y + Math.sin(ang) * (p.r + L);
    // lacquered handle
    ctx.strokeStyle = '#1a1512'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(hx, hy);
    ctx.lineTo(lerp(hx, bx, .78), lerp(hy, by, .78)); ctx.stroke();
    // white cord wraps
    ctx.strokeStyle = '#f5ead2'; ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      const t = .1 + i * .09;
      ctx.beginPath();
      ctx.moveTo(lerp(hx, bx, t) + nx * 3, lerp(hy, by, t) + ny * 3);
      ctx.lineTo(lerp(hx, bx, t) - nx * 3, lerp(hy, by, t) - ny * 3);
      ctx.stroke();
    }
    // ink-heavy bristles, tapering to the tip
    ctx.strokeStyle = INK; ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(lerp(hx, bx, .78), lerp(hy, by, .78));
    ctx.lineTo(lerp(hx, bx, .93), lerp(hy, by, .93)); ctx.stroke();
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(lerp(hx, bx, .93), lerp(hy, by, .93));
    ctx.lineTo(bx, by); ctx.stroke();
    // stray bristle strands splaying from the tuft
    ctx.strokeStyle = 'rgba(43,35,32,.55)'; ctx.lineWidth = 1;
    for (const o of [-2.2, 2.2]) {
      ctx.beginPath();
      ctx.moveTo(lerp(hx, bx, .8) + nx * o, lerp(hy, by, .8) + ny * o);
      ctx.lineTo(lerp(hx, bx, .96) + nx * o * .4, lerp(hy, by, .96) + ny * o * .4);
      ctx.stroke();
    }
    // the drop that never falls
    ctx.fillStyle = 'rgba(43,35,32,.85)';
    ctx.beginPath(); ctx.arc(bx, by + 4, 2, 0, TAU); ctx.fill();
    return;
  }
  // pale blades get a faint ink outline so they read on parchment
  if (style.outline) {
    ctx.strokeStyle = 'rgba(43,35,32,.55)'; ctx.lineWidth = style.w + 2;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
  }
  ctx.strokeStyle = (act && act.charged) ? '#eef4ff' : style.color;
  ctx.lineWidth = style.w;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
  // steel texture — a glint down the bevel; a temper wave where the fire kissed
  if (style.glint) {
    const go = style.w * .32;
    ctx.strokeStyle = style.glint; ctx.lineWidth = .9;
    ctx.beginPath();
    ctx.moveTo(lerp(hx, tx, .16) + nx * go, lerp(hy, ty, .16) + ny * go);
    ctx.lineTo(lerp(hx, tx, .86) + nx * go, lerp(hy, ty, .86) + ny * go);
    ctx.stroke();
  }
  if (style.hamon) {
    ctx.strokeStyle = style.hamon; ctx.lineWidth = .8;
    ctx.beginPath();
    ctx.moveTo(lerp(hx, tx, .14) - nx * .5, lerp(hy, ty, .14) - ny * .5);
    for (let i = 1; i <= 5; i++) {
      const ht = .14 + i * .14, off = i % 2 ? -1.5 : -.4;
      ctx.lineTo(lerp(hx, tx, ht) + nx * off, lerp(hy, ty, ht) + ny * off);
    }
    ctx.stroke();
  }
  if (wpn.id === 'kurogane') {
    // jagged crow-wing edge + red spine that pulses with the combo
    ctx.strokeStyle = style.color; ctx.lineWidth = 1.8;
    for (let i = 1; i <= 3; i++) {
      const t = .25 + i * .18;
      const jx = lerp(hx, tx, t), jy = lerp(hy, ty, t);
      ctx.beginPath(); ctx.moveTo(jx, jy);
      ctx.lineTo(jx + nx * 5, jy + ny * 5); ctx.stroke();
    }
    const pulse = Math.min(.85, .2 + game.combo * .08) * (Math.sin(game.time * 10) * .2 + .8);
    ctx.strokeStyle = `rgba(181,52,42,${pulse})`; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(hx - nx * 2, hy - ny * 2); ctx.lineTo(tx - nx * 2, ty - ny * 2);
    ctx.stroke();
    // iron rivets along the spine
    ctx.fillStyle = 'rgba(120,100,64,.8)';
    for (let i = 0; i < 2; i++) {
      const rt = .3 + i * .28;
      ctx.beginPath();
      ctx.arc(lerp(hx, tx, rt) - nx * 1.2, lerp(hy, ty, rt) - ny * 1.2, 1, 0, TAU);
      ctx.fill();
    }
  } else if (wpn.id === 'shirasagi') {
    // gold filigree near the hilt
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(lerp(hx, tx, .08) + nx * 2.5, lerp(hy, ty, .08) + ny * 2.5);
    ctx.lineTo(lerp(hx, tx, .28) - nx * 2.5, lerp(hy, ty, .28) - ny * 2.5);
    ctx.stroke();
    // feather barbs sweeping off the spine
    ctx.strokeStyle = 'rgba(43,35,32,.3)'; ctx.lineWidth = .8;
    for (let i = 0; i < 3; i++) {
      const bt = .45 + i * .16;
      ctx.beginPath();
      ctx.moveTo(lerp(hx, tx, bt), lerp(hy, ty, bt));
      ctx.lineTo(lerp(hx, tx, bt - .06) + nx * 3, lerp(hy, ty, bt - .06) + ny * 3);
      ctx.stroke();
    }
  } else if (wpn.id === 'akaoni') {
    // black serrated tip
    ctx.strokeStyle = INK; ctx.lineWidth = style.w;
    ctx.beginPath();
    ctx.moveTo(lerp(hx, tx, .72), lerp(hy, ty, .72)); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 2; i++) {
      const t = .75 + i * .12;
      ctx.beginPath();
      ctx.moveTo(lerp(hx, tx, t), lerp(hy, ty, t));
      ctx.lineTo(lerp(hx, tx, t) + nx * 4, lerp(hy, ty, t) + ny * 4);
      ctx.stroke();
    }
  } else if (wpn.id === 'botan') {
    // soft etching near the guard — gray now; the bloom waits for the surge
    ctx.strokeStyle = 'rgba(150,138,128,.85)'; ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(lerp(hx, tx, .1) + nx * 2, lerp(hy, ty, .1) + ny * 2);
    ctx.lineTo(lerp(hx, tx, .32) + nx * 2, lerp(hy, ty, .32) + ny * 2);
    ctx.stroke();
    // a single engraved petal on the flat
    ctx.save();
    ctx.translate(lerp(hx, tx, .55), lerp(hy, ty, .55));
    ctx.rotate(ang + .5);
    ctx.strokeStyle = 'rgba(140,130,122,.6)'; ctx.lineWidth = .9;
    ctx.beginPath(); ctx.ellipse(0, 0, 2.6, 1.3, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  } else if (wpn.id === 'ame') {
    // rain beads clinging to the needle
    ctx.fillStyle = 'rgba(224,234,248,.7)';
    for (let i = 0; i < 3; i++) {
      const bt = .3 + i * .22;
      ctx.beginPath();
      ctx.arc(lerp(hx, tx, bt), lerp(hy, ty, bt), .9, 0, TAU);
      ctx.fill();
    }
  } else if (wpn.id === 'tsukikage') {
    // a crescent scar near the tip — the moon lives in the steel
    ctx.strokeStyle = 'rgba(132,130,140,.55)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(lerp(hx, tx, .78), lerp(hy, ty, .78), 3.2, ang + .6, ang + Math.PI - .6);
    ctx.stroke();
  } else if (wpn.id === 'raiko') {
    // lightning etch down the fuller
    ctx.strokeStyle = (act && act.charged) ? '#ffffff' : '#c9cdd4';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(lerp(hx, tx, .15), lerp(hy, ty, .15));
    for (let i = 1; i <= 4; i++) {
      const t = .15 + i * .17, off = i % 2 ? 2.4 : -2.4;
      ctx.lineTo(lerp(hx, tx, t) + nx * off, lerp(hy, ty, t) + ny * off);
    }
    ctx.stroke();
    // the storm's haze clings to the whole length
    ctx.strokeStyle = 'rgba(148,148,152,.22)'; ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(lerp(hx, tx, .1), lerp(hy, ty, .1));
    ctx.lineTo(lerp(hx, tx, .9), lerp(hy, ty, .9));
    ctx.stroke();
  }
  // guard (tsuba) — gold-wrapped only on the legendary blade
  const gx = p.x + Math.cos(ang) * (p.r + 3), gy = p.y + Math.sin(ang) * (p.r + 3);
  ctx.strokeStyle = wpn.id === 'raiko' ? GOLD : INK;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(gx + nx * 3.5, gy + ny * 3.5);
  ctx.lineTo(gx - nx * 3.5, gy - ny * 3.5);
  ctx.stroke();
}
function drawPlayer(pl) {
  const p = pl || player;   // co-op: the same brush paints both blades
  drawShadow(p.x, p.y, p.r);
  // the fallen kneel — a faded silhouette waiting for the wave to break
  if (p.downed) {
    ctx.globalAlpha = .45;
    ctx.fillStyle = CREAM; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y + 3, p.r * .85, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = RED;
    ctx.font = '13px Georgia,serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('倒', p.x, p.y - p.r - 14);
    ctx.globalAlpha = 1;
    return;
  }
  if (!p.p2 && game.ult.run) drawUltRun(game.ult.run, p);   // windup telegraphs & stance glow
  if (!p.p2 && game.ult.env > 0 && game.mode !== 'duel')
    drawUltWings(p.x, p.y, p.face, game.equipped, p.r, game.ult.env);
  // hurt-iframe blink
  if (p.iT > 0 && Math.sin(game.time * 40) > 0) ctx.globalAlpha = .45;
  // roll: squash + motion streaks — neon dashes while the 奥義 burns
  const rolling = p.action && p.action.type === 'dodge';
  if (rolling) {
    if (!p.p2 && ultActive()) {
      neonRollStreaks(p.x, p.y, p.action.dx, p.action.dy, p.r, weaponNeon(game.equipped));
    } else {
      ctx.strokeStyle = 'rgba(43,35,32,.3)'; ctx.lineWidth = 2;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(p.x - p.action.dx * i * 9, p.y - p.action.dy * i * 9, p.r - i * 2, 0, TAU);
        ctx.stroke();
      }
    }
  }
  // 虚 hollow — a gray gasp of a ring while the lungs are empty
  if (p.hollowT > 0) {
    ctx.strokeStyle = 'rgba(43,35,32,.4)'; ctx.lineWidth = 1.6;
    ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 7 + Math.sin(game.time * 9) * 2, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(43,35,32,.55)';
    ctx.font = '12px Georgia,serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('虚', p.x, p.y - p.r - 16);
  }
  // body
  ctx.fillStyle = p.flashT > 0 ? REDHOT : CREAM;
  ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); ctx.stroke();
  // headband + trailing ribbon — gold for the tournament champion.
  // Ten lives brushed in gold: the cycle-10 stroke rides beneath it.
  if (!p.p2 && rebirthLevel() >= 10) {
    ctx.strokeStyle = 'rgba(245,194,66,.8)'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 3.5, p.face - .7, p.face + .7); ctx.stroke();
  }
  // the second blade wears ink, not cinnabar — told apart by value
  ctx.strokeStyle = p.p2 ? 'rgba(43,35,32,.85)'
                  : save.headband === 'gold' ? GOLD : RED;
  ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(p.x, p.y, p.r - 3, p.face + 2.4, p.face + 3.9); ctx.stroke();
  ctx.lineWidth = 2;
  const bx = p.x - Math.cos(p.face) * (p.r - 1), by = p.y - Math.sin(p.face) * (p.r - 1);
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.quadraticCurveTo(
    bx - Math.cos(p.face) * 7 + Math.sin(game.time * 7) * 3,
    by - Math.sin(p.face) * 7 + Math.cos(game.time * 7) * 3,
    bx - Math.cos(p.face) * 13, by - Math.sin(p.face) * 13 + Math.sin(game.time * 7) * 2);
  ctx.stroke();
  // eyes
  ctx.fillStyle = INK;
  const ex = Math.cos(p.face), ey = Math.sin(p.face);
  ctx.beginPath();
  ctx.arc(p.x + ex * 6 - ey * 3.5, p.y + ey * 6 + ex * 3.5, 1.6, 0, TAU);
  ctx.arc(p.x + ex * 6 + ey * 3.5, p.y + ey * 6 - ex * 3.5, 1.6, 0, TAU);
  ctx.fill();
  // sword — rendered per equipped weapon
  const a = p.action;
  const wpn = wpnOf(p);
  ctx.lineCap = 'round';
  let bladeAng = p.face + .55, bladeLen = 26;
  if (a && a.type === 'attack') {
    if (a.t < a.startup) {
      // startup: blade pulled back + telegraph arc in the blade's temper
      bladeAng = p.face - 1.5 * a.dir;
      const tp = a.t / a.startup;
      ctx.save();
      if (wpn.id === 'akaoni') {          // heavier, saturated warning
        ctx.strokeStyle = `rgba(160,25,18,${.3 + tp * .5})`; ctx.lineWidth = 2.6;
      } else if (wpn.id === 'raiko') {    // storm-light flash, now white-gray
        ctx.strokeStyle = `rgba(200,202,206,${.3 + tp * .5})`; ctx.lineWidth = 2.2;
      } else {
        ctx.strokeStyle = `rgba(43,35,32,${.2 + tp * .35})`; ctx.lineWidth = 1.5;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, a.reach, p.face - a.arc / 2, p.face + a.arc / 2);
      ctx.stroke();
      ctx.restore();
      bladeLen = 30;
    } else if (a.t < a.startup + a.active) {
      const tp = (a.t - a.startup) / a.active;
      bladeAng = p.face + lerp(-1.15, 1.15, tp) * a.dir;
      bladeLen = a.reach - p.r + 4;
    } else {
      bladeAng = p.face + 1.15 * a.dir;
      bladeLen = 28;
    }
  }
  // meditation: a calm gold ring, breath rising
  if (p.meditating) {
    const br = .5 + Math.sin(game.time * 3) * .12;
    ctx.strokeStyle = `rgba(168,132,58,${br * .6})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 6]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 12 + Math.sin(game.time * 3) * 2, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(168,132,58,${br})`;
    ctx.font = '13px Georgia,serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('瞑', p.x, p.y - p.r - 24);
  }
  // parry: a raised gold guard across the facing — gray once whiffed
  if (a && a.type === 'parry') {
    const active = a.t <= PARRY.active;
    ctx.strokeStyle = active ? GOLD : 'rgba(43,35,32,.35)';
    ctx.lineWidth = active ? 4 : 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 9, p.face - .95, p.face + .95);
    ctx.stroke();
  }
  // riposte window — a fading gold ring begging for the answer
  if (p.riposteT > 0) {
    ctx.strokeStyle = `rgba(168,132,58,${Math.min(.7, p.riposteT)})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 14, game.time * 2, game.time * 2 + TAU); ctx.stroke();
    ctx.setLineDash([]);
  }
  if (p.stance === 'bow' && wpn.id !== 'fudemaru') {
    drawEntityBow(p, bowOf(p), p.bowDraw, false);
  } else drawBlade(p, bladeAng, bladeLen, wpn, a);
  // Fudemaru hold-charge: the ring grows, the coming symbol shows itself
  if (wpn.id === 'fudemaru' && p.vHeld && game.state === 'playing') {
    const held = game.time - p.vDownAt;
    const sinceDodge = game.time - p.lastDodgeStart;
    const flow = sinceDodge > 0 && sinceDodge < DODGE.dur + .5;
    let ch, col;
    if (held >= 1.0) { ch = '命'; col = GOLD; }
    else if (held >= .45) { ch = '無'; col = INK; }
    else if (game.ultMode) { ch = '滅'; col = '#7a6cc0'; }
    else {
      const stormTap = game.brushSwap ? !flow : flow;
      ch = stormTap ? '雷' : '火';
      col = stormTap ? '#5b78c9' : RED;
    }
    ctx.strokeStyle = held >= 1.0 ? GOLD : held >= .45 ? RED : 'rgba(43,35,32,.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 20 + Math.min(held, 1.2) * 18, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.font = '18px Georgia,serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ch, p.x, p.y - p.r - 26);
  }
  ctx.globalAlpha = 1;
}
function drawStalk(st) {
  ctx.save();
  drawShadow(st.x, st.y, st.r);
  ctx.fillStyle = st.hp > 1 ? '#6e6a5c' : '#8b8577';   // ink bamboo: dark standing, pale cracked
  ctx.strokeStyle = '#3f3b33'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(63,59,51,.7)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(st.x, st.y, st.r * .55, 0, TAU); ctx.stroke();
  ctx.restore();
}
function drawFireZone(f) {
  // a hazard that bites is DANGER: the ring speaks cinnabar through
  // teleRGBA (colorblind-aware); the body of the flame is charcoal wash —
  // no ember orange survives the ink rule
  const pulse = .75 + Math.sin(f.phase * 3) * .25;
  ctx.save();
  ctx.fillStyle = `rgba(56,48,42,${.18 * pulse})`;
  ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill();
  ctx.fillStyle = teleRGBA(.12 * pulse);
  ctx.beginPath(); ctx.arc(f.x, f.y, f.r * .62, 0, TAU); ctx.fill();
  ctx.strokeStyle = teleRGBA(.5 * pulse); ctx.lineWidth = 2;
  ctx.setLineDash([6, 7]);
  ctx.beginPath(); ctx.arc(f.x, f.y, f.r, f.phase * .4, f.phase * .4 + TAU); ctx.stroke();
  ctx.restore();
}
function drawPortalFX() {
  const p = portal, pulse = 1 + Math.sin(p.t * 3.2) * .08;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(43,35,32,.25)';
  ctx.beginPath(); ctx.ellipse(0, 44, 26, 8, 0, 0, TAU); ctx.fill();
  // the rift — a tall ink tear, lined in the level's accent
  ctx.strokeStyle = p.accent; ctx.lineWidth = 3;
  ctx.fillStyle = '#14100e';
  ctx.beginPath();
  ctx.ellipse(0, 0, 15 * pulse, 44 * pulse, Math.sin(p.t * .8) * .06, 0, TAU);
  ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(0, 0, 8 * pulse, 30 * pulse, 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = p.accent;
  ctx.font = 'italic 12px Georgia,serif'; ctx.textAlign = 'center';
  ctx.fillText(p.kind === 'merchant' ? 'the stall'
             : p.kind === 'home' ? '帰 the road home' : 'onward', 0, 64);
  ctx.restore();
}
function drawMerchant() {
  const m = merchant;
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.fillStyle = 'rgba(43,35,32,.14)';
  ctx.beginPath(); ctx.ellipse(0, 34, 56, 10, 0, 0, TAU); ctx.fill();
  // scroll-covered counter
  ctx.fillStyle = '#5a4632';
  ctx.fillRect(-46, -12, 92, 28);
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(-46, -12, 92, 28);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 ? CREAM : '#e2d5b6';
    ctx.fillRect(-38 + i * 20, -8, 14, 5);
    ctx.strokeStyle = 'rgba(43,35,32,.5)'; ctx.lineWidth = 1;
    ctx.strokeRect(-38 + i * 20, -8, 14, 5);
  }
  // red awning
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.moveTo(-54, -34); ctx.lineTo(54, -34); ctx.lineTo(46, -18); ctx.lineTo(-46, -18);
  ctx.closePath(); ctx.fill();
  // lantern + glow
  const g = .5 + Math.sin(game.time * 2.4) * .12;
  ctx.fillStyle = `rgba(230,180,80,${g * .2})`;
  ctx.beginPath(); ctx.arc(38, -26, 20, 0, TAU); ctx.fill();
  ctx.fillStyle = GOLD; ctx.fillRect(35, -32, 6, 11);
  // the merchant — ink robe, gold-trimmed, wide hat
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(0, 4, 12, 0, TAU); ctx.fill();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 4, 12, .3, 2.8); ctx.stroke();
  ctx.fillStyle = '#7a6742';
  ctx.beginPath(); ctx.ellipse(0, -4, 14, 5, 0, 0, TAU); ctx.fill();
  // (E) keycap floats over the stall when the player is close enough to trade
  if (game.state === 'playing' &&
      dist(player.x, player.y, m.x, m.y) < 85) {
    const bob = Math.sin(game.time * 3.5) * 3;
    ctx.fillStyle = CREAM;
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
    ctx.fillRect(-11, -60 + bob, 22, 19);
    ctx.strokeRect(-11, -60 + bob, 22, 19);
    ctx.fillStyle = 'rgba(43,35,32,.35)';
    ctx.fillRect(-9, -41 + bob, 18, 2);        // keycap shadow lip
    ctx.fillStyle = INK;
    ctx.font = 'bold 13px Georgia,serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('E', 0, -50 + bob);
  }
  ctx.restore();
}
function drawShrine() {
  const s = shrine;
  ctx.save();
  ctx.translate(s.x, s.y);
  const glow = .5 + Math.sin(s.t * 2.2) * .2;
  ctx.fillStyle = `rgba(168,132,58,${glow * .14})`;
  ctx.beginPath(); ctx.arc(0, -4, 36, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(43,35,32,.14)';
  ctx.beginPath(); ctx.ellipse(0, 26, 30, 7, 0, 0, TAU); ctx.fill();
  // stone base + posts
  ctx.fillStyle = '#6b655c';
  ctx.fillRect(-16, 14, 32, 10);
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.strokeRect(-16, 14, 32, 10);
  ctx.fillStyle = '#7a7266';
  ctx.fillRect(-11, -8, 6, 22); ctx.fillRect(5, -8, 6, 22);
  ctx.strokeRect(-11, -8, 6, 22); ctx.strokeRect(5, -8, 6, 22);
  // brushed roof strokes
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-20, -10); ctx.quadraticCurveTo(0, -20, 20, -10); ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-15, -16); ctx.quadraticCurveTo(0, -24, 15, -16); ctx.stroke();
  // gold rope + swaying tassel
  ctx.strokeStyle = GOLD; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-10, -4); ctx.lineTo(10, -4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(Math.sin(s.t * 3) * 2, 4); ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.font = 'italic 12px Georgia,serif'; ctx.textAlign = 'center';
  ctx.fillText('the shrine', 0, 44);
  // (E) prompt when close
  if (game.state === 'playing' &&
      dist(player.x, player.y, s.x, s.y) < 80) {
    const bob = Math.sin(game.time * 3.5) * 3;
    ctx.fillStyle = CREAM;
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
    ctx.fillRect(-11, -52 + bob, 22, 19);
    ctx.strokeRect(-11, -52 + bob, 22, 19);
    ctx.fillStyle = INK;
    ctx.font = 'bold 13px Georgia,serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('E', 0, -42 + bob);
  }
  ctx.restore();
}
function drawBannerHUD() {
  if (game.bannerT > 0 && game.bannerText) {
    const t = game.bannerDur - game.bannerT;
    const alpha = t < .3 ? t / .3 : game.bannerT < .4 ? game.bannerT / .4 : 1;
    ctx.save();
    ctx.globalAlpha = alpha * .9;
    ctx.fillStyle = themeIndex === 4 ? '#e8e4f4' : INK;
    ctx.textAlign = 'center';
    // long teaching lines must stay on the paper: shrink toward 26px
    // first, then wrap onto a second line — never off the edge
    const maxW = W - 140;
    let size = 40;
    ctx.font = size + 'px Georgia,serif';
    while (size > 26 && ctx.measureText(game.bannerText).width > maxW) {
      size -= 2;
      ctx.font = size + 'px Georgia,serif';
    }
    if (ctx.measureText(game.bannerText).width <= maxW) {
      ctx.fillText(game.bannerText, W / 2, H / 2 - 90);
    } else {
      // greedy two-line wrap at the nearest word break
      const words = game.bannerText.split(' ');
      let l1 = '', l2 = '';
      for (const w2 of words) {
        const tryL = l1 ? l1 + ' ' + w2 : w2;
        if (!l2 && ctx.measureText(tryL).width <= maxW) l1 = tryL;
        else l2 = l2 ? l2 + ' ' + w2 : w2;
      }
      ctx.fillText(l1, W / 2, H / 2 - 106);
      ctx.fillText(l2, W / 2, H / 2 - 106 + size + 6);
    }
    ctx.restore();
  }
}
// ancestor tablets — dark stone, a kanji, the toll written beneath
function drawTombTablets() {
  for (const tb of tombTablets) {
    const tr = TOMB_TRACKS[tb.track];
    const steps = save.tomb[tb.track] || 0;
    drawShadow(tb.x, tb.y + 22, 20);
    ctx.save();
    ctx.translate(tb.x, tb.y);
    ctx.fillStyle = '#4a443e';
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-16, 26); ctx.lineTo(-16, -18);
    ctx.quadraticCurveTo(0, -30, 16, -18);
    ctx.lineTo(16, 26); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = CREAM;
    ctx.font = '17px Georgia,serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(tr.kanji, 0, -4);
    ctx.restore();
    ctx.fillStyle = steps >= 10 ? GOLD : INK;
    ctx.font = 'italic 11px Georgia,serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(
      `${tr.name} · ${tombFlatLabel(tb.track)} · 誉 ${fmtNum(tombCost(tb.track))}`,
      tb.x, tb.y + 44);
  }
  // 転生 the rebirth altar — a torii of ink standing apart in the east
  if (tombAltar) {
    const ax = tombAltar.x, ay = tombAltar.y;
    const gateOpen = (save.maxLevelCleared || 0) >= 5;
    drawShadow(ax, ay + 26, 24);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-20, 28); ctx.lineTo(-16, -18);
    ctx.moveTo(20, 28); ctx.lineTo(16, -18);
    ctx.stroke();
    ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(-30, -20); ctx.quadraticCurveTo(0, -28, 30, -20); ctx.stroke();
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(-22, -8); ctx.lineTo(22, -8); ctx.stroke();
    ctx.fillStyle = gateOpen ? RED : 'rgba(43,35,32,.45)';
    ctx.font = '15px Georgia,serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('転', 0, 10);
    ctx.restore();
    ctx.fillStyle = gateOpen ? GOLD : 'rgba(43,35,32,.55)';
    ctx.font = 'italic 11px Georgia,serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(gateOpen
      ? `転生 rebirth · cycle ${rebirthLevel()} — the altar answers`
      : '転生 rebirth · the fifth lord still stands',
      ax, ay + 48);
  }
}
/* 弓道 the archery rite — the wooden stand, and the straw ring while the
   rite runs. Ink and straw tones only; gold appears solely as the score
   flash (mechanical reward), per the color law.                        */
function drawKyudo() {
  if (kyudoStand) {
    const s = kyudoStand;
    drawShadow(s.x, s.y + 18, 16);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    // a simple tripod cradling a strung bow
    ctx.beginPath();
    ctx.moveTo(-13, 22); ctx.lineTo(0, -14);
    ctx.moveTo(13, 22); ctx.lineTo(0, -14);
    ctx.moveTo(-9, 10); ctx.lineTo(9, 10);
    ctx.stroke();
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(0, -18, 11, Math.PI * .15, Math.PI * .85, true); ctx.stroke();
    ctx.strokeStyle = 'rgba(43,35,32,.55)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-10, -21); ctx.lineTo(10, -21); ctx.stroke();
    ctx.restore();
    const K = game.kyudo, rk = kyudoRank();
    ctx.fillStyle = INK;
    ctx.font = 'italic 11px Georgia,serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(K && K.on
      ? 'the incense burns…'
      : `弓道 the archery rite · rank ${rk}/10` +
        (save.kyudo.best ? ` · best ${save.kyudo.best}` : ''),
      s.x, s.y + 40);
  }
  const K = game.kyudo;
  if (K && K.on) {
    // the shooting line — a brushed boundary the archer honors
    ctx.strokeStyle = 'rgba(43,35,32,.45)'; ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(K.lineX, ARENA.y + 14);
    ctx.lineTo(K.lineX, ARENA.y + ARENA.h - 14);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(43,35,32,.5)';
    ctx.font = '13px Georgia,serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('射', K.lineX, ARENA.y + 30);
  }
  if (K && K.on && K.target) {
    const tg = K.target;
    const fade = clamp(1 - (tg.t - 4.5) / 2.5, .25, 1);   // the straw dims as it waits
    drawShadow(tg.x, tg.y, tg.r * .8);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = '#d9c9a5';                            // straw butt
    ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(tg.x, tg.y, tg.r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(43,35,32,.65)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(tg.x, tg.y, tg.r * .62, 0, TAU); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(tg.x, tg.y, 3.2, 0, TAU); ctx.fill();
    ctx.restore();
  }
}
// the lacquer chest — dark wood, one gold band, a patient dashed halo
function drawChest(c) {
  const bob = Math.sin(c.t * 2.2) * 2;
  drawShadow(c.x, c.y + 6, 14);
  ctx.save();
  ctx.translate(c.x, c.y + bob);
  ctx.fillStyle = '#3a2f26';
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.rect(-16, -10, 32, 20); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-16, -2); ctx.lineTo(16, -2); ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.beginPath(); ctx.arc(0, -2, 2.6, 0, TAU); ctx.fill();
  ctx.strokeStyle = `rgba(168,132,58,${.35 + Math.sin(c.t * 3) * .15})`;
  ctx.setLineDash([4, 6]);
  ctx.beginPath(); ctx.arc(0, 0, 26, c.t, c.t + TAU); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
function drawHUD() {
  if (game.state === 'title') return;
  if (game.mode === 'duel') {
    if (duel) drawDuelHUD();
    drawBannerHUD();
    return;
  }
  const bx = 30, by = 26, bh = 13;
  ctx.font = '15px Georgia,serif';
  ctx.textBaseline = 'middle';
  // health — bar widens with Iron Body training
  const hpw = 190 + (player.maxHp - 100);
  ctx.fillStyle = INK; ctx.textAlign = 'left';
  ctx.fillText('命', bx - 2, by + bh / 2);
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.strokeRect(bx + 20, by, hpw, bh);
  ctx.fillStyle = 'rgba(43,35,32,.12)';
  ctx.fillRect(bx + 20, by, hpw, bh);
  ctx.fillStyle = RED;
  ctx.fillRect(bx + 21, by + 1, (hpw - 2) * clamp(player.hp / player.maxHp, 0, 1), bh - 2);
  // stamina — widens with Deep Lungs
  const sy = by + 21, stw = 190 + (player.maxSt - 100);
  ctx.fillStyle = INK;
  ctx.fillText('気', bx - 2, sy + bh / 2);
  ctx.strokeRect(bx + 20, sy, stw, bh);
  ctx.fillStyle = 'rgba(43,35,32,.12)';
  ctx.fillRect(bx + 20, sy, stw, bh);
  const exhausted = playerExhausted();
  ctx.fillStyle = exhausted && Math.sin(game.time * 16) > 0 ? RED : '#857b6c';
  ctx.fillRect(bx + 21, sy + 1, (stw - 2) * clamp(player.st / player.maxSt, 0, 1), bh - 2);
  if (exhausted) {
    ctx.fillStyle = RED; ctx.font = 'italic 12px Georgia,serif';
    ctx.fillText('winded — blade weakened', bx + 20 + stw + 10, sy + bh / 2);
  }
  if (player.downed) {
    ctx.fillStyle = RED; ctx.font = 'italic 12px Georgia,serif';
    ctx.fillText('倒 fallen — clear the wave', bx + 20 + hpw + 10, by + bh / 2);
  }
  // 二人 — the second blade's ledger, a slimmer stack beneath the first
  if (game.coop && p2) {
    const py = by + 68, pw = 150, ph = 10;
    ctx.font = '14px Georgia,serif'; ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    ctx.fillText('弐', bx - 2, py + ph / 2);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    ctx.strokeRect(bx + 20, py, pw, ph);
    ctx.fillStyle = 'rgba(43,35,32,.12)'; ctx.fillRect(bx + 20, py, pw, ph);
    ctx.fillStyle = RED;
    ctx.fillRect(bx + 21, py + 1, (pw - 2) * clamp(p2.hp / p2.maxHp, 0, 1), ph - 2);
    const py2 = py + 15;
    ctx.strokeRect(bx + 20, py2, pw, ph);
    ctx.fillStyle = 'rgba(43,35,32,.12)'; ctx.fillRect(bx + 20, py2, pw, ph);
    ctx.fillStyle = exhaustedOf(p2) && Math.sin(game.time * 16) > 0 ? RED : '#857b6c';
    ctx.fillRect(bx + 21, py2 + 1, (pw - 2) * clamp(p2.st / p2.maxSt, 0, 1), ph - 2);
    if (p2.downed) {
      ctx.fillStyle = RED; ctx.font = 'italic 12px Georgia,serif';
      ctx.fillText('倒 fallen — clear the wave', bx + 20 + pw + 10, py + ph / 2);
    }
    // online: the connection dot keeps its duel colors — green, gold, red
    if (net && net.coop && net.started) {
      const ny = py2 + 22;
      ctx.fillStyle = net.stall ? RED : net.rtt > 180 ? GOLD : '#5a7a4a';
      ctx.beginPath(); ctx.arc(bx + 6, ny, 4, 0, TAU); ctx.fill();
      ctx.fillStyle = INK; ctx.font = 'italic 11px Georgia,serif';
      ctx.fillText(net.stall ? 'waiting for the wire…'
                   : (net.host ? 'host' : 'guest') + ' · ' + Math.round(net.rtt) + 'ms',
                   bx + 16, ny);
    }
  }
  // 奥 ultimate meter — neon; drains as a duration bar while the surge runs.
  // Before the first rebirth the ART already answers a full meter; only
  // the INK SURGE after it waits behind the cycle (the label says so).
  if (game.mode !== 'duel') {
    const uy = by + 42, uw = 190;
    const nz = weaponNeon(game.equipped);
    ctx.fillStyle = INK; ctx.font = '15px Georgia,serif';
    ctx.fillText('奥', bx - 2, uy + bh / 2);
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.strokeRect(bx + 20, uy, uw, bh);
    ctx.fillStyle = 'rgba(43,35,32,.12)';
    ctx.fillRect(bx + 20, uy, uw, bh);
    if (game.ult.run || game.ult.buffT > 0) {
      // the art holds the bar full; the surge after drains it as duration
      const def = ULTS[game.ult.run ? game.ult.run.blade : game.equipped] || ULTS.tetsu;
      const frac = game.ult.run ? 1 : clamp(game.ult.buffT / ULT_BUFF_PVE, 0, 1);
      ctx.save();
      ctx.shadowBlur = 12; ctx.shadowColor = nz[0];
      ctx.fillStyle = nz[0];
      ctx.fillRect(bx + 21, uy + 1, (uw - 2) * frac, bh - 2);
      ctx.restore();
      ctx.shadowBlur = 0;
      ctx.fillStyle = nz[1]; ctx.font = 'italic 11px Georgia,serif';
      ctx.fillText('奥義 — ' + def.name, bx + 20 + uw + 10, uy + bh / 2);
    } else {
      const frac = clamp(game.ult.meter / game.ult.max, 0, 1);
      const full = frac >= 1;
      ctx.save();
      if (full) {   // full meter pulses, begging for the R key
        ctx.shadowBlur = 10 + 6 * Math.sin(game.time * 8);
        ctx.shadowColor = nz[0];
        ctx.globalAlpha = .75 + .25 * Math.sin(game.time * 8);
      } else ctx.globalAlpha = .85;
      ctx.fillStyle = nz[0];
      ctx.fillRect(bx + 21, uy + 1, (uw - 2) * frac, bh - 2);
      ctx.restore();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      if (full) {
        ctx.fillStyle = INK; ctx.font = 'italic 12px Georgia,serif';
        ctx.fillText(ultUnlocked() ? 'press R — 奥義'
          : 'press R — the art alone · 転生 wakes the SURGE',
          bx + 20 + uw + 10, uy + bh / 2);
      }
    }
  }
  // mode · wave · difficulty — top centre
  ctx.font = '20px Georgia,serif'; ctx.textAlign = 'center';
  ctx.fillStyle = INK;   // one ink for every mode line — no purple storm hue
  let modeLine;
  if (game.mode === 'campaign')
    modeLine = `${THEMES[game.map].kanji} MAP ${game.map + 1} — STAGE ` +
      `${Math.min(game.cStage, STAGES_PER_MAP)}/${STAGES_PER_MAP} · foes ×${
        stageMult(curStage()) < 100 ? stageMult(curStage()).toFixed(1) : fmtNum(stageMult(curStage()))}`;
  else if (game.mode === 'level')
    modeLine = `${THEMES[game.level - 1].kanji} LEVEL ${game.level} — WAVE ${Math.min(game.wave, game.levelWaves)}/${game.levelWaves}`;
  else if (game.mode === 'infinite')
    modeLine = `∞ WAVE ${game.wave} · CYCLE ${Math.floor((game.wave - 1) / 25) + 1}`;
  else if (game.mode === 'rush')
    modeLine = game.chaos
      ? `亂 CHAOS — STAGE ${game.stage} · ${fmtTime(game.rushTime)}`
      : `討 BOSS RUSH — ${Math.min(game.stage, 5)}/5 · ${fmtTime(game.rushTime)}`;
  else if (game.mode === 'ascension')
    modeLine = `転生の道 THE ROAD OF REBIRTH — LORD ${Math.min(game.stage, 5)}/5`;
  else if (game.mode === 'training') modeLine = '稽古 THE TRAINING YARD';
  else if (game.mode === 'tomb') modeLine = '墓 THE TOMB OF THE FALLEN';
  else modeLine = '視 THE MERCHANT’S STALL';
  ctx.fillText(modeLine, W / 2, 34);
  // training telemetry: rolling DPS, total, telegraph reaction times
  if (game.mode === 'training' && game.training) {
    const tr = game.training;
    tr.log = tr.log.filter(en => game.time - en.t < 3);
    const dps = tr.log.reduce((s, en) => s + en.dmg, 0) / 3;
    ctx.font = '14px Georgia,serif'; ctx.textAlign = 'center'; ctx.fillStyle = INK;
    ctx.fillText(`dps ${dps.toFixed(1)} · total ${tr.total}` +
      (tr.lastReact != null
        ? ` · reaction ${tr.lastReact}ms (best ${tr.bestReact}ms)` : ''), W / 2, 58);
    // the rite's ledger — incense left, rings struck, the streak
    if (game.kyudo && game.kyudo.on) {
      const K = game.kyudo;
      ctx.fillStyle = GOLD;
      ctx.fillText(`弓道 ${Math.ceil(KYUDO.dur - K.t)}s · rings ${K.score}` +
        (K.streak > 1 ? ` · streak ${K.streak}` : '') +
        ` · rank ${kyudoRank()}/10`, W / 2, 78);
    }
  }
  if (game.mode !== 'merchant') {          // difficulty tag, always visible
    const tw = ctx.measureText(modeLine).width;
    const tagX = W / 2 + tw / 2 + 12;
    ctx.fillStyle = game.diff >= 7 ? RED : game.diff >= 4 ? GOLD : 'rgba(43,35,32,.75)';
    ctx.fillRect(tagX, 24, 36, 19);
    ctx.fillStyle = PAPER;
    ctx.font = 'bold 13px Georgia,serif';
    ctx.fillText('×' + game.diff, tagX + 18, 34);
    // active curses — red glyphs beside the difficulty tag
    if (game.curses.length) {
      ctx.fillStyle = RED;
      ctx.font = '15px Georgia,serif';
      ctx.textAlign = 'left';
      const glyphs = game.curses
        .map(id => (CURSES.find(c => c.id === id) || {}).kanji || '呪').join(' ');
      ctx.fillText(glyphs, tagX + 44, 34);
      ctx.textAlign = 'center';
    }
  }
  // boss health bars
  const bosses = enemies.filter(e => !e.dead && e.isBoss);
  if (bosses.length) {
    const bwid = 400, bx0 = W / 2 - bwid / 2;
    let yy = 54;
    for (const b of bosses.slice(0, 3)) {
      ctx.font = 'italic 13px Georgia,serif';
      ctx.textAlign = 'center'; ctx.fillStyle = INK;
      ctx.fillText(b.bossName, W / 2, yy + 1);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.strokeRect(bx0, yy + 8, bwid, 7);
      ctx.fillStyle = 'rgba(43,35,32,.15)'; ctx.fillRect(bx0, yy + 8, bwid, 7);
      ctx.fillStyle = RED;   // a lord's health is danger in every mode
      ctx.fillRect(bx0 + 1, yy + 9, (bwid - 2) * clamp(b.hp / b.maxHp, 0, 1), 5);
      yy += 26;
    }
    if (bosses.length > 3) {
      ctx.font = 'italic 12px Georgia,serif';
      ctx.textAlign = 'center'; ctx.fillStyle = RED;
      ctx.fillText(`… and ${bosses.length - 3} more lords`, W / 2, yy + 1);
    }
  }
  // honor — top right, gold
  ctx.textAlign = 'right';
  ctx.fillStyle = GOLD;
  ctx.font = '20px Georgia,serif';
  ctx.fillText(`誉 ${fmtNum(game.honor)}`, W - 34, 34);
  // combo — at 10+ it runs HOT: a gold glow and faster breath (the +15%
  // stamina regen lives in updateSamurai; this is its face)
  if (game.combo > 1) {
    const pop = 1 + game.comboPop * 1.6;
    const hot = game.combo >= 10;
    ctx.save();
    ctx.translate(W - 60, 68);
    ctx.scale(pop, pop);
    if (hot) {
      ctx.shadowBlur = 12 + 5 * Math.sin(game.time * 7);
      ctx.shadowColor = GOLD;
    }
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 22px Georgia,serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${game.combo}×`, 0, 0);
    ctx.shadowBlur = 0;
    ctx.font = 'italic 11px Georgia,serif';
    ctx.fillText(hot ? '気 hot — breath +15%' : 'combo', 0, 16);
    ctx.restore();
  }
  // equipped blade — bottom left
  const wq = WEAPONS[game.equipped];
  ctx.font = '14px Georgia,serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  let bladeLabel;
  if (player.stance === 'bow' && game.equipped !== 'fudemaru') {
    const bq = currentBow();
    ctx.fillStyle = bq.legendary ? GOLD : INK;
    bladeLabel = `${bq.kanji} ${bq.name} — ${bq.epithet}  · Q — blade`;
  } else {
    ctx.fillStyle = wq.legendary ? GOLD : INK;
    bladeLabel = `${wq.kanji} ${wq.name} — ${wq.epithet}`;
    if (game.equipped !== 'fudemaru') bladeLabel += '  · Q — bow';
  }
  if (game.equipped === 'ame' && game.ameStacks > 0)
    bladeLabel += `  · tempo ×${game.ameStacks}`;
  if (game.mode !== 'duel') {
    const worn = [save.charm, rebirthLevel() >= 6 ? save.charm2 : null];
    for (const id of worn) {
      const ch = id && CHARMS.find(c => c.id === id);
      if (ch) bladeLabel += `   ${ch.kanji} ${ch.name}${game.omamoriUsed && ch.id === 'omamori' ? ' (spent)' : ''}`;
    }
  }
  ctx.fillText(bladeLabel, 30, H - 20);
  // the second blade's arm — quiet, bottom right
  if (game.coop && p2) {
    const w2 = wpnOf(p2);
    ctx.textAlign = 'right';
    ctx.fillStyle = w2.legendary ? GOLD : INK;
    const b2 = p2.stance === 'bow' ? bowOf(p2) : w2;
    ctx.fillText(`弐 ${b2.kanji} ${b2.name} — ${b2.epithet}`, W - 34, H - 20);
    ctx.textAlign = 'left';
  }
  // earned blessings — a quiet gold row above the blade
  if (game.blessings.length) {
    ctx.fillStyle = GOLD;
    ctx.font = '14px Georgia,serif';
    const glyphs = game.blessings
      .map(id => (BLESSINGS.find(b => b.id === id) || {}).kanji || '祈').join(' ');
    ctx.fillText('祈 ' + glyphs, 30, H - 40);
  }
  // admin flags
  if (game.equipped === 'fudemaru') {
    ctx.textAlign = 'right';
    ctx.font = 'bold 12px Georgia,serif';
    ctx.fillStyle = game.ultMode &&
      Math.sin(game.time * 8) > 0 ? '#7a6cc0' : RED;
    let adminLine = '筆 ADMIN BRUSH UNSEALED';
    if (game.brushSwap) adminLine = '雷 on tap · ' + adminLine;
    if (game.ultMode) adminLine = '滅 ULTIMATE · ' + adminLine;
    ctx.fillText(adminLine, W - 30, H - 20);
    ctx.font = 'italic 10px Georgia,serif';
    ctx.fillStyle = 'rgba(43,35,32,.55)';
    ctx.fillText('L — ultimate · U — swap tap spell', W - 30, H - 36);
  }
  // interaction hints
  if (merchant && game.state === 'playing' &&
      dist(player.x, player.y, merchant.x, merchant.y) < 85) {
    ctx.font = 'italic 14px Georgia,serif'; ctx.textAlign = 'center';
    ctx.fillStyle = GOLD;
    ctx.fillText('E — trade with the merchant', W / 2, H - 46);
  }
  if (shrine && game.state === 'playing' &&
      dist(player.x, player.y, shrine.x, shrine.y) < 80) {
    ctx.font = 'italic 14px Georgia,serif'; ctx.textAlign = 'center';
    ctx.fillStyle = GOLD;
    ctx.fillText('E — pray at the shrine', W / 2, H - 46);
  }
  if (game.mode === 'training' && kyudoStand && game.state === 'playing' &&
      !(game.kyudo && game.kyudo.on) &&
      dist(player.x, player.y, kyudoStand.x, kyudoStand.y) < 80) {
    ctx.font = 'italic 14px Georgia,serif'; ctx.textAlign = 'center';
    ctx.fillStyle = GOLD;
    ctx.fillText('E — begin the archery rite', W / 2, H - 46);
  }
  if (game.mode === 'tomb' && game.tomb) {
    if (game.tomb.phase === 'choose' && game.state === 'playing') {
      for (const tb of tombTablets)
        if (dist(player.x, player.y, tb.x, tb.y) < 80) {
          ctx.font = 'italic 14px Georgia,serif'; ctx.textAlign = 'center';
          ctx.fillStyle = GOLD;
          ctx.fillText('E — offer the toll and face the trial', W / 2, H - 46);
          break;
        }
      if (tombAltar && dist(player.x, player.y, tombAltar.x, tombAltar.y) < 85) {
        ctx.font = 'italic 14px Georgia,serif'; ctx.textAlign = 'center';
        ctx.fillStyle = GOLD;
        ctx.fillText('E — read the rebirth scroll', W / 2, H - 46);
      }
      // the stat wall — a swords-and-souls ledger of what the tomb has bought
      const rows = [
        ['刃', 'attack', `+${tombAtk() + rebirthLevel()}`, tombSteps('edge')],
        ['体', 'vitality', `${player.maxHp} hp`, tombSteps('body')],
        ['姿', 'posture', `+${tombPosture()}`, tombSteps('stance')],
      ];
      const px0 = 30, py0 = 132, rw = 200;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.font = 'italic 12px Georgia,serif'; ctx.fillStyle = 'rgba(43,35,32,.6)';
      ctx.fillText(`力 the ledger of the body · 転生 ×${rebirthMult().toFixed(2)}`,
        px0, py0 - 16);
      rows.forEach((r, i) => {
        const y = py0 + i * 24;
        ctx.fillStyle = INK; ctx.font = '14px Georgia,serif';
        ctx.fillText(r[0], px0, y);
        ctx.font = 'italic 12px Georgia,serif';
        ctx.fillText(r[1], px0 + 22, y);
        ctx.strokeStyle = 'rgba(43,35,32,.4)'; ctx.lineWidth = 1.5;
        ctx.strokeRect(px0 + 84, y - 6, rw - 84, 12);
        ctx.fillStyle = 'rgba(168,132,58,.55)';
        ctx.fillRect(px0 + 85, y - 5, (rw - 86) * Math.min(1, r[3] / 30), 10);
        ctx.fillStyle = INK; ctx.font = '12px Georgia,serif';
        ctx.fillText(r[2], px0 + rw + 8, y);
      });
    }
    if (game.tomb.phase === 'breath') {
      // the breath meter: a drifting needle, one gold band, one chance
      const bw = 320, bx0 = W / 2 - bw / 2, by0 = H - 92;
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.strokeRect(bx0, by0, bw, 16);
      ctx.fillStyle = 'rgba(43,35,32,.1)'; ctx.fillRect(bx0, by0, bw, 16);
      ctx.fillStyle = 'rgba(168,132,58,.45)';
      ctx.fillRect(bx0 + bw / 2 - bw * .09, by0, bw * .18, 16);
      const nx = bx0 + bw / 2 + clamp(game.tomb.needle || 0, -1, 1) * bw / 2;
      ctx.strokeStyle = RED; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(nx, by0 - 4); ctx.lineTo(nx, by0 + 20); ctx.stroke();
      ctx.fillStyle = INK; ctx.font = 'italic 12px Georgia,serif'; ctx.textAlign = 'center';
      ctx.fillText('M — release the breath inside the gold', W / 2, by0 + 32);
    }
  }
  // the reveal — a lacquer CAROUSEL: the arsenal streams past a gold
  // marker, the reel slows on an easing curve, and the landing tile is
  // the pull. Filler tiles are cosmetic; only the center tile is law.
  if (chestCard) {
    const cc = chestCard;
    const inT = clamp(cc.t / .2, 0, 1);
    const outT = clamp((REEL.spin + REEL.hold - cc.t) / .35, 0, 1);
    const a = Math.min(inT, outT);
    const cx = W / 2, cy = 150 - (1 - inT) * 18;
    const step = REEL.step, tw = 60, th = 76;
    const winW = step * 4.6, winH = th + 22;
    const center = reelCenterAt(cc.t);
    const landed = cc.t >= REEL.spin;
    const tierCol = t => t === 'legendary' ? GOLD
                       : t === 'pure' ? '#5d7f9c' : 'rgba(43,35,32,.55)';
    ctx.save();
    ctx.globalAlpha = a;
    // the parchment window the reel turns behind
    ctx.fillStyle = CREAM;
    ctx.strokeStyle = landed ? tierCol(cc.tier) : INK;
    ctx.lineWidth = landed && cc.tier === 'legendary' ? 3 : 2;
    ctx.fillRect(cx - winW / 2, cy - winH / 2, winW, winH);
    ctx.strokeRect(cx - winW / 2, cy - winH / 2, winW, winH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - winW / 2 + 3, cy - winH / 2 + 3, winW - 6, winH - 6);
    ctx.clip();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < cc.reel.length; i++) {
      const x = cx + (i - center) * step;
      if (x < cx - winW / 2 - tw || x > cx + winW / 2 + tw) continue;
      const id = cc.reel[i];
      const it = WEAPONS[id] || BOWS[id];
      const rar = WPN_RARITY[id] || BOW_RARITY[id] || 'worn';
      const isWin = landed && i === REEL.land;
      // tiles dim toward the window edges; the winner burns bright
      const edge = clamp(1 - Math.abs(x - cx) / (winW / 2), 0, 1);
      ctx.globalAlpha = a * (isWin ? 1 : .35 + .5 * edge);
      if (isWin) {
        ctx.save();
        ctx.shadowBlur = 16;
        ctx.shadowColor = tierCol(cc.tier);
      }
      ctx.strokeStyle = isWin ? tierCol(cc.tier) : tierCol(rar);
      ctx.lineWidth = isWin ? 3 : 1.4;
      ctx.strokeRect(x - tw / 2, cy - th / 2 + 2, tw, th - 10);
      ctx.fillStyle = INK;
      ctx.font = (isWin ? '32px' : '26px') + ' Georgia,serif';
      ctx.fillText(it.kanji, x, cy - 5);
      ctx.font = 'italic 9px Georgia,serif';
      ctx.fillStyle = tierCol(rar);
      ctx.fillText(RARITY[rar].name.toUpperCase(), x, cy + th / 2 - 14);
      if (isWin) ctx.restore();
    }
    ctx.restore();   // clip off
    // the gold marker notches, top and bottom of the window
    ctx.globalAlpha = a;
    ctx.strokeStyle = GOLD; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - winH / 2 - 7); ctx.lineTo(cx, cy - winH / 2 + 6);
    ctx.moveTo(cx, cy + winH / 2 + 7); ctx.lineTo(cx, cy + winH / 2 - 6);
    ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (landed) {
      // once the reel rests, the pull is named beneath the window
      ctx.fillStyle = cc.tier === 'legendary' ? GOLD : INK;
      ctx.font = 'italic 14px Georgia,serif';
      ctx.fillText(
        `${RARITY[cc.tier].kanji} ${cc.item.name} — “${cc.item.epithet}”` +
        (cc.isNew ? '' : ' · melted to temper'),
        cx, cy + winH / 2 + 18);
      if (cc.stone) {   // the rarest gleam of all rides beneath the pull
        ctx.fillStyle = GOLD;
        ctx.font = 'italic 13px Georgia,serif';
        ctx.fillText(`昇 an ascension stone — the road's toll (held: ${save.ascStones})`,
          cx, cy + winH / 2 + 36);
      }
    } else if (cc.odds) {
      // while it spins, the reel wears its true odds beneath the marker
      const y2 = cy + winH / 2 + 16;
      ctx.font = 'italic 12px Georgia,serif';
      ctx.fillStyle = tierCol('legendary');
      ctx.fillText(`傳 ${Math.round(cc.odds.legendary * 100)}%`, cx - 80, y2);
      ctx.fillStyle = tierCol('pure');
      ctx.fillText(`澄 ${Math.round(cc.odds.pure * 100)}%`, cx, y2);
      ctx.fillStyle = tierCol('worn');
      ctx.fillText(`鈍 ${Math.round(cc.odds.worn * 100)}%`, cx + 76, y2);
      if (cc.keyed) {
        ctx.fillStyle = GOLD;
        ctx.fillText('鍵 the key vouches — worn becomes pure', cx, y2 + 16);
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  if (game.state === 'playing') {
    const me = localSamurai();   // the guest's prompt follows the guest's body
    for (const c of chests)
      if (dist(me.x, me.y, c.x, c.y) < 70) {
        ctx.font = 'italic 14px Georgia,serif'; ctx.textAlign = 'center';
        ctx.fillStyle = GOLD;
        ctx.fillText('E — open the chest', W / 2, H - 46);
        break;
      }
  }
  if ((game.victory || game.mode === 'merchant') && game.state === 'playing') {
    ctx.font = 'italic 12px Georgia,serif'; ctx.textAlign = 'center';
    ctx.fillStyle = themeIndex === 4 ? 'rgba(230,226,244,.75)' : 'rgba(43,35,32,.6)';
    ctx.fillText('Esc — pause / leave', W / 2, H - 26);
  }
  drawBannerHUD();
}
function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#161210';
  ctx.fillRect(0, 0, W, H);
  // camera: boss pull-back + screen shake, both in world space
  if (game.zoom < .999) {
    ctx.translate(W / 2, H / 2);
    ctx.scale(game.zoom, game.zoom);
    ctx.translate(-W / 2, -H / 2);
  }
  if (shakeMag > 0)
    ctx.translate(crand(-shakeMag, shakeMag), crand(-shakeMag, shakeMag));
  ctx.drawImage(bg, 0, 0, W, H);
  // death calligraphy — the lords this run has claimed
  for (const c of calligraphy) {
    ctx.save();
    ctx.translate(c.x, c.y); ctx.rotate(c.rot);
    ctx.fillStyle = `rgba(43,35,32,${c.alpha})`;
    ctx.font = '130px Georgia,serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(c.ch, 0, 0);
    ctx.restore();
  }
  // ink stains from fallen foes
  for (const st of stains) {
    ctx.fillStyle = `rgba(43,35,32,${st.alpha})`;
    for (const b of st.blobs) {
      ctx.beginPath(); ctx.arc(st.x + b.dx, st.y + b.dy, b.r, 0, TAU); ctx.fill();
    }
  }
  // while an 奥義 burns, the scenery steps back behind a thin paper veil —
  // actors, telegraphs and pigment draw after it, so color owns the stage
  // without ever costing readability
  const sceneEnv = surgeSceneEnv();
  if (sceneEnv > .01) {
    ctx.fillStyle = `rgba(236,224,200,${(.13 * sceneEnv).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }
  for (const f of fireZones) drawFireZone(f);
  // 火矢 burn patches — a dark ink wash in base play; under the owner's
  // surge they become the Binding Scroll's glowing jade spell-circle
  for (const b of burnZones) {
    const bf = 1 - b.t / b.dur;
    const bs = styleFor(b.owner);
    ctx.save();
    if (bs.glow) {
      const jd = PAL.pigment.jade;
      ctx.fillStyle = `rgba(0,168,107,${.10 * bf + .04})`;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      ctx.shadowBlur = 10; ctx.shadowColor = jd;
      ctx.strokeStyle = jd; ctx.globalAlpha = .35 * bf + .15;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r - 2, game.time * 1.5, game.time * 1.5 + TAU - .5);
      ctx.stroke();
      ctx.font = '14px Georgia,serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = jd; ctx.globalAlpha = .5 * bf + .2;
      ctx.fillText('縛', b.x, b.y);
    } else {
      ctx.fillStyle = `rgba(43,35,32,${.12 * bf + .04})`;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(43,35,32,${.3 * bf + .08})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r - 2, game.time * 1.5, game.time * 1.5 + TAU - .5);
      ctx.stroke();
    }
    ctx.restore();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  // honor orbs — golden motes waiting to be gathered
  for (const o of orbs) {
    const bob = Math.sin(o.t * 4) * 2;
    ctx.fillStyle = 'rgba(168,132,58,.25)';
    ctx.beginPath(); ctx.arc(o.x, o.y + bob, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = GOLD;
    ctx.strokeStyle = 'rgba(43,35,32,.6)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(o.x, o.y + bob, 4.5, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(245,234,210,.9)';
    ctx.beginPath(); ctx.arc(o.x - 1.4, o.y + bob - 1.4, 1.4, 0, TAU); ctx.fill();
  }
  if (portal) drawPortalFX();
  if (merchant) drawMerchant();
  if (shrine) drawShrine();
  for (const c of chests) drawChest(c);
  if (game.mode === 'tomb') drawTombTablets();
  if (game.mode === 'training') drawKyudo();
  // projectiles — arrows, storm bolts, charged shots
  for (const p of projectiles) {
    const a = Math.atan2(p.vy, p.vx);
    if (p.kind === 'bolt') {
      ctx.strokeStyle = '#8fb4ff'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x - Math.cos(a) * 12, p.y - Math.sin(a) * 12);
      ctx.lineTo(p.x - Math.cos(a) * 5 + Math.sin(a) * 3, p.y - Math.sin(a) * 5 - Math.cos(a) * 3);
      ctx.lineTo(p.x + Math.cos(a) * 6, p.y + Math.sin(a) * 6);
      ctx.stroke();
      ctx.strokeStyle = '#e8f0ff'; ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(p.x - Math.cos(a) * 8, p.y - Math.sin(a) * 8);
      ctx.lineTo(p.x + Math.cos(a) * 5, p.y + Math.sin(a) * 5);
      ctx.stroke();
    } else if (p.kind === 'charged') {
      ctx.strokeStyle = 'rgba(181,52,42,.4)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x - Math.cos(a) * 16, p.y - Math.sin(a) * 16);
      ctx.lineTo(p.x + Math.cos(a) * 7, p.y + Math.sin(a) * 7);
      ctx.stroke();
      ctx.strokeStyle = REDHOT; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x - Math.cos(a) * 12, p.y - Math.sin(a) * 12);
      ctx.lineTo(p.x + Math.cos(a) * 7, p.y + Math.sin(a) * 7);
      ctx.stroke();
    } else {
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x - Math.cos(a) * 9, p.y - Math.sin(a) * 9);
      ctx.lineTo(p.x + Math.cos(a) * 5, p.y + Math.sin(a) * 5);
      ctx.stroke();
      // the head carries the DANGER token — cinnabar, colorblind-aware
      ctx.strokeStyle = teleRGBA(.95); ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(a) * 2, p.y + Math.sin(a) * 2);
      ctx.lineTo(p.x + Math.cos(a) * 6, p.y + Math.sin(a) * 6);
      ctx.stroke();
    }
  }
  // player & duelist arrows — sumi-e strokes in base, the four arts surged
  for (const pa of pArrows) {
    if (pa.delay > 0) continue;
    drawPArrow(pa);
  }
  // 雷渡 crescents — walls of storm-light on the move
  for (const w of ultWaves) {
    ctx.save();
    ctx.translate(w.x, w.y); ctx.rotate(w.ang);
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowBlur = 18; ctx.shadowColor = '#38bdf8';
    ctx.strokeStyle = '#8fd0ff'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-w.r * .5, 0, w.r, -1.15, 1.15); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-w.r * .5, 0, w.r, -1, 1); ctx.stroke();
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }
  // shockwave rings (Iron Brute)
  for (const sw of shockwaves) {
    const a = clamp(1 - sw.r / 640, 0, 1);
    ctx.strokeStyle = `rgba(181,52,42,${.55 * a + .15})`;
    ctx.lineWidth = sw.w * .9;
    ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(43,35,32,${.35 * a})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sw.x, sw.y, Math.max(2, sw.r - sw.w * .6), 0, TAU); ctx.stroke();
  }
  for (const e of enemies) drawEnemy(e);
  // 滅 — the black hole maw, drawn over its prey
  for (const b of blackholes) {
    const bp = clamp(b.t / b.dur, 0, 1);
    ctx.save();
    const g = ctx.createRadialGradient(b.x, b.y, b.r * .2, b.x, b.y, b.r * 1.6);
    g.addColorStop(0, 'rgba(16,12,10,.95)');
    g.addColorStop(.55, 'rgba(74,58,107,.35)');
    g.addColorStop(1, 'rgba(74,58,107,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0a0806';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * .55, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(122,108,192,${.5 + bp * .4})`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(b.x, b.y, b.r * .9, b.r * .35, game.time * 2.4, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(181,52,42,.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(b.x, b.y, b.r * 1.1, b.r * .42, -game.time * 1.7, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  if (game.mode === 'duel' && duel) {
    drawFighter(duel.p1); drawFighter(duel.p2);
  } else if (game.state !== 'gameover') {
    if (game.coop && p2) drawPlayer(p2);   // the second blade walks beneath
    drawPlayer(player);
  }
  for (const st of stalks) if (!st.dead) drawStalk(st);
  // particles
  for (const p of particles) {
    const fade = 1 - p.t / p.life;
    if (p.kind === 'line') {
      ctx.strokeStyle = pcol(p); ctx.globalAlpha = fade;
      ctx.lineWidth = p.w; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * .045, p.y - p.vy * .045);
      ctx.stroke();
    } else if (p.kind === 'dot') {
      ctx.fillStyle = pcol(p); ctx.globalAlpha = fade * .8;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.rad * fade, 0, TAU); ctx.fill();
    } else if (p.kind === 'arc') {
      ctx.strokeStyle = pcol(p); ctx.globalAlpha = fade;
      ctx.lineWidth = p.w * fade; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, p.a0, p.a1); ctx.stroke();
    } else if (p.kind === 'petal') {
      ctx.fillStyle = pcol(p); ctx.globalAlpha = fade * .85;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.spin + p.t * 2);
      ctx.beginPath(); ctx.ellipse(0, 0, p.rad * 1.6, p.rad * .9, 0, 0, TAU); ctx.fill();
      ctx.restore();
    } else if (p.kind === 'bolt') {
      ctx.strokeStyle = pcol(p); ctx.globalAlpha = fade;
      ctx.lineWidth = p.w; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(p.pts[0].x, p.pts[0].y);
      for (let i = 1; i < p.pts.length; i++) ctx.lineTo(p.pts[i].x, p.pts[i].y);
      ctx.stroke();
    } else if (p.kind === 'glyph') {
      ctx.fillStyle = pcol(p); ctx.globalAlpha = fade;
      ctx.font = `${p.size}px Georgia,serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.ch, p.x, p.y);
    } else if (p.kind === 'ring') {
      ctx.strokeStyle = pcol(p); ctx.globalAlpha = fade;
      ctx.lineWidth = p.w;
      ctx.beginPath();
      ctx.arc(p.x, p.y, lerp(p.r0, p.r1, p.t / p.life), 0, TAU);
      ctx.stroke();
    } else if (p.kind === 'bleed') {
      // the color explosion — pigment washing outward like wet ink on paper
      const r = Math.max(2, lerp(p.r0, p.r1, p.t / p.life));
      const g = ctx.createRadialGradient(p.x, p.y, r * .1, p.x, p.y, r);
      g.addColorStop(0, p.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade * .3;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }
  // 奥義 neon ribbon — glows above the ink, beneath the words
  if (game.mode === 'duel' && duel) {
    drawNeonRibbon(duel.p1.ultTrail, weaponNeon(duel.p1.blade), duel.p1.surgeEnv);
    drawNeonRibbon(duel.p2.ultTrail, weaponNeon(duel.p2.blade), duel.p2.surgeEnv);
  } else if (ultTrail.length > 1) drawNeonRibbon(ultTrail, weaponNeon(game.equipped), game.ult.env);
  // floating text
  for (const t of texts) {
    ctx.globalAlpha = 1 - (t.t / t.life) ** 2;
    ctx.fillStyle = t.color;
    ctx.font = `${t.size}px Georgia,serif`;
    ctx.textAlign = 'center';
    ctx.fillText(t.txt, t.x, t.y);
    ctx.globalAlpha = 1;
  }
  // Tsukikage — the world dims a shade when the Moon Shadow feeds
  if (game.desatT > 0) {
    ctx.fillStyle = `rgba(43,35,32,${game.desatT * .9})`;
    ctx.fillRect(0, 0, W, H);
  }
  /* --- screen-space weather + mode overlays --- */
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  // mouse-aim reticle: a dry-brush ring where the cursor rests (read-only)
  if (mouseAimOn()) {
    ctx.strokeStyle = 'rgba(43,35,32,.5)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 7, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(43,35,32,.65)';
    ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 1.6, 0, TAU); ctx.fill();
  }
  const th = THEMES[themeIndex];
  if (th.tint) { ctx.fillStyle = th.tint; ctx.fillRect(0, 0, W, H); }
  if (themeIndex === 2) {                       // driving rain on the bridge
    ctx.strokeStyle = 'rgba(90,120,160,.35)'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    const rt = game.time * 640;
    for (let i = 0; i < 46; i++) {
      const x = ((i * 227 + rt * .18) % (W + 80)) - 40;
      const y = ((i * 613 + rt) % (H + 60)) - 30;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 18); ctx.stroke();
    }
  }
  if (game.mode === 'infinite' && game.state !== 'title') {
    // permanent storm-violet sky — the mark of the endless trial
    ctx.fillStyle = 'rgba(96,72,160,.10)';
    ctx.fillRect(0, 0, W, H);
    const grad = ctx.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 620);
    grad.addColorStop(0, 'rgba(60,40,110,0)');
    grad.addColorStop(1, 'rgba(60,40,110,.22)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
  if (game.flashT > 0) {                        // shrine lightning flash
    ctx.fillStyle = `rgba(235,238,255,${game.flashT * .8})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (transition) {                             // portal fade between levels
    const tHalf = transition.dur / 2;
    const a = transition.t < tHalf ? transition.t / tHalf
                                   : 1 - (transition.t - tHalf) / tHalf;
    ctx.fillStyle = `rgba(16,12,10,${clamp(a, 0, 1)})`;
    ctx.fillRect(0, 0, W, H);
  }
  drawHUD();
  drawTouchUI();
}

