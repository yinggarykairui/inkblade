/* ---------- procedural audio: everything synthesized, nothing loaded ----------
   A master → sfx/ambient gain graph, one shared noise buffer, and small
   tone/noise one-shots. The context wakes on the first user gesture
   (autoplay policy); until then playSfx stays a no-op.                  */
const AE = {
  started: false, ctx: null, master: null, sfxG: null, ambG: null,
  noiseBuf: null, wind: null, rain: null,
  orbNote: 0, lastOrb: -9, evT: 1.5,
};
function makeNoiseBuf(ctx) {
  const len = ctx.sampleRate;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
function loopNoise(filterType, freq, q) {
  const src = AE.ctx.createBufferSource();
  src.buffer = AE.noiseBuf; src.loop = true;
  const f = AE.ctx.createBiquadFilter();
  f.type = filterType; f.frequency.value = freq; f.Q.value = q || .8;
  const g = AE.ctx.createGain(); g.gain.value = 0;
  src.connect(f); f.connect(g); g.connect(AE.ambG);
  src.start();
  return { src, f, g };
}
function sfxTone(type, f0, f1, dur, vol, delay = 0, dest) {
  const t = AE.ctx.currentTime + delay;
  const o = AE.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(1, f0), t);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  const g = AE.ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(dest || AE.sfxG);
  o.start(t); o.stop(t + dur + .02);
}
function sfxNoise(filterType, f0, f1, dur, vol, q = 1, delay = 0, dest) {
  const t = AE.ctx.currentTime + delay;
  const src = AE.ctx.createBufferSource();
  src.buffer = AE.noiseBuf;
  const f = AE.ctx.createBiquadFilter();
  f.type = filterType; f.Q.value = q;
  f.frequency.setValueAtTime(Math.max(10, f0), t);
  if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
  const g = AE.ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(dest || AE.sfxG);
  src.start(t, Math.random() * .5, dur + .05);
}
function realPlaySfx(name) {
  if (!AE.started || save.audio.muted) return;
  if (AE.ctx.state === 'suspended') { try { AE.ctx.resume(); } catch (e) {} return; }
  switch (name) {
    case 'whoosh': sfxNoise('bandpass', 420, 1500, .16, .10, 1.4); break;
    case 'dodge':  sfxNoise('lowpass', 900, 260, .16, .09); break;
    case 'thunk':  sfxTone('triangle', 140, 58, .11, .16);
                   sfxNoise('lowpass', 700, 220, .08, .10); break;
    case 'hurt':   sfxTone('triangle', 95, 45, .18, .2);
                   sfxNoise('lowpass', 500, 150, .12, .12); break;
    case 'clash':  sfxTone('square', 2430, 2150, .09, .05);
                   sfxTone('square', 3660, 3300, .07, .04);
                   sfxNoise('highpass', 2600, 2600, .12, .07); break;
    case 'parry':  sfxTone('sine', 1318.5, 1318.5, .3, .1);
                   sfxTone('sine', 1760, 1760, .38, .07, .03); break;
    case 'bow':    sfxNoise('highpass', 1800, 900, .07, .08);
                   sfxTone('sine', 620, 170, .12, .07); break;
    case 'bolt':   sfxNoise('highpass', 2400, 700, .12, .09);
                   sfxTone('sawtooth', 320, 90, .13, .05); break;
    case 'taiko':  sfxTone('sine', 96, 40, .5, .3);
                   sfxNoise('lowpass', 300, 80, .2, .14); break;
    case 'break':  sfxNoise('bandpass', 2900, 500, .16, .13, 2);
                   sfxTone('square', 420, 90, .2, .07); break;
    case 'vanish': sfxNoise('bandpass', 800, 240, .28, .07); break;
    case 'tick':   sfxTone('sine', 1050, 1050, .03, .05); break;
    case 'buy':    sfxTone('sine', 784, 784, .12, .08);
                   sfxTone('sine', 1046.5, 1046.5, .22, .08, .09); break;
    case 'achieve':sfxTone('sine', 659.3, 659.3, .16, .08);
                   sfxTone('sine', 987.8, 987.8, .3, .08, .12); break;
    case 'bless':  sfxTone('sine', 523.3, 523.3, .3, .06);
                   sfxTone('sine', 659.3, 659.3, .34, .06, .06);
                   sfxTone('sine', 784, 784, .42, .06, .12); break;
    case 'portal': sfxTone('sine', 190, 640, .5, .07);
                   sfxNoise('bandpass', 500, 1600, .5, .05); break;
    case 'rumble': sfxNoise('lowpass', 120, 60, .9, .22); break;
    case 'surge':  // the color explosion has a chord: a bright rising triad
                   sfxTone('sine', 523.3, 523.3, .35, .09);
                   sfxTone('sine', 659.3, 659.3, .4, .08, .04);
                   sfxTone('sine', 987.8, 1046.5, .5, .07, .08);
                   sfxNoise('highpass', 1200, 3800, .4, .05); break;
    case 'orb': {
      // pentatonic pickup — the ladder climbs while the streak holds
      if (game.time - AE.lastOrb > 1.2) AE.orbNote = 0;
      AE.lastOrb = game.time;
      const scale = [523.3, 587.3, 659.3, 784, 880, 1046.5];
      const f = scale[Math.min(AE.orbNote++, scale.length - 1)];
      sfxTone('sine', f, f, .18, .07);
      break;
    }
  }
}
/* per-theme ambient beds: a wind loop + a rain loop, retuned on arrival,
   plus scattered one-shots (birds, rustle, crackle, distant thunder)    */
