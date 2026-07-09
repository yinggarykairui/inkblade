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
  'chests', 'chestCard', 'REEL'];
const FN_NAMES = ['tombCost', 'tombAtk', 'spawnShrine', 'openShrine', 'updateTomb',
  'damagePlayer', 'startAttackFor', 'startAttack', 'activateUlt', 'updatePlayer',
  'makeP2', 'onBossDeath', 'playerLooseArrow', 'wxpOf', 'rebirthLevel',
  'mulberry32', 'hash2', 'openChest', 'resetPlayer', 'Grunt', 'ultReady',
  'persistSave', 'rand', 'onWaveCleared', 'updateChests', 'rollChest',
  'startRun', 'ascensionMults', 'hintOnce', 'renderMenu',
  'tryInteract', 'clearSpot'];
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
X.onWaveCleared();
t('the walked road turns the cycle', X.rebirthLevel() === 1);
t('the road ends at the dojo gate', X.game.state === 'title');
t('the arsenal crosses the cycle', X.save.owned.includes('tetsu'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
