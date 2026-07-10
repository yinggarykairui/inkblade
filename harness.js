#!/usr/bin/env node
/* INKBLADE smoke harness — the verification ritual from src/MANIFEST.md.
   Stubs document/localStorage/canvas, evals the BUILT index.html script,
   drives the sim directly, and asserts the balance/exploit invariants.
   Usage: node build.js && node harness.js                                */
'use strict';
const fs = require('fs'), vm = require('vm');

/* ---------- stubs ---------- */
function makeCtx() {
  return new Proxy({ canvas: { width: 64, height: 22 } }, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient')
        return () => ({ addColorStop() {} });
      return () => undefined;               // every method: a quiet no-op
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
function makeEl(id) {
  const el = {
    id, style: {}, dataset: {}, children: [],
    classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
    innerHTML: '', textContent: '', value: '', title: '',
    width: 300, height: 150, disabled: false, checked: false,
    appendChild(c) { el.children.push(c); return c; },
    insertBefore(c) { el.children.unshift(c); return c; },
    addEventListener() {}, removeEventListener() {},
    getContext: () => makeCtx(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1024, height: 640 }),
    select() {}, focus() {}, blur() {}, scrollBy() {},
    onclick: null, oninput: null, onchange: null,
  };
  Object.defineProperty(el, 'previousElementSibling',
    { get: () => makeEl(id + ':prev') });
  Object.defineProperty(el, 'parentElement', { get: () => null });
  return el;
}
const els = new Map();
const documentStub = {
  getElementById(id) { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); },
  createElement: tag => makeEl(tag + ':' + els.size),
  addEventListener() {}, removeEventListener() {},
  body: makeEl('body'), documentElement: makeEl('html'),
  activeElement: null, hidden: false,
  // querySelectorAll intentionally ABSENT — 10-dom feature-guards on it
};
const storage = new Map();
const sandbox = {
  document: documentStub, console,
  localStorage: {
    getItem: k => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: k => storage.delete(k),
  },
  addEventListener() {}, removeEventListener() {},
  requestAnimationFrame: () => 0,
  setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
  performance: { now: () => Date.now() },
  navigator: {}, innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
  btoa: s => Buffer.from(s, 'binary').toString('base64'),
  atob: s => Buffer.from(s, 'base64').toString('binary'),
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);

/* ---------- load the built game ---------- */
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const code = blocks.sort((a, b) => b.length - a.length)[0];
if (!code || code.length < 100000) throw new Error('game script not found in index.html');

// capture LIVE bindings (top-level let/const are lexical, invisible on the
// sandbox) via a getter object appended in the same scope
const EXPORT_NAMES = ['game', 'save', 'keys', 'player', 'enemies', 'shrine',
  'pArrows', 'CURSES', 'BLESSINGS', 'WEAPONS', 'BOWS', 'DROP_TABLES',
  'chests', 'chestCard', 'REEL', 'ARENA'];
const FN_NAMES = ['tombCost', 'tombAtk', 'spawnShrine', 'openShrine', 'updateTomb',
  'damagePlayer', 'startAttackFor', 'startAttack', 'activateUlt', 'updatePlayer',
  'makeP2', 'onBossDeath', 'playerLooseArrow', 'wxpOf', 'rebirthLevel',
  'mulberry32', 'hash2', 'openChest', 'resetPlayer', 'Grunt', 'ultReady',
  'persistSave', 'rand', 'onWaveCleared', 'updateChests', 'rollChest',
  'startRun', 'ascensionMults', 'hintOnce', 'renderMenu',
  'tryInteract', 'clearSpot',
  'playerLvl', 'playerLvlMult', 'grantPlayerXP', 'xpForPlayerLvl', 'buyArm',
  'applySaveData', 'armoryGuidance', 'gameOver', 'openShop', 'closeShop',
  'applyShopOp', 'homeDuelArrow', 'homePArrow', 'packAim', 'unpackAim',
  'grantWeaponXP'];
