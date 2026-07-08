/* ---------- persistent progression (localStorage) ----------
   Carries across runs, modes, and game-overs: the honor wallet, the
   sword collection, permanent training tiers, and infinite-mode records.
   Per-run state (hp, combo, wave) stays on `game` and resets each run.  */
const SAVE_KEY = 'inkblade_save_v1';
const UPGRADE_DEFS = {
  hp:  { kanji: '体', name: 'Iron Body',   per: '+20 max health per tier',
         costs: [120, 240, 420, 650, 900] },
  spd: { kanji: '足', name: 'Swift Feet',  per: '+4% move speed per tier',
         costs: [100, 200, 350, 550, 800] },
  dmg: { kanji: '刃', name: 'Honed Edge',  per: '+6% base damage per tier — stacks under any sword’s trait',
         costs: [150, 300, 500, 750, 1000] },
  st:  { kanji: '気', name: 'Deep Lungs',  per: '+15 max stamina per tier',
         costs: [100, 200, 350, 550, 800] },
  rgn: { kanji: '息', name: 'Calm Breath', per: '+12% stamina regen per tier',
         costs: [100, 200, 350, 550, 800] },
};
const UPGRADE_MAX = 5;
// charms — one equipped at a time, persistent, never active in duels
const CHARMS = [
  { id: 'omamori', kanji: '守', name: 'Omamori',      cost: 800,
    desc: 'survive one killing blow per run — the charm shatters and leaves you at 1 health' },
  { id: 'magnet',  kanji: '引', name: 'Magnet Charm', cost: 300,
    desc: 'honor orbs magnet from twice as far' },
  { id: 'koi',     kanji: '鯉', name: 'Koi Charm',    cost: 500,
    desc: 'the fish slips through — dodge i-frames last 40% longer' },
  { id: 'oni',     kanji: '鬼', name: 'Oni Charm',    cost: 600,
    desc: '+20% damage dealt, +20% damage taken — the demon’s bargain' },
];
const DEFAULT_STATS = { kills: 0, deaths: 0, perfectDodges: 0, parries: 0,
  postureBreaks: 0, honorEarned: 0, elites: 0, duelWins: 0, bladeKills: {} };