const AMBIENTS = [
  { wind: .04,  windF: 520, rain: 0   },   // dojo yard
  { wind: .085, windF: 720, rain: 0   },   // bamboo grove
  { wind: .025, windF: 420, rain: .12 },   // rain-slicked bridge
  { wind: .03,  windF: 300, rain: 0   },   // burning watchtower
  { wind: .07,  windF: 260, rain: .05 },   // storm shrine
];
function retuneAmbient() {
  if (!AE.started) return;
  const a = AMBIENTS[themeIndex] || AMBIENTS[0];
  const t = AE.ctx.currentTime;
  AE.wind.g.gain.linearRampToValueAtTime(a.wind, t + 1.4);
  AE.wind.f.frequency.linearRampToValueAtTime(a.windF, t + 1.4);
  AE.rain.g.gain.linearRampToValueAtTime(a.rain, t + 1.4);
}
function updateAudioAmbient(dt) {
  if (!AE.started || save.audio.muted || AE.ctx.state === 'suspended') return;
  // the surge drone rides the color envelope: a bright overtone layer
  // swells while any 奥義 burns and drains away with the pigment
  if (AE.surgeG) {
    const target = .055 * (game.state === 'playing' ? surgeSceneEnv() : 0);
    AE.surgeG.gain.value += (target - AE.surgeG.gain.value) * Math.min(1, dt * 7);
  }
  AE.evT -= dt;
  if (AE.evT > 0) return;
  const amb = AE.ambG;
  if (themeIndex === 0) {          // birdsong over the yard
    AE.evT = rand(2.5, 7);
    const f = rand(2200, 3200);
    sfxTone('sine', f, f * 1.25, .09, .05, 0, amb);
    sfxTone('sine', f * 1.1, f * .9, .08, .04, .12, amb);
  } else if (themeIndex === 1) {   // bamboo rustle
    AE.evT = rand(2, 5);
    sfxNoise('bandpass', 1500, 900, .45, .045, .8, 0, amb);
  } else if (themeIndex === 3) {   // fire crackle
    AE.evT = rand(.12, .45);
    sfxNoise('lowpass', rand(900, 1600), 300, .05, .05, 1, 0, amb);
  } else {                         // distant thunder over bridge + shrine
    AE.evT = rand(6, 14);
    sfxNoise('lowpass', 160, 55, 1.5, .11, 1, 0, amb);
  }
}
function initAudio() {
  if (AE.started) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    AE.ctx = new AC();
    AE.master = AE.ctx.createGain();
    AE.master.connect(AE.ctx.destination);
    AE.sfxG = AE.ctx.createGain(); AE.sfxG.connect(AE.master);
    AE.ambG = AE.ctx.createGain(); AE.ambG.connect(AE.master);
    AE.noiseBuf = makeNoiseBuf(AE.ctx);
    AE.wind = loopNoise('lowpass', 480);
    AE.rain = loopNoise('bandpass', 3200, .6);
    // the surge drone — two detuned voices an octave apart, silent until
    // an 奥義 burns (gain driven each frame from updateAudioAmbient)
    AE.surgeG = AE.ctx.createGain();
    AE.surgeG.gain.value = 0;
    AE.surgeG.connect(AE.ambG);
    for (const [type, freq, det] of [['sawtooth', 261.6, 0], ['triangle', 523.3, 7]]) {
      const o = AE.ctx.createOscillator();
      o.type = type; o.frequency.value = freq; o.detune.value = det;
      const og = AE.ctx.createGain(); og.gain.value = .5;
      o.connect(og); og.connect(AE.surgeG);
      o.start();
    }
    AE.started = true;
    syncAudioVolumes = () => {
      if (!AE.started) return;
      AE.master.gain.value = save.audio.muted ? 0 : save.audio.master;
      AE.sfxG.gain.value = save.audio.sfx;
      AE.ambG.gain.value = save.audio.ambient;
    };
    syncAudioVolumes();
    retuneAmbient();
    playSfx = realPlaySfx;
  } catch (e) { /* audio stays silent — the game plays on */ }
}
addEventListener('pointerdown', () => {
  initAudio();
  if (AE.ctx && AE.ctx.state === 'suspended') { try { AE.ctx.resume(); } catch (e) {} }
});
// every button press ticks like a brush tap
document.addEventListener('click', e => {
  if (e.target && e.target.tagName === 'BUTTON') playSfx('tick');
});

