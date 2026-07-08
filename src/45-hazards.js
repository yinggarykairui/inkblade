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
let shrine = null;   // {x, y, t} — cleared once a blessing is taken
function spawnShrine(x, y) {
  shrine = {
    x: clamp(x, ARENA.x + 50, ARENA.x + ARENA.w - 50),
    y: clamp(y, ARENA.y + 60, ARENA.y + ARENA.h - 60),
    t: 0,
  };
}
function openShrine() {
  game.state = 'shrine';
  const row = document.getElementById('blessRow');
  row.innerHTML = '';
  const pool = BLESSINGS.filter(b => !game.blessings.includes(b.id));
  const picks = [];
  while (picks.length < 3 && pool.length)
    picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  for (const b of picks) {
    const btn = document.createElement('button');
    btn.className = 'blessCard';
    btn.innerHTML = `<span class="bk">${b.kanji}</span>${b.name}<span class="bd">${b.desc}</span>`;
    btn.onclick = () => pickBlessing(b.id);
    row.appendChild(btn);
  }
  showOverlay('shrine');
}
function pickBlessing(id) {
  game.blessings.push(id);
  award('blessed');
  if (id === 'iron') { player.maxHp += 30; player.hp += 30; }
  const b = BLESSINGS.find(x => x.id === id);
  setBanner('祈 ' + b.name, 2);
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
        if (Math.random() < .8)
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
    if (player.iT <= 0 && !player.dodgeInv &&
        dist(player.x, player.y, f.x, f.y) < f.r - 4) {
      const ang = Math.atan2(player.y - f.y, player.x - f.x);
      if (damagePlayer(Math.max(4, Math.round(6 * game.curDmgMul)), ang, false)) {
        addText(player.x, player.y - 40, 'burned!', PAL.pigment.cinnabar, 13);
        fx('burn', { x: player.x, y: player.y });
      }
    }
  }
}
function updateAmbient(dt) {
  const ti = themeIndex;
  if (ti === 0 && Math.random() < dt * 2.2) {          // drifting sakura
    particles.push({ kind: 'petal', x: rand(ARENA.x, ARENA.x + ARENA.w), y: ARENA.y - 10,
      vx: rand(8, 30), vy: rand(14, 30), t: 0, life: rand(1.6, 2.6),
      tint: 'faint', owner: null, rad: rand(1.5, 2.6), spin: rand(0, TAU) });
  }
  if (ti === 3 && fireZones.length && Math.random() < dt * 10) {   // rising embers
    const f = fireZones[Math.floor(rand(0, fireZones.length))];
    particles.push({ kind: 'dot', x: f.x + rand(-f.r, f.r), y: f.y + rand(-f.r * .6, f.r * .6),
      vx: rand(-12, 12), vy: rand(-70, -30), t: 0, life: rand(.6, 1.3),
      color: Math.random() < .6 ? 'rgba(74,64,56,.6)' : 'rgba(50,44,38,.55)',
      rad: rand(1.5, 3) });
  }
  if (ti === 4 && Math.random() < dt * .22) {          // shrine lightning
    game.flashT = .3;
    const fx = rand(ARENA.x, ARENA.x + ARENA.w);
    // ambient lightning strikes in ink — the sky keeps no pigment either
    boltFX(fx + rand(-60, 60), -10, fx, rand(ARENA.y, ARENA.y + 120),
           'rgba(96,88,82,.85)', 'rgba(240,238,232,.95)');
    playSfx('bolt');
  }
}
function spawnPortal(x, y, kind) {
  portal = { x: clamp(x, ARENA.x + 50, ARENA.x + ARENA.w - 50),
             y: clamp(y, ARENA.y + 60, ARENA.y + ARENA.h - 60),
             kind, t: 0, armed: true,
             accent: kind === 'merchant' ? GOLD : THEMES[Math.min(game.level, 4)].accent };
}
/* ---------- loot chests — the only road to the deep blades ----------
   The ROLL is seeded per save (mulberry32 over hash(save.seed,
   chestsOpened)): the Nth chest of a save always holds the same thing,
   so scroll export/import cannot re-roll a legendary. Spawn chance is
   plain Math.random — PvE only, so lockstep never sees any of this.   */
