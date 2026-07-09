/* ---------- enemies: finite-state machines ----------
   Shared FSM: spawn → approach → circle → (token) → advance → windup →
   attack → recover → retreat …  plus hurt / feint / aim per type.
   Subclasses tune parameters and override states, so new enemy types
   drop in without touching core logic.                                   */
let enemies = [];

class Enemy {
  constructor(x, y) {
    this.x = x; this.y = y; this.r = 14;
    this.kbx = 0; this.kby = 0;
    this.hp = 30; this.maxHp = 30;
    this.speed = 120; this.color = C_GRUNT;
    const t0 = nearestPlayerTo(x, y);   // co-op: face whichever blade is near
    this.face = Math.atan2(t0.y - y, t0.x - x);
    this.state = 'spawn'; this.stateT = 0;
    this.dead = false; this.flashT = 0; this.frozenT = 0;
    this.armored = false;
    this.tokenPool = () => meleeTokens;
    this.hasToken = false;
    // attack tuning (subclasses override)
    this.attackRange = 58; this.attackArc = 1.75; this.dmg = 10;
    this.windupBase = .55; this.activeDur = .16; this.recoverDur = .55;
    this.lungeSpeed = 260; this.heavy = false;
    this.holdDist = 130;
    this.didHit = false; this.dodgeAwarded = false;
    this.hitBy = 0;
    this.orbitDir = srandom() < .5 ? 1 : -1;
    this.orbitFlipT = rand(1.2, 2.8);
    // a stable seed for the ragged ink silhouette — sim stream, so both
    // lockstep sims brush the same body (render reads it, never rolls)
    this.inkSeed = Math.floor(srandom() * 1e9);
    this.honorKill = 40;
    this.weapon = 'club';
    // posture: fills as hits land, drains when left alone; full = broken stance
    this.posture = 0; this.postureMax = 40; this.postureDrain = 8;
    this.lastPostureHit = -9; this.brokenT = 0;
  }
  /* --- plumbing --- */
  setState(s, extra) {
    this.state = s; this.stateT = 0;
    const fn = this['enter_' + s];
    if (fn) fn.call(this, extra);
  }
  // CO-OP CHOKEPOINT: every distance/angle/pursuit question about "the
  // player" routes through tgt() — the nearest living, standing blade.
  // Solo this is always `player`, so nothing changes for one samurai.
  tgt() { return nearestPlayerTo(this.x, this.y); }
  d() { const T = this.tgt(); return dist(this.x, this.y, T.x, T.y); }
  angTo() { const T = this.tgt(); return Math.atan2(T.y - this.y, T.x - this.x); }
  facePlayer(rate, dt) {
    this.face += clamp(angDiff(this.face, this.angTo()), -rate * dt, rate * dt);
  }
  moveToward(tx, ty, sp, dt) {
    const dx = tx - this.x, dy = ty - this.y;
    const l = Math.hypot(dx, dy);
    if (l < 2) return;
    this.x += dx / l * sp * dt; this.y += dy / l * sp * dt;
  }
  foeName() {   // how the death scroll speaks of this foe
    if (this.bossName) return this.bossName;
    const n = this.constructor.name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
    return (this.elite ? 'an elite ' : 'a ') + n;
  }
  grabToken() {
    if (this.hasToken) return true;
    if (this.tokenPool().request(this)) { this.hasToken = true; return true; }
    return false;
  }
  dropToken() {
    if (this.hasToken) { this.tokenPool().release(this); this.hasToken = false; }
  }
  update(dt) {
    if (this.dead) return;
    if (this.frozenT > 0) {           // 無 — the state machine holds its breath
      this.frozenT -= dt;
      this.flashT = Math.max(0, this.flashT - dt);
      return;
    }
    this.stateT += dt;
    this.flashT = Math.max(0, this.flashT - dt);
    this.brokenT = Math.max(0, this.brokenT - dt);
    // posture drains once the pressure lets up
    if (this.posture > 0 && game.time - this.lastPostureHit > 1.2)
      this.posture = Math.max(0, this.posture - this.postureDrain * dt);
    this.kbx *= Math.exp(-8 * dt); this.kby *= Math.exp(-8 * dt);
    this.x += this.kbx * dt; this.y += this.kby * dt;
    const fn = this['st_' + this.state];
    if (fn) fn.call(this, dt);
    // 奥 the ASCENDANT SURGE — an enemy ultimate state: at half health a
    // marked foe erupts (faster windups, +25% cruelty, neon crackle) for
    // six seconds. Counterplay is the player's own grammar: crack its
    // POSTURE and the surge is snuffed early.
    if (this.ascSurge && !this.surgeUsed && this.hp <= this.maxHp * .5) {
      this.surgeUsed = true;
      this.surgeT = 6;
      this.dmgPreSurge = this.dmg;
      this.dmg = Math.round(this.dmg * 1.25);
      addText(this.x, this.y - this.r - 24, '奥 SURGE!', '#7c5cff', 16);
      particles.push({ kind: 'ring', x: this.x, y: this.y, t: 0, life: .5,
        color: 'rgba(124,92,255,.7)', r0: this.r, r1: this.r + 90, w: 3 });
      freeze(.08); shake(6);
      playSfx('surge');
    }
    if (this.surgeT > 0) {
      this.surgeT -= dt;
      if (Math.random() < dt * 14)   // cosmetic crackle only
        particles.push({ kind: 'line',
          x: this.x + crand(-this.r, this.r), y: this.y + crand(-this.r, this.r),
          vx: crand(-70, 70), vy: crand(-70, 70),
          t: 0, life: .14, color: 'rgba(124,92,255,.8)', w: 1.3 });
      if (this.surgeT <= 0 || this.brokenT > 0) {   // a break snuffs the surge
        if (this.brokenT > 0 && this.surgeT > 0)
          addText(this.x, this.y - this.r - 22, 'surge broken!', GOLD, 13);
        this.surgeT = 0;
        if (this.dmgPreSurge) this.dmg = this.dmgPreSurge;
      }
    }
    // lords SMOLDER — ink-smoke wisps rise off the body (cosmetic die only)
    if (this.isBoss && Math.random() < dt * 2)
      particles.push({ kind: 'dot',
        x: this.x + crand(-this.r * .7, this.r * .7), y: this.y - this.r * .6,
        vx: crand(-6, 6), vy: crand(-34, -18),
        t: 0, life: crand(.7, 1.3), color: 'rgba(43,35,32,.35)',
        rad: crand(1.5, 3) });
    // elite damage aura — a seared ring every blade must respect
    if (this.affix === 'aura' && !this.dead) {
      this.auraTick = Math.max(0, (this.auraTick || 0) - dt);
      if (this.auraTick <= 0) {
        for (const P of alivePlayers()) {
          if (dist(this.x, this.y, P.x, P.y) >= 64 + P.r) continue;
          this.auraTick = .9;
          if (damageSamurai(P, Math.max(2, Math.round(3 * game.curDmgMul)),
                            Math.atan2(P.y - this.y, P.x - this.x), false,
                            'a searing aura'))
            addText(P.x, P.y - 40, 'seared!', RED, 11);
        }
      }
    }
    clampArena(this);
  }
  addPosture(n) {
    if (this.dead || this.brokenT > 0 || n <= 0) return;
    this.posture += n;
    this.lastPostureHit = game.time;
    if (this.posture >= this.postureMax) this.postureBreak();
  }
  postureBreak() {
    // the stance shatters — a long stagger, armor or no, every hit a critical
    this.posture = 0;
    this.brokenT = 1.5;
    this.dropToken();
    this.hurtDur = 1.5;
    this.setState('hurt');
    save.stats.postureBreaks++;
    if (save.stats.postureBreaks >= 10) award('break10');
    addText(this.x, this.y - this.r - 18, '崩 BREAK!', GOLD, 16);
    particles.push({ kind: 'ring', x: this.x, y: this.y, t: 0, life: .45,
      color: 'rgba(168,132,58,.75)', r0: this.r, r1: this.r + 46, w: 3 });
    // the crack itself flashes imperial gold — the pigment rule for breaks
    particles.push({ kind: 'ring', x: this.x, y: this.y, t: 0, life: .28,
      color: 'rgba(245,194,66,.9)', r0: this.r - 4, r1: this.r + 26, w: 2 });
    sparks(this.x, this.y, rand(0, TAU), PAL.pigment.imperialGold, 10, Math.PI);
    freeze(.08); shake(5);
    playSfx('break');
  }
  getParried(byPl) {
    byPl = byPl || player;   // which blade turned the blow aside
    // the blade turned aside — knocked wide open, the answer is coming
    this.didHit = true;
    const away = Math.atan2(this.y - byPl.y, this.x - byPl.x);
    this.kbx += Math.cos(away) * 420; this.kby += Math.sin(away) * 420;
    this.dropToken();
    this.addPosture(25);
    if (!this.dead && this.brokenT <= 0) {
      this.hurtDur = .95;
      this.setState('hurt');
    }
    // the Tomb's Set Stance also steadies the answer: +1% window per step
    byPl.riposteT = 1.3 * (1 + blessVal('focus', 1, 1.8, 2.6))
                    * (1 + (byPl.p2 ? 0 : tombSteps('stance')) * .01);
    byPl.st = Math.min(byPl.maxSt, byPl.st + 14);
    if (!byPl.p2) { save.stats.parries++; award('firstParry'); }
    const mx = (this.x + byPl.x) / 2, my = (this.y + byPl.y) / 2;
    sparks(mx, my, away, PAL.pigment.imperialGold, 12, Math.PI);
    addText(mx, my - 18, '弾 parried!', GOLD, 15);
    freeze(.1); shake(5);
    playSfx('parry');
    const thornV = blessVal('thorn', 12, 24, 40);
    if (thornV && !this.dead) {   // thorned guard bites back
      this.hp -= thornV; this.flashT = .12;
      if (this.hp <= 0) this.die();
    }
  }
  hurt(dmg, ang, stun, pDmg = 8, src, arm) {
    if (this.dead || this.state === 'spawn') return;
    if (src) {
      this.lastHitBy = src;      // co-op: remember whose steel bit last
      this.lastHitArm = arm;     // …and WHICH arm — kills credit the true weapon
    }
    // mirror-touched elites: the mirror holds while it postures — its own
    // attack and recovery are the honest punish windows
    if (this.affix === 'mirrortouched' && this.brokenT <= 0 &&
        this.state !== 'attack' && this.state !== 'recover' && this.state !== 'hurt') {
      this.addPosture(pDmg * 1.25);
      this.flashT = .08;
      this.kbx += Math.cos(ang) * 70; this.kby += Math.sin(ang) * 70;
      addText(this.x, this.y - this.r - 12, 'mirrored', 'rgba(43,35,32,.65)', 12);
      playSfx('clash');
      return;
    }
    // shield ashigaru: frontal blows are turned aside — flank it or break it
    if (this.shielded && this.brokenT <= 0 &&
        Math.abs(angDiff(this.face, this.angTo())) < 1.15) {
      this.addPosture(pDmg * 1.3);
      this.flashT = .08;
      this.kbx += Math.cos(ang) * 90; this.kby += Math.sin(ang) * 90;
      sparks(this.x + Math.cos(this.face) * this.r, this.y + Math.sin(this.face) * this.r,
             ang, 'rgba(138,118,72,.9)', 5);
      addText(this.x, this.y - this.r - 12, 'blocked', 'rgba(43,35,32,.65)', 12);
      playSfx('clash');
      return;
    }
    this.hp -= dmg; this.flashT = .14;
    this.addPosture(pDmg);
    playSfx('thunk');
    if (this.hp <= 0) { this.die(); return; }
    if (this.armored && this.brokenT <= 0) {   // brutes shrug hits off — until broken
      this.kbx += Math.cos(ang) * 60; this.kby += Math.sin(ang) * 60;
      addText(this.x, this.y - this.r - 12, 'armor', 'rgba(43,35,32,.6)', 12);
    } else {
      // stun (Akaoni stagger / Raiko shock) extends the hurt stun and
      // cancels whatever the FSM was doing — windups included
      this.kbx += Math.cos(ang) * (stun ? 330 : 240);
      this.kby += Math.sin(ang) * (stun ? 330 : 240);
      this.dropToken();
      // while the stance is broken, stay staggered for the rest of the break
      this.hurtDur = Math.max(this.brokenT, .28 + (stun || 0));
      if (stun) addText(this.x, this.y - this.r - 12, 'staggered!', RED, 12);
      this.setState('hurt');
    }
  }
  die() {
    this.dead = true;
    this.dropToken();
    inkSplat(this.x, this.y);
    shake(3);
    save.stats.kills++;
    addUlt(8);   // a felled foe feeds the 奥義 meter
    const killer = this.lastHitBy || player;
    // credit the arm that actually landed the killing blow — a stormbow
    // kill tempers the stormbow, never the sword resting in the other hand
    const arm = this.lastHitArm || game.equipped;
    if (!killer.p2) {   // the second blade is progression-free
      save.stats.bladeKills[arm] = (save.stats.bladeKills[arm] || 0) + 1;
      grantWeaponXP(arm, this.isBoss ? 40 : 2);   // kills sharpen the arm used
      grantPlayerXP(this.isBoss ? 20 : 2);        // …and the hand behind it
    }
    award('firstBlood');
    const reapV = blessVal('reap', 12, 20, 28);
    if (reapV)   // the reaper's rhythm — stamina back on every kill
      killer.st = Math.min(killer.maxSt, killer.st + reapV);
    // the trash pays in TEMPER, visibly: a hot mote flies home from the
    // corpse to the hand that fed the blade — pure feedback, zero balance
    if (!killer.p2 && game.mode !== 'duel' && !this.ghost) {
      const ma = Math.atan2(killer.y - this.y, killer.x - this.x);
      const md = dist(this.x, this.y, killer.x, killer.y);
      particles.push({ kind: 'dot', x: this.x, y: this.y,
        vx: Math.cos(ma) * 360, vy: Math.sin(ma) * 360,
        t: 0, life: Math.min(.6, md / 360),
        color: 'rgba(168,132,58,.85)', rad: 2.4 });
      if (save.stats.kills % 3 === 0)
        addText(this.x, this.y - this.r - 6, '+temper', 'rgba(139,109,66,.85)', 11);
    }
    // elites are the only non-boss honor source — a small scatter
    if (this.elite && !this.isBoss) {
      spawnHonorOrbs(this.x, this.y, Math.max(10, Math.round(this.honorOrb * game.honorMult)));
      save.stats.elites++;
      if (save.stats.elites >= 10) award('elite10');
    }
    // honor falls only from bosses — a scatter of golden orbs to gather
    if (this.isBoss) {
      spawnHonorOrbs(this.x, this.y, Math.round(this.honorKill * game.honorMult));
      game.lastBossDeath = { x: this.x, y: this.y };
      // sword mastery: the lord must fall to P1's OWN drawn blade — a bow
      // kill or the second samurai's steel teaches this sword nothing
      if (game.equipped !== 'fudemaru' && !killer.p2 && arm === game.equipped
          && WEAPONS[arm]) {
        save.mastery[game.equipped] = (save.mastery[game.equipped] || 0) + 1;
        if (save.mastery[game.equipped] === 5) {
          setBanner('極 ' + WEAPONS[game.equipped].name + ' — MASTERED', 2.6);
          award('master1');
        }
      }
      onBossDeath(this);
    }
    game.comboPop = .25;
  }
  /* --- shared states --- */
  st_spawn(dt) { if (this.stateT > .7) this.setState('approach'); }
  st_hurt(dt) { if (this.stateT > (this.hurtDur || .28)) this.setState('approach'); }
  st_approach(dt) {
    this.facePlayer(8, dt);
    // a drawn bow is an invitation — foes press it hard
    this.moveToward(this.tgt().x, this.tgt().y, this.speed * (playerDrawing() ? 1.3 : 1), dt);
    if (this.d() < this.holdDist + 25) {
      if (this.grabToken()) this.setState('advance');
      else this.setState('circle');
    }
  }
  st_circle(dt) {
    // hold a respectful distance, orbit slowly — visible pressure, no pile-on
    this.facePlayer(8, dt);
    this.orbitFlipT -= dt;
    if (this.orbitFlipT <= 0) { this.orbitDir *= -1; this.orbitFlipT = rand(1.2, 3); }
    const d = this.d(), ang = this.angTo();
    const tang = ang + Math.PI / 2 * this.orbitDir;
    let vx = Math.cos(tang), vy = Math.sin(tang);
    const err = d - this.holdDist;
    vx += Math.cos(ang) * clamp(err * .03, -1, 1);
    vy += Math.sin(ang) * clamp(err * .03, -1, 1);
    const l = Math.hypot(vx, vy) || 1;
    const nx = this.x + vx / l * this.speed * .7 * dt;
    const ny = this.y + vy / l * this.speed * .7 * dt;
    // flip orbit when hugging a wall
    if (nx < ARENA.x + this.r + 4 || nx > ARENA.x + ARENA.w - this.r - 4 ||
        ny < ARENA.y + this.r + 4 || ny > ARENA.y + ARENA.h - this.r - 4) this.orbitDir *= -1;
    this.x = nx; this.y = ny;
    // the ring collapses on a drawn bow — no patient circling for archers-at-play
    if (this.stateT > (playerDrawing() ? .12 : .35) && this.grabToken()) this.setState('advance');
  }
  st_advance(dt) {
    this.facePlayer(9, dt);
    this.moveToward(this.tgt().x, this.tgt().y, this.speed * 1.25, dt);
    if (this.d() < this.attackRange - 6) this.setState('windup');
    else if (this.stateT > 2.6) { this.dropToken(); this.setState('circle'); }
  }
  enter_windup(opts) {
    opts = opts || {};
    // a surging foe winds up a third faster — bosses' explicit durations
    // feel it too, so the ultimate state tightens EVERY telegraph
    const tempo = this.surgeT > 0 ? 1.3 : 1;
    if (opts.dur !== undefined) opts.dur /= tempo;
    let stretch = 0;
    if (opts.dur === undefined && !opts.noDelay) stretch = adapt.extraDelay();
    this.wDur = opts.dur !== undefined ? opts.dur
      : this.windupBase / (eAggro() * tempo) + stretch;
    // the adaptive layer plays fair in the open: a stretched windup — its
    // counter to habitual reaction-dodgers — announces itself with a glint
    if (stretch > 0)
      addText(this.x, this.y - this.r - 26, '読', 'rgba(93,127,156,.85)', 12);
    // the very first raised weapon teaches the roll
    if (!this.ghost)
      hintOnce('roll', 'Shift — roll THROUGH the red arc as it falls');
    this.isFeint = opts.feint || false;
    adapt.windups++;
  }
  st_windup(dt) {
    // track the player early, lock aim late — dodging early gets read
    if (this.stateT < this.wDur * .6) this.facePlayer(3.5, dt);
    if (this.isFeint && this.stateT >= this.wDur * .55) {
      // cancel! hop back and watch for a wasted dodge
      const ang = this.angTo();
      this.kbx -= Math.cos(ang) * 200; this.kby -= Math.sin(ang) * 200;
      puff(this.x, this.y, 'rgba(93,127,156,.6)', 4);
      this.setState('feintwait');
      return;
    }
    if (this.stateT >= this.wDur) this.setState('attack');
  }
  enter_attack() {
    this.didHit = false; this.dodgeAwarded = false;
    this.kbx += Math.cos(this.face) * this.lungeSpeed;
    this.kby += Math.sin(this.face) * this.lungeSpeed;
  }
  st_attack(dt) {
    // the swing threatens every blade in the arc — co-op included
    for (const P of alivePlayers()) {
      if (this.didHit) break;
      if (!inArc(this.x, this.y, this.face, this.attackRange + this.r, this.attackArc,
                 P.x, P.y, P.r)) continue;
      const angP = Math.atan2(P.y - this.y, P.x - this.x);
      if (P.dodgeInv) {
        if (!this.dodgeAwarded) {
          this.dodgeAwarded = true;
          onPerfectDodge(P);
        }
      } else if (samuraiParryActive(P)) {
        if (this.heavy) {
          // too much iron behind it — the guard is crushed, dodge these
          this.didHit = true;
          P.action = null;
          if (damageSamurai(P, Math.max(1, Math.round(this.dmg * .5)), angP, true,
                            this.foeName()))
            addText(P.x, P.y - 42, 'crushed!', RED, 13);
        } else this.getParried(P);
      } else if (P.iT <= 0) {
        this.didHit = damageSamurai(P, this.dmg, angP, this.heavy, this.foeName());
      }
    }
    if (this.stateT >= this.activeDur) { this.dropToken(); this.setState('recover'); }
  }
  st_recover(dt) {
    if (this.stateT >= this.recoverDur)
      this.setState(srandom() < .3 ? 'retreat' : 'approach');
  }
  st_retreat(dt) {
    const ang = this.angTo();
    this.moveToward(this.x - Math.cos(ang) * 50, this.y - Math.sin(ang) * 50, this.speed * .8, dt);
    if (this.stateT > .6) this.setState('circle');
  }
  st_feintwait(dt) { /* duelist overrides; default: resume */
    if (this.stateT > .3) { this.dropToken(); this.setState('circle'); }
  }
}

