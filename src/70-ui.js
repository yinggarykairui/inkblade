/* ---------- the merchant's ledger (shop) ---------- */
const shopEl = document.getElementById('shop');
let lastBought = null;
let shopTab = 'swords';
function openShop() {
  game.state = 'shop';
  renderShopUI();
  showOverlay('shop');
}
function closeShop() {
  showOverlay('none');
  game.state = 'playing';
  // stepping out of the stall portal shouldn't immediately re-trigger it
  if (portal && portal.kind === 'merchant') portal.armed = false;
}
function drawWeaponIcon(canvas, wpn) {
  const c = canvas.getContext('2d');
  const y = canvas.height / 2, x0 = 10, x1 = canvas.width - 8;
  const style = BLADE_STYLE[wpn.id];
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.lineCap = 'round';
  if (style.outline) {
    c.strokeStyle = 'rgba(43,35,32,.55)'; c.lineWidth = style.w + 2;
    c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
  }
  c.strokeStyle = style.color; c.lineWidth = style.w;
  c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
  c.strokeStyle = wpn.id === 'raiko' ? GOLD : INK; c.lineWidth = 3;
  c.beginPath(); c.moveTo(x0 + 4, y - 5); c.lineTo(x0 + 4, y + 5); c.stroke();
  if (wpn.id === 'kurogane') {
    c.strokeStyle = 'rgba(181,52,42,.85)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x0 + 8, y - 2); c.lineTo(x1, y - 2); c.stroke();
  } else if (wpn.id === 'akaoni') {
    c.strokeStyle = INK; c.lineWidth = style.w;
    c.beginPath(); c.moveTo(x1 - 12, y); c.lineTo(x1, y); c.stroke();
  } else if (wpn.id === 'raiko') {
    c.strokeStyle = '#c9cdd4'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x0 + 10, y);
    for (let i = 1; i <= 4; i++) c.lineTo(x0 + 10 + i * 8, y + (i % 2 ? -2.5 : 2.5));
    c.stroke();
  } else if (wpn.id === 'botan') {
    c.strokeStyle = '#96897f'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x0 + 8, y + 2); c.lineTo(x0 + 20, y + 2); c.stroke();
  } else if (wpn.id === 'shirasagi') {
    c.strokeStyle = GOLD; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x0 + 6, y - 3); c.lineTo(x0 + 14, y - 3); c.stroke();
  }
}
// what each blade learns after five lords fall to it
const MASTERY_PERKS = {
  tetsu: '+15% posture damage',
  ame: 'tempo climbs to 6 stacks',
  shirasagi: 'the flow window lasts half again as long',
  botan: 'clean hits strike 60% harder',
  kurogane: 'crow strikes also crack posture (+10)',
  tsukikage: 'true punishes also mend 4 health',
  akaoni: 'staggers last 0.3s longer',
  raiko: 'the lightning walks to a second foe',
};
function renderShopUI() {
  document.getElementById('shopHonor').textContent = fmtNum(game.honor);
  document.getElementById('tabSwords').classList.toggle('sel', shopTab === 'swords');
  document.getElementById('tabBows').classList.toggle('sel', shopTab === 'bows');
  document.getElementById('tabUpgrades').classList.toggle('sel', shopTab === 'upgrades');
  document.getElementById('tabCharms').classList.toggle('sel', shopTab === 'charms');
  if (shopTab === 'swords') renderSwords();
  else if (shopTab === 'bows') renderBows();
  else if (shopTab === 'charms') renderCharms();
  else renderUpgrades();
}
// the bow rack — same unlock pattern as the blades: honor buys, levels gate
function drawBowIcon(canvas, bow) {
  const c = canvas.getContext('2d');
  const y = canvas.height / 2, x0 = 16, x1 = canvas.width - 20;
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.lineCap = 'round';
  c.strokeStyle = bow.legendary ? GOLD : INK;
  c.lineWidth = bow.id === 'longbow' ? 3.2 : 2.4;
  c.beginPath();
  c.moveTo(x0 + 6, y - 9);
  c.quadraticCurveTo(x1, y, x0 + 6, y + 9);
  c.stroke();
  c.strokeStyle = 'rgba(43,35,32,.6)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(x0 + 6, y - 9); c.lineTo(x0 + 6, y + 9); c.stroke();
  // the nocked shaft, tinted per bow
  c.strokeStyle = bow.id === 'firebow' ? 'rgba(181,52,42,.9)'
                : bow.id === 'stormbow' ? '#9aa0a8'
                : bow.id === 'repeater' ? 'rgba(43,35,32,.5)' : INK;
  c.lineWidth = 1.6;
  const shafts = bow.id === 'repeater' ? [-4, 0, 4] : [0];
  for (const off of shafts) {
    c.beginPath();
    c.moveTo(x0, y + off); c.lineTo(x1 - 4, y + off);
    c.stroke();
  }
}
function renderBows() {
  shopEl.innerHTML = '';
  for (const id of BOW_ORDER) {
    const b0 = BOWS[id];
    const bowOwned = save.bowsOwned.includes(id);
    const row = document.createElement('div');
    row.className = 'shopItem' + (bowOwned ? '' : ' locked') + (b0.legendary ? ' legendary' : '');
    const icon = document.createElement('canvas');
    icon.width = 64; icon.height = 22;
    drawBowIcon(icon, b0);
    row.appendChild(icon);
    const info = document.createElement('div');
    info.className = 'si-info';
    info.innerHTML =
      `<div class="si-name"><span class="kj">${b0.kanji}</span>${b0.name} — “${b0.epithet}”</div>` +
      `<div class="si-desc">${b0.desc}</div>` +
      (bowOwned ? `<div class="si-desc">temper <b>L${wxpOf(id).lvl}</b>/${rarityOf(id).cap}` +
        (wxpOf(id).lvl >= rarityOf(id).cap ? ' — fully tempered'
          : ` · ${fmtNum(wxpOf(id).xp)}/${fmtNum(xpForLevel(wxpOf(id).lvl))} xp`) +
        ` · ×${(rarityMult(id) * wxpMult(id)).toFixed(1)}</div>` : '') +
      `<div class="si-desc"><i>Q strings the bow in any trial; hold V to draw, release to loose.</i></div>`;
    row.appendChild(info);
    const right = document.createElement('div');
    right.className = 'si-right';
    if (save.bowsOwned.includes(id)) {
      if (save.bowEquipped === id) {
        right.innerHTML = `<span class="si-cost">— strung —</span>`;
      } else {
        const btn = document.createElement('button');
        btn.className = 'ghost'; btn.textContent = 'STRING';
        btn.onclick = () => {
          save.bowEquipped = id;
          persistSave();
          renderShopUI();
        };
        right.appendChild(btn);
      }
    } else {
      const rar = rarityOf(id);
      right.innerHTML = `<span class="si-cost">${rar.kanji} ${rar.name} — sealed in chests</span>`;
    }
    row.appendChild(right);
    if (lastBought === id) { row.classList.add('flash'); lastBought = null; }
    shopEl.appendChild(row);
  }
}
function renderCharms() {
  shopEl.innerHTML = '';
  // the chest key — an honor sink promising the next chest opens ≥ Pure
  {
    const row = document.createElement('div');
    row.className = 'shopItem';
    const kj = document.createElement('div');
    kj.className = 'upgKanji'; kj.textContent = '鍵';
    row.appendChild(kj);
    const info = document.createElement('div');
    info.className = 'si-info';
    info.innerHTML = `<div class="si-name">Chest Key</div>` +
      `<div class="si-desc">the next lacquer chest you open holds at least a ` +
      `<b>澄 Pure</b> arm — one key held at a time</div>`;
    row.appendChild(info);
    const right = document.createElement('div');
    right.className = 'si-right';
    const keyCost = Math.round(120 * Math.pow(2.2, (save.maps.unlocked || 1) - 1));
    if (save.chestKey) {
      right.innerHTML = `<span class="si-cost">— a key waits on your belt —</span>`;
    } else {
      const b = document.createElement('button');
      b.textContent = `BUY 誉 ${fmtNum(keyCost)}`;
      if (game.honor < keyCost) b.disabled = true;
      else b.onclick = () => {
        game.honor -= keyCost; save.honor = game.honor;
        save.chestKey = true;
        persistSave();
        playSfx('buy');
        renderShopUI();
      };
      right.appendChild(b);
    }
    row.appendChild(right);
    shopEl.appendChild(row);
  }
  for (const c of CHARMS) {
    const row = document.createElement('div');
    row.className = 'shopItem';
    const kj = document.createElement('div');
    kj.className = 'upgKanji'; kj.textContent = c.kanji;
    row.appendChild(kj);
    const info = document.createElement('div');
    info.className = 'si-info';
    info.innerHTML =
      `<div class="si-name">${c.name}</div><div class="si-desc">${c.desc}` +
      ` <i>(charms never enter duels)</i></div>`;
    row.appendChild(info);
    const right = document.createElement('div');
    right.className = 'si-right';
    if (save.charmsOwned.includes(c.id)) {
      // cycle 6's Twin Charms opens a second wrist
      const slots = rebirthLevel() >= 6 ? ['charm', 'charm2'] : ['charm'];
      const wornSlot = slots.find(s => save[s] === c.id);
      const b = document.createElement('button');
      if (wornSlot) {
        b.className = 'ghost'; b.textContent = 'UNEQUIP';
        b.onclick = () => { save[wornSlot] = null; persistSave(); renderShopUI(); };
        const tag = document.createElement('div');
        tag.className = 'si-cost'; tag.textContent = '— worn —';
        right.appendChild(tag);
      } else {
        b.className = 'ghost'; b.textContent = 'WEAR';
        b.onclick = () => {
          const free = slots.find(s => !save[s]);
          save[free || 'charm'] = c.id;   // both full: the first wrist trades
          persistSave(); renderShopUI();
        };
      }
      right.appendChild(b);
    } else {
      const b = document.createElement('button');
      b.textContent = `BUY 誉 ${c.cost}`;
      if (game.honor < c.cost) b.disabled = true;
      else b.onclick = () => {
        game.honor -= c.cost; save.honor = game.honor;
        save.charmsOwned.push(c.id);
        save.charm = c.id;
        persistSave();
        lastBought = c.id;
        playSfx('buy');
        renderShopUI();
      };
      right.appendChild(b);
    }
    row.appendChild(right);
    if (lastBought === c.id) { row.classList.add('flash'); lastBought = null; }
    shopEl.appendChild(row);
  }
}
function renderSwords() {
  shopEl.innerHTML = '';
  const order = game.adminUnlocked ? WEAPON_ORDER.concat(['fudemaru']) : WEAPON_ORDER;
  for (const id of order) {
    const w = WEAPONS[id];
    const ownedRow = w.admin ? game.adminUnlocked : save.owned.includes(id);
    const row = document.createElement('div');
    row.className = 'shopItem' + (ownedRow ? '' : ' locked') +
      (w.legendary ? ' legendary' : '') + (w.admin ? ' admin' : '');
    const icon = document.createElement('canvas');
    icon.width = 64; icon.height = 22;
    drawWeaponIcon(icon, w);
    row.appendChild(icon);
    const info = document.createElement('div');
    info.className = 'si-info';
    // mastery pips: lords felled with this blade, out of five
    let masteryHTML = '';
    if (!w.admin && save.owned.includes(id)) {
      // temper: the vertical XP track — every landed stroke feeds it
      const wx = wxpOf(id), cap = rarityOf(id).cap;
      masteryHTML += `<div class="si-desc">temper <b>L${wx.lvl}</b>/${cap}` +
        (wx.lvl >= cap ? ' — fully tempered'
          : ` · ${fmtNum(wx.xp)}/${fmtNum(xpForLevel(wx.lvl))} xp`) +
        ` · cutting weight ×${(rarityMult(id) * wxpMult(id)).toFixed(1)}</div>`;
      const mk = Math.min(5, masteryOf(id));
      let pips = '<div class="upgPips" style="margin-top:5px;">';
      for (let i = 0; i < 5; i++) pips += `<span class="${i < mk ? 'on' : ''}"></span>`;
      pips += '</div>';
      masteryHTML = pips + (isMastered(id)
        ? `<div class="si-desc" style="color:var(--gold);">極 mastered — ${MASTERY_PERKS[id]}</div>`
        : `<div class="si-desc">mastery ${mk}/5 lords — unlocks: ${MASTERY_PERKS[id]}</div>`);
    }
    info.innerHTML =
      `<div class="si-name"><span class="kj">${w.kanji}</span>${w.name} — “${w.epithet}”</div>` +
      `<div class="si-desc">${w.desc}</div>` + masteryHTML;
    row.appendChild(info);
    const right = document.createElement('div');
    right.className = 'si-right';
    const ownedNow = w.admin ? game.adminUnlocked : save.owned.includes(id);
    if (ownedNow) {
      if (game.equipped === id) {
        right.innerHTML = `<span class="si-cost">— equipped —</span>`;
      } else {
        const b = document.createElement('button');
        b.className = 'ghost'; b.textContent = 'EQUIP';
        b.onclick = () => {
          game.equipped = id; game.ameStacks = 0;
          // the ledger remembers every choice — the brush too, while unsealed
          save.equipped = id;
          persistSave();
          renderShopUI();
        };
        right.appendChild(b);
      }
    } else {
      // blades are no longer bought — they are FOUND. Chests only.
      const rar = rarityOf(id);
      right.innerHTML = `<span class="si-cost">${rar.kanji} ${rar.name} — sealed in chests</span>`;
    }
    row.appendChild(right);
    if (lastBought === id) { row.classList.add('flash'); lastBought = null; }
    shopEl.appendChild(row);
  }
}
function renderUpgrades() {
  shopEl.innerHTML = '';
  for (const key in UPGRADE_DEFS) {
    const u = UPGRADE_DEFS[key];
    const tier = save.upgrades[key];
    const row = document.createElement('div');
    row.className = 'shopItem';
    const kj = document.createElement('div');
    kj.className = 'upgKanji'; kj.textContent = u.kanji;
    row.appendChild(kj);
    const info = document.createElement('div');
    info.className = 'si-info';
    let pips = '<div class="upgPips">';
    for (let i = 0; i < UPGRADE_MAX; i++)
      pips += `<span class="${i < tier ? 'on' : ''}"></span>`;
    pips += '</div>';
    info.innerHTML =
      `<div class="si-name">${u.name}</div><div class="si-desc">${u.per}</div>` + pips;
    row.appendChild(info);
    const right = document.createElement('div');
    right.className = 'si-right';
    if (tier >= UPGRADE_MAX) {
      right.innerHTML = `<span class="si-cost">— mastered —</span>`;
    } else {
      const cost = u.costs[tier];
      const b = document.createElement('button');
      b.textContent = `TRAIN 誉 ${cost}`;
      if (game.honor < cost) b.disabled = true;
      else b.onclick = () => {
        game.honor -= cost; save.honor = game.honor;
        save.upgrades[key]++;
        persistSave();
        refreshPlayerStats();
        lastBought = key;
        renderShopUI();
      };
      right.appendChild(b);
    }
    row.appendChild(right);
    if (lastBought === key) { row.classList.add('flash'); lastBought = null; }
    shopEl.appendChild(row);
  }
}

