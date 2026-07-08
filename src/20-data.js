/* ---------- progression curves & rarity — THE BALANCE IDENTITY ----------
   World: M(n) = 1.15^(n-1) over 5 maps × 10 stages → ×942 at stage 50.
   Player: rarity(8×) × weaponXP(1.08^30 ≈ 10×) × tomb(10×) ≈ ×805. The
   world wins by ~17%, so the last lords stay tight fights. Knobs live HERE
   and the harness's identity test guards the ratio (1.05..1.35).          */
const STAGES_PER_MAP = 10;
const MAP_COUNT = 5;
function stageMult(n) { return Math.pow(1.15, n - 1); }
const RARITY = {
  worn:      { name: 'Worn',      kanji: '鈍', mult: 1,   cap: 10 },
  pure:      { name: 'Pure',      kanji: '澄', mult: 2.5, cap: 20 },
  legendary: { name: 'Legendary', kanji: '傳', mult: 8,   cap: 30 },
};
const WPN_RARITY = {
  tetsu: 'worn', kurogane: 'worn', botan: 'worn',
  ame: 'pure', shirasagi: 'pure', tsukikage: 'pure',
  akaoni: 'legendary', raiko: 'legendary',
  fudemaru: 'worn',   // admin — outside every progression system
};
const BOW_RARITY = { shortbow: 'worn', repeater: 'worn',
  longbow: 'pure', firebow: 'pure', stormbow: 'legendary' };
function rarityOf(id) { return RARITY[WPN_RARITY[id] || BOW_RARITY[id] || 'worn']; }
// weapon XP: geometric thresholds, ×1.085 cutting weight per level
function xpForLevel(k) { return Math.round(60 * Math.pow(1.25, k)); }
function wxpGrowth(lvl) { return Math.pow(1.08, lvl); }
// chest drop tables by map tier — [worn, pure, legendary] weights
const DROP_TABLES = [
  { worn: .82, pure: .15, legendary: .03 },   // maps 1–2
  { worn: .60, pure: .32, legendary: .08 },   // maps 3–4
  { worn: .40, pure: .45, legendary: .15 },   // map 5 / lords
];
const CHEST_POOL = {
  worn: ['tetsu', 'kurogane', 'botan', 'shortbow', 'repeater'],
  pure: ['ame', 'shirasagi', 'tsukikage', 'longbow', 'firebow'],
  legendary: ['akaoni', 'raiko', 'stormbow'],
};

/* ---------- adaptive difficulty tracker ----------
   Watches the player's performance in the current fight and nudges enemy
   aggression / feint frequency / attack-delay accordingly.               */
const adapt = {
  swings: 0, landedSwings: 0,  // player attack accuracy
  taken: 0,                    // hits eaten (recent)
  perfects: 0,                 // dodges through active attacks
  windups: 0, windupDodges: 0, // "player dodges on reaction to telegraphs"
  windupParries: 0,            // "player parries on reaction to telegraphs"
  reset() { this.swings = this.landedSwings = this.taken = this.perfects =
            this.windups = this.windupDodges = this.windupParries = 0; },
  decay() {  // between waves, halve everything so recency dominates
    for (const k of ['swings','landedSwings','taken','perfects','windups','windupDodges','windupParries'])
      this[k] = Math.floor(this[k] / 2);
  },
  aggression() {   // >1 when the player is doing well → enemies speed up
    const hr = this.swings > 4 ? this.landedSwings / this.swings : .5;
    const a = .92 + (hr - .45) * .5 + Math.min(this.perfects, 8) * .025
              - Math.min(this.taken, 8) * .05;
    return clamp(a, .72, 1.3);
  },
  dodgeHabit() {   // 0..1 — how reliably the player dodges telegraphs
    return this.windups > 3 ? clamp(this.windupDodges / this.windups, 0, 1) : 0;
  },
  parryHabit() {   // 0..1 — how reliably the player parries telegraphs
    return this.windups > 3 ? clamp(this.windupParries / this.windups, 0, 1) : 0;
  },
  feintChance(base) { return clamp(base + this.dodgeHabit() * .45 + this.parryHabit() * .35
                                   + (this.aggression() - 1) * .15
                                   + (game.dFeint || 0), .05, .75); },
  extraDelay() {   // habitual dodgers/parriers get windups stretched past their reaction
    return (this.dodgeHabit() > .35 || this.parryHabit() > .35) ? rand(.18, .42) : 0;
  }
};
// combined enemy tempo: adaptive layer × chosen difficulty setting
function eAggro() { return clamp(adapt.aggression() * (game.dAggro || 1), .72, 1.8); }

