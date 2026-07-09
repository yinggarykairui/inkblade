/* ---------- shrine blessings: run-scoped roguelite picks ---------- */
const BLESSINGS = [
  { id: 'mend',   kanji: '癒', name: 'Mending Step',    desc: 'perfect dodges restore 6 health' },
  { id: 'wind',   kanji: '風', name: 'Wind Feet',       desc: '+18% move speed' },
  { id: 'magnet', kanji: '引', name: 'Golden Pull',     desc: 'honor orbs magnet from twice as far' },
  { id: 'reap',   kanji: '刈', name: 'Reaper’s Rhythm', desc: 'every kill restores 12 stamina' },
  { id: 'thorn',  kanji: '棘', name: 'Thorned Guard',   desc: 'parried foes take 12 damage' },
  { id: 'iron',   kanji: '膚', name: 'Iron Skin',       desc: '+30 max health, immediately' },
  { id: 'focus',  kanji: '心', name: 'Still Heart',     desc: 'riposte windows last twice as long' },
  { id: 'tempo',  kanji: '律', name: 'Even Breath',     desc: '+25% stamina regen' },
  { id: 'edge',   kanji: '鋭', name: 'Whetted Edge',    desc: '+10% damage' },
];
let shrine = null;   // {x, y, t, picks, cursed} — cleared once a blessing is taken
function spawnShrine(x, y) {
  // the offerings are rolled ONCE, here at spawn (sim-side, seeded stream):
  // walking away and returning can never re-roll them, and both lockstep
  // sims carve the same three cards.
  // Every THIRD shrine of a run drives a bargain: each blessing arrives
  // fused to a curse — a heavier burden, chosen mid-run with open eyes,
  // and richer honor from the next wave on (waveMults reads curses live).
  game.shrineN = (game.shrineN || 0) + 1;
  // blessings deepen: a taken blessing returns to the pool until tier III
  const pool = BLESSINGS.filter(b => blessCount(b.id) < 3);
  const cursePool = game.shrineN % 3 === 0
    ? CURSES.filter(c => !game.curses.includes(c.id)) : [];
  const picks = [];
  while (picks.length < 3 && pool.length) {
    const bless = pool.splice(Math.floor(srandom() * pool.length), 1)[0];
    const curse = cursePool.length
      ? cursePool.splice(Math.floor(srandom() * cursePool.length), 1)[0] : null;
    picks.push({ bless, curse });
  }
  const s = clearSpot(clamp(x, ARENA.x + 50, ARENA.x + ARENA.w - 50),
                      clamp(y, ARENA.y + 60, ARENA.y + ARENA.h - 60));
  shrine = { x: s.x, y: s.y, t: 0, picks,
             cursed: !!(picks[0] && picks[0].curse) };
}
function openShrine() {
  game.state = 'shrine';
  const row = document.getElementById('blessRow');
  row.innerHTML = '';
  const picks = (shrine && shrine.picks) || [];
  for (const p of picks) {
    const b = p.bless;
    const btn = document.createElement('button');
    btn.className = 'blessCard';
    const tier = blessCount(b.id);   // 0 = fresh; 1–2 = a deepening
    const tierTag = tier > 0
      ? ` <span style="color:var(--gold)">— deepens to ${tier >= 2 ? 'III' : 'II'}</span>` : '';
    btn.innerHTML = `<span class="bk">${b.kanji}</span>${b.name}${tierTag}<span class="bd">${b.desc}</span>` +
      (p.curse ? `<span class="bd" style="color:var(--red)">呪 fused to ${p.curse.name} — ${p.curse.desc}</span>` : '');
    // online co-op: the shrine answers the host's hand alone — the guest's
    // sim applies the same pick when it crosses the wire
    btn.onclick = () => { if (netCoop() && net.started && !net.host) return; pickBlessing(b.id); };
    row.appendChild(btn);
  }
  showOverlay('shrine');
  if (netCoop() && net.started && !net.host && net.blessQ) {
    const q = net.blessQ;              // the host chose before our sim arrived
    net.blessQ = null;
    if (q.close) closeShrine(); else pickBlessing(q.id);
  }
}
function pickBlessing(id) {
  if (netCoop() && net.started && net.host) {
    try { net.conn.send({ t: 'bless', id }); } catch (e) {}
  }
  game.blessings.push(id);
  award('blessed');
  // blessings are run-scoped and bless the whole party, P2 included
  if (id === 'iron') for (const P of allPlayers()) { P.maxHp += 30; P.hp += 30; }
  const b = BLESSINGS.find(x => x.id === id);
  const tier = blessCount(id);   // counted AFTER the push: 1 = fresh, 2–3 = deepened
  const tierName = tier >= 3 ? ' III' : tier === 2 ? ' II' : '';
  // a bargain card carries its curse — both sims resolve it from their own
  // (identical, seed-rolled) picks, so the wire never needs to name it
  const pick = shrine && shrine.picks && shrine.picks.find(p => p.bless.id === id);
  const c = pick && pick.curse;
  if (c) {
    game.curses.push(c.id);
    if (c.id === 'frail') for (const P of allPlayers()) {   // The Glass bites at once
      P.maxHp = Math.max(10, Math.round(P.maxHp * .5));
      P.hp = Math.min(P.hp, P.maxHp);
    }
    setBanner(`祈 ${b.name}${tierName} · 呪 ${c.name} — the bargain is struck`, 2.6);
  } else setBanner(`祈 ${b.name}${tierName}${tier > 1 ? ' — the blessing deepens' : ''}`, 2);
  if (shrine) {
    puff(shrine.x, shrine.y, 'rgba(168,132,58,.6)', 14);
    particles.push({ kind: 'ring', x: shrine.x, y: shrine.y, t: 0, life: .6,
      color: 'rgba(168,132,58,.6)', r0: 14, r1: 110, w: 2.5 });
    shrine = null;
  }
  playSfx('bless');
  game.state = 'playing';
  showOverlay('none');
}
function closeShrine() {   // walk on — the shrine keeps waiting
  if (netCoop() && net.started && net.host) {
    try { net.conn.send({ t: 'blessClose' }); } catch (e) {}
  }
  game.state = 'playing';
  showOverlay('none');
}

