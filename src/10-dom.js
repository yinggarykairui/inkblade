/* ---------- canvas ---------- */
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const W = 1024, H = 640;
let DPR = 1;
function fitCanvas() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = W * DPR; cv.height = H * DPR;
}
fitCanvas();
addEventListener('resize', fitCanvas);

/* every overlay panel hangs like a scroll: lacquered rollers pinned to the
   top and bottom of the frame, the paper winding beneath them whenever the
   writing runs long (the panel body scrolls; the rollers stay put)        */
if (document.querySelectorAll) {
  const scrollPairs = [];   // [overlay, topRoller, botRoller] per panel
  for (const panel of Array.from(document.querySelectorAll('.panel'))) {
    const top = document.createElement('div');
    top.className = 'roller rollerTop';
    const bot = document.createElement('div');
    bot.className = 'roller rollerBot';
    panel.insertBefore(top, panel.firstChild);
    panel.appendChild(bot);
    // when the writing runs past the screen, the dowels become handles:
    // click the bottom roller and the scroll unravels; the top rewinds it
    const ov = panel.parentElement;
    if (ov && ov.classList && ov.classList.contains('overlay')) {
      top.title = 'rewind the scroll';
      bot.title = 'unravel the scroll';
      bot.addEventListener('click', () =>
        ov.scrollBy({ top: ov.clientHeight * .65, behavior: 'smooth' }));
      top.addEventListener('click', () =>
        ov.scrollBy({ top: -ov.clientHeight * .65, behavior: 'smooth' }));
      ov.addEventListener('scroll', updateRollerHints);
      scrollPairs.push([ov, top, bot]);
    }
  }
  function updateRollerHints() {
    for (const [ov, top, bot] of scrollPairs) {
      bot.classList.toggle('unravel',
        ov.scrollHeight - ov.clientHeight - ov.scrollTop > 4);
      top.classList.toggle('unravel', ov.scrollTop > 4);
    }
  }
  addEventListener('resize', updateRollerHints);
  // panels grow and shrink as menus rerender — keep the hint honest
  setInterval(updateRollerHints, 400);
}

const ARENA = { x: 42, y: 42, w: W - 84, h: H - 84 };
function clampArena(e) {
  e.x = clamp(e.x, ARENA.x + e.r, ARENA.x + ARENA.w - e.r);
  e.y = clamp(e.y, ARENA.y + e.r, ARENA.y + ARENA.h - e.r);
}

/* ---------- the five arenas ----------
   Each theme repaints the pre-rendered backdrop, reshapes the arena,
   and owns a hazard + ambient particle behaviour. Phase 3: themes are
   told apart by PAPER TONE, brushwork density and line weight — the
   accents are muted gray-inks now, never a hue statement.              */
const THEMES = [
  { name: 'The Outer Dojo Yard',  kanji: '庭', accent: '#6b625c', paper: '#ece0c8',
    arena: { x: 42, y: 42, w: W - 84, h: H - 84 }, tint: null },
  { name: 'The Bamboo Grove',     kanji: '竹', accent: '#5a6052', paper: '#e3e4c4',
    arena: { x: 72, y: 42, w: W - 144, h: H - 84 }, tint: 'rgba(86,92,78,.05)' },
  { name: 'The Rain-Slicked Bridge', kanji: '橋', accent: '#596066', paper: '#d7dcda',
    arena: { x: 42, y: 205, w: W - 84, h: 230 }, tint: 'rgba(92,99,104,.07)' },
  { name: 'The Burning Watchtower', kanji: '炎', accent: '#6a5b4c', paper: '#e2cba8',
    arena: { x: 42, y: 42, w: W - 84, h: H - 84 }, tint: 'rgba(120,100,80,.06)' },
  { name: 'The Storm Shrine',     kanji: '嵐', accent: '#5c5561', paper: '#c7c2c9',
    arena: { x: 42, y: 42, w: W - 84, h: H - 84 }, tint: 'rgba(46,43,52,.16)' },
];

/* the Tomb's dressing — painted OVER a theme backdrop when the mode
   begins: darker paper, candle pools (gold is sanctioned), tablet rows.
   Texture and value only, no new hues — the ink rules hold underground. */
function paintTombDressing() {
  const b = bg.getContext('2d');
  b.fillStyle = 'rgba(24,22,20,.42)';           // the earth closes overhead
  b.fillRect(0, 0, W, H);
  // ranks of ancestor tablets receding along the walls
  for (const side of [ARENA.y + 40, ARENA.y + ARENA.h - 46]) {
    for (let i = 0; i < 9; i++) {
      const x = ARENA.x + 60 + i * (ARENA.w - 120) / 8;
      b.fillStyle = `rgba(20,17,15,${.35 + (i % 3) * .08})`;
      b.strokeStyle = 'rgba(60,54,48,.5)'; b.lineWidth = 1.5;
      b.beginPath();
      b.moveTo(x - 8, side + 18); b.lineTo(x - 8, side - 8);
      b.quadraticCurveTo(x, side - 14, x + 8, side - 8);
      b.lineTo(x + 8, side + 18); b.closePath();
      b.fill(); b.stroke();
    }
  }
  // candle pools — small warm gold breaths in the dark
  for (let i = 0; i < 7; i++) {
    const x = ARENA.x + 90 + i * (ARENA.w - 180) / 6;
    const y = i % 2 ? ARENA.y + 80 : ARENA.y + ARENA.h - 84;
    const g = b.createRadialGradient(x, y, 2, x, y, 46);
    g.addColorStop(0, 'rgba(200,164,90,.20)');
    g.addColorStop(1, 'rgba(200,164,90,0)');
    b.fillStyle = g;
    b.beginPath(); b.arc(x, y, 46, 0, TAU); b.fill();
    b.fillStyle = 'rgba(220,190,120,.6)';
    b.beginPath(); b.arc(x, y, 1.6, 0, TAU); b.fill();
  }
}

