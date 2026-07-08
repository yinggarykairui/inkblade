/* ---------- main loop: rAF + delta time (frame-rate independent) ---------- */
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = Math.min((now - last) / 1000, 1 / 30);   // clamp tab-switch spikes
  last = now;
  if (net && net.started && (game.mode === 'duel' || net.coop) &&
      game.state === 'playing') {
    // online lockstep: fixed 60Hz ticks, gated on both sides' inputs
    if (hitStop > 0) hitStop -= rawDt;
    else netFrame(rawDt);
  } else if (hitStop > 0) {
    hitStop -= rawDt;            // freeze-frame: render only
  } else if (game.state === 'playing') {
    update(rawDt);
  } else {
    updateEffects(rawDt);        // let particles settle on menus
  }
  updateAudioAmbient(rawDt);     // the world keeps breathing on menus too
  draw();
}
requestAnimationFrame(frame);