const shim = '\n;globalThis.__X = {'
  + EXPORT_NAMES.map(n => `get ${n}() { return ${n}; }`).join(',')
  + ',' + FN_NAMES.map(n => `${n}: ${n}`).join(',')
  + ',get p2() { return p2; }, set p2(v) { p2 = v; }'
  + ',set enemiesSet(v) { enemies = v; }'
  + ',get merchant() { return merchant; }, set merchant(v) { merchant = v; }'
  + ',get portal() { return portal; }, set portal(v) { portal = v; }'
  + '};';
vm.runInContext(code + shim, ctx, { filename: 'index.html<script>' });
const X = sandbox.__X;

/* ---------- assertions ---------- */
let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ FAIL ' + name); }
}
console.log('boot');
t('game booted to title', X.game.state === 'title');
t('save initialized', !!X.save && Array.isArray(X.save.owned));

console.log('phase 2 — economy core');
t('tomb cost starts at 300', X.tombCost('edge') === 300);
X.save.tomb.edge = 5;
t('tomb cost is geometric (step 5 ≈ 2278)', X.tombCost('edge') === Math.round(300 * Math.pow(1.5, 5)));
// flat tomb attack: with ×1.3 training the flat must NOT ride the multiplier
X.save.tomb.edge = 10; X.save.upgrades.dmg = 5;
X.game.equipped = 'tetsu'; X.game.mode = 'level'; X.game.state = 'playing';
X.player.st = 100; X.player.stance = 'sword'; X.player.hp = 100;
X.startAttack();
t('melee: tomb flat lands post-multiplier (16+10=26, not 29)',
  X.player.action && X.player.action.dmg === Math.round(12 * 1.3) + 10);
X.player.action = null;
X.playerLooseArrow(X.BOWS.shortbow, 1, X.player);
t('arrow: tomb flat lands post-multiplier (14+10=24)',
  X.pArrows.length > 0 && X.pArrows[X.pArrows.length - 1].dmg === Math.round(11 * 1.3) + 10);
X.save.tomb.edge = 0; X.save.upgrades.dmg = 0;

console.log('phase 1 — exploits');
// shrine: picks rolled at spawn, reopening never re-rolls
X.game.blessings = []; X.game.curses = []; X.game.shrineN = 0;
X.spawnShrine(200, 200);
const ids1 = X.shrine.picks.map(p => p.bless.id).join(',');
X.openShrine(); X.game.state = 'playing'; X.openShrine();
const ids2 = X.shrine.picks.map(p => p.bless.id).join(',');
t('shrine picks stable across reopen', ids1 === ids2 && X.shrine.picks.length === 3);
t('regular shrine carries no curse', X.shrine.picks.every(p => !p.curse));
X.game.state = 'playing';
// chest key: consumed only when it upgrades (replicate the seeded roll)
// — tier base is mode-aware now: campaign map 5 reads DROP_TABLES[2]
X.save.chestKey = true; X.game.map = 4; X.game.mode = 'campaign';
const naturalRoll = () => {
  const rng = X.mulberry32(X.hash2(X.save.seed, X.save.chestsOpened + 1));
  const r = rng(), tb = X.DROP_TABLES[2];
  return r < tb.legendary ? 'legendary' : r < tb.legendary + tb.pure ? 'pure' : 'worn';
};
let keyOk = true;
for (let i = 0; i < 12; i++) {
  X.save.chestKey = true;
  const nat = naturalRoll();
  X.openChest({ x: 300, y: 300, bias: 0, opened: false });
  if (X.save.chestKey !== (nat !== 'worn')) keyOk = false;
}
t('chest key spent only on real upgrades (12 rolls)', keyOk);
X.game.mode = 'level';
// tomb breath: a held M can never bank the step
X.game.mode = 'tomb';
X.game.tomb = { phase: 'ghosts', track: 'edge', round: 3, scars: 0, toll: 300, t: 0 };
X.enemiesSet = [];
X.keys.m = true;
X.updateTomb(1 / 60);                       // ghosts clear → breath begins
t('breath phase entered with latch armed', X.game.tomb.phase === 'breath' && X.game.tomb.mLatch === true);
for (let i = 0; i < 30; i++) X.updateTomb(1 / 60);   // half a second of held M
t('held M never banks the breath', !X.game.tomb.pressed && X.game.tomb.phase === 'breath');
X.keys.m = false; X.updateTomb(1 / 60);
X.keys.m = true; X.updateTomb(1 / 60);
t('a fresh press answers the breath', X.game.tomb.pressed === true);
X.keys.m = false; X.game.mode = 'level'; X.game.tomb = null;
// kill credit: a bow killing blow tempers the bow, not the sword
X.save.weaponXP = {}; X.save.mastery = {}; X.game.equipped = 'tetsu';
const g = new X.Grunt(400, 300); g.state = 'approach'; g.isBoss = true; g.bossName = 'Test Lord';
X.enemiesSet = [g];
g.hurt(9999, 0, undefined, 6, X.player, 'stormbow');
t('bow kill banks XP on the bow', X.wxpOf('stormbow').xp > 0 || X.wxpOf('stormbow').lvl > 0);
t('bow kill banks nothing on the sword', X.wxpOf('tetsu').xp === 0 && X.wxpOf('tetsu').lvl === 0);
t('bow kill grants NO sword mastery', !X.save.mastery.tetsu);