/* Pre-rendered themed background */
const bg = document.createElement('canvas');
function paintBG(ti) {
  const th = THEMES[ti];
  bg.width = W * 2; bg.height = H * 2;
  const b = bg.getContext('2d');
  b.scale(2, 2);
  b.fillStyle = th.paper; b.fillRect(0, 0, W, H);
  // paper speckle + fibers
  for (let i = 0; i < 900; i++) {
    b.fillStyle = `rgba(120,100,70,${rand(.02, .09)})`;
    b.beginPath();
    b.arc(rand(0, W), rand(0, H), rand(.4, 1.6), 0, TAU);
    b.fill();
  }
  for (let i = 0; i < 130; i++) {
    b.strokeStyle = `rgba(120,100,70,${rand(.03, .07)})`;
    b.lineWidth = rand(.5, 1.2);
    const x = rand(0, W), y = rand(0, H), a = rand(0, TAU), l = rand(6, 22);
    b.beginPath(); b.moveTo(x, y);
    b.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); b.stroke();
  }
  // ensō — big brushed circle, faint (dojo + shrine only)
  if (ti === 0 || ti === 4) {
    b.save();
    b.translate(W / 2, H / 2);
    b.strokeStyle = ti === 4 ? 'rgba(80,76,86,.12)' : 'rgba(43,35,32,.08)';
    b.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      b.lineWidth = 14 - i * 2;
      b.beginPath();
      b.arc(0, 0, 205 + i * 3, -TAU * .38 + i * .05, TAU * .52 - i * .04);
      b.stroke();
    }
    b.restore();
  }
  /* per-theme scenery */
  if (ti === 0) {
    // raked gravel — long horizontal strokes
    b.strokeStyle = 'rgba(120,100,70,.10)'; b.lineWidth = 1;
    for (let y = ARENA.y + 24; y < ARENA.y + ARENA.h; y += 22) {
      b.beginPath(); b.moveTo(ARENA.x + 14, y + rand(-2, 2));
      b.lineTo(ARENA.x + ARENA.w - 14, y + rand(-2, 2)); b.stroke();
    }
  } else if (ti === 1) {
    // bamboo lanes — tall pale-green columns flanking the arena
    for (const bx of [ARENA.x - 34, ARENA.x + ARENA.w + 14]) {
      for (let i = 0; i < 8; i++) {
        const x = bx + rand(0, 22), sway = rand(-6, 6);
        b.strokeStyle = `rgba(86,92,78,${rand(.25, .45)})`; b.lineWidth = rand(6, 10);
        b.lineCap = 'round';
        b.beginPath(); b.moveTo(x, H + 10); b.quadraticCurveTo(x + sway, H / 2, x + sway * 2, -10);
        b.stroke();
        b.strokeStyle = 'rgba(43,35,32,.25)'; b.lineWidth = 1.5;
        for (let s = 1; s < 7; s++) {
          const yy = s * H / 7;
          b.beginPath(); b.moveTo(x - 5 + sway * s / 7, yy); b.lineTo(x + 5 + sway * s / 7, yy); b.stroke();
        }
      }
    }
    // faint interior lane stripes
    b.fillStyle = 'rgba(86,92,78,.05)';
    for (let i = 0; i < 3; i++) b.fillRect(ARENA.x + 90 + i * 260, ARENA.y, 60, ARENA.h);
  } else if (ti === 2) {
    // water above and below the bridge
    b.fillStyle = 'rgba(92,99,104,.16)';
    b.fillRect(0, 0, W, ARENA.y - 14); b.fillRect(0, ARENA.y + ARENA.h + 14, W, H);
    b.strokeStyle = 'rgba(92,99,104,.35)'; b.lineWidth = 1.4;
    for (let i = 0; i < 40; i++) {
      const wy = Math.random() < .5 ? rand(8, ARENA.y - 24) : rand(ARENA.y + ARENA.h + 24, H - 8);
      const wx = rand(20, W - 60);
      b.beginPath(); b.moveTo(wx, wy);
      b.quadraticCurveTo(wx + 14, wy - 4, wx + 30, wy);
      b.quadraticCurveTo(wx + 44, wy + 4, wx + 56, wy); b.stroke();
    }
    // planks
    b.strokeStyle = 'rgba(43,35,32,.14)'; b.lineWidth = 2;
    for (let x = ARENA.x + 26; x < ARENA.x + ARENA.w; x += 34) {
      b.beginPath(); b.moveTo(x + rand(-2, 2), ARENA.y + 4);
      b.lineTo(x + rand(-2, 2), ARENA.y + ARENA.h - 4); b.stroke();
    }
    // rope rails
    b.strokeStyle = 'rgba(110,90,60,.5)'; b.lineWidth = 3;
    for (const ry of [ARENA.y - 8, ARENA.y + ARENA.h + 8]) {
      b.beginPath(); b.moveTo(ARENA.x - 10, ry);
      for (let x = ARENA.x; x <= ARENA.x + ARENA.w; x += 64)
        b.quadraticCurveTo(x + 32, ry + 6, x + 64, ry);
      b.stroke();
    }
  } else if (ti === 3) {
    // scorched floorboards + charred beams
    b.strokeStyle = 'rgba(43,35,32,.12)'; b.lineWidth = 2;
    for (let y = ARENA.y + 30; y < ARENA.y + ARENA.h; y += 42) {
      b.beginPath(); b.moveTo(ARENA.x + 6, y); b.lineTo(ARENA.x + ARENA.w - 6, y); b.stroke();
    }
    for (let i = 0; i < 14; i++) {
      b.fillStyle = `rgba(40,25,15,${rand(.08, .2)})`;
      const x = rand(ARENA.x, ARENA.x + ARENA.w), y = rand(ARENA.y, ARENA.y + ARENA.h);
      b.beginPath(); b.ellipse(x, y, rand(12, 44), rand(6, 18), rand(0, TAU), 0, TAU); b.fill();
    }
    // fallen beam silhouettes in the corners
    b.strokeStyle = 'rgba(60,35,18,.4)'; b.lineWidth = 9; b.lineCap = 'round';
    b.beginPath(); b.moveTo(ARENA.x + 10, ARENA.y + 60); b.lineTo(ARENA.x + 120, ARENA.y + 14); b.stroke();
    b.beginPath(); b.moveTo(ARENA.x + ARENA.w - 10, ARENA.y + ARENA.h - 70);
    b.lineTo(ARENA.x + ARENA.w - 130, ARENA.y + ARENA.h - 16); b.stroke();
  } else if (ti === 4) {
    // night sky + stars above the shrine
    b.fillStyle = 'rgba(32,30,38,.30)'; b.fillRect(0, 0, W, H);
    for (let i = 0; i < 60; i++) {
      b.fillStyle = `rgba(235,235,255,${rand(.15, .5)})`;
      b.beginPath(); b.arc(rand(0, W), rand(0, H * .35), rand(.5, 1.5), 0, TAU); b.fill();
    }
    // torii gate silhouette at the top
    b.strokeStyle = 'rgba(88,84,96,.55)'; b.lineWidth = 10; b.lineCap = 'round';
    const tx = W / 2, ty = 30;
    b.beginPath(); b.moveTo(tx - 90, ty + 90); b.lineTo(tx - 80, ty); b.stroke();
    b.beginPath(); b.moveTo(tx + 90, ty + 90); b.lineTo(tx + 80, ty); b.stroke();
    b.lineWidth = 12;
    b.beginPath(); b.moveTo(tx - 120, ty + 4); b.lineTo(tx + 120, ty + 4); b.stroke();
    b.lineWidth = 7;
    b.beginPath(); b.moveTo(tx - 96, ty + 34); b.lineTo(tx + 96, ty + 34); b.stroke();
    // shrine stone circle mid-arena
    b.strokeStyle = 'rgba(88,84,96,.25)'; b.lineWidth = 4;
    b.beginPath(); b.arc(W / 2, H / 2, 120, 0, TAU); b.stroke();
  }
  // arena border — double ink line, hand-drawn wobble
  function wobblyRect(inset, lw, alpha) {
    b.strokeStyle = `rgba(43,35,32,${alpha})`;
    b.lineWidth = lw; b.lineCap = 'round';
    const x0 = ARENA.x - inset, y0 = ARENA.y - inset;
    const x1 = ARENA.x + ARENA.w + inset, y1 = ARENA.y + ARENA.h + inset;
    b.beginPath();
    const pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
    for (let s = 0; s < 4; s++) {
      const [ax, ay] = pts[s], [cx, cy] = pts[s + 1];
      const steps = 14;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = lerp(ax, cx, t) + rand(-1.4, 1.4);
        const py = lerp(ay, cy, t) + rand(-1.4, 1.4);
        (s === 0 && i === 0) ? b.moveTo(px, py) : b.lineTo(px, py);
      }
    }
    b.stroke();
  }
  wobblyRect(10, 5, .9);
  wobblyRect(2, 2, .55);
  // corner brush ticks
  b.strokeStyle = 'rgba(43,35,32,.5)'; b.lineWidth = 3;
  const cs = 26;
  [[ARENA.x, ARENA.y, 1, 1], [ARENA.x + ARENA.w, ARENA.y, -1, 1],
   [ARENA.x, ARENA.y + ARENA.h, 1, -1], [ARENA.x + ARENA.w, ARENA.y + ARENA.h, -1, -1]
  ].forEach(([x, y, sx, sy]) => {
    b.beginPath();
    b.moveTo(x + sx * cs, y + sy * 6); b.lineTo(x + sx * 6, y + sy * 6);
    b.lineTo(x + sx * 6, y + sy * cs); b.stroke();
  });
  // red hanko seal
  b.save();
  b.translate(W - 74, H - 74); b.rotate(-.06);
  b.strokeStyle = 'rgba(181,52,42,.55)'; b.lineWidth = 3;
  b.strokeRect(-20, -20, 40, 40);
  b.fillStyle = 'rgba(181,52,42,.55)';
  b.font = '26px Georgia,serif'; b.textAlign = 'center'; b.textBaseline = 'middle';
  b.fillText('刃', 0, 2);
  b.restore();
}
/* switch the live arena to a theme: reshape bounds, repaint, reset hazards */
let themeIndex = 0;
function setTheme(ti) {
  themeIndex = ti;
  const a = THEMES[ti].arena;
  ARENA.x = a.x; ARENA.y = a.y; ARENA.w = a.w; ARENA.h = a.h;
  paintBG(ti);
  setupHazards(ti);
  retuneAmbient();
  calligraphy = [];   // a fresh floor for a fresh arena
  if (typeof player !== 'undefined') clampArena(player);
}
paintBG(0);

