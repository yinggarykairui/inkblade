/* ---------- effects: particles, floating text, stains, shake, hit-stop ---------- */
let particles = [], texts = [], stains = [];
let ultTrail = [];   // 奥義 blade-tip ribbon points {x,y,t}
let shakeMag = 0, hitStop = 0;

function shake(m) {
  const mul = (typeof save !== 'undefined' && save.shakeMul !== undefined) ? save.shakeMul : 1;
  shakeMag = Math.max(shakeMag, m * mul);
}
function freeze(t) { hitStop = Math.max(hitStop, t); }

function addText(x, y, txt, color, size = 15) {
  texts.push({ x, y, txt, color, size, t: 0, life: .9 });
}
function sparks(x, y, ang, color, n = 6, spread = 1.2) {
  for (let i = 0; i < n; i++) {
    const a = ang + crand(-spread, spread), s = crand(90, 300);
    particles.push({ kind: 'line', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      t: 0, life: crand(.18, .34), color, w: crand(1, 2.5) });
  }
}
function puff(x, y, color, n = 5) {
  for (let i = 0; i < n; i++) {
    const a = crand(0, TAU), s = crand(20, 70);
    particles.push({ kind: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      t: 0, life: crand(.25, .5), color, rad: crand(2, 4.5) });
  }
}
function slashTrail(x, y, r, a0, a1, color, w = 5) {
  particles.push({ kind: 'arc', x, y, r, a0, a1, t: 0, life: .22, color, w });
}
function spawnPetals(x, y, n, tint, owner) {
  // default pigment petals; a tint token turns them to ink in base play
  for (let i = 0; i < n; i++) {
    const a = crand(0, TAU);
    particles.push({ kind: 'petal', x: x + crand(-6, 6), y: y + crand(-6, 6),
      vx: Math.cos(a) * crand(5, 25), vy: crand(10, 32),
      t: 0, life: crand(.8, 1.4), color: '#d98ea1', tint, owner,
      rad: crand(1.5, 2.8), spin: crand(0, TAU) });
  }
}
function boltFX(x0, y0, x1, y1, c1, c2) {
  const jag = () => {
    const pts = [{ x: x0, y: y0 }];
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      pts.push({ x: lerp(x0, x1, t) + crand(-10, 10), y: lerp(y0, y1, t) + crand(-10, 10) });
    }
    pts.push({ x: x1, y: y1 });
    return pts;
  };
  particles.push({ kind: 'bolt', pts: jag(), t: 0, life: .22, color: c1 || '#8fb4ff', w: 2.5 });
  particles.push({ kind: 'bolt', pts: jag(), t: 0, life: .15, color: c2 || '#e8f0ff', w: 1.2 });
}
function chainLightning(x, y, hops = 1) {
  // Raiko: one arc per kill, to the nearest living enemy in range
  // (a mastered blade lets the storm walk one foe further)
  let best = null, bd = 190;
  for (const o of enemies) {
    if (o.dead || o.state === 'spawn') continue;
    const d = dist(x, y, o.x, o.y);
    if (d < bd && d > 1) { bd = d; best = o; }
  }
  if (!best) return;
  // in base play the storm is drawn in ink; the surge lets it burn blue
  const glow = ownerSurged(player);
  boltFX(x, y, best.x, best.y,
    glow ? undefined : 'rgba(96,88,82,.85)',
    glow ? undefined : 'rgba(240,238,232,.95)');
  addText(best.x, best.y - best.r - 14, 'shock!',
    glow ? '#5b78c9' : 'rgba(43,35,32,.7)', 13);
  best.hurt(14, Math.atan2(best.y - y, best.x - x), .45, 8);
  freeze(.04); shake(3);
  if (hops > 1) chainLightning(best.x, best.y, hops - 1);
}
// death calligraphy — every fallen lord is brushed into the floor
let calligraphy = [];
function paintDeathKanji(b) {
  if (calligraphy.length > 6) calligraphy.shift();
  const ch = game.mode === 'rush' ? '討'
    : game.mode === 'infinite' ? '滅'
    : (b.bossName || '').includes('Storm') ? '嵐' : '勝';
  calligraphy.push({
    x: clamp(b.x, ARENA.x + 90, ARENA.x + ARENA.w - 90),
    y: clamp(b.y, ARENA.y + 80, ARENA.y + ARENA.h - 80),
    ch, rot: crand(-.15, .15), alpha: .16,
  });
}
function inkSplat(x, y) {
  if (stains.length > 40) stains.shift();
  const blobs = [];
  for (let i = 0; i < crand(4, 8); i++) {
    const a = crand(0, TAU), d = crand(0, 22);
    blobs.push({ dx: Math.cos(a) * d, dy: Math.sin(a) * d, r: crand(2.5, 9) });
  }
  stains.push({ x, y, blobs, alpha: .28 });
  puff(x, y, INK, 9);
}
/* ---------- fx: the write-only cosmetics director (Phase 0) ----------
   Gameplay reports WHAT happened; a recipe decides how it looks in the
   owner's current visual state (ink vs color). Rules: recipes may read
   game state and emit particles/sfx — they NEVER mutate simulation
   state, so online lockstep cannot be disturbed from here.             */