/* --- Grunt: aggressive, honest melee. Teaches the timing. --- */
class Grunt extends Enemy {
  constructor(x, y) {
    super(x, y);
    this.hp = this.maxHp = 30;
    this.speed = 125; this.color = C_GRUNT;
    this.attackRange = 58; this.attackArc = 1.75; this.dmg = 10;
    this.windupBase = .58; this.activeDur = .16; this.recoverDur = .6;
    this.holdDist = 120; this.honorKill = 40;
    this.weapon = 'club';
    this.postureMax = 40;
  }
}

/* --- Duelist: spacing, strafing, feints, punishes. --- */
class Duelist extends Enemy {
  constructor(x, y) {
    super(x, y);
    this.hp = this.maxHp = 40; this.r = 13;
    this.speed = 155; this.color = C_DUELIST;
    this.attackRange = 72; this.attackArc = 1.1; this.dmg = 12;
    this.windupBase = .5; this.activeDur = .13; this.recoverDur = .5;
    this.lungeSpeed = 380; this.holdDist = 135;
    this.honorKill = 70; this.weapon = 'rapier';
    this.circlePatience = rand(1.2, 2.4);
    this.postureMax = 55;
  }
  playerIsPunishable() {
    const T = this.tgt(), a = T.action;
    return (a && a.type === 'attack' && a.t > a.startup + a.active) ||  // swing recovery
           (a && a.type === 'parry' && a.t > PARRY.active) ||           // whiffed parry
           T.dodgeRecoverT > 0;                                        // roll recovery
  }
  st_circle(dt) {
    this.facePlayer(9, dt);
    // pounce on recovery frames the instant a token is free
    if (this.playerIsPunishable() && this.d() < 185 && this.grabToken()) {
      this.punishNext = true;
      this.setState('advance');
      return;
    }
    this.circlePatience -= dt;
    if (this.circlePatience <= 0 && this.grabToken()) {
      this.circlePatience = rand(1.2, 2.4);
      this.setState('advance');
      return;
    }
    super.st_circle(dt);
  }
  st_advance(dt) {
    this.facePlayer(10, dt);
    this.moveToward(this.tgt().x, this.tgt().y, this.speed * 1.45, dt);
    if (this.d() < this.attackRange - 4) {
      if (this.punishNext) {
        this.punishNext = false;
        this.setState('windup', { dur: .28, noDelay: true });   // fast punish stab
      } else {
        const feint = srandom() < adapt.feintChance(.22);
        this.setState('windup', { feint });
      }
    } else if (this.stateT > 2.2) { this.dropToken(); this.setState('circle'); }
  }
  st_feintwait(dt) {
    // if the feint baited a roll, strike the recovery window
    const T = this.tgt();
    const baited = game.time - T.lastDodgeStart < .55 &&
                   game.time - T.lastDodgeStart > 0;
    if (baited && this.stateT > .18) {
      addText(this.x, this.y - this.r - 12, 'read!', C_DUELIST, 13);
      this.setState('windup', { dur: .26, noDelay: true });
      return;
    }
    if (this.stateT > .45) { this.dropToken(); this.setState('circle'); }
  }
}

