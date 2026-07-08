/* ---------- online duel: PeerJS + input lockstep ----------
   Only inputs cross the wire. Both browsers run identical simulations
   with a 3-tick input delay; the reliable ordered DataChannel means no
   loss handling, only latency. Cosmetic randomness (particles) never
   touches fighter state, so the sims cannot drift. Restricted to the
   dojo ground — its hazards are none, its floor deterministic.         */
const NET_DELAY = 3;   // minimum input delay in ticks; a pre-match RTT probe raises it
let net = null;   // {peer, conn, host, started, tick, delay, acc, sendAcc, sendTick,
                  //  localQ, remoteQ, pend, rtt, stall}
function netStatus(msg, bad) {
  const el = document.getElementById('netMsg');
  if (el) { el.textContent = msg || ''; el.style.color = bad ? 'var(--red)' : 'var(--gold)'; }
}
/* STUN discovers each side's public address so ordinary home NATs can
   hole-punch a direct path; two tabs on one machine never needed it, which
   is why local tests pass while two houses stall. Strict/symmetric NATs
   additionally need TURN — a relay of last resort — and no reliable
   anonymous TURN exists (the old openrelay pool is dead: probed, silent).
   For those networks, create free credentials (metered.ca / Cloudflare,
   minutes) and uncomment the TURN entry below.                            */