const FX_RECIPES = {};
function fx(event, d) {
  const r = FX_RECIPES[event];
  if (r) r(d || {});
}
// draw-time particle color: legacy particles carry .color; token particles
// carry .tint (+ .owner) and are resolved fresh every frame
function pcol(p) { return p.tint ? resolveTint(p.tint, p.owner) : p.color; }

/* brushStroke — the sumi-e primitive: a tapered ribbon with a solid core
   and dry-brush flecks at the tip. pts: [{x,y,a?}] (a = brush pressure).
   opts: { color, weight, taper=true, glow=false, alpha, flecks=true }
   The glow flag is the entire ink→neon costume change: same geometry.   */
function brushStroke(pts, opts) {
  if (!pts || pts.length < 2) return;
  const o = opts || {};
  const col = o.color || PAL.ink.stroke;
  const w0 = o.weight || 4;
  const left = [], right = [];
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(pts.length - 1, i + 1)];
    const dx = p1.x - p0.x, dy = p1.y - p0.y;
    const l = Math.hypot(dx, dy) || 1;
    const press = pts[i].a !== undefined ? pts[i].a : 1;
    const w = Math.max(.3, w0 * press *
      (o.taper === false ? 1 : (.35 + .65 * (1 - i / (pts.length - 1)))));
    left.push({ x: pts[i].x - dy / l * w, y: pts[i].y + dx / l * w });
    right.push({ x: pts[i].x + dy / l * w, y: pts[i].y - dx / l * w });
  }
  ctx.save();
  if (o.glow) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowBlur = 14; ctx.shadowColor = col;
  }
  ctx.fillStyle = col;
  ctx.globalAlpha = o.alpha !== undefined ? o.alpha : (o.glow ? .75 : .9);
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
  ctx.fill();
  if (!o.glow && o.flecks !== false) {   // dry-brush spatter — cosmetic dice
    const tip = pts[0];
    ctx.globalAlpha = .35;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(tip.x + crand(-3, 3), tip.y + crand(-3, 3), crand(.4, 1.1), 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
}

/* --- arrow recipes: the Phase 1 proof of concept ---
   Base: everything is ink. Surged: the four bow arts wake —
   longbow 「貫の一画」 Piercing Stroke   · shattering ruled geometry
   repeater 「飛沫の斉射」 Splatter Volley · vibrant pigment bursts
   firebow 「縛りの巻物」 Binding Scroll  · jade grass-script coils
   stormbow 「描かれし獣」 Painted Beast  · neon-winged flame strokes   */
FX_RECIPES.arrowLoose = d => {
  const s = styleFor(d.owner);
  if (s.glow) {
    particles.push({ kind: 'ring', x: d.x, y: d.y, t: 0, life: .28,
      color: s.stroke, r0: 4, r1: 26, w: 2 });
  } else {
    for (let i = 0; i < 3; i++)   // a flick of ink off the string
      particles.push({ kind: 'line', x: d.x, y: d.y,
        vx: Math.cos(d.ang + crand(-.5, .5)) * crand(60, 140),
        vy: Math.sin(d.ang + crand(-.5, .5)) * crand(60, 140),
        t: 0, life: crand(.12, .2), tint: 'wash', owner: d.owner, w: 1.2 });
  }
};
FX_RECIPES.arrowImpact = d => {
  const s = styleFor(d.owner);
  if (!s.glow) {
    // sumi-e: the shaft lands as a directional splatter of ink droplets
    for (let i = 0; i < 6; i++) {
      const a = d.ang + Math.PI + crand(-1.1, 1.1);
      particles.push({ kind: 'dot', x: d.x, y: d.y,
        vx: Math.cos(a) * crand(30, 160), vy: Math.sin(a) * crand(30, 160),
        t: 0, life: crand(.2, .45), tint: 'stroke', owner: d.owner, rad: crand(1, 2.6) });
    }
    return;
  }
  const P = PAL.pigment;
  if (d.bowId === 'longbow') {          // Piercing Stroke — the line shatters
    for (let i = 0; i < 8; i++) {
      const a = crand(0, TAU);
      particles.push({ kind: 'line', x: d.x, y: d.y,
        vx: Math.cos(a) * crand(160, 380), vy: Math.sin(a) * crand(160, 380),
        t: 0, life: crand(.2, .38),
        color: i % 2 ? P.imperialGold : '#ffffff', w: crand(1.4, 2.4) });
    }
    particles.push({ kind: 'ring', x: d.x, y: d.y, t: 0, life: .3,
      color: P.imperialGold, r0: 4, r1: 46, w: 2.5 });
  } else if (d.bowId === 'repeater') {  // Splatter Volley — pigment bursts
    const cols = [P.cinnabar, P.azurite, P.jade];
    for (let i = 0; i < 10; i++) {
      const a = crand(0, TAU);
      particles.push({ kind: 'dot', x: d.x, y: d.y,
        vx: Math.cos(a) * crand(40, 260), vy: Math.sin(a) * crand(40, 260) - 40,
        t: 0, life: crand(.3, .6), color: cols[i % 3], rad: crand(2, 5) });
    }
  } else if (d.bowId === 'firebow') {   // Binding Scroll — grass-script coils
    const script = ['縛', '封', '結'];
    for (let i = 0; i < 3; i++)
      particles.push({ kind: 'glyph', ch: script[i], color: P.jade,
        x: d.x + crand(-18, 18), y: d.y + crand(-18, 18),
        vx: 0, vy: -20, t: 0, life: .8 + i * .15, size: 20 + i * 5, misted: false });
    particles.push({ kind: 'ring', x: d.x, y: d.y, t: 0, life: .5,
      color: P.jade, r0: 8, r1: 44, w: 2 });
  } else if (d.bowId === 'stormbow') {  // Painted Beast — the wings burst
    for (let i = 0; i < 8; i++) {
      const a = d.ang + Math.PI + crand(-1.3, 1.3);
      particles.push({ kind: 'petal', x: d.x, y: d.y,
        vx: Math.cos(a) * crand(60, 220), vy: Math.sin(a) * crand(60, 220),
        t: 0, life: crand(.35, .7),
        color: i % 2 ? P.cinnabar : P.imperialGold, rad: crand(2, 3.4), spin: crand(0, TAU) });
    }
    particles.push({ kind: 'glyph', ch: '鳳', color: P.cinnabar,
      x: d.x, y: d.y - 8, vx: 0, vy: -26, t: 0, life: .7, size: 26, misted: false });
  } else {                              // shortbow — plain neon
    sparks(d.x, d.y, d.ang, s.stroke, 8);
    particles.push({ kind: 'ring', x: d.x, y: d.y, t: 0, life: .3,
      color: s.accent, r0: 6, r1: 32, w: 2 });
  }
};

/* --- melee recipes: Phase 2 ---
   Base: every swing is a heavy, textured sumi-e stroke — a dark core over
   a wider drying halo — with no per-blade hue. Identity survives as brush
   language (weight, rain, paper-white heron cuts, ink petals). The surge
   unlocks the blade's WPN_NEON pair through the same event.             */
FX_RECIPES.slash = d => {
  const s = styleFor(d.owner);
  if (s.glow) {   // ultimate slashes — the blade's own neon
    slashTrail(d.x, d.y, d.reach - 6, d.ang - .35 * d.dir, d.ang + .1 * d.dir,
      s.accent, d.bladeId === 'kurogane' ? 7 : 5);
    return;
  }
  if (d.bladeId === 'tsukikage') return;   // Moon Shadow leaves no trail
  if (d.bladeId === 'ame') {               // falling rain, now in gray ink
    particles.push({ kind: 'line', x: d.tipX, y: d.tipY, vx: 0, vy: 150,
      t: 0, life: .3, tint: 'wash', owner: d.owner, w: 1.2 });
    return;
  }
  const w = d.bladeId === 'kurogane' ? 7 : 5;
  // the drying halo — wide, dilute, lingers a beat longer than the cut
  particles.push({ kind: 'arc', x: d.x, y: d.y, r: d.reach - 6,
    a0: d.ang - .35 * d.dir, a1: d.ang + .1 * d.dir,
    t: 0, life: .3, tint: 'faint', owner: d.owner, w: w * 1.9 });
  // the loaded core — dark, narrow, sharp (weak swings stay dilute)
  particles.push({ kind: 'arc', x: d.x, y: d.y, r: d.reach - 6,
    a0: d.ang - .32 * d.dir, a1: d.ang + .08 * d.dir,
    t: 0, life: .22, tint: d.weak ? 'wash' : 'stroke', owner: d.owner, w });
  if (d.bladeId === 'shirasagi')   // the heron cuts in untouched paper-white
    particles.push({ kind: 'arc', x: d.x, y: d.y, r: d.reach - 8,
      a0: d.ang - .3 * d.dir, a1: d.ang + .06 * d.dir,
      t: 0, life: .2, color: 'rgba(252,250,244,.85)', w: 3 });
  if (d.charged)                   // Raiko's flow-charge flashes white-hot
    particles.push({ kind: 'arc', x: d.x, y: d.y, r: d.reach - 8,
      a0: d.ang - .3 * d.dir, a1: d.ang + .06 * d.dir,
      t: 0, life: .18, color: 'rgba(240,240,240,.95)', w: 2.5 });
  if (d.bladeId === 'botan' && d.tipX !== undefined)
    spawnPetals(d.tipX, d.tipY, 1, 'wash', d.owner);   // ink petals in base
  // temper shows in the ink — cosmetic, PvE only, deepening with level:
  // L15+ drags a second wake; L25+ cuts it wider and sheds a droplet
  if (game.mode !== 'duel' && d.bladeId && wxpLvl(d.bladeId) >= 15) {
    const deep = wxpLvl(d.bladeId) >= 25;
    particles.push({ kind: 'arc', x: d.x, y: d.y, r: d.reach - 14,
      a0: d.ang - .3 * d.dir, a1: d.ang + .05 * d.dir,
      t: 0, life: .4, tint: 'faint', owner: d.owner, w: deep ? 4.5 : 3 });
    if (deep && d.tipX !== undefined)
      particles.push({ kind: 'dot', x: d.tipX, y: d.tipY,
        vx: crand(-30, 30), vy: crand(10, 50), t: 0, life: crand(.3, .5),
        tint: 'stroke', owner: d.owner, rad: crand(1, 2) });
    if (deep && d.bladeId === 'botan' && d.tipX !== undefined)
      spawnPetals(d.tipX, d.tipY, 1, 'wash', d.owner);   // the bloom doubles
  }
  if (d.tipX !== undefined && Math.random() < .3)      // droplets off the tip
    particles.push({ kind: 'dot', x: d.tipX, y: d.tipY,
      vx: crand(-40, 40), vy: crand(-20, 60), t: 0, life: crand(.2, .4),
      tint: 'wash', owner: d.owner, rad: crand(.8, 1.8) });
};
// fire status — the pigment rule: a cinnabar wash under charcoal smoke
FX_RECIPES.burn = d => {
  particles.push({ kind: 'dot', x: d.x, y: d.y - 6,
    vx: crand(-8, 8), vy: crand(-50, -25),
    t: 0, life: crand(.4, .7), color: 'rgba(227,66,52,.5)', rad: crand(2, 3.5) });
  for (let i = 0; i < 2; i++)
    particles.push({ kind: 'dot', x: d.x + crand(-6, 6), y: d.y - 8,
      vx: crand(-10, 10), vy: crand(-60, -30),
      t: 0, life: crand(.5, .9), tint: 'faint', owner: null, rad: crand(2, 4) });
};

function updateEffects(dt) {
  for (const p of particles) {
    p.t += dt;
    if (p.vx !== undefined) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .92; p.vy *= .92; }
    // hanging calligraphy dissolves into ink mist near the end of its life
    if (p.kind === 'glyph' && !p.misted && p.t > p.life * .7) {
      p.misted = true;
      puff(p.x, p.y, 'rgba(43,35,32,.45)', 6);
    }
  }
  particles = particles.filter(p => p.t < p.life);
  // particle budget: the ink jar is finite — when the stage overflows, the
  // oldest droplets dry first. Cosmetic-only, so eviction is lockstep-safe.
  if (particles.length > 450) particles.splice(0, particles.length - 450);
  for (const t of texts) { t.t += dt; t.y -= 26 * dt; }
  texts = texts.filter(t => t.t < t.life);
  for (const s of stains) s.alpha = Math.max(.10, s.alpha - dt * .02);
  shakeMag = Math.max(0, shakeMag - dt * 22);
}