/* --- Brute: slow, armored, huge unblockable sweep — dodge it. --- */
class Brute extends Enemy {
  constructor(x, y) {
    super(x, y);
    this.hp = this.maxHp = 100; this.r = 22;
    this.speed = 62; this.color = C_BRUTE;
    this.armored = true; this.heavy = true;
    this.attackRange = 105; this.attackArc = 2.9; this.dmg = 26;
    this.windupBase = 1.05; this.activeDur = .22; this.recoverDur = 1.15;
    this.lungeSpeed = 160; this.holdDist = 95;
    this.honorKill = 120; this.weapon = 'slab';
    this.postureMax = 90;   // the armor's true weakness
  }
  enter_windup(opts) {
    // heavy attacks barely speed up with aggression — reading them stays fair
    super.enter_windup(Object.assign({ dur: this.windupBase / Math.sqrt(eAggro()) }, opts));
  }
  st_circle(dt) {  // brutes don't dance — they loom, then push in
    this.facePlayer(5, dt);
    const d = this.d();
    if (d > this.holdDist + 10) this.moveToward(this.tgt().x, this.tgt().y, this.speed * .6, dt);
    if (this.stateT > .4 && this.grabToken()) this.setState('advance');
  }
}

/* --- Archer: max distance, predictive shots, repositions under pressure. --- */
class Archer extends Enemy {
  constructor(x, y) {
    super(x, y);
    this.hp = this.maxHp = 26; this.r = 12;
    this.speed = 135; this.color = C_ARCHER;
    this.tokenPool = () => rangedTokens;
    this.honorKill = 60; this.weapon = 'bow';
    this.fireCd = rand(.8, 2);      // random phase staggers volleys
    this.arrowSpeed = 340;
    this.arrowDmg = 9;
    this.aimDur = .55;
    this.holdDist = 330;
    this.postureMax = 35;
  }
  st_approach(dt) { this.setState('band'); }
  st_hurt(dt) { if (this.stateT > (this.hurtDur || .28)) this.setState('band'); }
  st_retreat(dt) { this.setState('band'); }
  st_circle(dt) { this.setState('band'); }
  st_band(dt) {
    this.facePlayer(10, dt);
    const d = this.d(), ang = this.angTo();
    this.fireCd -= dt;
    if (d < 200) {
      // player closing in — flee, angling along a tangent to slip corners
      const tang = ang + Math.PI + Math.PI / 4 * this.orbitDir;
      const nx = this.x + Math.cos(tang) * this.speed * 1.2 * dt;
      const ny = this.y + Math.sin(tang) * this.speed * 1.2 * dt;
      if (nx < ARENA.x + 30 || nx > ARENA.x + ARENA.w - 30 ||
          ny < ARENA.y + 30 || ny > ARENA.y + ARENA.h - 30) this.orbitDir *= -1;
      this.x = nx; this.y = ny;
    } else if (d > 430) {
      this.moveToward(this.tgt().x, this.tgt().y, this.speed * .8, dt);
    } else {
      // in the band: sidestep lazily so they're never a static turret
      this.orbitFlipT -= dt;
      if (this.orbitFlipT <= 0) { this.orbitDir *= -1; this.orbitFlipT = rand(1.5, 3.5); }
      const tang = ang + Math.PI / 2 * this.orbitDir;
      this.x += Math.cos(tang) * this.speed * .4 * dt;
      this.y += Math.sin(tang) * this.speed * .4 * dt;
    }
    if (this.fireCd <= 0 && d > 170 && this.grabToken()) this.setState('aim');
  }
  enter_aim() { this.aimT = this.aimDur / eAggro(); adapt.windups++; }
  st_aim(dt) {
    // keep re-predicting until loosing — the telegraph shows the true line
    const T = this.tgt();
    const lead = aimLead(T.x, T.y, T.vx, T.vy,
                         this.x, this.y, this.arrowSpeed);
    this.face = Math.atan2(lead.y - this.y, lead.x - this.x);
    if (this.d() < 110 && srandom() < .5) {   // pressured: bail out
      this.dropToken();
      this.fireCd = .8;
      const ang = this.angTo();
      this.kbx -= Math.cos(ang) * 320; this.kby -= Math.sin(ang) * 320;
      this.setState('band');
      return;
    }
    if (this.stateT >= this.aimT) {
      // split-affix elites loose a three-arrow fan
      const nA = this.affix === 'split' ? 3 : 1;
      for (let s = 0; s < nA; s++) {
        const fa = this.face + (s - (nA - 1) / 2) * .26;
        projectiles.push({
          x: this.x + Math.cos(fa) * (this.r + 6),
          y: this.y + Math.sin(fa) * (this.r + 6),
          vx: Math.cos(fa) * this.arrowSpeed,
          vy: Math.sin(fa) * this.arrowSpeed,
          dead: false, dodgeAwarded: false,
          kind: 'arrow', dmg: this.arrowDmg, deflectable: true,
          chain: this.stormTouched || false,
        });
      }
      playSfx('bow');
      this.dropToken();
      this.fireCd = rand(1.9, 2.7) / eAggro();
      this.setState('recover');
    }
  }
  st_recover(dt) { if (this.stateT > .35) this.setState('band'); }
}

