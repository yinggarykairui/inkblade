/* ---------- palette ---------- */
const INK    = '#2b2320';
const PAPER  = '#ece0c8';
const CREAM  = '#f5ead2';
const RED    = '#b5342a';
const REDHOT = '#d64533';
const GOLD   = '#a8843a';
// enemy bodies — a strict VALUE RAMP, never a hue code: light grays are
// quick and frail, darker grays hit harder; elites and lords are inked
// darkest at draw time (see drawEnemy). Silhouette + weapon carry the
// rest of the identity.
const C_GRUNT   = '#79695c';   // mid — the honest club
const C_DUELIST = '#5d574f';   // darker — the punishing rapier
const C_BRUTE   = '#453f39';   // darkest standard — the armored slab
const C_ARCHER  = '#7f766b';   // light — frail, distant
const C_SHINOBI = '#8b847d';   // lightest — the knife in the mist
const C_ASHIGARU= '#645a4a';   // dark warm — the walking wall

// sound dispatcher — a no-op until the procedural audio engine (below)
// takes over; lets every system emit sound without caring if audio is live
let playSfx = () => {};

// telegraph danger color — swaps to high-contrast blue when the
// colorblind-safe setting is on (red arcs read poorly for deuteranopia)
function teleRGBA(a) {
  return (typeof save !== 'undefined' && save.colorblind)
    ? `rgba(14,107,168,${a})` : `rgba(181,52,42,${a})`;
}

/* ---------- ink / color duality (Phase 0 plumbing) ----------
   The base state is calligraphy: ink, paper, and two sanctioned accents —
   cinnabar for danger (always through teleRGBA) and gold for reward.
   Full color exists only while an ultimate burns. Visual code asks
   styleFor(owner) instead of hardcoding colors, so one emitter paints
   both worlds; particles carry TOKENS resolved fresh at draw time, so a
   shaft loosed in ink turns neon mid-flight when the surge ignites.    */
const PAL = {
  ink: {
    stroke: INK,                       // the loaded brush
    wash:   'rgba(43,35,32,.5)',       // diluted ink
    faint:  'rgba(43,35,32,.28)',      // drying ink
    splat:  '#241d1a',                 // fresh spatter
  },
  // traditional pigments for the ultimate arts (recipes may also reach
  // for the blade's WPN_NEON pair via styleFor)
  pigment: {
    cinnabar:     '#e34234',           // 朱 — the seal's red
    jade:         '#00a86b',           // 石綠
    imperialGold: '#f5c242',           // 泥金
    azurite:      '#3a6ea5',           // 石青
  },
};
// is this owner's world currently in color? (owner: player | fighter | null)
function ownerSurged(owner) {
  if (!owner) return false;
  if (typeof player !== 'undefined' && owner === player) return ultActive();
  if (owner.blade !== undefined) return fighterSurged(owner) || !!owner.ultRun;
  return false;
}
// the one question visual code may ask: how do I paint for this owner?
function styleFor(owner) {
  if (ownerSurged(owner)) {
    const nz = weaponNeon(owner === player ? game.equipped : owner.blade);
    return { glow: true, stroke: nz[0], accent: nz[1], wash: nz[1], faint: nz[0] };
  }
  return { glow: false, stroke: PAL.ink.stroke, accent: PAL.ink.wash,
           wash: PAL.ink.wash, faint: PAL.ink.faint };
}
// draw-time token resolution: tint ∈ stroke|wash|faint|accent|danger|gold
function resolveTint(tint, owner) {
  if (tint === 'danger') return teleRGBA(.8);
  if (tint === 'gold') return GOLD;
  const s = styleFor(owner);
  return s[tint] || s.stroke;
}