/* ---------- attack tokens: loose squad coordination ----------
   Only a limited number of enemies may commit to an attack at once; the
   rest circle and posture. A grant cooldown staggers threats in time.    */
function makeTokenPool(cap, gapBase) {
  return {
    holders: new Set(), cap, gapBase, cd: 0,
    request(e) {
      if (this.cd > 0 || this.holders.size >= this.cap) return false;
      this.holders.add(e); return true;
    },
    release(e) {
      if (this.holders.delete(e)) this.cd = this.gapBase / eAggro();
    },
    update(dt) { if (this.cd > 0) this.cd -= dt; }
  };
}
let meleeTokens = makeTokenPool(1, .9);
let rangedTokens = makeTokenPool(1, .7);

/* ---------- weapons ----------
   Stats feed the shared attack code; specials hook into hit resolution.
   spdMul scales all three attack phases (higher = slower blade).        */
const WEAPON_ORDER = ['tetsu', 'ame', 'shirasagi', 'botan',
                      'kurogane', 'tsukikage', 'akaoni', 'raiko'];
const WEAPONS = {
  tetsu: { id: 'tetsu', kanji: '鉄', name: 'Tetsu', epithet: 'Old Iron',
    cost: 0, unlockLevel: 0,
    dmg: 12, spdMul: 1, arc: 2.3, reach: 60, stCost: 18,
    desc: 'The dojo training blade. Balanced, honest, unremarkable.' },
  ame: { id: 'ame', kanji: '雨', name: 'Ame', epithet: 'Rain',
    cost: 150, unlockLevel: 0,
    dmg: 6, spdMul: .68, arc: 1.6, reach: 56, stCost: 9,
    desc: 'Needle-thin, tireless. Consecutive hits without a whiff quicken the blade further (up to 5 stacks).' },
  shirasagi: { id: 'shirasagi', kanji: '白鷺', name: 'Shirasagi', epithet: 'White Heron',
    cost: 320, unlockLevel: 1,
    dmg: 8, spdMul: .78, arc: 1.7, reach: 58, stCost: 12,
    desc: 'Pale and weightless. Dodge-roll into a swing to extend its active frames — flow like water.' },
  botan: { id: 'botan', kanji: '牡丹', name: 'Botan', epithet: 'Peony',
    cost: 320, unlockLevel: 1,
    dmg: 12, spdMul: .95, arc: 2.2, reach: 48, stCost: 16,
    desc: 'A show blade, short but lovely. Clean hits (no damage taken for 2s) strike 40% harder.' },
  kurogane: { id: 'kurogane', kanji: '黒鉄', name: 'Kurogane', epithet: 'The Iron Crow',
    cost: 500, unlockLevel: 2,
    dmg: 17, spdMul: 1.25, arc: 2.8, reach: 62, stCost: 20,
    desc: 'Heavy as a crow’s omen. Every 3rd combo hit lands as a crushing crow strike.' },
  tsukikage: { id: 'tsukikage', kanji: '月影', name: 'Tsukikage', epithet: 'Moon Shadow',
    cost: 500, unlockLevel: 3,
    dmg: 12, spdMul: 1, arc: 2.3, reach: 60, stCost: 18,
    desc: 'Drinks the light. Striking a foe mid-windup — a true punish — refunds the swing’s stamina.' },
  akaoni: { id: 'akaoni', kanji: '赤鬼', name: 'Akaoni', epithet: 'Red Demon',
    cost: 750, unlockLevel: 4,
    dmg: 22, spdMul: 1.45, arc: 2.2, reach: 64, stCost: 24, stagger: .7,
    desc: 'Cruel and slow. Hits stagger unarmored foes, cancelling their attacks — but a whiff leaves you wide open.' },
  raiko: { id: 'raiko', kanji: '雷光', name: 'Raiko', epithet: 'Thunder Child',
    cost: 1200, unlockLevel: 5, legendary: true,
    dmg: 15, spdMul: .88, arc: 2.4, reach: 62, stCost: 18,
    desc: 'Legendary. Killing blows arc chain lightning to a nearby foe; dodge-roll into a swing to charge it white-hot.' },
  // not sold, not earned — unsealed only by the admin code on the title scroll
  fudemaru: { id: 'fudemaru', kanji: '筆', name: 'Fudemaru', epithet: 'The Brush That Unwrites',
    cost: 0, unlockLevel: 0, admin: true,
    dmg: 0, spdMul: 1, arc: 1.5, reach: 70, stCost: 0,
    desc: 'ADMIN. Tap: 火 burns a cone clean. Dodge-tap: 雷 storms through every foe. Hold: 無 stills the world. Hold longer: 命 restores all. Never winded, always charged.' },
};
// posture damage per hit, by blade: fast-weak blades chip stances quickly,
// the heavy demon blade cracks them outright
const WPN_POSTURE = { tetsu: 10, ame: 13, shirasagi: 9, botan: 10,
  kurogane: 15, tsukikage: 10, akaoni: 22, raiko: 11, fudemaru: 0 };