/* --- Shinobi: smoke-steps behind you — the smoke itself is the warning. --- */
class Shinobi extends Enemy {
  constructor(x, y) {
    super(x, y);
    this.hp = this.maxHp = 22; this.r = 11;
    this.speed = 175; this.color = C_SHINOBI;
    this.attackRange = 48; this.attackArc = 1.4; this.dmg = 7;
    this.windupBase = .4; this.activeDur = .12; this.recoverDur = .5;
    this.lungeSpeed = 300; this.holdDist = 155;
    this.honorKill = 55; this.weapon = 'knife';
    this.postureMax = 30;
    this.vanishCd = rand(.5, 2);
  }
  st_circle(dt) {
    this.vanishCd -= dt;
    if (this.vanishCd <= 0 && this.grabToken()) {
      this.setState('vanishprep');
      return;
    }
    super.st_circle(dt);
  }
  enter_vanishprep() {
    // the landing spot is marked BEFORE the step — smoke is the telegraph
    const T = this.tgt();
    const behind = T.face + Math.PI;
    this.dest = {
      x: clamp(T.x + Math.cos(behind) * 64, ARENA.x + this.r + 6, ARENA.x + ARENA.w - this.r - 6),
      y: clamp(T.y + Math.sin(behind) * 64, ARENA.y + this.r + 6, ARENA.y + ARENA.h - this.r - 6),
    };
    puff(this.dest.x, this.dest.y, 'rgba(76,72,80,.55)', 8);
  }
  st_vanishprep(dt) {
    // crouched still; smoke gathers where the strike will come from
    if (Math.random() < dt * 24)
      puff(this.dest.x, this.dest.y, 'rgba(76,72,80,.4)', 2);
    if (this.stateT >= .55) {
      puff(this.x, this.y, 'rgba(76,72,80,.6)', 8);
      this.x = this.dest.x; this.y = this.dest.y;
      this.face = this.angTo();
      this.vanishCd = rand(2.2, 3.6);
      playSfx('vanish');
      this.setState('windup', { dur: .38 / eAggro(), noDelay: true });
    }
  }
  st_recover(dt) {
    if (this.stateT >= this.recoverDur) this.setState('retreat');
  }
}