console.log('phase 3 — rebalance');
t('curse pricing: Rooted .75 / Reversed 1.0',
  X.CURSES.find(c => c.id === 'noroll').bonus === .75 &&
  X.CURSES.find(c => c.id === 'mirror').bonus === 1.0);
X.player.maxHp = 100; X.player.hp = 100; X.player.iT = 0; X.player.dodgeInv = false;
X.player.downed = false; X.player.action = null; X.game.state = 'playing';
X.damagePlayer(500, 0, false, 'the harness');
t('single hit capped at 40% max health', X.player.hp === 60);
t('death recap recorded', X.game.lastHitDesc && X.game.lastHitDesc.name === 'the harness'
  && X.game.lastHitDesc.dmg === 40);

console.log('phase 4 — features');
// lesser art: cycle 0 fires the art, gets no surge
X.save.rebirth = { level: 0 }; X.game.adminUnlocked = false;
X.game.ult = { meter: 100, max: 100, run: null, buffT: 0, env: 0 };
X.player.hp = 100; X.player.iT = 99; X.game.state = 'playing'; X.game.mode = 'level';
X.enemiesSet = [];
X.activateUlt();
t('pre-rebirth: the art fires', !!X.game.ult.run);
for (let i = 0; i < 600 && X.game.ult.run; i++) X.updatePlayer(1 / 60);
t('pre-rebirth: no surge follows', X.game.ult.buffT === 0 && X.game.ult.meter === 0);
X.save.rebirth = { level: 1 };
X.game.ult.meter = 100;
X.activateUlt();
for (let i = 0; i < 600 && X.game.ult.run; i++) X.updatePlayer(1 / 60);
t('post-rebirth: the surge answers', X.game.ult.buffT > 0);
X.game.ult = { meter: 0, max: 100, run: null, buffT: 0, env: 0 };
X.save.rebirth = { level: 0 };
// cursed shrine: every third offering drives a bargain
X.game.blessings = []; X.game.curses = []; X.game.shrineN = 2;
X.spawnShrine(200, 200);
t('third shrine fuses curses to its cards',
  X.shrine.cursed && X.shrine.picks.every(p => p.curse));
// P2 resolve
X.game.coop = true; X.makeP2('tetsu', 'shortbow');
const hpBefore = X.p2.maxHp;
try { X.onBossDeath({ x: 300, y: 300, bossName: 'Test Lord', r: 30 }); } catch (e) {}
t('a fallen lord grants P2 resolve', X.p2.resolve === 1 && X.p2.maxHp === hpBefore + 15);
X.p2.resolve = 4; X.p2.st = 100; X.p2.stance = 'sword'; X.p2.action = null;
X.startAttackFor(X.p2);
t('resolve scales P2 damage (12 → 19)', X.p2.action && X.p2.action.dmg === Math.round(12 * 1.6));
X.p2 = null; X.game.coop = false;