// 奥義 neon per blade — [primary, secondary] for the surge ribbon and meter
const WPN_NEON = {
  tetsu:     ['#00e5ff', '#7c5cff'], ame:       ['#38bdf8', '#22d3ee'],
  shirasagi: ['#a5f3fc', '#ffffff'], botan:     ['#ff5fa2', '#d946ef'],
  kurogane:  ['#8b5cf6', '#22d3ee'], tsukikage: ['#818cf8', '#c084fc'],
  akaoni:    ['#ff3b3b', '#ff9d00'], raiko:     ['#38bdf8', '#00ffff'],
  fudemaru:  ['#00ffff', '#d946ef'],
};
function weaponNeon(id) { return WPN_NEON[id] || ['#00ffff', '#d946ef']; }

/* ---------- bows: the archer stance's arm ----------
   Q swaps stance (P2: P in duels). Hold the attack key to draw — movement
   slows, the draw itself is the telegraph — release to loose. Arrows cost
   STAMINA rather than a quiver: the game already prices every action
   (swings, rolls, parries) in the one stamina gauge, and meditation, Deep
   Lungs and Calm Breath training all exist to manage it. A regenerating
   quiver would be a second, parallel resource with its own HUD and regen
   rules for a near-identical feel; stamina keeps archery inside the
   existing economy, makes point-blank spam self-limiting (a winded archer
   can neither shoot nor roll), and lets the training the player already
   bought serve both stances.                                            */
const BOW_ORDER = ['shortbow', 'longbow', 'repeater', 'firebow', 'stormbow'];
const BOWS = {
  shortbow: { id: 'shortbow', kanji: '小弓', name: 'Koyumi', epithet: 'The First String',
    cost: 0, unlockLevel: 0,
    draw: .4, dmg: 11, speed: 520, stCost: 12,
    desc: 'A hunter’s shortbow. Quick to bend, honest in flight — the first string every archer learns.' },
  longbow: { id: 'longbow', kanji: '大弓', name: 'Ōyumi', epithet: 'The Patient Arc',
    cost: 400, unlockLevel: 1, pierce: 1,
    draw: .95, dmg: 26, speed: 660, stCost: 20,
    desc: 'Slow to bend, cruel to receive. A drawn shaft passes through one foe and finds the next.' },
  repeater: { id: 'repeater', kanji: '連弩', name: 'Rendō', epithet: 'Three Strings',
    cost: 600, unlockLevel: 2, burst: 3,
    draw: .22, dmg: 6, speed: 470, stCost: 17,
    desc: 'Three strings, one release — a rattling three-arrow burst. Weak shafts, and the lungs pay dearly for the speed.' },
  firebow: { id: 'firebow', kanji: '火矢', name: 'Hiya', epithet: 'The Ground Remembers',
    cost: 800, unlockLevel: 3, burn: true,
    draw: .6, dmg: 13, speed: 540, stCost: 15,
    desc: 'Pitch-wrapped arrowheads. Where a shaft lands the ground remembers — a patch of flame that bites all who stand in it.' },
  stormbow: { id: 'stormbow', kanji: '嵐弓', name: 'Arashi', epithet: 'The Sky Answers',
    cost: 1500, unlockLevel: 5, split: 3, legendary: true,
    draw: .85, dmg: 16, speed: 600, stCost: 18,
    desc: 'Legendary. Bend it fully and the sky answers — one arrow leaves the string, three arrive in a spreading fan.' },
};
function currentBow() { return BOWS[save.bowEquipped] || BOWS.shortbow; }
function bowUnlocked(b) { return save.maxLevelCleared >= b.unlockLevel; }
// sword mastery: 5 boss kills while a blade is drawn unlocks its hidden perk
function masteryOf(id) { return (save.mastery && save.mastery[id]) || 0; }
function isMastered(id) { return masteryOf(id) >= 5; }
function currentWeapon() { return WEAPONS[game.equipped]; }
function purchasedCount() {
  let n = 0;
  for (const id of save.owned) if (id !== 'tetsu') n++;
  return n;
}
function weaponUnlocked(w) {
  if (w.admin) return game.adminUnlocked;
  // gated by the highest story level cleared (persistent)
  if (w.id === 'raiko') return save.maxLevelCleared >= 5 || purchasedCount() >= 2;
  return save.maxLevelCleared >= w.unlockLevel;
}