/* --- Shield Ashigaru: a walking wall with a spear. Flank it or break it. --- */
class ShieldAshigaru extends Enemy {
  constructor(x, y) {
    super(x, y);
    this.hp = this.maxHp = 46; this.r = 15;
    this.speed = 92; this.color = C_ASHIGARU;
    this.shielded = true;
    this.attackRange = 84; this.attackArc = .9; this.dmg = 12;
    this.windupBase = .62; this.activeDur = .15; this.recoverDur = .8;
    this.lungeSpeed = 340; this.holdDist = 105;
    this.honorKill = 80; this.weapon = 'spear';
    this.postureMax = 70;
  }
  st_circle(dt) {  // no dancing — a slow, square-shouldered advance
    this.facePlayer(6, dt);
    if (this.d() > this.holdDist) this.moveToward(this.tgt().x, this.tgt().y, this.speed * .8, dt);
    if (this.stateT > .5 && this.grabToken()) this.setState('advance');
  }
}

/* --- the Tomb's ghost-flicker striker: a faint figure that exists only
   to be PARRIED. Dodging merely delays it; a landed hit scars the trial.
   Windups tighten as the player's tomb sessions mount.                 --- */
class TombGhost extends Enemy {
  constructor(x, y, windup) {
    super(x, y);
    this.hp = this.maxHp = 1e9;
    this.r = 12; this.speed = 165; this.color = '#9a948c';
    this.attackRange = 66; this.attackArc = 1.6; this.dmg = 0;
    this.windupBase = windup; this.activeDur = .12; this.recoverDur = .3;
    this.lungeSpeed = 320; this.holdDist = 85; this.weapon = 'knife';
    this.ghost = true;
    this.postureMax = 1e9; this.honorKill = 0;
  }
  hurt() { /* steel passes through — only the guard answers a ghost */ }
  die() {
    this.dead = true;
    this.dropToken();
    puff(this.x, this.y, 'rgba(120,116,108,.6)', 10);
    playSfx('vanish');
  }
  st_attack(dt) {
    // the tomb is walked alone — the ghost answers only P1
    if (!this.didHit &&
        inArc(this.x, this.y, this.face, this.attackRange + this.r, this.attackArc,
              player.x, player.y, player.r)) {
      if (playerParryActive()) {
        this.didHit = true;
        save.stats.parries++;
        const mx = (this.x + player.x) / 2, my = (this.y + player.y) / 2;
        sparks(mx, my, this.angTo() + Math.PI, PAL.pigment.imperialGold, 10, Math.PI);
        addText(mx, my - 16, '弾', GOLD, 15);
        playSfx('parry');
        freeze(.06);
        tombGhostDown(true);
        this.die();
        return;
      } else if (!player.dodgeInv && player.iT <= 0) {
        this.didHit = true;
        damagePlayer(Math.max(3, Math.round(player.maxHp * .06)), this.angTo(), false,
                     'a tomb flicker');
        tombGhostDown(false);
        this.die();
        return;
      }
    }
    if (this.stateT >= this.activeDur) {
      this.dropToken();
      this.setState('approach');   // a dodged flicker circles back — parry it
    }
  }
}