console.log('chest expansion — drops + carousel');
// the reel: winner sits on the landing tile; banner fires when the reel rests
X.game.mode = 'campaign'; X.game.map = 0; X.game.state = 'playing';
X.openChest({ x: 300, y: 300, bias: 0, opened: false });
const cc = X.chestCard;
t('reel carries the pull on the landing tile',
  cc && cc.reel.length === X.REEL.len && cc.reel[X.REEL.land] === cc.item.id);
t('reveal is deferred while the reel spins', cc.t < X.REEL.spin && !!cc.bannerText);
X.game.bannerT = 0;
for (let i = 0; i < 300 && X.chestCard; i++) X.updateChests(1 / 60);
t('landing fires the banner, card retires after hold',
  X.game.bannerT >= 0 && X.game.bannerText.length > 0 && !X.chestCard);
// story mode: first clear ALWAYS pays a chest
X.game.mode = 'level'; X.game.level = 1; X.game.levelWaves = 3; X.game.wave = 3;
X.save.maxLevelCleared = 0; X.game.curses = []; X.game.blessings = [];
X.game.lastBossDeath = { x: 400, y: 300 }; X.game.coop = false;
X.game.levelDamageTaken = 5;
let nChests = X.chests.length;
X.onWaveCleared();
t('story first clear drops a guaranteed chest', X.chests.length === nChests + 1);
// infinite: every 25th wave guarantees a chest
X.game.mode = 'infinite'; X.game.wave = 25; X.game.lastBossDeath = { x: 400, y: 300 };
nChests = X.chests.length;
X.onWaveCleared();
t('infinite wave 25 drops a guaranteed chest', X.chests.length === nChests + 1);
// chaos rush: every 5th stage guarantees a chest
X.game.mode = 'rush'; X.game.chaos = true; X.game.stage = 5;
X.game.lastBossDeath = { x: 400, y: 300 };
nChests = X.chests.length;
X.onWaveCleared();
t('chaos stage 5 drops a guaranteed chest', X.chests.length === nChests + 1);
X.game.mode = 'level'; X.game.state = 'title';

console.log('phase 5 — UX');
// one-shot hints: fire once per save, ever
X.game.mode = 'level'; X.save.seenHints.length = 0;
X.hintOnce('roll', 'test hint'); X.hintOnce('roll', 'test hint');
t('a hint fires exactly once', X.save.seenHints.filter(h => h === 'roll').length === 1);
X.game.mode = 'duel'; X.hintOnce('parry', 'x');
t('duels never lecture', !X.save.seenHints.includes('parry'));
X.game.mode = 'level';
// menu gating: the rebirth door waits for the first cleared lord
X.save.maxLevelCleared = 0; X.save.maps.best = [0, 0, 0, 0, 0];
X.renderMenu();
const rbBtn = sandbox.document.getElementById('btnRebirthMenu');
t('rebirth door hidden on a fresh scroll', rbBtn.style.display === 'none');
X.save.maxLevelCleared = 1; X.renderMenu();
t('rebirth door opens after the first lord', rbBtn.style.display !== 'none');

console.log('fixture stacking — the stall can no longer bury a chest');
X.game.mode = 'level'; X.game.state = 'playing';
X.portal = null; X.merchant = { x: 500, y: 300 };
X.rollChest({ x: 500, y: 300 }, 0);   // dropped exactly under the stall
const ch = X.chests[X.chests.length - 1];
t('a new chest spawns clear of the stall',
  Math.hypot(ch.x - X.merchant.x, ch.y - X.merchant.y) >= 110);
// recreate the OLD broken layout by force — nearest-first E must dig it out
ch.x = 512; ch.y = 300;
X.player.x = 524; X.player.y = 300;   // nearer the chest than the stall
X.tryInteract();
t('E answers the nearer fixture (chest, not shop)',
  ch.opened && X.game.state === 'playing');