/* ---------- arena hazards, portal, merchant ---------- */
let stalks = [], fireZones = [];
let portal = null, merchant = null, transition = null;

function setupHazards(ti) {
  stalks = []; fireZones = [];
  if (ti === 1) {
    // two knockable bamboo lanes splitting the grove into thirds
    for (const fx of [.33, .66]) {
      const lx = ARENA.x + ARENA.w * fx;
      for (let y = ARENA.y + 40; y < ARENA.y + ARENA.h - 30; y += 58) {
        if (srandom() < .8)
          stalks.push({ x: lx + rand(-8, 8), y: y + rand(-10, 10),
                        r: 9, hp: 2, dead: false, hitBy: 0 });
      }
    }
  } else if (ti === 3) {
    for (let i = 0; i < 3; i++) {
      fireZones.push({
        x: ARENA.x + ARENA.w * (.25 + .25 * i) + rand(-40, 40),
        y: ARENA.y + ARENA.h * rand(.3, .7),
        r: rand(52, 74), phase: rand(0, TAU) });
    }
  }
}
function collideStalks() {
  for (const st of stalks) {
    if (st.dead) continue;
    const bodies = [];
    if (game.mode === 'duel' && duel) bodies.push(duel.p1, duel.p2);
    else {
      bodies.push(player);
      for (const e of enemies) if (!e.dead) bodies.push(e);
    }
    for (const b of bodies) {
      const dx = b.x - st.x, dy = b.y - st.y;
      const d = Math.hypot(dx, dy), min = b.r + st.r;
      if (d > 0 && d < min) {
        if (b.r > 20) {                     // the big ones crash straight through
          st.dead = true;
          puff(st.x, st.y, 'rgba(96,94,82,.7)', 8);
          break;
        }
        b.x += dx / d * (min - d); b.y += dy / d * (min - d);
      }
    }
  }
}
function updateHazards(dt) {
  for (const f of fireZones) {
    f.phase += dt;
    for (const P of alivePlayers()) {   // the flame bites every blade
      if (P.iT <= 0 && !P.dodgeInv &&
          dist(P.x, P.y, f.x, f.y) < f.r - 4) {
        const ang = Math.atan2(P.y - f.y, P.x - f.x);
        if (damageSamurai(P, Math.max(4, Math.round(6 * game.curDmgMul)), ang, false,
                          'the burning ground')) {
          addText(P.x, P.y - 40, 'burned!', PAL.pigment.cinnabar, 13);
          fx('burn', { x: P.x, y: P.y });
        }
      }
    }
  }
}
function updateAmbient(dt) {
  // pure atmosphere — every die here is the COSMETIC one: these blocks
  // fire behind local Math.random gates, and a gated pull on the sim
  // stream would silently desync an online co-op lockstep
  const ti = themeIndex;
  if (ti === 0 && Math.random() < dt * 2.2) {          // drifting sakura
    particles.push({ kind: 'petal', x: crand(ARENA.x, ARENA.x + ARENA.w), y: ARENA.y - 10,
      vx: crand(8, 30), vy: crand(14, 30), t: 0, life: crand(1.6, 2.6),
      tint: 'faint', owner: null, rad: crand(1.5, 2.6), spin: crand(0, TAU) });
  }
  if (ti === 3 && fireZones.length && Math.random() < dt * 10) {   // rising embers
    const f = fireZones[Math.floor(crand(0, fireZones.length))];
    particles.push({ kind: 'dot', x: f.x + crand(-f.r, f.r), y: f.y + crand(-f.r * .6, f.r * .6),
      vx: crand(-12, 12), vy: crand(-70, -30), t: 0, life: crand(.6, 1.3),
      color: Math.random() < .6 ? 'rgba(74,64,56,.6)' : 'rgba(50,44,38,.55)',
      rad: crand(1.5, 3) });
  }
  if (ti === 4 && Math.random() < dt * .22) {          // shrine lightning
    game.flashT = .3;
    const fx = crand(ARENA.x, ARENA.x + ARENA.w);
    // ambient lightning strikes in ink — the sky keeps no pigment either
    boltFX(fx + crand(-60, 60), -10, fx, crand(ARENA.y, ARENA.y + 120),
           'rgba(96,88,82,.85)', 'rgba(240,238,232,.95)');
    playSfx('bolt');
  }
}
function spawnPortal(x, y, kind) {
  const s = clearSpot(clamp(x, ARENA.x + 50, ARENA.x + ARENA.w - 50),
                      clamp(y, ARENA.y + 60, ARENA.y + ARENA.h - 60));
  portal = { x: s.x, y: s.y,
             kind, t: 0, armed: true,
             accent: (kind === 'merchant' || kind === 'home')
               ? GOLD : THEMES[Math.min(game.level, 4)].accent };
}
/* ---------- loot chests — the only road to the deep blades ----------
   The ROLL is seeded per save (mulberry32 over hash(save.seed,
   chestsOpened)): the Nth chest of a save always holds the same thing,
   so scroll export/import cannot re-roll a legendary. Spawn-chance dice
   ride the SIM stream (srandom) — online co-op's lockstep sims must
   agree on every chest that falls.
   EVERY MODE pays in lacquer now (2026-07-08c):
     story     — first clear of a level: guaranteed (lord-biased);
                 repeat clears: 25%
     campaign  — lords always; stages 18% + 1.5%/stage
     infinite  — each 5th-wave lord 40%; every 25th wave guaranteed;
                 tier bias deepens with the wave
     rush      — gauntlet lords 30% (stages 1–4); chaos every 5th stage
                 guaranteed, else 15%, bias climbing by lap              */