/* --- training room fixtures: a tireless dummy and a telegraph drill --- */
class TrainingDummy extends Enemy {
  constructor(x, y) {
    super(x, y);
    this.hp = this.maxHp = 600; this.r = 17;
    this.color = '#9b8a68'; this.weapon = 'none';
    this.postureMax = 60;
    this.state = 'dummy';
    this.honorKill = 0;
  }
  st_spawn() { this.setState('dummy'); }
  st_dummy(dt) { this.facePlayer(4, dt); }
  st_hurt(dt) { if (this.stateT > (this.hurtDur || .28)) this.setState('dummy'); }
  st_approach() { this.setState('dummy'); }
  hurt(dmg, ang, stun, pDmg) {
    const before = this.hp;
    super.hurt(dmg, ang, stun, pDmg);
    const dealt = before - this.hp;
    if (dealt > 0 && game.training) {
      game.training.log.push({ t: game.time, dmg: dealt });
      game.training.total += dealt;
    }
  }
  die() {   // straw and rope — it only slumps, then stands again
    this.hp = this.maxHp;
    this.posture = 0; this.brokenT = 0;
    puff(this.x, this.y, 'rgba(155,138,104,.7)', 14);
    addText(this.x, this.y - this.r - 16, 'rebuilt', 'rgba(43,35,32,.6)', 12);
    this.setState('dummy');
  }
}
class TrainerBot extends Grunt {
  constructor(x, y) {
    super(x, y);
    this.hp = this.maxHp = 999; this.color = '#6d5f7e';
    this.dmg = 3;   // a teaching sting, not a wound
    this.waitT = rand(1, 3);
    this.reacted = false; this.windupAt = 0;
    this.honorKill = 0;
  }
  st_spawn() { this.setState('drill'); }
  st_approach() { this.setState('drill'); }
  st_circle() { this.setState('drill'); }
  st_retreat() { this.setState('drill'); }
  st_recover(dt) { if (this.stateT > .5) { this.waitT = rand(1, 3); this.setState('drill'); } }
  st_hurt(dt) { if (this.stateT > (this.hurtDur || .28)) this.setState('drill'); }
  st_drill(dt) {
    this.facePlayer(6, dt);
    this.waitT -= dt;
    if (this.waitT <= 0 && this.d() < 220) {
      this.windupAt = game.time;
      this.reacted = false;
      this.setState('windup', { dur: .6, noDelay: true });
    }
  }
  update(dt) {
    super.update(dt);
    // the drill: how fast did you answer the telegraph?
    if (this.state === 'windup' && !this.reacted && game.training) {
      const reactAt = Math.max(player.lastDodgeStart, player.lastParryStart || -99);
      if (reactAt > this.windupAt) {
        this.reacted = true;
        const ms = Math.round((reactAt - this.windupAt) * 1000);
        game.training.lastReact = ms;
        if (game.training.bestReact == null || ms < game.training.bestReact)
          game.training.bestReact = ms;
        addText(this.x, this.y - this.r - 18, ms + 'ms', GOLD, 13);
      }
    }
  }
  die() { this.hp = this.maxHp; this.setState('drill'); }
}

/* --- the Road's retinue: SKILL CHECKS, not stat sponges ---
   These two walk beside the ascension lords (and the deep storm): one
   demands posture play, the other demands the parry. Both die fast once
   their check is answered — the test is the lock, not the health bar. */
class MirrorGuard extends Enemy {
  // 鏡 — the mirror turns EVERY edge aside, from every angle. Only
  // posture passes; crack the stance and it dies like anything else.
  constructor(x, y) {
    super(x, y);
    this.hp = this.maxHp = 60; this.r = 15;
    this.speed = 120; this.color = '#6d7a80';
    this.attackRange = 62; this.attackArc = 1.5; this.dmg = 11;
    this.windupBase = .34; this.activeDur = .12; this.recoverDur = .42;
    this.lungeSpeed = 330; this.holdDist = 110;
    this.honorKill = 90; this.weapon = 'spear';
    this.postureMax = 70; this.postureDrain = 4;
    this.mirrorAll = true;
  }
  hurt(dmg, ang, stun, pDmg = 8, src, arm) {
    if (this.dead || this.state === 'spawn') return;
    if (this.brokenT <= 0) {
      if (src) { this.lastHitBy = src; this.lastHitArm = arm; }
      this.addPosture(pDmg * 1.5);   // steel feeds the stance, not the wound
      this.flashT = .08;
      this.kbx += Math.cos(ang) * 70; this.kby += Math.sin(ang) * 70;
      addText(this.x, this.y - this.r - 12, 'mirrored', 'rgba(43,35,32,.65)', 12);
      playSfx('clash');
      return;
    }
    super.hurt(dmg, ang, stun, pDmg, src, arm);
  }
}
class Duelmaster extends Duelist {
  // 要 — the flurry: three strikes, each re-tracking the samurai. A roll
  // buys one beat; only a PARRY (or a posture break) ends the sequence.
  constructor(x, y) {
    super(x, y);
    this.hp = this.maxHp = 55; this.r = 14;
    this.speed = 175; this.color = '#8a5a68';
    this.attackRange = 70; this.attackArc = 1.3; this.dmg = 9;
    this.windupBase = .42; this.activeDur = .12; this.recoverDur = .6;
    this.lungeSpeed = 420; this.holdDist = 140;
    this.honorKill = 110; this.weapon = 'rapier';
    this.postureMax = 60;
    this.chain = 0; this.chainMax = 3;
  }
  enter_attack() { super.enter_attack(); this.chain++; }
  enter_hurt() { this.chain = 0; }
  getParried(byPl) { this.chain = 0; super.getParried(byPl); }
  st_recover(dt) {
    if (this.chain > 0 && this.chain < this.chainMax && this.stateT > .12) {
      this.facePlayer(12, dt);   // the flurry hunts — re-track between strikes
      this.setState('windup', { dur: .24, noDelay: true });
      return;
    }
    if (this.stateT >= this.recoverDur) {
      this.chain = 0;
      this.setState(srandom() < .3 ? 'retreat' : 'approach');
    }
  }
}
const ENEMY_TYPES = { grunt: Grunt, duelist: Duelist, brute: Brute, archer: Archer,
                      shinobi: Shinobi, ashigaru: ShieldAshigaru,
                      mirror: MirrorGuard, duelmaster: Duelmaster };

/* ---------- bosses ----------
   Main bosses render ~2.5-3x normal size with proportionally longer
   telegraphs; the Twin Duelists run smaller (~2x) but come in pairs.
   Infinite Mode fields remixes via flags: reforged / coordinated /
   stormTouched / twinned spawns / ascendant.                            */
class GateSentinel extends Grunt {
  constructor(x, y) {
    super(x, y);
    this.isBoss = true; this.bossName = 'The Gate Sentinel';
    this.r = 36; this.hp = this.maxHp = 380; this.speed = 96;
    this.dmg = 18; this.attackRange = 132; this.attackArc = 1.9;
    this.windupBase = .85; this.activeDur = .2; this.recoverDur = .95;
    this.lungeSpeed = 320; this.holdDist = 150;
    this.honorKill = 600; this.reforged = false;
    this.postureMax = 160;
  }
  st_advance(dt) {
    this.facePlayer(9, dt);
    this.moveToward(this.tgt().x, this.tgt().y, this.speed * 1.35, dt);
    if (this.d() < this.attackRange + 10) {
      const T = this.dmgTuned || 1;
      if (srandom() < .42) {          // gate-slam: wide, heavy, slow
        this.attackRange = 168; this.attackArc = 2.7;
        this.dmg = Math.round(26 * T); this.heavy = true;
        this.setState('windup', { dur: 1.2 / Math.sqrt(eAggro()) });
      } else {                            // straight cut — feintable when reforged
        this.attackRange = 132; this.attackArc = 1.9;
        this.dmg = Math.round(18 * T); this.heavy = false;
        const feint = this.reforged && srandom() < adapt.feintChance(.3);
        this.setState('windup', { feint });
      }
    } else if (this.stateT > 3) { this.dropToken(); this.setState('circle'); }
  }
}

class TwinDuelist extends Duelist {
  constructor(x, y) {
    super(x, y);
    this.isBoss = true; this.bossName = 'The Twin Duelists';
    this.r = 26; this.hp = this.maxHp = 250;
    this.speed = 168; this.dmg = 16;
    this.attackRange = 112; this.attackArc = 1.15;
    this.windupBase = .62; this.activeDur = .15; this.recoverDur = .55;
    this.lungeSpeed = 470; this.holdDist = 170;
    this.honorKill = 400; this.coordinated = false;
    this.postureMax = 120;
  }
  st_circle(dt) {
    // Unbound: strike together whenever a sibling commits
    if (this.coordinated &&
        enemies.some(o => o !== this && !o.dead &&
                     (o.state === 'advance' || o.state === 'windup')) &&
        this.grabToken()) { this.setState('advance'); return; }
    super.st_circle(dt);
  }
}