/* ---------- input ---------- */
const keys = Object.create(null);
/* input buffers live ON the player entities now (co-op needs two sets);
   these shims keep old expressions compiling if any linger */
let attackBuf = 0, dodgeBuf = 0, parryBuf = 0;   // legacy — unused, see player.attackBuf
// virtual-stick state — populated by the touch layer when a finger drives movement
const touch = { active: false, mx: 0, my: 0, enabled: false };
addEventListener('keydown', e => {
  initAudio();   // autoplay policy: the context wakes on the first gesture
  if (e.target && e.target.tagName === 'INPUT') return;
  const k = e.key;
  if (k.startsWith('Arrow') || k === ' ') e.preventDefault();
  keys[k] = true;
  if (k.length === 1) keys[k.toLowerCase()] = true;
  // 網 online co-op: every action rides the tick pipeline, never the
  // entity — a locally-applied press would land early on one sim only
  const coopWire = net && net.started && net.coop && game.state === 'playing';
  if (coopWire && !e.repeat) {
    const wk = k.length === 1 ? k.toLowerCase() : k;
    if (wk === 'v') net.pend.atk = true;
    if (k === 'Shift') net.pend.roll = true;
    if (wk === 'c') net.pend.parry = true;
    if (wk === 'r' || k === ' ') net.pend.ult = true;
    if (wk === 'q') net.pend.stance = true;
    if (wk === 'e') net.pend.interact = true;
  }
  if ((k === 'v' || k === 'V') && !e.repeat && !coopWire) {
    // Fudemaru casts on release so the hold duration can pick the symbol
    if (game.equipped === 'fudemaru' && game.state === 'playing' && game.mode !== 'duel') {
      player.vHeld = true; player.vDownAt = game.time;
    } else player.attackBuf = 0.18;
  }
  if (k === 'Shift' && !coopWire) player.dodgeBuf = 0.18;
  if ((k === 'c' || k === 'C') && !e.repeat && !coopWire) player.parryBuf = 0.18;
  // couch co-op: the second blade answers the duel-style row —
  // U slash · I roll · O parry · P bow-stance · , meditate (held) · . interact
  if (game.coop && !net && p2 && game.state === 'playing' && game.mode !== 'duel' && !e.repeat) {
    const ck = k.length === 1 ? k.toLowerCase() : k;
    if (ck === 'u') p2.attackBuf = 0.18;
    if (ck === 'i') p2.dodgeBuf = 0.18;
    if (ck === 'o') p2.parryBuf = 0.18;
    if (ck === 'p') toggleStanceFor(p2);
    if (ck === '.') tryInteract(p2);   // the second blade opens chests too
  }
  if (game.mode === 'duel' && game.state === 'playing' && duel) {
    const lk = k.length === 1 ? k.toLowerCase() : k;
    if (net && net.started) {
      // online: presses go into the lockstep pipeline, never straight in —
      // one local player, so both bind sets drive them
      if (!e.repeat) {
        if (lk === 'v' || lk === 'u') net.pend.atk = true;
        if (lk === 'b' || lk === 'i' || k === 'Shift') net.pend.roll = true;
        if (lk === 'n' || lk === 'c' || lk === 'o') net.pend.parry = true;
        if (lk === 'l' || lk === 'k' || lk === 'r' || k === ' ')
          net.pend.ult = true;                            // brush maw / 奥義 art
        if (lk === 'y' || lk === 'j') net.pend.swap = true;   // cross the wire too
        if (lk === 'q' || lk === 'p') net.pend.stance = true; // 弓 stance toggle
      }
    } else if (!e.repeat) {
      // vs a bot the lone human owns BOTH bind sets; vs a human they split
      const solo = !!duel.p2.ai;
      const p2t = solo ? duel.p1 : duel.p2;
      // P1 answers BOTH bind sets — the duel row (V/B/N) and the PvE
      // muscle memory (V/Shift/C), just like the online ring already does
      if (lk === 'v') duel.p1.attackBuf = .18;
      if (lk === 'b' || k === 'Shift') duel.p1.dodgeBuf = .18;
      if (lk === 'n' || lk === 'c') duel.p1.parryBuf = .18;
      // P2 mirrors the V/B/N order one row up: U slash · I roll · O parry
      if (lk === 'u') p2t.attackBuf = .18;
      if (lk === 'i') p2t.dodgeBuf = .18;
      if (lk === 'o') p2t.parryBuf = .18;
      // 奥義 / brush stances: P1 on L (or R / Space), P2 on K; swaps on Y / J
      if (lk === 'l' || lk === 'r' || k === ' ') toggleFighterUlt(duel.p1);
      if (lk === 'k') toggleFighterUlt(p2t);
      if (lk === 'y') toggleFighterSwap(duel.p1);
      if (lk === 'j') toggleFighterSwap(p2t);
      // 弓 stance: P1 on Q, P2 on P
      if (lk === 'q') toggleFighterStance(duel.p1);
      if (lk === 'p') toggleFighterStance(p2t);
    }
  }
  if ((k === 'e' || k === 'E') && !e.repeat && !coopWire) tryInteract();
  if ((k === 'r' || k === 'R' || k === ' ') && !e.repeat && !coopWire) activateUlt();
  if ((k === 'q' || k === 'Q') && !e.repeat && !coopWire) toggleStance();
  if ((k === 'l' || k === 'L') && !e.repeat && !coopWire) toggleUlt();
  if ((k === 'u' || k === 'U') && !e.repeat && !coopWire &&
      !(game.coop && game.mode !== 'duel'))
    toggleBrushSwap();   // in co-op, U belongs to the second blade
  if (k === 'Enter') {
    if (document.activeElement === document.getElementById('sealInput')) return;
    if (game.state === 'title') beginRun();
    else if (game.state === 'gameover') retryRun();
  }
  if (k === 'Escape') {
    if (game.state === 'shop') closeShop();
    else if (game.state === 'shrine') {
      // online co-op: only the host may wave the shrine away
      if (!(netCoop() && net.started && !net.host)) closeShrine();
    }
    else if (game.state === 'records' || game.state === 'settings') closeMetaOverlay();
    else if (game.state === 'rebirth') closeRebirth();
    else if (game.state === 'playing') pauseGame();
    else if (game.state === 'paused') resumeGame();
  }
});
addEventListener('keyup', e => {
  keys[e.key] = false;
  if (e.key.length === 1) keys[e.key.toLowerCase()] = false;
  if ((e.key === 'v' || e.key === 'V') && player.vHeld) {
    player.vHeld = false;
    castSymbol(game.time - player.vDownAt);
  }
});
addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
  player.vHeld = false;
  mouse.down = false;
});