function defaultSave() {
  return {
    honor: 0,
    owned: ['tetsu'], equipped: 'tetsu',
    bowsOwned: ['shortbow'], bowEquipped: 'shortbow',   // archer stance loadout
    // --- progression overhaul (all additive) ---
    weaponXP: {},                          // id → {xp, lvl}; blades AND bows
    tomb: { body: 0, stance: 0, edge: 0 }, // Tomb of the Fallen steps (0..10 each)
    maps: { unlocked: 1, best: [0, 0, 0, 0, 0] },   // campaign progress
    seed: 0,                               // minted on first load; chest rolls
    chestsOpened: 0,                       // the deterministic loot stream index
    chestKey: false,                       // merchant key: next chest ≥ Pure
    upgrades: { hp: 0, spd: 0, dmg: 0, st: 0, rgn: 0 },
    maxLevelCleared: 0,
    merchantUnlocked: false,
    deepestWave: 0,
    highScores: [],           // {wave, honor, diff, date}
    bestRushTime: null,       // gauntlet: fastest clear (seconds)
    bestChaosStage: 0,        // chaos rush: deepest stage survived
    charm: null,              // equipped charm id
    charm2: null,             // second slot — opens at rebirth cycle 6
    charmsOwned: [],
    recCycles: {},            // which 転生 cycle each record was set at
    mastery: {},              // swordId → boss kills while it was equipped
    achievements: [],         // earned achievement ids
    stats: Object.assign({}, DEFAULT_STATS, { bladeKills: {} }),
    headband: null,           // tournament cosmetic ('gold')
    adminUnlocked: false,     // the seal, once inscribed, holds across reloads
    audio: { master: .8, sfx: 1, ambient: .7, muted: false },
    shakeMul: 1,              // screen-shake intensity setting
    colorblind: false,        // high-contrast telegraph palette
    mouseAim: false,          // 360° cursor aim (PvE only; duels stay keys)
    kyudo: { rank: 0, best: 0 },   // 弓道 archery rite — trained bow skill
    rebirth: { level: 0 },         // 転生 — the only exponential the player owns
  };
}
let save = defaultSave();
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      save = Object.assign(save, d);
      save.upgrades = Object.assign({ hp: 0, spd: 0, dmg: 0, st: 0, rgn: 0 }, d.upgrades);
      // new fields merge additively — old saves must load without loss
      save.stats = Object.assign({}, DEFAULT_STATS, d.stats);
      save.stats.bladeKills = Object.assign({}, d.stats && d.stats.bladeKills);
      save.audio = Object.assign({ master: .8, sfx: 1, ambient: .7, muted: false }, d.audio);
      save.mastery = Object.assign({}, d.mastery);
      if (!Array.isArray(save.achievements)) save.achievements = [];
      if (!Array.isArray(save.charmsOwned)) save.charmsOwned = [];
      if (save.charm && !save.charmsOwned.includes(save.charm)) save.charm = null;
      if (save.charm2 && (!save.charmsOwned.includes(save.charm2) ||
          save.charm2 === save.charm)) save.charm2 = null;
      save.recCycles = Object.assign({}, d.recCycles);
      if (typeof save.shakeMul !== 'number') save.shakeMul = 1;
      save.mouseAim = !!save.mouseAim;   // additive — old saves default off
      save.kyudo = Object.assign({ rank: 0, best: 0 }, d.kyudo);
      save.rebirth = Object.assign({ level: 0 }, d.rebirth);
      if (!Array.isArray(save.owned) || !save.owned.includes('tetsu')) save.owned = ['tetsu'];
      // bows arrived later — old saves get the starter quiver for free
      if (!Array.isArray(save.bowsOwned) || !save.bowsOwned.includes('shortbow'))
        save.bowsOwned = ['shortbow'].concat(
          Array.isArray(save.bowsOwned) ? save.bowsOwned.filter(b => BOWS[b]) : []);
      save.bowsOwned = save.bowsOwned.filter(b => BOWS[b]);
      if (!BOWS[save.bowEquipped] || !save.bowsOwned.includes(save.bowEquipped))
        save.bowEquipped = 'shortbow';
      // progression overhaul fields — old saves gain them at zero
      save.weaponXP = Object.assign({}, d.weaponXP);
      save.tomb = Object.assign({ body: 0, stance: 0, edge: 0 }, d.tomb);
      save.maps = Object.assign({ unlocked: 1, best: [0, 0, 0, 0, 0] }, d.maps);
      if (!Array.isArray(save.maps.best) || save.maps.best.length !== 5)
        save.maps.best = [0, 0, 0, 0, 0];
      // a cleared old-campaign level vouches for the matching map
      save.maps.unlocked = clamp(Math.max(save.maps.unlocked || 1,
        Math.min(5, (save.maxLevelCleared || 0) + 1)), 1, 5);
      save.chestsOpened = save.chestsOpened | 0;
      save.adminUnlocked = !!save.adminUnlocked;
      // the brush survives reloads only while the seal stands
      const fudeOk = save.equipped === 'fudemaru' && save.adminUnlocked;
      if (!WEAPONS[save.equipped] ||
          (!fudeOk && (save.equipped === 'fudemaru' || !save.owned.includes(save.equipped))))
        save.equipped = 'tetsu';
    }
  } catch (e) { /* corrupted or blocked storage — start fresh */ }
}
function persistSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
}
loadSave();
if (!save.seed) { save.seed = (Math.random() * 0x7fffffff) | 0 || 1; persistSave(); }

/* ---------- weapon XP & tomb stats — the vertical tracks ----------
   grantWeaponXP is the ONLY write path: it banks, levels, announces and
   persists on level-up. XP is normalized by the stage multiplier at the
   call sites, so farming low maps earns crumbs. NONE of these accessors
   may be read in duel code — duels stay progression-free (harness-pinned). */
function wxpOf(id) { return save.weaponXP[id] || { xp: 0, lvl: 0 }; }
function wxpLvl(id) { return wxpOf(id).lvl; }
function wxpMult(id) { return wxpGrowth(wxpLvl(id)); }
function rarityMult(id) { return rarityOf(id).mult; }
function grantWeaponXP(id, amt) {
  if (!id || id === 'fudemaru' || game.mode === 'duel' || !(amt > 0)) return;
  const w = save.weaponXP[id] = save.weaponXP[id] || { xp: 0, lvl: 0 };
  const cap = rarityOf(id).cap;
  if (w.lvl >= cap) return;
  w.xp += amt;
  while (w.lvl < cap && w.xp >= xpForLevel(w.lvl)) {
    w.xp -= xpForLevel(w.lvl);
    w.lvl++;
    const nm = (WEAPONS[id] || BOWS[id] || {}).name || id;
    setBanner(`${nm} — LEVEL ${w.lvl}${w.lvl >= cap ? ' · TEMPERED' : ''}`, 1.8);
    playSfx('achieve');
    persistSave();
  }
}
// Tomb of the Fallen: 10 steps per track, each ×10^(1/10) → exactly 10× capped
/* ---------- 墓 tomb flat stats + 転生 rebirth ----------
   THE NEW BALANCE SHAPE (2026-07-08): the tomb no longer multiplies.
   Each hard-won step ADDS a flat stat — costs climb on a steady slope,
   steps are uncapped, and flat gains naturally fade against the
   world's exponential curve. The ONLY exponential the player owns is
   rebirth: ×1.5 might and vigor per cycle. All of it PvE — duels and
   fighters never read these.                                          */