class RoninArcher extends Archer {
  constructor(x, y) {
    super(x, y);
    this.isBoss = true; this.bossName = 'The Ronin Archer';
    this.r = 30; this.hp = this.maxHp = 430; this.speed = 190;
    this.arrowSpeed = 385; this.arrowDmg = 12;
    this.aimDur = .5; this.holdDist = 300;
    this.honorKill = 700;
    this.shots = 0; this.chargedShot = false; this.stormTouched = false;
    this.postureMax = 140;
  }
  enter_aim() {
    this.shots++;
    this.chargedShot = this.shots % 3 === 0;
    this.aimT = (this.chargedShot ? 1.2 : this.aimDur) / eAggro();
    adapt.windups++;
    if (this.chargedShot) addText(this.x, this.y - this.r - 16, 'charging…', RED, 13);
  }
  st_aim(dt) {
    if (!this.chargedShot) { super.st_aim(dt); return; }
    // charged shot: tracks early, locks late, cannot be deflected — dodge it
    if (this.stateT < this.aimT * .8) {
      const T = this.tgt();
      const lead = aimLead(T.x, T.y, T.vx, T.vy, this.x, this.y, 680);
      this.face = Math.atan2(lead.y - this.y, lead.x - this.x);
    }
    if (this.stateT >= this.aimT) {
      projectiles.push({
        x: this.x + Math.cos(this.face) * (this.r + 8),
        y: this.y + Math.sin(this.face) * (this.r + 8),
        vx: Math.cos(this.face) * 680, vy: Math.sin(this.face) * 680,
        dead: false, dodgeAwarded: false,
        kind: 'charged', dmg: Math.round(24 * (this.dmgTuned || 1)),
        deflectable: false, chain: this.stormTouched,
      });
      shake(4); freeze(.04);
      this.dropToken();
      this.fireCd = rand(1.4, 2) / eAggro();
      this.setState('recover');
    }
  }
  enter_recover() {
    // fast reposition — kick away along a tangent after every shot
    const ang = this.angTo() + Math.PI + rand(-.9, .9);
    this.kbx += Math.cos(ang) * 520; this.kby += Math.sin(ang) * 520;
    puff(this.x, this.y, 'rgba(110,143,82,.6)', 6);
  }
}

class IronBrute extends Brute {
  constructor(x, y) {
    super(x, y);
    this.isBoss = true; this.bossName = 'The Iron Brute';
    this.r = 55; this.hp = this.maxHp = 760; this.speed = 58;
    this.dmg = 30; this.attackRange = 180; this.attackArc = 3.0;
    this.windupBase = 1.3; this.activeDur = .26; this.recoverDur = 1.35;
    this.lungeSpeed = 200; this.holdDist = 135;
    this.honorKill = 800; this.slamNext = false;
    this.postureMax = 260;
  }
  st_advance(dt) {
    this.facePlayer(6, dt);
    this.moveToward(this.tgt().x, this.tgt().y, this.speed * 1.5, dt);
    if (this.d() < this.attackRange - 6) {
      const T = this.dmgTuned || 1;
      this.slamNext = srandom() < .45;
      if (this.slamNext) {   // earthbreaker: full-circle slam + expanding shock ring
        this.attackRange = 120; this.attackArc = TAU;
        this.dmg = Math.round(24 * T);
        this.setState('windup', { dur: 1.55 / Math.sqrt(eAggro()) });
      } else {               // the long sweep: nearly all-around, unblockable
        this.attackRange = 180; this.attackArc = 5.1;
        this.dmg = Math.round(30 * T);
        this.setState('windup', { dur: 1.3 / Math.sqrt(eAggro()) });
      }
    } else if (this.stateT > 3.6) { this.dropToken(); this.setState('circle'); }
  }
  enter_attack() {
    super.enter_attack();
    if (this.slamNext) {
      spawnShockwave(this.x, this.y, Math.round(22 * (this.dmgTuned || 1)));
      shake(10); freeze(.08);
      puff(this.x, this.y, 'rgba(43,35,32,.65)', 16);
    }
  }
}

class StormSovereign extends Enemy {
  constructor(x, y) {
    super(x, y);
    this.isBoss = true; this.bossName = 'The Storm Sovereign';
    this.r = 34; this.hp = this.maxHp = 950; this.speed = 165;
    this.color = '#4a3a6b'; this.weapon = 'rapier';
    this.attackRange = 122; this.attackArc = 1.5; this.dmg = 20;
    this.windupBase = .58; this.activeDur = .15; this.recoverDur = .5;
    this.lungeSpeed = 460; this.holdDist = 150;
    this.honorKill = 1500;
    this.ascendant = false; this.boltCd = 2.4; this.charging = 0;
    this.lastPhase = 1;
    this.postureMax = 200;
  }
  // phase 1: duelist blade-work · phase 2: + predictive lightning ·
  // phase 3: both, faster.  Ascendant remix: phase 3 from the first breath.
  phase() {
    if (this.ascendant) return 3;
    const f = this.hp / this.maxHp;
    return f > .66 ? 1 : f > .33 ? 2 : 3;
  }
  update(dt) {
    super.update(dt);
    if (this.dead || this.frozenT > 0 || this.state === 'spawn') return;
    const ph = this.phase();
    if (ph !== this.lastPhase) {
      this.lastPhase = ph;
      setBanner(ph === 2 ? 'the storm answers' : 'the sky splits open', 1.8);
      boltFX(this.x, this.y - 120, this.x, this.y);
      shake(6); freeze(.08);
    }
    if (ph >= 2) {
      if (this.charging > 0) {
        this.charging -= dt;
        if (Math.random() < dt * 26)
          sparks(this.x, this.y, rand(0, TAU), '#8fb4ff', 1, 3);
        if (this.charging <= 0) this.fireVolley();
      } else {
        this.boltCd -= dt * (ph === 3 ? 1.6 : 1);
        if (this.boltCd <= 0) {
          this.boltCd = rand(2.4, 3.6) / eAggro();
          this.charging = .55;              // crackle telegraph before the volley
          addText(this.x, this.y - this.r - 18, '雷', '#8fb4ff', 16);
        }
      }
    }
  }
  fireVolley() {
    const n = this.phase() === 3 ? 3 : 2;
    const T = this.tgt();
    for (let i = 0; i < n; i++) {
      const lead = aimLead(T.x, T.y, T.vx, T.vy, this.x, this.y, 430);
      const a = Math.atan2(lead.y - this.y, lead.x - this.x) + (i - (n - 1) / 2) * .22;
      projectiles.push({
        x: this.x + Math.cos(a) * (this.r + 8), y: this.y + Math.sin(a) * (this.r + 8),
        vx: Math.cos(a) * 430, vy: Math.sin(a) * 430,
        dead: false, dodgeAwarded: false,
        kind: 'bolt', dmg: Math.round(13 * (this.dmgTuned || 1)), deflectable: false,
      });
    }
    boltFX(this.x, this.y - 80, this.x, this.y);
    shake(3);
    playSfx('bolt');
  }
  playerIsPunishable() {
    const T = this.tgt(), a = T.action;
    return (a && a.type === 'attack' && a.t > a.startup + a.active) ||
           (a && a.type === 'parry' && a.t > PARRY.active) ||
           T.dodgeRecoverT > 0;
  }
  st_circle(dt) {
    this.facePlayer(10, dt);
    if (this.playerIsPunishable() && this.d() < 200 && this.grabToken()) {
      this.punishNext = true; this.setState('advance'); return;
    }
    if (this.stateT > (this.phase() === 3 ? .5 : .9) && this.grabToken()) {
      this.setState('advance'); return;
    }
    super.st_circle(dt);
  }
  st_advance(dt) {
    this.facePlayer(10, dt);
    this.moveToward(this.tgt().x, this.tgt().y, this.speed * 1.5, dt);
    if (this.d() < this.attackRange - 4) {
      if (this.punishNext) { this.punishNext = false; this.setState('windup', { dur: .3, noDelay: true }); }
      else this.setState('windup', { feint: srandom() < adapt.feintChance(.3) });
    } else if (this.stateT > 2.3) { this.dropToken(); this.setState('circle'); }
  }
  st_feintwait(dt) {
    const T = this.tgt();
    const baited = game.time - T.lastDodgeStart < .55 && game.time - T.lastDodgeStart > 0;
    if (baited && this.stateT > .18) {
      addText(this.x, this.y - this.r - 12, 'read!', '#7a6cc0', 13);
      this.setState('windup', { dur: .26, noDelay: true });
      return;
    }
    if (this.stateT > .45) { this.dropToken(); this.setState('circle'); }
  }
}

