'use strict';
/* =========================================================================
   INKBLADE — single-file 2D sword-fighting arena
   Sections: helpers / canvas / input / effects / adaptive+tokens /
             player / enemies (FSM) / projectiles / waves / game / loop
   ========================================================================= */

/* ---------- helpers ---------- */
// big-number ink: 14.2k, 1.1M — mandatory once the curves pass 4 digits
function fmtNum(n) {
  n = Math.round(n);
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
  if (n >= 1e4) return Math.round(n / 1e3) + 'k';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return '' + n;
}
// deterministic PRNG for loot rolls — seeded per save so scroll
// export/import can't re-roll a legendary (anti-scum, not netcode)
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(a, b) { return ((a * 2654435761) ^ (b * 40503)) >>> 0; }
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp  = (a, b, t) => a + (b - a) * t;
const rand  = (a, b) => a + Math.random() * (b - a);
const dist  = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
function angDiff(a, b) {           // signed shortest angle a->b
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
// Is target circle (tx,ty,tr) inside an arc sector from (sx,sy)?
function inArc(sx, sy, faceAng, range, arc, tx, ty, tr) {
  const dx = tx - sx, dy = ty - sy;
  const d = Math.hypot(dx, dy);
  if (d > range + tr) return false;
  const a = Math.atan2(dy, dx);
  const slack = Math.atan2(tr, Math.max(d, 1));
  return Math.abs(angDiff(faceAng, a)) < arc / 2 + slack;
}
// Predictive aim: where to shoot so a projectile of speed s meets the target.
function aimLead(px, py, pvx, pvy, ax, ay, s) {
  const rx = px - ax, ry = py - ay;
  const a = pvx * pvx + pvy * pvy - s * s;
  const b = 2 * (rx * pvx + ry * pvy);
  const c = rx * rx + ry * ry;
  let t = 0;
  if (Math.abs(a) < 1e-6) {
    if (Math.abs(b) > 1e-6) t = -c / b;
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      const t1 = (-b - sq) / (2 * a), t2 = (-b + sq) / (2 * a);
      t = Math.min(t1 > 0 ? t1 : Infinity, t2 > 0 ? t2 : Infinity);
      if (!isFinite(t)) t = 0;
    }
  }
  t = clamp(t, 0, 1.1);
  return { x: px + pvx * t, y: py + pvy * t };
}