/* ---------- the record scroll: stats + achievement stamps ---------- */
let overlayReturn = 'title';   // where records/settings should hand back to
function renderRecords() {
  const s = save.stats;
  let fav = null, favN = 0;
  for (const k in s.bladeKills)
    if (s.bladeKills[k] > favN) { favN = s.bladeKills[k]; fav = k; }
  document.getElementById('statsBlock').innerHTML =
    `<div>foes felled: <b>${s.kills}</b></div><div>deaths: <b>${s.deaths}</b></div>` +
    `<div>perfect dodges: <b>${s.perfectDodges}</b></div><div>parries: <b>${s.parries}</b></div>` +
    `<div>posture breaks: <b>${s.postureBreaks}</b></div><div>elites felled: <b>${s.elites}</b></div>` +
    `<div>lifetime honor: <b>${s.honorEarned}</b></div><div>duel wins: <b>${s.duelWins}</b></div>` +
    `<div>chests opened: <b>${save.chestsOpened || 0}</b></div>` +
    `<div>tomb steps: <b>${((save.tomb.body || 0) + (save.tomb.stance || 0) + (save.tomb.edge || 0)).toFixed(1)}/30</b></div>` +
    `<div>弓道 archery rank: <b>${(save.kyudo && save.kyudo.rank) || 0}/10${save.kyudo && save.kyudo.best ? ' · best ' + save.kyudo.best : ''}</b></div>` +
    `<div>転生 rebirths: <b>${rebirthLevel()}${rebirthLevel() ? ' · ×' + rebirthMult().toFixed(2) : ''}</b></div>` +
    `<div>favorite blade: <b>${fav && WEAPONS[fav] ? WEAPONS[fav].name + ' · ' + favN : '—'}</b></div>` +
    `<div>stamps: <b>${save.achievements.length}/${ACHIEVEMENTS.length}</b></div>`;
  const wall = document.getElementById('stampWall');
  wall.innerHTML = '';
  for (const a of ACHIEVEMENTS) {
    const el = document.createElement('div');
    const got = save.achievements.includes(a.id);
    el.className = 'stamp' + (got ? ' on' : '');
    el.title = a.desc;
    el.innerHTML = `<div class="sk">${got ? a.kanji : '？'}</div><div class="sn">${a.name}</div>`;
    wall.appendChild(el);
  }
}
function openRecords() {
  overlayReturn = game.state;
  renderRecords();
  game.state = 'records';
  showOverlay('records');
}
function closeMetaOverlay() {   // records + settings share the return path
  game.state = overlayReturn === 'shop' ? 'shop' : 'title';
  showOverlay(game.state === 'shop' ? 'shop' : 'title');
}

