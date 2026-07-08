/* ---------- online play: PeerJS + input lockstep ----------
   Only inputs cross the wire. Both browsers run identical simulations
   with a 3-tick input delay; the reliable ordered DataChannel means no
   loss handling, only latency. Two session kinds share the pipeline:
   'duel' (1v1, dojo-locked) and 'coop' (二人 PvE — infinite/rush).
   Co-op determinism rests on three legs: the sim rolls only from the
   seeded stream (setSimSeed, 00-util), the guest borrows the host's
   ledger (borrowSave, 25-save) so P1's statline matches, and every
   player action rides the tick-stamped bitmask — never a local key.
   A periodic state checksum severs the line honestly if they drift.   */
const NET_DELAY = 3;   // minimum input delay in ticks; a pre-match RTT probe raises it
let net = null;   // {peer, conn, host, kind, started, tick, delay, acc, sendAcc,
                  //  sendTick, localQ, remoteQ, pend, rtt, stall, coop}
let netMsgEl = 'netMsg';   // which menu box speaks — the duel's or the co-op's
function netStatus(msg, bad) {
  const el = document.getElementById(netMsgEl);
  if (el) { el.textContent = msg || ''; el.style.color = bad ? 'var(--red)' : 'var(--gold)'; }
}
function netCoop() { return !!(net && net.coop); }
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
  setSimSeed(null);   // offline play rolls free dice again
  try { n.conn && n.conn.close(); } catch (e) {}
  try { n.peer && n.peer.destroy(); } catch (e) {}
}
function netDropped(msg) {
  const wasLive = net && net.started;
  const wasCoop = net && net.coop;
  netCleanup();
  if (wasLive && (game.mode === 'duel' || wasCoop)) {
    setBanner('the line is severed', 2.5);
    returnToMenu();
    netStatus(msg || (wasCoop ? 'connection lost — the storm scatters'
                              : 'connection lost — the duel ends'), true);
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
    if (net.host) {
      netStatus(net.kind === 'coop' ? 'a second blade arrives — stringing the wire…'
                                    : 'challenger connected — crossing blades…');
    } else if (net.kind === 'coop') {
      // the guest fights as P2 — their co-op picks ride the join
      conn.send({ t: 'join', kind: 'coop',
                  blade: menuSel.p2Blade, bow: menuSel.p2Bow });
    } else {
      conn.send({ t: 'join', kind: 'duel',
                  blade: menuSel.p1Blade, bow: menuSel.p1Bow });
    }
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
function hostGame(kind) {
  if (net) netCleanup();
  netMsgEl = kind === 'coop' ? 'coopNetMsg' : 'netMsg';
  loadPeerJS(err => {
    if (err) return netStatus(err, true);
    const code = Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(0, 5) || 'inkbl';
    const peer = new window.Peer('inkblade-' + code, { config: ICE_CONFIG });
    net = { peer, host: true, started: false, code, kind };
    peer.on('open', () =>
      netStatus('room code: ' + code.toUpperCase() +
        (kind === 'coop' ? ' — send it to your partner and wait'
                         : ' — send it to your challenger and wait')));
    peer.on('connection', c => { if (net) wireConn(c); });
    peer.on('error', e => netDropped('signal failed (' + (e && e.type || 'error') + ')'));
  });
}
function hostDuel() { hostGame('duel'); }
function hostCoop() { hostGame('coop'); }
function joinDuel(code) { joinGame('duel', code); }
function joinCoop(code) { joinGame('coop', code); }
function joinGame(kind, code) {
  if (net) netCleanup();
  netMsgEl = kind === 'coop' ? 'coopNetMsg' : 'netMsg';
  code = (code || '').trim().toLowerCase();
  if (!code) return netStatus('enter the host’s code first', true);
  loadPeerJS(err => {
    if (err) return netStatus(err, true);
    const peer = new window.Peer({ config: ICE_CONFIG });
    net = { peer, host: false, started: false, kind };
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
    if ((d.kind || 'duel') !== net.kind) {
      try { net.conn.send({ t: 'kindErr', want: net.kind }); } catch (e) {}
      netStatus(net.kind === 'coop'
        ? 'that code answered a duelist — this room hosts a co-op storm'
        : 'that code answered a co-op partner — this room hosts a duel', true);
      return;
    }
    // measure the wire before the first blade is drawn — the round trip
    // sizes the input delay for the whole match
    net.guestBlade = d.blade;
    net.guestBow = d.bow;
    netStatus('measuring the wire…');
    net.conn.send({ t: 'probe', ts: performance.now() });
  } else if (d.t === 'kindErr' && !net.host) {
    netDropped(d.want === 'coop'
      ? 'that room hosts a co-op storm — join it from the CO-OP door'
      : 'that room hosts a duel — join it from the DUEL door');
  } else if (d.t === 'probe' && !net.host) {
    net.conn.send({ t: 'probeAck', ts: d.ts });
  } else if (d.t === 'probeAck' && net.host && !net.started) {
    const rtt = performance.now() - d.ts;
    net.rtt = rtt;
    // one-way trip in ticks, plus two of headroom — a 40ms wire plays at
    // the old feel (3), a 200ms wire flows at 8 instead of stuttering
    const delay = clamp(Math.round(rtt / 2 / (1000 / 60)) + 2, NET_DELAY, 9);
    if (net.kind === 'coop') {
      // the storm is the host's: seed, ledger, mode and burdens all ride
      // the start message so both sims are born identical
      const cfg = {
        t: 'coopStart', delay,
        seed: (Math.random() * 0x7fffffff) | 0 || 1,
        mode: menuSel.mode === 'rush' ? 'rush' : 'infinite',
        chaos: !!menuSel.chaos,
        diff: menuSel.diff, curses: menuSel.curses.slice(),
        p2Blade: net.guestBlade, p2Bow: net.guestBow,
        save: JSON.parse(JSON.stringify(save)),
      };
      net.conn.send(cfg);
      startOnlineCoop(cfg);
    } else {
      net.conn.send({ t: 'start', hostBlade: menuSel.p1Blade, guestBlade: net.guestBlade,
                      hostBow: menuSel.p1Bow, guestBow: net.guestBow,
                      mut: menuSel.mut, delay });
      startOnlineDuel(menuSel.p1Blade, net.guestBlade, menuSel.mut, delay,
                      menuSel.p1Bow, net.guestBow);
    }
  } else if (d.t === 'start' && !net.host && !net.started) {
    startOnlineDuel(d.hostBlade, d.guestBlade, d.mut, d.delay, d.hostBow, d.guestBow);
  } else if (d.t === 'coopStart' && !net.host && !net.started) {
    startOnlineCoop(d);
  } else if (d.t === 'in') {
    net.remoteQ[d.k] = d.b;
  } else if (d.t === 'bless') {
    // the host's shrine pick — apply now if our sim has reached the
    // shrine, or hold it until our tick opens the scroll (unordered wire)
    if (net.coop && !net.host) {
      if (game.state === 'shrine') pickBlessing(d.id);
      else net.blessQ = { id: d.id };
    }
  } else if (d.t === 'blessClose') {
    if (net.coop && !net.host) {
      if (game.state === 'shrine') closeShrine();
      else net.blessQ = { close: true };
    }
  } else if (d.t === 'pause') {
    if (net.coop && game.state === 'playing') pauseGame();
  } else if (d.t === 'resume') {
    if (net.coop && game.state === 'paused') resumeGame();
  } else if (d.t === 'ck') {
    if (net.started && net.coop) {
      net.ckRemote[d.k] = d.h;
      netCkCompare();
    }
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
/* ---------- 二人 online co-op: one storm, two houses ---------- */
function startOnlineCoop(cfg) {
  if (!net) return;
  if (!net.host) borrowSave(cfg.save);   // the guest fights on the host's ledger
  menuSel.diff = clamp(cfg.diff | 0, 1, 10);
  menuSel.curses = Array.isArray(cfg.curses) ? cfg.curses.slice() : [];
  menuSel.chaos = !!cfg.chaos;
  menuSel.p2Blade = WEAPONS[cfg.p2Blade] && !WEAPONS[cfg.p2Blade].admin
    ? cfg.p2Blade : 'tetsu';
  menuSel.p2Bow = BOWS[cfg.p2Bow] ? cfg.p2Bow : 'shortbow';
  net.coop = true;
  setSimSeed(cfg.seed);                  // every sim roll now comes from here
  startRun(cfg.mode === 'rush' ? 'rush' : 'infinite');
  // the brush cannot reach across the wire — its casts ride keyups, not ticks
  if (game.equipped === 'fudemaru') game.equipped = 'tetsu';
  player.netCtl = { mx: 0, my: 0 };
  p2.netCtl = { mx: 0, my: 0 };
  Object.assign(net, {
    started: true, tick: 0, acc: 0, sendAcc: 0,
    delay: clamp(cfg.delay || NET_DELAY, NET_DELAY, 9),
    localQ: {}, remoteQ: {},
    pend: { atk: false, roll: false, parry: false, ult: false,
            swap: false, stance: false, interact: false },
    rtt: net.rtt || 0, stall: false, pingT: 0,
    ckLocal: {}, ckRemote: {}, blessQ: null,
  });
  for (let k = 0; k < net.delay; k++) {
    net.localQ[k] = 0;
    try { net.conn.send({ t: 'in', k, b: 0 }); } catch (e) {}
  }
  net.sendTick = net.delay;
  setBanner('二人 ONLINE — the storm takes two houses', 2.4);
}
// a cheap positional digest — identical sims give identical doubles, so
// any mismatch means the lockstep broke and the line should own up to it
function coopChecksum() {
  let h = hash2(game.wave | 0, (game.stage | 0) + enemies.length * 31 + 7);
  const mix = v => { h = hash2(h, (Math.round(v * 64) | 0) + 0x9e37); };
  for (const P of allPlayers()) { mix(P.x); mix(P.y); mix(P.hp); mix(P.st); }
  for (const e of enemies) if (!e.dead) { mix(e.x); mix(e.y); mix(e.hp); }
  mix(game.honor);
  return h >>> 0;
}
function netCkCompare() {
  if (!net || !net.ckLocal) return;
  for (const k in net.ckRemote) {
    if (net.ckLocal[k] === undefined) continue;
    const same = net.ckLocal[k] === net.ckRemote[k];
    delete net.ckRemote[k]; delete net.ckLocal[k];
    if (!same) { netDropped('the sims drifted apart — the line owns up and lets go'); return; }
  }
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
  if (net.pend.interact) b |= 4096;    // co-op: E rides the wire (host's P1)
  net.pend.atk = net.pend.roll = net.pend.parry =
    net.pend.ult = net.pend.swap = net.pend.stance = net.pend.interact = false;
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
  if (net && net.coop) {
    // samurai speak the PvE tongue: 奥義 and shrine doors are P1's alone,
    // the bow stance belongs to both; the brush swap has no meaning here
    if ((b & 128) && f === player) activateUlt();
    if (b & 1024) toggleStanceFor(f);
    if ((b & 4096) && f === player) tryInteract();
  } else {
    if (b & 128) toggleFighterUlt(f);    // brush maw — or the 奥義 art on a plain blade
    if (b & 256) toggleFighterSwap(f);
    if (b & 1024) toggleFighterStance(f);
  }
}
function commitLocal(k) {   // sample now, remember, and put it on the wire
  if (net.localQ[k] !== undefined) return;
  const b = sampleLocalBits();
  net.localQ[k] = b;
  try { net.conn.send({ t: 'in', k, b }); } catch (e) {}
}
function netFrame(rawDt) {
  // a hanging scroll (shrine, pause, game over) freezes the lockstep on
  // BOTH sims at the same tick — stepping through one would let the two
  // simulations apply the pick at different ticks and drift
  if (game.state !== 'playing') return;
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
    const mine = net.coop ? (net.host ? player : p2) : (net.host ? duel.p1 : duel.p2);
    const theirs = net.coop ? (net.host ? p2 : player) : (net.host ? duel.p2 : duel.p1);
    applyBits(mine, net.localQ[k]);
    applyBits(theirs, net.remoteQ[k]);
    update(1 / 60);                            // both branches are deterministic
    if (!net) return;                          // the step may have ended everything
    net.tick++;
    net.acc = Math.max(0, net.acc - 1 / 60);
    steps++;
    if (net.coop && net.tick % 300 === 0) {    // a positional digest each 5s
      const h = coopChecksum();
      net.ckLocal[net.tick] = h;
      try { net.conn.send({ t: 'ck', k: net.tick, h }); } catch (e) {}
      netCkCompare();
      if (!net) return;                        // the digest may have severed the line
    }
    // an interact bit can open a scroll mid-step (shrine, game over) — both
    // sims break here on the same tick and resume together when it closes
    if (game.state !== 'playing') break;
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