let chests = [];
let chestCard = null;   // the reveal reel — drawn by the HUD while it spins
// the carousel: ~12 tiles scroll past, ease-out cubic, land dead-center
const REEL = { spin: 2.3, hold: 2.5, land: 16, len: 20, step: 72 };
function reelCenterAt(t) {
  const p = clamp(t / REEL.spin, 0, 1);
  return (REEL.land - 12.4) + 12.4 * (1 - Math.pow(1 - p, 3));
}
/* keep the wayside fixtures from stacking: find a stand clear of the
   portal, the stall, the shrine and every unopened chest. A direct
   push-apart FAILS on narrow arenas (the bridge is a 230px band — the
   vertical push and the clamp fight to a stalemate), so after one push
   we walk a deterministic ring of candidates outward along BOTH axes
   and take the first clear one. No dice at all — lockstep-safe.       */
function clearSpot(x, y) {
  const MIN = 115;
  const others = [];
  if (portal) others.push([portal.x, portal.y]);
  if (merchant) others.push([merchant.x, merchant.y]);
  if (shrine) others.push([shrine.x, shrine.y]);
  for (const c of chests) if (!c.opened) others.push([c.x, c.y]);
  const cx = v => clamp(v, ARENA.x + 60, ARENA.x + ARENA.w - 60);
  const cy = v => clamp(v, ARENA.y + 70, ARENA.y + ARENA.h - 70);
  const ok = (px, py) => others.every(([ox, oy]) => dist(px, py, ox, oy) >= MIN);
  x = cx(x); y = cy(y);
  if (ok(x, y)) return { x, y };
  // one direct push off the nearest offender (works in open arenas)
  let nx = null, nd = Infinity;
  for (const o of others) {
    const d = dist(x, y, o[0], o[1]);
    if (d < nd) { nd = d; nx = o; }
  }
  if (nx && nd > 1) {
    const a = Math.atan2(y - nx[1], x - nx[0]);
    const px = cx(nx[0] + Math.cos(a) * MIN), py = cy(nx[1] + Math.sin(a) * MIN);
    if (ok(px, py)) return { x: px, y: py };
  }
  // the ring walk: outward candidates on both axes and the diagonals
  for (let ring = 1; ring <= 8; ring++) {
    const r = ring * MIN * .8;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1],
                            [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const px = cx(x + dx * r), py = cy(y + dy * r);
      if (ok(px, py)) return { x: px, y: py };
    }
  }
  return { x, y };   // crowded beyond saving — nearest-first E still digs it out
}
function rollChest(p, bias) {
  const s = clearSpot(
    clamp(p.x + rand(-70, 70), ARENA.x + 50, ARENA.x + ARENA.w - 50),
    clamp(p.y + rand(-50, 50), ARENA.y + 60, ARENA.y + ARENA.h - 60));
  chests.push({ x: s.x, y: s.y, t: 0, bias: bias || 0, opened: false });
  setBanner('a lacquer chest remains', 1.6);
  playSfx('thunk');
}
function openChest(c) {
  c.opened = true;
  const rng = mulberry32(hash2(save.seed, ++save.chestsOpened));
  // the tier table listens to the mode: campaign/story climb by map/level,
  // the endless modes speak entirely through the roll's bias argument
  const base = game.mode === 'campaign' ? (game.map >= 4 ? 2 : game.map >= 2 ? 1 : 0)
             : game.mode === 'level' ? (game.level >= 5 ? 2 : game.level >= 3 ? 1 : 0)
             : 0;
  const table = DROP_TABLES[Math.min(2, base + c.bias)];
  const r = rng();
  let tier = r < table.legendary ? 'legendary'
           : r < table.legendary + table.pure ? 'pure' : 'worn';
  // a merchant key vouches for at least a Pure pull — and is spent only
  // when it actually has to vouch; a natural Pure+ roll leaves it on the belt
  let keyed = false;
  if (save.chestKey && tier === 'worn') {
    tier = 'pure';
    save.chestKey = false;
    keyed = true;
  }
  const pool = CHEST_POOL[tier];
  const id = pool[Math.floor(rng() * pool.length) % pool.length];
  const item = WEAPONS[id] || BOWS[id];
  const isBow = !!BOWS[id];
  const ownedList = isBow ? save.bowsOwned : save.owned;
  // the burst stays NEUTRAL — no kanji, no tier color: the carousel keeps
  // the secret until the reel stops turning
  inkSplat(c.x, c.y);
  particles.push({ kind: 'glyph', ch: '宝', color: 'rgba(168,132,58,.9)',
    x: c.x, y: c.y - 20, vx: 0, vy: -24, t: 0, life: .9, size: 40, misted: false });
  particles.push({ kind: 'ring', x: c.x, y: c.y, t: 0, life: .5,
    color: 'rgba(168,132,58,.6)', r0: 10, r1: 120, w: 3 });
  // 昇 the ascension stone — the road of rebirth's toll, found ONLY here.
  // A third draw on the same seeded stream (the first two picked the arm,
  // so old saves' pending pulls are untouched); richer tables gleam more.
  const stone = rng() < .04 + .04 * Math.min(2, base + c.bias);
  if (stone) save.ascStones = (save.ascStones || 0) + 1;
  const isNew = !ownedList.includes(id);
  let bannerText, landSfx;
  if (isNew) {
    ownedList.push(id);
    bannerText = `${RARITY[tier].kanji} ${RARITY[tier].name} — ${item.kanji} ${item.name} joins the arsenal`;
    landSfx = tier === 'worn' ? 'buy' : 'achieve';
    if (tier === 'legendary') award('legend');
    if (WEAPON_ORDER.every(wid => save.owned.includes(wid))) award('allSwords');
  } else {
    // duplicates melt into shards of temper — no drop is ever dead
    const shards = Math.round(xpForLevel(wxpLvl(id)) * .6);
    grantWeaponXP(id, shards);
    bannerText = `${item.kanji} ${item.name} again — the duplicate melts into temper`;
    landSfx = 'buy';
  }
  if (stone) {
    bannerText += ' · 昇 AN ASCENSION STONE GLEAMS BENEATH';
    landSfx = 'achieve';
  }
  // the reveal reel: filler tiles from the whole arsenal (cosmetic die —
  // each client may see different filler; only the landing tile is law)
  const ids = WEAPON_ORDER.concat(BOW_ORDER);
  const reel = [];
  for (let i = 0; i < REEL.len; i++)
    reel.push(i === REEL.land ? id : ids[Math.floor(crand(0, ids.length))]);
  // the reel wears its odds openly — the exact table this roll was drawn from
  chestCard = { t: 0, item, tier, isNew, isBow, reel, lastIdx: -1,
                bannerText, landSfx, odds: table, keyed, stone };
  playSfx('thunk');
  shake(3);
  persistSave();
}
function updateChests(dt) {
  for (const c of chests) c.t += dt;
  chests = chests.filter(c => !c.opened);
  if (chestCard) {
    const cc = chestCard;
    const was = cc.t;
    cc.t += dt;
    if (cc.t < REEL.spin) {   // the reel clicks past the marker, tile by tile
      const idx = Math.round(reelCenterAt(cc.t));
      if (idx !== cc.lastIdx) { cc.lastIdx = idx; playSfx('tick'); }
    }
    if (was < REEL.spin && cc.t >= REEL.spin) {   // the reel lands
      setBanner(cc.bannerText, 2.2);
      playSfx(cc.landSfx);
      freeze(.07);
      shake(cc.tier === 'legendary' ? 6 : 3);
    }
    if (cc.t > REEL.spin + REEL.hold) chestCard = null;
  }
}