/* ---------- 転生 the rebirth scroll ----------
   Opened at the tomb altar (or from the title once the fifth lord has
   fallen). Shows the ladder, what the cycle keeps, and asks twice —
   a rebirth burns the ledger and cannot be taken back.               */
let rebirthReturn = 'title';
let rebirthArmed = false;
function renderRebirth() {
  const lvl = rebirthLevel();
  const gateOpen = (save.maxLevelCleared || 0) >= 5;
  document.getElementById('rebirthStatus').innerHTML =
    `cycle <b>${lvl}</b> · might &amp; vigor <b>×${rebirthMult().toFixed(2)}</b>` +
    ` · next cycle <b>×${Math.pow(1.5, lvl + 1).toFixed(2)}</b>` +
    `<br>${gateOpen
      ? 'the fifth lord has fallen — the altar will answer'
      : 'the altar is silent — <b>slay the fifth lord</b> of the story to open the cycle'}`;
  const wall = document.getElementById('rebirthPerks');
  wall.innerHTML = '';
  for (const p of REBIRTH_PERKS) {
    const row = document.createElement('div');
    row.className = 'perkRow' + (lvl >= p.lvl ? ' got' : '');
    row.innerHTML = `<div class="pk">${p.kanji}</div>` +
      `<div><div>${p.name}</div><div class="pd">${p.desc}</div></div>` +
      `<div class="plvl">${lvl >= p.lvl ? '— held —' : 'cycle ' + p.lvl}</div>`;
    wall.appendChild(row);
  }
  const btn = document.getElementById('btnRebirth');
  btn.disabled = !gateOpen || game.state !== 'rebirth' || rebirthReturn !== 'playing';
  btn.textContent = rebirthArmed ? 'SPEAK IT AGAIN — BE REBORN' : 'BE REBORN';
  document.getElementById('rebirthMsg').textContent =
    rebirthReturn !== 'playing'
      ? 'the cycle turns only at the tomb altar — this scroll only tells of it'
      : (rebirthArmed ? 'once spoken twice, nothing unsays it' : '');
}
function openRebirth() {
  rebirthReturn = game.state === 'playing' ? 'playing' : 'title';
  rebirthArmed = false;
  game.state = 'rebirth';
  renderRebirth();
  showOverlay('rebirth');
}
function closeRebirth() {
  game.state = rebirthReturn === 'playing' ? 'playing' : 'title';
  showOverlay(rebirthReturn === 'playing' ? 'none' : 'title');
  rebirthArmed = false;
}
document.getElementById('btnRebirthClose').onclick = closeRebirth;
document.getElementById('btnRebirth').onclick = () => {
  if (!rebirthArmed) { rebirthArmed = true; renderRebirth(); return; }
  const err = doRebirth();
  if (err) {
    document.getElementById('rebirthMsg').textContent = err;
    rebirthArmed = false;
    return;
  }
  // the world wakes into the new life
  game.honor = save.honor;
  game.equipped = save.equipped;
  game.adminUnlocked = save.adminUnlocked;
  rebirthArmed = false;
  playSfx('achieve');
  returnToMenu();
  renderMenu();
  setBanner(`転生 cycle ${rebirthLevel()} — might ×${rebirthMult().toFixed(2)}`, 3.5);
};
document.getElementById('btnRebirthMenu').onclick = openRebirth;