X.merchant = null;

console.log('narrow arena — the bridge cannot stack fixtures');
{
  const AR = X.ARENA, saved = { x: AR.x, y: AR.y, w: AR.w, h: AR.h };
  Object.assign(AR, { x: 42, y: 205, w: 940, h: 230 });   // the bridge band
  X.merchant = null; X.portal = { x: 120, y: 320 };
  X.game.blessings = []; X.game.shrineN = 0;
  X.spawnShrine(120, 320);                                 // wants the portal's spot
  t('the shrine slides clear on the bridge',
    Math.hypot(X.shrine.x - X.portal.x, X.shrine.y - X.portal.y) >= 110);
  X.rollChest({ x: 120, y: 320 }, 0);
  const bch = X.chests[X.chests.length - 1];
  t('the chest finds its own stand among both',
    Math.hypot(bch.x - X.portal.x, bch.y - X.portal.y) >= 110 &&
    Math.hypot(bch.x - X.shrine.x, bch.y - X.shrine.y) >= 110);
  X.portal = null;
  Object.assign(AR, saved);
}

console.log('armory expansion — player level, purchases, open odds');
// 位 player level: geometric thresholds, +0.5%/level in the damage chain
X.game.mode = 'level'; X.save.playerXP = { xp: 0, lvl: 0 };
X.grantPlayerXP(45);
t('45 xp crosses the 40-xp first threshold', X.playerLvl() === 1 && X.save.playerXP.xp === 5);
X.game.mode = 'duel'; X.grantPlayerXP(500); X.game.mode = 'level';
t('duels never feed the level', X.playerLvl() === 1);
X.save.playerXP = { xp: 0, lvl: 100 };
X.save.upgrades.dmg = 0; X.save.tomb.edge = 0; X.game.equipped = 'tetsu';
X.game.state = 'playing'; X.player.st = 100; X.player.action = null; X.player.stance = 'sword';
X.startAttack();
t('level 100 = ×1.5 might (12 → 18)', X.player.action && X.player.action.dmg === 18);
X.player.action = null; X.save.playerXP = { xp: 0, lvl: 0 };
// purchases: Worn/Pure arms sold, legendaries never
X.game.honor = 1000; X.save.honor = 1000;
X.save.owned = ['tetsu'];
t('an affordable blade is bought', X.buyArm('kurogane') && X.save.owned.includes('kurogane')
  && X.game.honor === 500);
t('owned arms cannot be re-bought', !X.buyArm('kurogane'));
t('legendaries are never sold', !X.buyArm('raiko') && !X.buyArm('stormbow'));
X.save.bowsOwned = ['shortbow'];   // the chest tests above may have pulled it
t('a bow buys like a blade', X.buyArm('repeater') && X.save.bowsOwned.includes('repeater'));
// the reel wears its odds
X.game.mode = 'campaign'; X.game.map = 0;
X.openChest({ x: 300, y: 300, bias: 0, opened: false });
const od = X.chestCard && X.chestCard.odds;
t('the roulette carries its true odds',
  od && Math.abs(od.worn + od.pure + od.legendary - 1) < .001);
for (let i = 0; i < 300 && X.chestCard; i++) X.updateChests(1 / 60);
X.game.mode = 'level';

console.log('転生の道 — the road of rebirth');
// the road scales with the walker: cycle 0 fights at base, cycle 3 rises
X.save.rebirth = { level: 0 };
t('cycle 0: the road fights at base', X.ascensionMults().hp === 1 && X.ascensionMults().dmg === 1);
X.save.rebirth = { level: 3 };
t('cycle 3: the road rises to meet you',
  X.ascensionMults().hp > 2 && X.ascensionMults().dmg > 1.5);
X.save.rebirth = { level: 0 };
// walking it: startRun spawns lord 1; clearing stage 5 turns the cycle
X.startRun('ascension');
t('the road opens on a boss', X.game.mode === 'ascension' && X.game.stage === 1 &&
  X.enemies.length > 0 && X.enemies.every(e => e.isBoss));