function updatePortal(dt) {
  if (!portal) return;
  portal.t += dt;
  // ambient inward pull — motes fall into the rift
  if (Math.random() < dt * 30) {
    const a = crand(0, TAU), d = crand(45, 95);
    particles.push({ kind: 'line',
      x: portal.x + Math.cos(a) * d, y: portal.y + Math.sin(a) * d,
      vx: -Math.cos(a) * 95, vy: -Math.sin(a) * 95,
      t: 0, life: .4, color: portal.accent, w: 1.5 });
  }
  const d = dist(player.x, player.y, portal.x, portal.y);
  if (portal.armed === false) { if (d > 80) portal.armed = true; return; }
  if (d < 30 && !transition) {
    if (portal.kind === 'next') {
      portal = null;
      if (game.mode === 'campaign') {
        startTransition(() => { game.cStage++; startCampaignStage(false); });
      } else {
        const target = game.level + 1;
        startTransition(() => loadLevel(target));
      }
    } else if (portal.kind === 'home') {
      // the road home — victory earned, honor banked, back to the dojo gate
      portal = null;
      playSfx('portal');
      returnToMenu();
    } else openShop();
  }
}
function startTransition(cb) {
  transition = { t: 0, dur: 1.1, cb, fired: false };
  playSfx('portal');
}
function updateTransition(dt) {
  if (!transition) return;
  transition.t += dt;
  if (!transition.fired && transition.t >= transition.dur / 2) {
    transition.fired = true; transition.cb();
  }
  if (transition.t >= transition.dur) transition = null;
}
function tryInteract() {
  if (game.state !== 'playing') return;
  // the NEAREST thing in reach answers E — fixtures standing close
  // together can no longer shadow one another (stall over chest, etc.)
  const opts = [];
  const add = (x, y, r, go) => {
    const d = dist(player.x, player.y, x, y);
    if (d < r) opts.push({ d, go });
  };
  if (merchant) add(merchant.x, merchant.y, 85, openShop);
  if (shrine) add(shrine.x, shrine.y, 80, openShrine);
  for (const c of chests)
    if (!c.opened) add(c.x, c.y, 70, () => openChest(c));
  if (game.mode === 'tomb' && game.tomb && game.tomb.phase === 'choose') {
    if (tombAltar) add(tombAltar.x, tombAltar.y, 85, openRebirth);
    for (const tb of tombTablets)
      add(tb.x, tb.y, 80, () => startTombTrial(tb.track));
  }
  if (game.mode === 'training' && kyudoStand)
    add(kyudoStand.x, kyudoStand.y, 80, startKyudoRite);
  if (!opts.length) return;
  opts.sort((a, b) => a.d - b.d);
  opts[0].go();
}

// gentle body separation so enemies never stack into one blob
function separateEnemies() {
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i];
    if (a.dead) continue;
    for (let j = i + 1; j < enemies.length; j++) {
      const b = enemies[j];
      if (b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy), min = a.r + b.r + 4;
      if (d > 0 && d < min) {
        const push = (min - d) / 2, nx = dx / d, ny = dy / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
      }
    }
  }
}