/* ---------- settings ---------- */
let syncAudioVolumes = () => {};   // the audio engine re-points this
function renderSettings() {
  const a = save.audio;
  const bind = (id, val, show) => {
    document.getElementById(id).value = val;
    if (show) document.getElementById(id + 'V').textContent = show;
  };
  bind('setMaster', Math.round(a.master * 100), Math.round(a.master * 100) + '%');
  bind('setSfx', Math.round(a.sfx * 100), Math.round(a.sfx * 100) + '%');
  bind('setAmb', Math.round(a.ambient * 100), Math.round(a.ambient * 100) + '%');
  bind('setShake', Math.round(save.shakeMul * 100), Math.round(save.shakeMul * 100) + '%');
  document.getElementById('setMute').checked = a.muted;
  document.getElementById('setCB').checked = save.colorblind;
  document.getElementById('setMouse').checked = save.mouseAim;
  document.getElementById('saveIO').value = '';
  document.getElementById('ioMsg').textContent = '';
}
function openSettings() {
  overlayReturn = game.state;
  renderSettings();
  game.state = 'settings';
  showOverlay('settings');
}
function wireSettings() {
  const upd = () => { persistSave(); syncAudioVolumes(); renderSettings(); };
  document.getElementById('setMaster').oninput = e => { save.audio.master = e.target.value / 100; upd(); };
  document.getElementById('setSfx').oninput = e => { save.audio.sfx = e.target.value / 100; upd(); };
  document.getElementById('setAmb').oninput = e => { save.audio.ambient = e.target.value / 100; upd(); };
  document.getElementById('setShake').oninput = e => { save.shakeMul = e.target.value / 100; upd(); };
  document.getElementById('setMute').onchange = e => { save.audio.muted = e.target.checked; upd(); };
  document.getElementById('setCB').onchange = e => { save.colorblind = e.target.checked; persistSave(); };
  document.getElementById('setMouse').onchange = e => { save.mouseAim = e.target.checked; persistSave(); };
  document.getElementById('btnExport').onclick = () => {
    const io = document.getElementById('saveIO');
    io.value = exportSave();
    io.select();
    document.getElementById('ioMsg').textContent = 'copied? paste it anywhere safe';
    try { navigator.clipboard && navigator.clipboard.writeText(io.value); } catch (e) {}
  };
  document.getElementById('btnImport').onclick = () => {
    const err = importSave(document.getElementById('saveIO').value);
    document.getElementById('ioMsg').textContent =
      err || 'the scroll unfurls — progress restored';
    if (!err) { renderMenu(); renderSettings(); }
  };
}
wireSettings();