/* ---------- mouse aim (settings: save.mouseAim) ----------
   The cursor becomes the wrist: the blade faces it at any of 360°,
   click slashes, hold bends the bow, hold-release speaks the brush.
   PvE only — duels keep their key binds and the online lockstep
   never sees a cursor. Movement stays on WASD.                     */
const mouse = { x: W / 2, y: H / 2, seen: false, down: false };
function mouseAimOn() {
  // never online: the other sim cannot see this cursor
  return save.mouseAim && mouse.seen && game.state === 'playing' &&
    game.mode !== 'duel' && !netCoop() && !touch.active;
}
function duelMouseAimOn() {
  // LOCAL duels honor the cursor for P1 (vs bots or a couch rival).
  // Online stays keys for both: the lockstep wire carries key BITS only —
  // there is no aim channel, and one-sided cursor aim would be unfair
  // even if there were.
  return save.mouseAim && mouse.seen && game.state === 'playing' &&
    game.mode === 'duel' && !!duel && !(net && net.started) && !touch.active;
}
function mouseWorld() {   // undo the boss-camera ease around center
  const z = game.zoom || 1;
  return { x: (mouse.x - W / 2) / z + W / 2,
           y: (mouse.y - H / 2) / z + H / 2 };
}
cv.addEventListener('mousemove', e => {
  const rect = cv.getBoundingClientRect();
  mouse.x = (e.clientX - rect.left) / rect.width * W;
  mouse.y = (e.clientY - rect.top) / rect.height * H;
  mouse.seen = true;
});
cv.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  initAudio();
  // a mouse hand that hasn't found the setting gets told exactly once
  if (!save.mouseAim && !save.mouseHinted && game.state === 'playing' &&
      game.mode !== 'duel' && !netCoop() && !touch.active) {
    save.mouseHinted = true;
    persistSave();
    setBanner('滑 the cursor can own the blade — enable MOUSE AIM in settings', 3.2);
  }
  // ONLINE (duel with mutual consent, or the co-op storm): the click
  // rides the tick pipeline exactly like the V key; the held button
  // feeds the bow-draw bit in sampleLocalBits
  if (net && net.started && game.state === 'playing' && save.mouseAim &&
      mouse.seen && !touch.active && (net.coop || net.mouseBoth)) {
    e.preventDefault();
    mouse.down = true;
    net.pend.atk = true;
    return;
  }
  // local duels: the click is P1's slash; the held button bends the bow
  if (duelMouseAimOn()) {
    e.preventDefault();
    mouse.down = true;
    duel.p1.attackBuf = .18;
    return;
  }
  if (!mouseAimOn()) return;
  e.preventDefault();
  mouse.down = true;
  // the same doorway the V key uses — brush holds for its symbol,
  // the bow reads the held state, the blade buffers a slash
  if (game.equipped === 'fudemaru') {
    player.vHeld = true; player.vDownAt = game.time;
  } else player.attackBuf = 0.18;
});
addEventListener('mouseup', e => {
  if (e.button !== 0 || !mouse.down) return;
  mouse.down = false;
  if (player.vHeld) { player.vHeld = false; castSymbol(game.time - player.vDownAt); }
});