/* --- elites: gold-marked variants with one affix; the only non-boss honor --- */
function makeElite(e) {
  e.elite = true;
  const pool = e instanceof Archer ? ['split', 'swift', 'stoneguard', 'surgetouched']
                                   : ['swift', 'aura', 'stoneguard',
                                      'surgetouched', 'mirrortouched'];
  e.affix = pool[Math.floor(srandom() * pool.length)];
  e.hp = e.maxHp = Math.round(e.maxHp * 1.4);
  e.dmg = Math.round(e.dmg * 1.15);
  e.honorOrb = Math.round(rand(15, 30));
  if (e.affix === 'swift') { e.windupBase *= .78; e.speed *= 1.18; }
  if (e.affix === 'stoneguard') {   // an unshakable stance
    e.postureDrain = 30;
    e.hp = e.maxHp = Math.round(e.maxHp * 1.2);
  }
  if (e.affix === 'surgetouched') e.ascSurge = true;   // an ultimate of its own
  // 'mirrortouched' resolves in Enemy.hurt — blocks while posturing
}

// per-wave stat tuning: difficulty setting × infinite-mode escalation
function tuneEnemy(e, m) {
  e.dmgTuned = m.dmg;
  e.hp = e.maxHp = Math.round(e.maxHp * m.hp);
  e.dmg = Math.round(e.dmg * m.dmg);
  if (e.arrowSpeed) e.arrowSpeed *= m.proj;
  if (e.arrowDmg) e.arrowDmg = Math.round(e.arrowDmg * m.dmg);
}
function onBossDeath(b) {
  // 二人 resolve: each fallen lord steels the second blade — run-scoped
  // sim state (never a save write, lockstep-safe), +15% might and +15
  // health per lord, capped at ten. P2 finally has a ladder to climb
  // inside the run the world keeps escalating.
  if (game.coop && p2 && p2.resolve < 10) {
    p2.resolve = (p2.resolve || 0) + 1;
    p2.maxHp += 15;
    p2.hp = Math.min(p2.maxHp, p2.hp + 15);
    addText(p2.x, p2.y - 32, `志 resolve ${p2.resolve} — the lord remembers`, GOLD, 13);
  }
  shake(10); freeze(.12);
  inkSplat(b.x, b.y);
  spawnPetals(b.x, b.y, 10, 'wash', null);   // the lord falls in ink, not pigment
  setBanner(b.bossName + ' falls', 2);
  playSfx('taiko');
  paintDeathKanji(b);
}

/* ---------- honor orbs ----------
   The only source of honor: bosses shatter into golden orbs on death.
   Orbs drift, then magnet to the player when approached; any left on
   the ground are quietly banked at level/wave transitions so a payout
   is never lost.                                                       */
let orbs = [];
function spawnHonorOrbs(x, y, total) {
  if (total <= 0) return;
  const n = clamp(6 + Math.floor(total / 120), 6, 16);
  const per = Math.floor(total / n);
  let rem = total - per * n;
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), sp = rand(60, 220);
    orbs.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      val: per + (rem-- > 0 ? 1 : 0),
      t: rand(0, TAU), dead: false,
    });
  }
}
function updateOrbs(dt) {
  for (const o of orbs) {
    o.t += dt;
    o.vx *= Math.exp(-3.2 * dt); o.vy *= Math.exp(-3.2 * dt);
    // co-op: gold flows to whichever blade stands nearer — one shared wallet
    const P = nearestPlayerTo(o.x, o.y);
    const d = dist(o.x, o.y, P.x, P.y);
    // blessing and charm both widen the pull — they stack
    const magR = 120 * (1 + blessVal('magnet', 1, 2, 3)) * (charmed('magnet') ? 2 : 1);
    if (d < magR) {          // magnet
      const ang = Math.atan2(P.y - o.y, P.x - o.x);
      const pull = 340 * (1 - d / magR) + 90;
      o.vx += Math.cos(ang) * pull * dt * 6;
      o.vy += Math.sin(ang) * pull * dt * 6;
    }
    o.x += o.vx * dt; o.y += o.vy * dt;
    o.x = clamp(o.x, ARENA.x + 8, ARENA.x + ARENA.w - 8);
    o.y = clamp(o.y, ARENA.y + 8, ARENA.y + ARENA.h - 8);
    if (d < P.r + 9) {
      o.dead = true;
      addHonor(o.val, P.x, P.y - 26);
      sparks(P.x, P.y, rand(0, TAU), GOLD, 3, Math.PI);
      playSfx('orb');
    }
  }
  orbs = orbs.filter(o => !o.dead);
}
function bankOrbs() {       // sweep uncollected orbs into the wallet
  let sum = 0;
  for (const o of orbs) sum += o.val;
  if (sum > 0) addHonor(sum);
  orbs = [];
}

/* ---------- shockwaves (Iron Brute earthbreaker) ---------- */
let shockwaves = [];
function spawnShockwave(x, y, dmg) {
  shockwaves.push({ x, y, r: 34, speed: 330, w: 16, dmg, dead: false, awarded: false });
}
function updateShockwaves(dt) {
  for (const s of shockwaves) {
    s.r += s.speed * dt;
    if (s.r > 720) { s.dead = true; continue; }
    // the ring threatens every blade it crosses — co-op included
    for (const P of alivePlayers()) {
      const d = dist(s.x, s.y, P.x, P.y);
      if (Math.abs(d - s.r) < s.w) {
        if (P.dodgeInv) {
          if (!s.awarded) {
            s.awarded = true;
            onPerfectDodge(P);
          }
        } else if (P.iT <= 0) {
          damageSamurai(P, s.dmg, Math.atan2(P.y - s.y, P.x - s.x), true,
                        'the earthbreaker ring');
        }
      }
    }
  }
  shockwaves = shockwaves.filter(s => !s.dead);
}