/* ---------- main menu ----------
   Three doors, not five: CAMPAIGN gathers the story arenas and the
   conquest maps; INFINITE gathers the endless storm and both boss
   rushes; the duel stands alone. menuSel.mode still speaks the old
   tongue ('level'/'campaign'/'infinite'/'rush') — only the menu
   groups them.                                                      */
let advOpen = false;   // the "too easy?" drawer — difficulty, curses, skips
function renderMenu() {
  const groupCamp = menuSel.mode === 'level' || menuSel.mode === 'campaign';
  const groupInf = menuSel.mode === 'infinite' || menuSel.mode === 'rush';
  document.getElementById('modeCampaign').classList.toggle('sel', groupCamp);
  document.getElementById('modeInfinite').classList.toggle('sel', groupInf);
  document.getElementById('modeDuel').classList.toggle('sel', menuSel.mode === 'duel');
  // campaign path — story (the old level mode) or conquest (the map climb)
  document.getElementById('campLabel').style.display = groupCamp ? 'block' : 'none';
  document.getElementById('campRow').style.display = groupCamp ? 'flex' : 'none';
  document.getElementById('campStory').classList.toggle('sel', menuSel.mode === 'level');
  document.getElementById('campConquest').classList.toggle('sel', menuSel.mode === 'campaign');
  // storm style — endless waves, or the boss rushes folded in
  document.getElementById('infLabel').style.display = groupInf ? 'block' : 'none';
  document.getElementById('infRow').style.display = groupInf ? 'flex' : 'none';
  document.getElementById('infEndless').classList.toggle('sel', menuSel.mode === 'infinite');
  document.getElementById('infGauntlet').classList.toggle('sel', menuSel.mode === 'rush' && !menuSel.chaos);
  document.getElementById('infChaos').classList.toggle('sel', menuSel.mode === 'rush' && menuSel.chaos);
  // 二人 couch co-op — a second blade may join the storm and the rushes.
  // P2 is duel-raw (any arm, no progression); the brush stays sealed out.
  document.getElementById('coopBox').style.display = groupInf ? 'block' : 'none';
  if (groupInf) {
    const cRow = document.getElementById('coopRow');
    cRow.innerHTML = '';
    for (const [on, label] of [[false, '一人 ALONE'], [true, '二人 CO-OP']]) {
      const b = document.createElement('button');
      b.className = 'curseBtn' + (!!menuSel.coop === on ? ' sel' : '');
      b.textContent = label;
      b.onclick = () => { menuSel.coop = on; renderMenu(); };
      cRow.appendChild(b);
    }
    document.getElementById('coopSetup').style.display = menuSel.coop ? 'block' : 'none';
    if (menuSel.coop) {
      if (!WEAPONS[menuSel.p2Blade] || WEAPONS[menuSel.p2Blade].admin) menuSel.p2Blade = 'tetsu';
      if (!BOWS[menuSel.p2Bow]) menuSel.p2Bow = 'shortbow';
      const bRow = document.getElementById('coopBladeRow');
      bRow.innerHTML = '';
      for (const id of WEAPON_ORDER) {
        const w = WEAPONS[id];
        const b = document.createElement('button');
        b.className = 'lvlBtn' + (menuSel.p2Blade === id ? ' sel' : '');
        b.textContent = w.kanji;
        b.title = `${w.name} — ${w.epithet}`;
        b.onclick = () => { menuSel.p2Blade = id; renderMenu(); };
        bRow.appendChild(b);
      }
      const wRow = document.getElementById('coopBowRow');
      wRow.innerHTML = '';
      for (const id of BOW_ORDER) {
        const b0 = BOWS[id];
        const b = document.createElement('button');
        b.className = 'lvlBtn' + (menuSel.p2Bow === id ? ' sel' : '');
        b.textContent = b0.kanji;
        b.title = `${b0.name} — ${b0.epithet}`;
        b.onclick = () => { menuSel.p2Bow = id; renderMenu(); };
        wRow.appendChild(b);
      }
    }
  }
  const isDuel = menuSel.mode === 'duel';
  document.getElementById('duelSetup').style.display = isDuel ? 'block' : 'none';
  if (isDuel) {
    // duels are settled by blades and reads, not progression —
    // the whole arsenal is open here, owned or not; the brush only
    // enters the ring for those who have spoken the seal
    const bladeOk = id => WEAPONS[id] && (!WEAPONS[id].admin || game.adminUnlocked);
    if (!bladeOk(menuSel.p1Blade)) menuSel.p1Blade = 'tetsu';
    if (!bladeOk(menuSel.p2Blade)) menuSel.p2Blade = 'tetsu';
    // opponent select — a second human, three temperaments, or the bracket
    const oppRow = document.getElementById('duelOppRow');
    oppRow.innerHTML = '';
    const opps = [['human', '二人 TWO PLAYERS'], ['aggressor', '牛 THE OX'],
                  ['trickster', '狐 THE FOX'], ['stone', '石 THE STONE'],
                  ['tournament', '冠 TOURNAMENT'], ['online', '網 ONLINE']];
    for (const [id, label] of opps) {
      const b = document.createElement('button');
      b.className = 'curseBtn' + (menuSel.duelOpp === id ? ' sel' : '');
      b.textContent = label;
      b.onclick = () => { menuSel.duelOpp = id; renderMenu(); };
      oppRow.appendChild(b);
    }
    // online box + arena row (online locks to the dojo for determinism)
    const isOnline = menuSel.duelOpp === 'online';
    document.getElementById('onlineBox').style.display = isOnline ? 'block' : 'none';
    const arRow = document.getElementById('duelArenaRow');
    arRow.style.display = isOnline ? 'none' : 'flex';
    arRow.previousElementSibling.style.display = isOnline ? 'none' : '';
    arRow.innerHTML = '';
    if (!isOnline) THEMES.forEach((th, i) => {
      const b = document.createElement('button');
      b.className = 'lvlBtn' + (menuSel.duelArena === i ? ' sel' : '');
      b.textContent = th.kanji;
      b.title = th.name;
      b.onclick = () => { menuSel.duelArena = i; renderMenu(); };
      arRow.appendChild(b);
    });
    // mutators
    const mutRow = document.getElementById('duelMutRow');
    mutRow.innerHTML = '';
    const muts = [['sudden', '一撃 sudden death'], ['nostam', '無尽 no stamina'],
                  ['giant', '大刀 giant blades'], ['mirror', '鏡 mirror match'],
                  ['surge', '奥義 eternal surge']];
    for (const [id, label] of muts) {
      const b = document.createElement('button');
      b.className = 'curseBtn' + (menuSel.mut[id] ? ' sel' : '');
      b.textContent = label;
      b.onclick = () => { menuSel.mut[id] = !menuSel.mut[id]; renderMenu(); };
      mutRow.appendChild(b);
    }
    // blade rows — P2's hides against AI, the bracket, or a mirror
    const showP2 = menuSel.duelOpp === 'human' && !menuSel.mut.mirror;
    document.getElementById('p2BladeLabel').style.display = showP2 ? '' : 'none';
    document.getElementById('p2BladeRow').style.display = showP2 ? 'flex' : 'none';
    const duelBlades = game.adminUnlocked ? WEAPON_ORDER.concat(['fudemaru']) : WEAPON_ORDER;
    for (const [rowId, key] of [['p1BladeRow', 'p1Blade'], ['p2BladeRow', 'p2Blade']]) {
      const row = document.getElementById(rowId);
      row.innerHTML = '';
      for (const id of duelBlades) {
        const w = WEAPONS[id];
        const b = document.createElement('button');
        b.className = 'lvlBtn' + (menuSel[key] === id ? ' sel' : '');
        if (w.admin) b.style.color = 'var(--red)';
        b.textContent = w.kanji;
        b.title = w.admin
          ? `${w.name} — ADMIN · tap: 火 cone · roll-tap: 雷 bolt · L ult (滅 maw) · Y swap in duels`
          : `${w.name} — ${w.epithet}` +
            (save.owned.includes(id) ? '' : ' (duels only until purchased)');
        b.onclick = () => { menuSel[key] = id; renderMenu(); };
        row.appendChild(b);
      }
    }
    // bow rows — like the blades, duels are progression-free: any bow strings
    if (!BOWS[menuSel.p1Bow]) menuSel.p1Bow = 'shortbow';
    if (!BOWS[menuSel.p2Bow]) menuSel.p2Bow = 'shortbow';
    document.getElementById('p2BowLabel').style.display = showP2 ? '' : 'none';
    document.getElementById('p2BowRow').style.display = showP2 ? 'flex' : 'none';
    for (const [rowId, key] of [['p1BowRow', 'p1Bow'], ['p2BowRow', 'p2Bow']]) {
      const row = document.getElementById(rowId);
      row.innerHTML = '';
      for (const id of BOW_ORDER) {
        const b0 = BOWS[id];
        const b = document.createElement('button');
        b.className = 'lvlBtn' + (menuSel[key] === id ? ' sel' : '');
        b.textContent = b0.kanji;
        b.title = `${b0.name} — ${b0.epithet}` +
          (save.bowsOwned.includes(id) ? '' : ' (duels only until purchased)');
        b.onclick = () => { menuSel[key] = id; renderMenu(); };
        row.appendChild(b);
      }
    }
  }
  if (menuSel.level > save.maxLevelCleared + 1) menuSel.level = 1;
  // the "too easy?" drawer — starting level, maps, difficulty and curses
  // all wait behind one quiet button; duels need none of it
  const duelSel = menuSel.mode === 'duel';
  document.getElementById('tooEasyBox').style.display = duelSel ? 'none' : 'block';
  const teBtn = document.getElementById('btnTooEasy');
  teBtn.textContent = advOpen ? '太易 ENOUGH — FOLD IT AWAY' : '太易 TOO EASY?';
  document.getElementById('advBox').style.display = (advOpen && !duelSel) ? 'block' : 'none';
  const dr = document.getElementById('diffRow');
  dr.style.display = duelSel ? 'none' : 'flex';
  dr.previousElementSibling.style.display = duelSel ? 'none' : 'block';
  document.getElementById('diffDesc').style.display = duelSel ? 'none' : 'block';
  dr.innerHTML = '';
  for (let d = 1; d <= 10; d++) {
    const b = document.createElement('button');
    b.className = 'diffBtn' + (menuSel.diff === d ? ' sel' : '');
    b.textContent = d;
    b.onclick = () => { menuSel.diff = d; renderMenu(); };
    dr.appendChild(b);
  }
  document.getElementById('diffDesc').textContent =
    menuSel.diff === 1
      ? 'the trial as it was written — ×1 foes, ×1 honor'
      : `foes ×${(1 + (menuSel.diff - 1) * .15).toFixed(2)} · honor ×${(1 + (menuSel.diff - 1) * .25).toFixed(2)}`;
  // curses — stackable self-handicaps, hidden for duels
  const cl = document.getElementById('curseLabel');
  const cr = document.getElementById('curseRow');
  const cd = document.getElementById('curseDesc');
  cl.style.display = cr.style.display = duelSel ? 'none' : '';
  cd.style.display = duelSel ? 'none' : 'block';
  if (!duelSel) {
    cr.style.display = 'flex';
    cr.innerHTML = '';
    for (const c of CURSES) {
      const b = document.createElement('button');
      b.className = 'curseBtn' + (menuSel.curses.includes(c.id) ? ' sel' : '');
      b.textContent = `${c.kanji} ${c.name}`;
      b.title = c.desc;
      b.onclick = () => {
        const i = menuSel.curses.indexOf(c.id);
        if (i >= 0) menuSel.curses.splice(i, 1);
        else menuSel.curses.push(c.id);
        renderMenu();
      };
      cr.appendChild(b);
    }
    let bonus = 1;
    for (const cid of menuSel.curses) {
      const c = CURSES.find(x => x.id === cid);
      if (c) bonus *= 1 + c.bonus;
    }
    cd.textContent = menuSel.curses.length
      ? `${menuSel.curses.map(id => CURSES.find(c => c.id === id).desc).join(' · ')} — honor ×${bonus.toFixed(2)} on top of difficulty`
      : 'take on a burden, earn richer honor — click to toggle';
  }
  // campaign map row — the five arenas as maps, unlocked in order
  const mr = document.getElementById('mapRow');
  const showMap = menuSel.mode === 'campaign';
  mr.style.display = showMap ? 'flex' : 'none';
  document.getElementById('mapLabel').style.display = showMap ? 'block' : 'none';
  if (showMap) {
    if ((menuSel.map | 0) >= (save.maps.unlocked || 1)) menuSel.map = 0;
    mr.innerHTML = '';
    THEMES.forEach((th, i) => {
      const b = document.createElement('button');
      b.className = 'lvlBtn' + (menuSel.map === i ? ' sel' : '');
      b.textContent = th.kanji;
      b.disabled = i >= (save.maps.unlocked || 1);
      b.title = `${th.name} — best stage ${(save.maps.best && save.maps.best[i]) || 0}/${STAGES_PER_MAP}`;
      b.onclick = () => { menuSel.map = i; renderMenu(); };
      mr.appendChild(b);
    });
  }
  const lr = document.getElementById('lvlRow');
  const showLvl = menuSel.mode === 'level';
  lr.style.display = showLvl ? 'flex' : 'none';
  lr.previousElementSibling.style.display = showLvl ? 'block' : 'none';
  lr.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const b = document.createElement('button');
    b.className = 'lvlBtn' + (menuSel.level === i ? ' sel' : '');
    b.textContent = i;
    b.disabled = i > save.maxLevelCleared + 1;
    b.title = THEMES[i - 1].name;
    b.onclick = () => { menuSel.level = i; renderMenu(); };
    lr.appendChild(b);
  }
  document.getElementById('btnMerchantMenu').style.display =
    save.merchantUnlocked ? 'inline-block' : 'none';
  document.getElementById('btnRebirthMenu').style.display =
    (rebirthLevel() > 0 || (save.maxLevelCleared || 0) >= 5) ? 'inline-block' : 'none';
  let rec = `wallet <b>誉 ${save.honor}</b>`;
  if (rebirthLevel() > 0)
    rec += ` · 転生 cycle <b>${rebirthLevel()}</b> (×${rebirthMult().toFixed(2)})`;
  // records remember the cycle they were set at — a c0 wave 30 and a
  // c5 wave 30 are different feats
  const cyc = n => n ? ` <i>(cycle ${n})</i>` : '';
  if (save.maxLevelCleared > 0) rec += ` · levels cleared: <b>${save.maxLevelCleared}/5</b>`;
  if (save.deepestWave > 0)
    rec += ` · deepest wave: <b>${save.deepestWave}</b>${cyc(save.recCycles.wave)}`;
  if (save.bestRushTime != null)
    rec += ` · best gauntlet: <b>${fmtTime(save.bestRushTime)}</b>${cyc(save.recCycles.rush)}`;
  if (save.bestChaosStage > 0)
    rec += ` · chaos stage: <b>${save.bestChaosStage}</b>${cyc(save.recCycles.chaos)}`;
  const hs = save.highScores[0];
  if (hs) rec += `<br>best storm: wave <b>${hs.wave}</b> · 誉 ${hs.honor} · ×${hs.diff}${cyc(hs.cycle)}`;
  document.getElementById('menuRecords').innerHTML = rec;
}