let chests = [];
let chestCard = null;   // the reveal card — drawn by the HUD for a breath
function rollChest(p, bias) {
  chests.push({
    x: clamp(p.x + rand(-70, 70), ARENA.x + 50, ARENA.x + ARENA.w - 50),
    y: clamp(p.y + rand(-50, 50), ARENA.y + 60, ARENA.y + ARENA.h - 60),
    t: 0, bias: bias || 0, opened: false,
  });
  setBanner('a lacquer chest remains', 1.6);
  playSfx('thunk');
}
function openChest(c) {
  c.opened = true;
  const rng = mulberry32(hash2(save.seed, ++save.chestsOpened));
  const table = DROP_TABLES[Math.min(2,
    (game.map >= 4 ? 2 : game.map >= 2 ? 1 : 0) + c.bias)];
  const r = rng();
  let tier = r < table.legendary ? 'legendary'
           : r < table.legendary + table.pure ? 'pure' : 'worn';
  if (save.chestKey) {   // a merchant key vouches for at least a Pure pull
    if (tier === 'worn') tier = 'pure';
    save.chestKey = false;
  }
  const pool = CHEST_POOL[tier];
  const id = pool[Math.floor(rng() * pool.length) % pool.length];
  const item = WEAPONS[id] || BOWS[id];
  const isBow = !!BOWS[id];
  const ownedList = isBow ? save.bowsOwned : save.owned;
  inkSplat(c.x, c.y);
  particles.push({ kind: 'glyph', ch: item.kanji,
    color: tier === 'legendary' ? GOLD : INK,
    x: c.x, y: c.y - 20, vx: 0, vy: -24, t: 0, life: 1.2, size: 44, misted: false });
  particles.push({ kind: 'ring', x: c.x, y: c.y, t: 0, life: .5,
    color: tier === 'legendary' ? 'rgba(245,194,66,.8)' : 'rgba(168,132,58,.6)',
    r0: 10, r1: 120, w: 3 });
  const isNew = !ownedList.includes(id);
  if (isNew) {
    ownedList.push(id);
    setBanner(`${RARITY[tier].kanji} ${RARITY[tier].name} — ${item.kanji} ${item.name} joins the arsenal`, 3);
    if (tier === 'legendary') award('legend');
    if (WEAPON_ORDER.every(wid => save.owned.includes(wid))) award('allSwords');
  } else {
    // duplicates melt into shards of temper — no drop is ever dead
    const shards = Math.round(xpForLevel(wxpLvl(id)) * .6);
    grantWeaponXP(id, shards);
    setBanner(`${item.kanji} ${item.name} again — the duplicate melts into temper`, 2.4);
  }
  chestCard = { t: 0, item, tier, isNew, isBow };
  playSfx(tier === 'worn' ? 'buy' : 'achieve');
  freeze(.08); shake(5);
  persistSave();
}
function updateChests(dt) {
  for (const c of chests) c.t += dt;
  chests = chests.filter(c => !c.opened);
  if (chestCard) {
    chestCard.t += dt;
    if (chestCard.t > 2.8) chestCard = null;
  }
}

function updatePortal(dt) {
  if (!portal) return;
  portal.t += dt;
  // ambient inward pull — motes fall into the rift
  if (Math.random() < dt * 30) {
    const a = rand(0, TAU), d = rand(45, 95);
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
  if (merchant && dist(player.x, player.y, merchant.x, merchant.y) < 85) { openShop(); return; }
  if (shrine && dist(player.x, player.y, shrine.x, shrine.y) < 80) { openShrine(); return; }
  for (const c of chests)
    if (!c.opened && dist(player.x, player.y, c.x, c.y) < 70) { openChest(c); return; }
  if (game.mode === 'tomb' && game.tomb && game.tomb.phase === 'choose')
    for (const tb of tombTablets)
      if (dist(player.x, player.y, tb.x, tb.y) < 80) { startTombTrial(tb.track); return; }
  if (game.mode === 'training' && kyudoStand &&
      dist(player.x, player.y, kyudoStand.x, kyudoStand.y) < 80) { startKyudoRite(); return; }
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