function tombSteps(track) { return (save.tomb && save.tomb[track]) || 0; }
function tombAtk()     { return Math.round(tombSteps('edge')); }        // 刃 +1 attack/step
function tombHp()      { return Math.round(tombSteps('body') * 6); }    // 体 +6 health/step
function tombPosture() { return tombSteps('stance') * 2; }              // 姿 +2 posture/step
function baseCrit() { return 1.5; }   // crits are a skill payoff, no longer a track
function tombCost(track) { return Math.round(300 * (1 + .35 * tombSteps(track))); }
// 転生 rebirth — everything burns, the arsenal and the records remain
function rebirthLevel() { return (save.rebirth && save.rebirth.level) || 0; }
function rebirthMult() { return Math.pow(1.5, rebirthLevel()); }
function ultUnlocked() {   // 奥義 opens at the first rebirth; the brush is admin
  return rebirthLevel() >= 1 || game.adminUnlocked;
}
const REBIRTH_PERKS = [
  { lvl: 1, kanji: '奥', name: 'The Gate Opens',
    desc: '奥義 ultimate arts awaken — the meter charges, the arts answer' },
  { lvl: 2, kanji: '視', name: 'An Old Friend',
    desc: 'the merchant knows your face — the stall stands open from birth' },
  { lvl: 3, kanji: '誉', name: 'Inheritance',
    desc: 'each life begins with 誉 1,000 honor' },
  { lvl: 4, kanji: '鍵', name: 'The Keeper’s Key',
    desc: 'each life begins with a chest key on your belt' },
  { lvl: 5, kanji: '符', name: 'Heirloom Charms',
    desc: 'charms survive the cycle from here on' },
  { lvl: 6, kanji: '双', name: 'Twin Charms',
    desc: 'a second charm may be worn at once' },
  { lvl: 7, kanji: '呪', name: 'Sweetened Burdens',
    desc: 'every curse pays its honor twice over' },
  { lvl: 8, kanji: '地', name: 'Remembered Roads',
    desc: 'each life begins with the second map already open' },
  { lvl: 9, kanji: '霊', name: 'A Patient Ancestor',
    desc: 'the tomb trial forgives one scar' },
  { lvl: 10, kanji: '金', name: 'The Golden Stroke',
    desc: 'your figure carries a stroke of gold — proof of ten lives' },
];
function doRebirth() {
  if ((save.maxLevelCleared || 0) < 5) return 'the fifth lord still stands';
  const lvl = rebirthLevel() + 1;
  // what crosses the cycle: the arsenal (and its tempering + mastery),
  // the records, the trained eye, the seal, and the settings. The chest
  // stream (seed + count) persists so old pulls can never be re-rolled.
  const keep = {
    owned: save.owned, weaponXP: save.weaponXP, mastery: save.mastery,
    bowsOwned: save.bowsOwned, bowEquipped: save.bowEquipped,
    equipped: (save.equipped === 'fudemaru' && save.adminUnlocked) ||
              save.owned.includes(save.equipped) ? save.equipped : 'tetsu',
    achievements: save.achievements, stats: save.stats,
    highScores: save.highScores, deepestWave: save.deepestWave,
    bestRushTime: save.bestRushTime, bestChaosStage: save.bestChaosStage,
    kyudo: save.kyudo, headband: save.headband,
    recCycles: save.recCycles,
    adminUnlocked: save.adminUnlocked,
    audio: save.audio, shakeMul: save.shakeMul,
    colorblind: save.colorblind, mouseAim: save.mouseAim,
    seed: save.seed, chestsOpened: save.chestsOpened,
    charmsOwned: lvl >= 5 ? save.charmsOwned : [],   // heirloom charms at 5
  };
  save = Object.assign(defaultSave(), keep);
  save.rebirth = { level: lvl };
  // the ladder's standing gifts, granted at the start of every new life
  if (lvl >= 2) save.merchantUnlocked = true;
  if (lvl >= 3) save.honor = 1000;
  if (lvl >= 4) save.chestKey = true;
  if (lvl >= 8) save.maps.unlocked = Math.max(save.maps.unlocked, 2);
  persistSave();
  return null;
}
// 弓道 archery-rite ranks: trained at the yard's straw rings, skill IS the
// stat. Ranks widen the arrows' seek cone (see ARROW_HOME) and, below,
// quicken the draw and cheapen its wind — never in duels (fighters read
// raw BOWS stats; a harness test pins them).
function kyudoRank() { return (save.kyudo && save.kyudo.rank) || 0; }
function kyudoDrawMul() { return 1 - .015 * kyudoRank(); }   // rank 10: -15% draw time
function kyudoStamMul() { return 1 - .015 * kyudoRank(); }   // rank 10: -15% draw stamina