document.getElementById('btnStart').onclick = beginRun;
document.getElementById('btnRestart2').onclick = retryRun;
document.getElementById('btnMenu').onclick = returnToMenu;
document.getElementById('btnMerchantMenu').onclick = () => startRun('merchant');
document.getElementById('btnTraining').onclick = () => startRun('training');
document.getElementById('btnTomb').onclick = () => startRun('tomb');
document.getElementById('btnShopClose').onclick = closeShop;
document.getElementById('btnShrineSkip').onclick = closeShrine;
document.getElementById('btnResume').onclick = resumeGame;
document.getElementById('btnAbandon').onclick = returnToMenu;
document.getElementById('tabSwords').onclick = () => { shopTab = 'swords'; renderShopUI(); };
document.getElementById('tabBows').onclick = () => { shopTab = 'bows'; renderShopUI(); };
document.getElementById('tabUpgrades').onclick = () => { shopTab = 'upgrades'; renderShopUI(); };
document.getElementById('tabCharms').onclick = () => { shopTab = 'charms'; renderShopUI(); };
document.getElementById('btnRecords').onclick = openRecords;
document.getElementById('btnRecordsShop').onclick = openRecords;
document.getElementById('btnRecordsClose').onclick = closeMetaOverlay;
document.getElementById('btnSettings').onclick = openSettings;
document.getElementById('btnSettingsClose').onclick = closeMetaOverlay;
// the three doors — entering a group lands on its gentlest style
document.getElementById('modeCampaign').onclick = () => {
  if (menuSel.mode !== 'level' && menuSel.mode !== 'campaign') menuSel.mode = 'level';
  renderMenu();
};
document.getElementById('modeInfinite').onclick = () => {
  if (menuSel.mode !== 'infinite' && menuSel.mode !== 'rush') menuSel.mode = 'infinite';
  renderMenu();
};
document.getElementById('modeDuel').onclick = () => { menuSel.mode = 'duel'; renderMenu(); };
document.getElementById('campStory').onclick = () => { menuSel.mode = 'level'; renderMenu(); };
document.getElementById('campConquest').onclick = () => { menuSel.mode = 'campaign'; renderMenu(); };
document.getElementById('infEndless').onclick = () => { menuSel.mode = 'infinite'; renderMenu(); };
document.getElementById('infGauntlet').onclick = () => { menuSel.mode = 'rush'; menuSel.chaos = false; renderMenu(); };
document.getElementById('infChaos').onclick = () => { menuSel.mode = 'rush'; menuSel.chaos = true; renderMenu(); };
document.getElementById('btnTooEasy').onclick = () => { advOpen = !advOpen; renderMenu(); };
document.getElementById('btnHost').onclick = hostDuel;
document.getElementById('btnJoin').onclick = () =>
  joinDuel(document.getElementById('joinCode').value);