X.game.stage = 5;
X.game.lastBossDeath = { x: 400, y: 300 };
X.save.playerXP = { xp: 12, lvl: 7 };
X.save.ascStones = 2;
X.onWaveCleared();
t('the walked road turns the cycle', X.rebirthLevel() === 1);
t('the road ends at the dojo gate', X.game.state === 'title');
t('the arsenal crosses the cycle', X.save.owned.includes('tetsu'));
t('the player level crosses the cycle', X.playerLvl() === 7);
t('the walk consumed exactly one stone; the spare crossed too',
  X.save.ascStones === 1);

console.log('armory follow-ups — veteran guidance + grandfathered levels');
// a reborn hand is never lectured like a novice
X.save.rebirth = { level: 5 }; X.save.maxLevelCleared = 0; X.save.charmsOwned = [];
const vTips = X.armoryGuidance().join(' | ');
t('veteran guidance speaks in cycles', vTips.includes('cycle 5') &&
  !vTips.includes('opens every road'));
X.save.rebirth = { level: 0 };
// an old save wakes up at a level its lifetime kills already earned
X.applySaveData({ honor: 0, owned: ['tetsu'], stats: { kills: 1000 } });
t('1000 lifetime kills grandfather a real level', X.playerLvl() >= 8);
const seeded = X.playerLvl();
X.applySaveData({ honor: 0, owned: ['tetsu'], stats: { kills: 99999 },
                  playerXP: { xp: 0, lvl: seeded } });
t('seeding happens only once — an existing level is never re-rolled',
  X.playerLvl() === seeded);

console.log('昇 ascension stones — the road grows a toll and a climb');
// the road DOUBLES per cycle while the walker only ×1.5s
X.save.rebirth = { level: 3 };
t('cycle 3 lords stand ~5.5× (2^3 · .85 / wr)',
  X.ascensionMults().hp > 4 && X.ascensionMults().hp < 8);
X.save.rebirth = { level: 0 };

console.log('the retinue — skill checks walk the road');
X.save.rebirth = { level: 2 };
X.startRun('ascension');
t('cycle-2 road brings mirror guards and a duelmaster',
  X.enemies.some(e => e.mirrorAll) && X.enemies.some(e => e.chainMax === 3));
t('the road lords carry the surge',
  X.enemies.filter(e => e.isBoss).every(e => e.ascSurge));
const mg = X.enemies.find(e => e.mirrorAll);
mg.state = 'circle';
const mgHp = mg.hp;
mg.hurt(500, 0, undefined, 10, X.player, 'tetsu');
t('the mirror turns raw steel aside, feeding its stance',
  mg.hp === mgHp && mg.posture > 0);
mg.brokenT = 1;
mg.hurt(10, 0, undefined, 10, X.player, 'tetsu');
t('a cracked mirror finally bleeds', mg.hp < mgHp);
const surgeLord = X.enemies.find(e => e.isBoss);
const lordDmg = surgeLord.dmg;
surgeLord.state = 'circle';
surgeLord.hp = Math.floor(surgeLord.maxHp * .4);
surgeLord.update(1 / 60);
t('half health erupts into the 奥 surge', surgeLord.surgeT > 0 && surgeLord.dmg > lordDmg);
surgeLord.brokenT = 1;
surgeLord.update(1 / 60);
t('a posture break snuffs the surge', surgeLord.surgeT === 0 && surgeLord.dmg === lordDmg);
X.save.rebirth = { level: 0 };
X.game.state = 'title'; X.enemiesSet = [];
// stones fall from the seeded stream — deterministic per save.seed
X.save.seed = 424242; X.save.chestsOpened = 0; X.save.ascStones = 0;
X.game.mode = 'campaign'; X.game.map = 4; X.game.state = 'playing';
for (let i = 0; i < 40; i++) X.openChest({ x: 300, y: 300, bias: 0, opened: false });
t('stones gleam from lacquer chests (40 rich pulls)', X.save.ascStones >= 1);
for (let i = 0; i < 400 && X.chestCard; i++) X.updateChests(1 / 60);
X.game.mode = 'level';