// save scroll: compact base64 for copy-paste between machines
function exportSave() {
  return 'INK1.' + btoa(unescape(encodeURIComponent(JSON.stringify(save))));
}
function importSave(str) {
  try {
    str = (str || '').trim();
    if (!str.startsWith('INK1.')) return 'that is not an ink scroll';
    const d = JSON.parse(decodeURIComponent(escape(atob(str.slice(5)))));
    if (!d || typeof d !== 'object' || typeof d.honor !== 'number' ||
        !Array.isArray(d.owned))
      return 'the scroll is damaged';
    localStorage.setItem(SAVE_KEY, JSON.stringify(d));
    save = defaultSave();
    loadSave();          // re-runs the sanitizing merge path
    persistSave();
    return null;         // success
  } catch (e) {
    return 'the scroll is damaged';
  }
}
// derived player stats from training tiers
/* ---------- achievements: the kanji-stamp scroll ---------- */
const ACHIEVEMENTS = [
  { id: 'firstBlood',  kanji: '初',   name: 'First Ink',            desc: 'fell your first foe' },
  { id: 'firstParry',  kanji: '弾',   name: 'Turned Aside',         desc: 'parry an attack' },
  { id: 'firstPerfect',kanji: '舞',   name: 'Through the Blade',    desc: 'dodge through an active strike' },
  { id: 'deflect',     kanji: '返矢', name: 'Arrow Turned',         desc: 'parry a projectile out of the air' },
  { id: 'riposte',     kanji: '返',   name: 'The Answer',           desc: 'kill with a riposte' },
  { id: 'break10',     kanji: '崩',   name: 'Breaker of Stances',   desc: 'break posture ten times' },
  { id: 'combo15',     kanji: '連',   name: 'Fifteen Strokes',      desc: 'reach a 15 combo' },
  { id: 'trial1',      kanji: '庭',   name: 'The Yard Swept',       desc: 'clear Level 1' },
  { id: 'trialAll',    kanji: '完',   name: 'The Trial Complete',   desc: 'clear all five levels' },
  { id: 'untouched',   kanji: '無傷', name: 'Untouched',            desc: 'clear a level without taking damage' },
  { id: 'gauntletFast',kanji: '討',   name: 'Five Lords, Five Minutes', desc: 'clear the gauntlet under 5:00' },
  { id: 'chaos10',     kanji: '亂',   name: 'Ten Storms',           desc: 'reach chaos stage 10' },
  { id: 'wave20',      kanji: '淵',   name: 'Deep Water',           desc: 'reach wave 20 of the endless storm' },
  { id: 'elite10',     kanji: '精',   name: 'Elite Hunter',         desc: 'fell ten gold-marked elites' },
  { id: 'rich',        kanji: '富',   name: 'A Full Purse',         desc: 'hold 2000 honor at once' },
  { id: 'allSwords',   kanji: '刀匠', name: 'The Collector',        desc: 'own every blade in the ledger' },
  { id: 'master1',     kanji: '極',   name: 'One Path, Mastered',   desc: 'master a sword — five lords felled with it' },
  { id: 'blessed',     kanji: '祈',   name: 'Blessed',              desc: 'accept a shrine blessing' },
  { id: 'defiant',     kanji: '呪',   name: 'Defiant',              desc: 'clear a level while cursed' },
  { id: 'duelist',     kanji: '決',   name: 'Planted Feet',         desc: 'win a duel without rolling' },
  { id: 'crowned',     kanji: '冠',   name: 'Tournament Crown',     desc: 'win the dojo tournament' },
  { id: 'legend',      kanji: '傳',   name: 'A Legend Unsealed',    desc: 'pull a legendary arm from a chest' },
  { id: 'tombTen',     kanji: '墓',   name: 'The Path Walked',      desc: 'walk a tomb track to its 10× end' },
];
function award(id) {
  if (save.achievements.includes(id)) return;
  save.achievements.push(id);
  persistSave();
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (a) {
    setBanner(`${a.kanji} — ${a.name}`, 2.4);
    playSfx('achieve');
  }
}

function upgMaxHp()  { return 100 + 20 * save.upgrades.hp; }
function upgSpeed()  { return 235 * (1 + .04 * save.upgrades.spd); }
function upgDmgMul() { return 1 + .06 * save.upgrades.dmg; }
function upgMaxSt()  { return 100 + 15 * save.upgrades.st; }
function upgRegen()  { return 26 * (1 + .12 * save.upgrades.rgn); }