document.getElementById('joinCode').addEventListener('keydown', ev => {
  ev.stopPropagation();
  if (ev.key === 'Enter') joinDuel(ev.target.value);
});
renderMenu();

/* ---------- the seal (admin code entry) ----------
   Fudemaru stays entirely outside the honor economy: no cost, no gate.
   Inscribing its name opens the seal and the save remembers it across
   reloads; inscribing it again closes the seal and puts the brush away. */
const sealInputEl = document.getElementById('sealInput');
const sealMsgEl = document.getElementById('sealMsg');
sealInputEl.addEventListener('keydown', ev => {
  ev.stopPropagation();
  if (ev.key !== 'Enter') return;
  const v = sealInputEl.value.trim().toLowerCase();
  sealInputEl.value = '';
  if (!v) return;
  if (v === 'fudemaru' || v === '筆' || v === 'the brush that unwrites') {
    if (game.adminUnlocked) {
      // spoken twice, the seal closes again
      game.adminUnlocked = false;
      save.adminUnlocked = false;
      if (game.equipped === 'fudemaru') game.equipped = 'tetsu';
      if (save.equipped === 'fudemaru') save.equipped = 'tetsu';
      persistSave();
      sealMsgEl.textContent = '筆 the brush sleeps once more — the seal is closed';
    } else {
      game.adminUnlocked = true;
      game.equipped = 'fudemaru';
      save.adminUnlocked = true;
      save.equipped = 'fudemaru';
      persistSave();
      sealMsgEl.textContent = '筆 the brush awakens — and it will remember, even if you leave';
    }
  } else {
    sealMsgEl.textContent = 'the seal does not answer';
  }
});