console.log('momentum — stacking blessings, hot combo, elite mirrors');
// blessings deepen: tier II Whetted Edge = +18%
X.game.mode = 'level'; X.game.state = 'playing';
X.game.blessings = ['edge', 'edge']; X.game.curses = [];
X.save.upgrades.dmg = 0; X.save.tomb.edge = 0; X.save.playerXP = { xp: 0, lvl: 0 };
X.save.weaponXP = {};   // the chest tests above melted duplicates into temper
X.game.equipped = 'tetsu'; X.player.st = 100; X.player.action = null;
X.startAttack();
t('tier-II edge cuts +18% (12 → 14)', X.player.action && X.player.action.dmg === 14);
X.player.action = null;
// a tier-III blessing leaves the shrine pool
X.game.blessings = ['mend', 'mend', 'mend']; X.game.shrineN = 0;
X.spawnShrine(200, 200);
t('a tier-III blessing is no longer offered',
  X.shrine.picks.every(p => p.bless.id !== 'mend'));
X.game.blessings = [];
// hot combo: 10+ breathes 15% faster
X.game.combo = 12; X.game.lastComboAt = X.game.time;
X.player.st = 50; X.player.regenDelay = 0; X.player.action = null;
X.player.hollowT = 0; X.game.ult.run = null;
X.updatePlayer(1);
t('a hot combo fills the lungs +15% (≈29.9 not 26)', X.player.st > 78 && X.player.st < 81);
X.game.combo = 0;
// mirror-touched elites block while posturing, bleed in their own recovery
const me = new X.Grunt(500, 300);
me.affix = 'mirrortouched'; me.state = 'circle';
const meHp = me.hp;
me.hurt(20, 0, undefined, 8, X.player, 'tetsu');
t('mirror-touched turns steel while posturing', me.hp === meHp && me.posture > 0);
me.state = 'recover';
me.hurt(5, 0, undefined, 8, X.player, 'tetsu');
t('its own recovery is the punish window', me.hp < meHp);

console.log('the death loop — lesson honor, the stall, the TRAIN door');
X.save.merchantUnlocked = false;
X.game.mode = 'level'; X.game.state = 'playing'; X.game.honorMult = 1;
X.game.honor = 0; X.save.honor = 0; X.game.level = 1; X.game.equipped = 'tetsu';
const lord = new X.Grunt(400, 300);
lord.isBoss = true; lord.bossName = 'Test Lord';
lord.honorKill = 600; lord.maxHp = 100; lord.hp = 40;   // 60% wounded
X.enemiesSet = [lord];
X.gameOver();
t('a 60%-wounded lord pays 180 lesson honor (half-rate)', X.game.honor === 180);
t('the first fall opens the stall', X.save.merchantUnlocked === true);
X.openShop();
t('the stall opens over the death scroll', X.game.state === 'shop');
X.closeShop();
t('leaving the stall returns to the death scroll', X.game.state === 'gameover');
X.game.state = 'title';

console.log('co-op interact + the mirrored stall');
// either blade opens a chest; the stall scroll answers P1 alone
X.game.mode = 'infinite'; X.game.state = 'playing'; X.game.coop = true;
X.makeP2('tetsu', 'shortbow');
X.p2.x = 600; X.p2.y = 300; X.player.x = 100; X.player.y = 100;
X.merchant = null; X.portal = null;
X.rollChest({ x: 600, y: 300 }, 0);
const cch = X.chests[X.chests.length - 1];
cch.x = 600; cch.y = 300;   // pin it under P2 (clearSpot may have nudged it)
X.tryInteract(X.p2);
t('the second blade opens a chest', cch.opened === true);
for (let i = 0; i < 400 && X.chestCard; i++) X.updateChests(1 / 60);
X.merchant = { x: 610, y: 300 };
X.tryInteract(X.p2);
t('the stall never answers the second blade', X.game.state === 'playing');
X.merchant = null; X.p2 = null; X.game.coop = false; X.game.mode = 'level';
// mirrored stall ops: one mutation path for host click and guest wire
X.game.honor = 500; X.save.honor = 500; X.save.upgrades.hp = 0;
t('a mirrored training purchase lands',
  X.applyShopOp('upg', 'hp') && X.save.upgrades.hp === 1 && X.game.honor === 380);