/* ---------- touch controls: left-thumb stick, right-thumb actions ----------
   Appears the moment a finger touches the canvas; drives the PvE player
   and duel P1 through the same buffers the keyboard uses.               */
const touchUI = {
  stickId: null, sx: 0, sy: 0, knx: 0, kny: 0,
  btns: [
    { id: 'atk',    x: () => W - 78,  y: () => H - 96,  r: 36, kanji: '斬' },
    { id: 'roll',   x: () => W - 168, y: () => H - 58,  r: 29, kanji: '転' },
    { id: 'parry',  x: () => W - 92,  y: () => H - 184, r: 27, kanji: '弾' },
    { id: 'ult',    x: () => W - 92,  y: () => H - 262, r: 27, kanji: '奥' },
    { id: 'stance', x: () => W - 176, y: () => H - 146, r: 25, kanji: '弓' },
  ],
  pressed: {},
};
function touchPos(t) {
  const rect = cv.getBoundingClientRect();
  return { x: (t.clientX - rect.left) / rect.width * W,
           y: (t.clientY - rect.top) / rect.height * H };
}
function nearInteractable() {
  return game.state === 'playing' && (
    (merchant && dist(player.x, player.y, merchant.x, merchant.y) < 85) ||
    (shrine && dist(player.x, player.y, shrine.x, shrine.y) < 80));
}
function touchAction(id) {
  if (game.state !== 'playing') return;
  if (game.mode === 'duel' && duel) {
    if (net && net.started) {
      if (id === 'atk') net.pend.atk = true;
      else if (id === 'roll') net.pend.roll = true;
      else if (id === 'parry') net.pend.parry = true;
      else if (id === 'ult') net.pend.ult = true;
      else if (id === 'stance') net.pend.stance = true;
      return;
    }
    if (id === 'atk') duel.p1.attackBuf = .18;
    else if (id === 'roll') duel.p1.dodgeBuf = .18;
    else if (id === 'parry') duel.p1.parryBuf = .18;
    else if (id === 'ult') toggleFighterUlt(duel.p1);
    else if (id === 'stance') toggleFighterStance(duel.p1);
    return;
  }
  if (net && net.started && net.coop) {   // online co-op: taps ride the wire
    if (id === 'atk') net.pend.atk = true;
    else if (id === 'roll') net.pend.roll = true;
    else if (id === 'parry') net.pend.parry = true;
    else if (id === 'ult') net.pend.ult = true;
    else if (id === 'stance') net.pend.stance = true;
    return;
  }
  if (id === 'atk') {
    if (game.equipped === 'fudemaru') { player.vHeld = true; player.vDownAt = game.time; }
    else if (player.stance === 'sword') player.attackBuf = .18;
    // bow stance: the held 斬 button itself bends the string (see updatePlayer)
  } else if (id === 'roll') player.dodgeBuf = .18;
  else if (id === 'parry') player.parryBuf = .18;
  else if (id === 'ult') activateUlt();
  else if (id === 'stance') toggleStance();
}
cv.addEventListener('touchstart', e => {
  touch.enabled = true;
  initAudio();
  for (const t of Array.from(e.changedTouches)) {
    const p = touchPos(t);
    let hit = false;
    for (const b of touchUI.btns) {
      if (dist(p.x, p.y, b.x(), b.y()) < b.r + 10) {
        hit = true;
        touchUI.pressed[b.id] = t.identifier;
        touchAction(b.id);
      }
    }
    if (!hit && nearInteractable() &&
        dist(p.x, p.y, W / 2, H - 74) < 42) {
      hit = true;
      if (net && net.started && net.coop) net.pend.interact = true;
      else tryInteract();
    }
    if (!hit && p.x < W * .55 && touchUI.stickId === null) {
      touchUI.stickId = t.identifier;
      touchUI.sx = p.x; touchUI.sy = p.y;
      touchUI.knx = p.x; touchUI.kny = p.y;
      touch.active = true; touch.mx = 0; touch.my = 0;
    }
  }
  if (game.state === 'playing') e.preventDefault();
}, { passive: false });
cv.addEventListener('touchmove', e => {
  for (const t of Array.from(e.changedTouches)) {
    if (t.identifier !== touchUI.stickId) continue;
    const p = touchPos(t);
    let dx = (p.x - touchUI.sx) / 52, dy = (p.y - touchUI.sy) / 52;
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    touch.mx = Math.abs(dx) > .18 ? dx : 0;
    touch.my = Math.abs(dy) > .18 ? dy : 0;
    touchUI.knx = touchUI.sx + dx * 46;
    touchUI.kny = touchUI.sy + dy * 46;
  }
  if (game.state === 'playing') e.preventDefault();
}, { passive: false });
function touchRelease(e) {
  for (const t of Array.from(e.changedTouches)) {
    if (t.identifier === touchUI.stickId) {
      touchUI.stickId = null;
      touch.active = false; touch.mx = 0; touch.my = 0;
    }
    for (const b of touchUI.btns) {
      if (touchUI.pressed[b.id] === t.identifier) {
        delete touchUI.pressed[b.id];
        // the brush casts on release, exactly like the keyboard
        if (b.id === 'atk' && player.vHeld) {
          player.vHeld = false;
          castSymbol(game.time - player.vDownAt);
        }
      }
    }
  }
}
cv.addEventListener('touchend', touchRelease);
cv.addEventListener('touchcancel', touchRelease);
function drawTouchUI() {
  if (!touch.enabled || game.state !== 'playing') return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.lineCap = 'round';
  // stick
  if (touch.active) {
    ctx.globalAlpha = .3;
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(touchUI.sx, touchUI.sy, 46, 0, TAU); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(touchUI.knx, touchUI.kny, 19, 0, TAU); ctx.fill();
  }
  // action buttons
  for (const b of touchUI.btns) {
    const down = touchUI.pressed[b.id] !== undefined;
    ctx.globalAlpha = down ? .55 : .3;
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(b.x(), b.y(), b.r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = `${Math.round(b.r * .8)}px Georgia,serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.kanji, b.x(), b.y() + 1);
  }
  // context tap where the E prompt would be
  if (nearInteractable()) {
    ctx.globalAlpha = .55;
    ctx.fillStyle = GOLD;
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(W / 2, H - 74, 30, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = '20px Georgia,serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('談', W / 2, H - 73);
  }
  ctx.globalAlpha = 1;
}


/* ---------- 掛軸 the hanging scrolls — procedural sumi-e for the menus ----
   No asset may enter the file, so the paintings are BRUSHED at boot on
   offscreen canvases (cosmetic dice only — never the sim stream) and hung
   as CSS backgrounds flanking the menu panels: silk-mounted landscapes of
   misted ridges, a pagoda, a waterfall, a calligraphy column and the red
   seal. A parchment-grain tile is baked into every scroll panel the same
   way. All of it wrapped in try/catch — a headless harness has no head. */
function brushLandscape() {
  const pw = 300, ph = 920;
  const c = document.createElement('canvas');
  c.width = pw; c.height = ph;
  const g = c.getContext('2d');
  const R = Math.random;
  // lacquered dowels top and bottom — the painting is itself a scroll
  const dowel = y => {
    const grd = g.createLinearGradient(0, y, 0, y + 14);
    grd.addColorStop(0, '#5a4632'); grd.addColorStop(.55, '#241c16');
    grd.addColorStop(1, '#3a2c20');
    g.fillStyle = grd;
    g.fillRect(6, y, pw - 12, 14);
    for (const kx of [2, pw - 16]) {           // end knobs, gold-pinned
      g.fillStyle = '#2c2016';
      g.beginPath(); g.arc(kx + 7, y + 7, 8, 0, TAU); g.fill();
      g.strokeStyle = '#a8843a'; g.lineWidth = 2;
      g.beginPath(); g.arc(kx + 7, y + 7, 8, 0, TAU); g.stroke();
    }
  };
  // the silk brocade mount — the muted green of the reference
  g.fillStyle = '#a9a583';
  g.fillRect(0, 8, pw, ph - 16);
  g.fillStyle = 'rgba(255,255,240,.05)';
  for (let y = 8; y < ph - 8; y += 4) g.fillRect(0, y, pw, 1);
  g.fillStyle = 'rgba(60,55,35,.12)';
  for (let x = 0; x < pw; x += 7) g.fillRect(x, 8, 1, ph - 16);
  // the paper field
  const fx0 = 24, fy0 = 54, fw = pw - 48, fh = ph - 108;
  g.fillStyle = '#efe7d2';
  g.fillRect(fx0, fy0, fw, fh);
  for (let i = 0; i < 500; i++) {              // paper mottle
    g.fillStyle = `rgba(120,100,70,${R() * .05})`;
    g.fillRect(fx0 + R() * fw, fy0 + R() * fh, 1 + R() * 3, 1 + R() * 3);
  }
  g.save();
  g.beginPath(); g.rect(fx0, fy0, fw, fh); g.clip();
  // six ridges, back to front — further is fainter, mist between
  const inkAt = a => `rgba(72,80,88,${a})`;
  let pagodaSpot = null, fallSpot = null;
  for (let r = 0; r < 6; r++) {
    const baseY = fy0 + fh * (.16 + .13 * r);
    const alpha = .12 + r * .1;
    // jagged crest polyline
    const pts = [];
    let x = fx0 - 20;
    while (x < fx0 + fw + 20) {
      pts.push([x, baseY - (18 + R() * (46 + r * 16)) * (R() < .25 ? 1.9 : 1)]);
      x += 16 + R() * 34;
    }
    g.fillStyle = inkAt(alpha);
    g.beginPath();
    g.moveTo(fx0 - 20, baseY + fh * .16);
    for (const [qx, qy] of pts) g.lineTo(qx, qy);
    g.lineTo(fx0 + fw + 20, baseY + fh * .16);
    g.closePath(); g.fill();
    // dry-brush texture dabs riding the crest
    g.strokeStyle = inkAt(Math.min(.5, alpha + .18));
    g.lineWidth = 1;
    for (const [qx, qy] of pts) {
      if (R() < .55) continue;
      g.beginPath();
      g.moveTo(qx, qy + 2);
      g.lineTo(qx - 4 - R() * 8, qy + 8 + R() * 14);
      g.stroke();
    }
    // trees along the nearer crests — ink blobs on short trunks
    if (r >= 3) {
      for (const [qx, qy] of pts) {
        if (R() < .6) continue;
        g.strokeStyle = 'rgba(40,44,40,.6)';
        g.beginPath(); g.moveTo(qx, qy); g.lineTo(qx + crand(-2, 2), qy - 7); g.stroke();
        g.fillStyle = r === 5 && R() < .3
          ? 'rgba(150,80,50,.55)'          // the reference's autumn embers
          : 'rgba(48,56,48,.55)';
        for (let b = 0; b < 3; b++) {
          g.beginPath();
          g.arc(qx + crand(-5, 5), qy - 8 + crand(-4, 2), 2.5 + R() * 3, 0, TAU);
          g.fill();
        }
      }
    }
    if (r === 2) pagodaSpot = [fx0 + fw * (.3 + R() * .3), baseY - 30];
    if (r === 4) fallSpot = [fx0 + fw * (.14 + R() * .2), baseY];
    // mist: a soft cream band swallowing each ridge's feet
    const mist = g.createLinearGradient(0, baseY + 6, 0, baseY + fh * .13);
    mist.addColorStop(0, 'rgba(239,231,210,0)');
    mist.addColorStop(.6, 'rgba(239,231,210,.8)');
    mist.addColorStop(1, 'rgba(239,231,210,0)');
    g.fillStyle = mist;
    g.fillRect(fx0, baseY + 6, fw, fh * .13);
  }
  // the pagoda — three sweeping roofs and a finial, pure silhouette
  if (pagodaSpot) {
    const [px, py] = pagodaSpot;
    g.fillStyle = 'rgba(38,42,46,.8)';
    for (let t = 0; t < 3; t++) {
      const w2 = 26 - t * 6, y2 = py - t * 11;
      g.beginPath();
      g.moveTo(px - w2, y2);
      g.quadraticCurveTo(px, y2 - 7, px + w2, y2);
      g.lineTo(px + w2 - 5, y2 - 5); g.lineTo(px - w2 + 5, y2 - 5);
      g.closePath(); g.fill();
      g.fillRect(px - w2 * .45, y2 - 11, w2 * .9, 7);
    }
    g.fillRect(px - 1.5, py - 40, 3, 8);
  }
  // the waterfall — paper shows through the near ridge in a falling thread
  if (fallSpot) {
    const [wx, wy] = fallSpot;
    g.strokeStyle = 'rgba(239,231,210,.85)';
    for (let s = 0; s < 4; s++) {
      g.lineWidth = 3 - s * .5;
      g.beginPath();
      g.moveTo(wx + s * 3 - 4, wy - 16);
      g.quadraticCurveTo(wx + s * 3 - 6 + crand(-2, 2), wy + 24, wx + s * 3 - 4, wy + 58);
      g.stroke();
    }
    g.fillStyle = 'rgba(239,231,210,.5)';
    for (let i = 0; i < 8; i++) {
      g.beginPath();
      g.arc(wx + crand(-8, 8), wy + 58 + crand(0, 8), 1.5 + R() * 2, 0, TAU);
      g.fill();
    }
  }
  // the calligraphy column and the artist's red seal, top-right
  const GLYPHS = '山水雲霧月風松嵐帰道墨心静遠夢';
  g.fillStyle = 'rgba(43,35,32,.55)';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let col = 0; col < 2; col++) {
    const gx = fx0 + fw - 22 - col * 20;
    const n = col ? 5 + Math.floor(R() * 3) : 9 + Math.floor(R() * 4);
    g.font = `${col ? 11 : 13}px Georgia,serif`;
    for (let i = 0; i < n; i++)
      g.fillText(GLYPHS[Math.floor(R() * GLYPHS.length)],
                 gx + crand(-1, 1), fy0 + 22 + i * (col ? 14 : 17));
  }
  g.fillStyle = 'rgba(160,42,30,.8)';
  g.fillRect(fx0 + fw - 30, fy0 + 190, 13, 13);
  g.fillStyle = 'rgba(239,231,210,.5)';
  g.fillRect(fx0 + fw - 27, fy0 + 193, 3, 3);
  g.fillRect(fx0 + fw - 23, fy0 + 196, 3, 4);
  g.restore();
  // aged edge on the paper, then the dowels over everything
  g.strokeStyle = 'rgba(93,74,50,.3)'; g.lineWidth = 2;
  g.strokeRect(fx0, fy0, fw, fh);
  dowel(0); dowel(ph - 14);
  return c;
}
function brushParchmentTile() {
  const s = 220;
  const c = document.createElement('canvas');
  c.width = s; c.height = s;
  const g = c.getContext('2d');
  const R = Math.random;
  for (let i = 0; i < 26; i++) {               // soft age blotches
    g.fillStyle = `rgba(139,109,66,${.02 + R() * .03})`;
    g.beginPath(); g.arc(R() * s, R() * s, 8 + R() * 34, 0, TAU); g.fill();
  }
  g.lineWidth = 1;
  for (let i = 0; i < 90; i++) {               // paper fibers
    g.strokeStyle = `rgba(120,95,60,${.03 + R() * .05})`;
    const x = R() * s, y = R() * s, a = R() * TAU, l = 3 + R() * 9;
    g.beginPath(); g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  for (let i = 0; i < 5; i++) {                // creases and old cracks
    g.strokeStyle = `rgba(93,74,50,${.06 + R() * .06})`;
    let x = R() * s, y = R() * s;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += crand(-26, 26); y += crand(-26, 26);
      g.lineTo(x, y);
    }
    g.stroke();
  }
  return c;
}
(function hangMenuScrolls() {
  try {
    const left = brushLandscape().toDataURL('image/png');
    const right = brushLandscape().toDataURL('image/png');   // a second, different painting
    const tile = brushParchmentTile().toDataURL('image/png');
    const st = document.createElement('style');
    st.textContent =
      `#titleOverlay,#recordsOverlay,#settingsOverlay,#rebirthOverlay{` +
      `background-image:url(${left}),url(${right});` +
      `background-repeat:no-repeat,no-repeat;` +
      `background-position:left 14px center,right 14px center;` +
      `background-size:auto 86%,auto 86%;}` +
      `.panel{background-image:url(${tile});}`;
    document.head.appendChild(st);
  } catch (e) { /* headless harness: no head to hang a scroll on */ }
})();