const ICE_CONFIG = { iceServers: [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302',
           'stun:stun.relay.metered.ca:80'] },
  // { urls: 'turn:global.relay.metered.ca:443?transport=tcp',
  //   username: 'YOUR_METERED_USERNAME', credential: 'YOUR_METERED_CREDENTIAL' },
]};
function loadPeerJS(cb) {
  if (window.Peer) return cb(null);
  netStatus('reaching for the wire…');
  const s = document.createElement('script');
  s.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
  s.onload = () => cb(null);
  s.onerror = () => cb('could not fetch the connection library — are you offline?');
  document.head.appendChild(s);
}
function netCleanup() {
  if (!net) return;
  const n = net;
  net = null;
  try { n.conn && n.conn.close(); } catch (e) {}
  try { n.peer && n.peer.destroy(); } catch (e) {}
}
function netDropped(msg) {
  const wasLive = net && net.started;
  netCleanup();
  if (wasLive && game.mode === 'duel') {
    setBanner('the line is severed', 2.5);
    returnToMenu();
    netStatus(msg || 'connection lost — the duel ends', true);
  } else {
    netStatus(msg || 'connection failed — strict NATs may block the path; try another network', true);
  }
}
function wireConn(conn) {
  net.conn = conn;
  // a blocked ICE path fires NO event — the silent stall is the only symptom,
  // so a timer has to speak for it
  const stallT = setTimeout(() => {
    if (!net || net.conn !== conn || conn.open) return;
    if (net.host) {   // keep the room alive; only this attempt died
      conn.abandoned = true;   // its close event must not sever the room
      try { conn.close(); } catch (e) {}
      net.conn = null;
      netStatus('a challenger reached out but the wire could not cross — the room stays open', true);
    } else {
      netDropped('found the room, but no path crossed the NATs — try a phone hotspot on one side');
    }
  }, 15000);
  conn.on('open', () => {
    clearTimeout(stallT);
    if (!net) return;
    if (net.host) netStatus('challenger connected — crossing blades…');
    else conn.send({ t: 'join', blade: menuSel.p1Blade, bow: menuSel.p1Bow });
  });
  conn.on('data', onNetData);
  conn.on('close', () => {
    clearTimeout(stallT);
    if (!conn.abandoned) netDropped('the other side left');
  });
  conn.on('error', () => {
    clearTimeout(stallT);
    if (!conn.abandoned) netDropped();
  });
}
function hostDuel() {
  if (net) netCleanup();
  loadPeerJS(err => {
    if (err) return netStatus(err, true);
    const code = Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(0, 5) || 'inkbl';
    const peer = new window.Peer('inkblade-' + code, { config: ICE_CONFIG });
    net = { peer, host: true, started: false, code };
    peer.on('open', () =>
      netStatus('room code: ' + code.toUpperCase() + ' — send it to your challenger and wait'));
    peer.on('connection', c => { if (net) wireConn(c); });
    peer.on('error', e => netDropped('signal failed (' + (e && e.type || 'error') + ')'));
  });
}
function joinDuel(code) {
  if (net) netCleanup();
  code = (code || '').trim().toLowerCase();
  if (!code) return netStatus('enter the host’s code first', true);
  loadPeerJS(err => {
    if (err) return netStatus(err, true);
    const peer = new window.Peer({ config: ICE_CONFIG });
    net = { peer, host: false, started: false };
    netStatus('seeking the host…');
    // reliable:false → PeerJS opens the channel UNORDERED (still retransmitting).
    // Inputs are keyed by tick, so order is irrelevant — and one late packet
    // no longer holds every packet behind it hostage (no head-of-line stalls).
    peer.on('open', () => {
      if (net) wireConn(peer.connect('inkblade-' + code, { reliable: false }));
    });
    peer.on('error', e => netDropped('no room answered to that code (' + (e && e.type || 'error') + ')'));
  });
}
function onNetData(d) {
  if (!net || !d) return;
  if (d.t === 'join' && net.host && !net.started) {
    // measure the wire before the first blade is drawn — the round trip
    // sizes the input delay for the whole match
    net.guestBlade = d.blade;
    net.guestBow = d.bow;
    netStatus('measuring the wire…');
    net.conn.send({ t: 'probe', ts: performance.now() });
  } else if (d.t === 'probe' && !net.host) {
    net.conn.send({ t: 'probeAck', ts: d.ts });
  } else if (d.t === 'probeAck' && net.host && !net.started) {
    const rtt = performance.now() - d.ts;
    net.rtt = rtt;
    // one-way trip in ticks, plus two of headroom — a 40ms wire plays at
    // the old feel (3), a 200ms wire flows at 8 instead of stuttering
    const delay = clamp(Math.round(rtt / 2 / (1000 / 60)) + 2, NET_DELAY, 9);
    net.conn.send({ t: 'start', hostBlade: menuSel.p1Blade, guestBlade: net.guestBlade,
                    hostBow: menuSel.p1Bow, guestBow: net.guestBow,
                    mut: menuSel.mut, delay });
    startOnlineDuel(menuSel.p1Blade, net.guestBlade, menuSel.mut, delay,
                    menuSel.p1Bow, net.guestBow);
  } else if (d.t === 'start' && !net.host && !net.started) {
    startOnlineDuel(d.hostBlade, d.guestBlade, d.mut, d.delay, d.hostBow, d.guestBow);
  } else if (d.t === 'in') {
    net.remoteQ[d.k] = d.b;
  } else if (d.t === 'ping') {
    try { net.conn.send({ t: 'pong', ts: d.ts }); } catch (e) {}
  } else if (d.t === 'pong') {
    net.rtt = performance.now() - d.ts;
  } else if (d.t === 'quit') {
    netDropped('the other side withdrew');
  }
}
function startOnlineDuel(hostBlade, guestBlade, mut, delay, hostBow, guestBow) {
  menuSel.duelOpp = 'online';
  menuSel.duelArena = 0;                    // deterministic ground, no hazards
  menuSel.mut = Object.assign({ sudden: false, nostam: false, giant: false,
                                mirror: false, surge: false }, mut);
  menuSel.p1Blade = WEAPONS[hostBlade] ? hostBlade : 'tetsu';
  menuSel.p2Blade = WEAPONS[guestBlade] ? guestBlade : 'tetsu';
  startRun('duel');
  // both sims must string the same bows — they arrive in the start message
  duel.p1.bow = BOWS[hostBow] ? hostBow : 'shortbow';
  duel.p2.bow = BOWS[guestBow] ? guestBow : 'shortbow';
  duel.p1.netCtl = { mx: 0, my: 0 };
  duel.p2.netCtl = { mx: 0, my: 0 };
  duel.p1.name = net.host ? 'YOU · HOST' : 'THE HOST';
  duel.p2.name = net.host ? 'THE CHALLENGER' : 'YOU';
  Object.assign(net, {
    started: true, tick: 0, acc: 0, sendAcc: 0,
    delay: clamp(delay || NET_DELAY, NET_DELAY, 9),
    localQ: {}, remoteQ: {},
    pend: { atk: false, roll: false, parry: false, ult: false, swap: false, stance: false },
    rtt: net.rtt || 0, stall: false, pingT: 0,
  });
  // prime the input pipeline so tick 0 can step immediately
  for (let k = 0; k < net.delay; k++) {
    net.localQ[k] = 0;
    try { net.conn.send({ t: 'in', k, b: 0 }); } catch (e) {}
  }
  net.sendTick = net.delay;
  setBanner('決闘 ONLINE — ROUND 1 · first to 2', 2.2);
}
function sampleLocalBits() {
  let b = 0;
  if (touch.active) {
    if (touch.mx < -.3) b |= 1;
    if (touch.mx > .3) b |= 2;
    if (touch.my < -.3) b |= 4;
    if (touch.my > .3) b |= 8;
  } else {
    if (keys.a || keys.ArrowLeft) b |= 1;
    if (keys.d || keys.ArrowRight) b |= 2;
    if (keys.w || keys.ArrowUp) b |= 4;
    if (keys.s || keys.ArrowDown) b |= 8;
  }
  if (net.pend.atk) b |= 16;
  if (net.pend.roll) b |= 32;
  if (net.pend.parry) b |= 64;
  if (net.pend.ult) b |= 128;
  if (net.pend.swap) b |= 256;
  if (keys.m || keys[',']) b |= 512;   // meditation is a held stance
  if (net.pend.stance) b |= 1024;      // 弓 stance toggle
  if (keys.v || keys.u || touchUI.pressed.atk !== undefined)
    b |= 2048;                         // attack HELD — the bow draw rides this
  net.pend.atk = net.pend.roll = net.pend.parry =
    net.pend.ult = net.pend.swap = net.pend.stance = false;
  return b;
}
function applyBits(f, b) {
  f.netCtl.mx = ((b & 2) ? 1 : 0) - ((b & 1) ? 1 : 0);
  f.netCtl.my = ((b & 8) ? 1 : 0) - ((b & 4) ? 1 : 0);
  f.netCtl.med = !!(b & 512);
  f.netCtl.atkHeld = !!(b & 2048);
  if (b & 16) f.attackBuf = .1;
  if (b & 32) f.dodgeBuf = .1;
  if (b & 64) f.parryBuf = .1;
  if (b & 128) toggleFighterUlt(f);    // brush maw — or the 奥義 art on a plain blade
  if (b & 256) toggleFighterSwap(f);
  if (b & 1024) toggleFighterStance(f);
}
function commitLocal(k) {   // sample now, remember, and put it on the wire
  if (net.localQ[k] !== undefined) return;
  const b = sampleLocalBits();
  net.localQ[k] = b;
  try { net.conn.send({ t: 'in', k, b }); } catch (e) {}
}
function netFrame(rawDt) {
  // commit inputs on the WALL clock, independent of sim progress — the
  // pipe stays full through a stall, so both sides recover in a burst
  // instead of waiting out a fresh round trip of mutual silence
  net.sendAcc = Math.min(net.sendAcc + rawDt, .3);
  while (net.sendAcc >= 1 / 60) {
    net.sendAcc -= 1 / 60;
    if (net.sendTick < net.tick + net.delay + 12)   // bounded lead (~200ms)
      commitLocal(net.sendTick++);
  }
  net.acc = Math.min(net.acc + rawDt, .25);
  let steps = 0;
  while (steps < 8) {
    const k = net.tick;
    if (net.remoteQ[k] === undefined) break;         // the wire is behind
    // step on the wall-time budget — or beyond it when the peer has run
    // ahead and their inputs are already banked (catch-up burst)
    const backlog = net.remoteQ[k + 2] !== undefined;
    if (net.acc < 1 / 60 && !backlog) break;
    commitLocal(k);                                  // never stall on ourselves
    if (net.sendTick <= k) net.sendTick = k + 1;
    applyBits(net.host ? duel.p1 : duel.p2, net.localQ[k]);
    applyBits(net.host ? duel.p2 : duel.p1, net.remoteQ[k]);
    update(1 / 60);                            // the duel branch is deterministic
    if (!net) return;                          // the step may have ended everything
    net.tick++;
    net.acc = Math.max(0, net.acc - 1 / 60);
    steps++;
  }
  if (!net) return;
  net.stall = net.remoteQ[net.tick] === undefined;
  net.pingT -= rawDt;
  if (net.pingT <= 0 && net.conn) {
    net.pingT = 2;
    try { net.conn.send({ t: 'ping', ts: performance.now() }); } catch (e) {}
  }
  if (net.tick % 120 === 0) {                  // sweep stale inputs
    for (const q of [net.localQ, net.remoteQ])
      for (const key in q) if (+key < net.tick - 20) delete q[key];
  }
}