X.game.honor = 0; X.save.honor = 0;
t('an empty purse is refused', !X.applyShopOp('upg', 'dmg'));
t('the admin brush cannot be equipped by wire', !X.applyShopOp('equip', 'fudemaru'));

console.log('duel homing — a flat magnet the roll still answers');
{
  const foe = { x: 400, y: 330, hp: 100 };
  const a = { x: 0, y: 300, vx: 500, vy: 0, travel: 100, dead: false,
              pvp: true, owner: { foe } };
  X.homeDuelArrow(a, 1 / 60);
  t('inside the 10° cone the shaft bends toward the foe', a.vy > 0);
  const b = { x: 0, y: 300, vx: 500, vy: 0, travel: 100, dead: false,
              pvp: true, owner: { foe: { x: 400, y: 500, hp: 100 } } };
  X.homeDuelArrow(b, 1 / 60);
  t('outside the cone there is no magnet', b.vy === 0);
  const c = { x: 0, y: 300, vx: 500, vy: 0, travel: 30, dead: false,
              pvp: true, owner: { foe } };
  X.homeDuelArrow(c, 1 / 60);
  t('point-blank shafts fly honest', c.vy === 0);
}

console.log('蔓 riana — the admin vine');
{
  X.game.mode = 'level'; X.game.state = 'playing';
  // the seal: unlock survives the sanitizing merge; without it the bow resets
  X.applySaveData({ honor: 0, owned: ['tetsu'], stats: { kills: 1 },
                    rianaUnlocked: true, bowEquipped: 'riana' });
  t('the vine stays strung while its seal stands', X.save.bowEquipped === 'riana');
  X.applySaveData({ honor: 0, owned: ['tetsu'], stats: { kills: 1 },
                    bowEquipped: 'riana' });
  t('without the seal the vine withers to shortbow', X.save.bowEquipped === 'shortbow');
  X.save.rianaUnlocked = true;
  t('the seal strings the vine by wire too', X.applyShopOp('strBow', 'riana')
    && X.save.bowEquipped === 'riana');
  // 100% accuracy: full-sky seek, no cone — an arrow flying dead AWAY
  // from the only foe turns fully around within half a second
  const g2 = new X.Grunt(200, 300); g2.state = 'circle';
  X.enemiesSet = [g2];
  X.game.kyudo = null;
  const va = { x: 600, y: 300, vx: 700, vy: 0, travel: 200, dead: false,
               pvp: false, hit: [], bowId: 'riana', owner: X.player };
  for (let i = 0; i < 30; i++) {
    X.homePArrow(va, 1 / 60);
    va.x += va.vx / 60; va.y += va.vy / 60;
  }
  t('the vine does not miss — a fleeing shaft turns back', va.vx < 0);
  // admin arms live outside the temper economy
  X.enemiesSet = []; X.game.mode = 'level';
  X.save.weaponXP = {};
  X.grantWeaponXP('riana', 500);
  t('admin arms bank no temper', !X.save.weaponXP.riana);
  X.save.rianaUnlocked = false; X.save.bowEquipped = 'shortbow';
}

console.log('the aim channel — a cursor quantized onto the wire');
{
  let worst = 0;
  for (const a of [-3, -1.2, 0, .7, 2.9, 6.1]) {
    const back = X.unpackAim(X.packAim(a) | 16 | 2048);   // survives other bits
    const want = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    let d = Math.abs(back - want) % (Math.PI * 2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    worst = Math.max(worst, d);
  }
  t('aim round-trips within a spoke (≤0.7°)', worst < (Math.PI * 2) / 256);
  t('no aim flag means no aim', X.unpackAim(16 | 2048 | 4096) === null);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
