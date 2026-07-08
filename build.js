#!/usr/bin/env node
/* INKBLADE build — stitches src/ chunks into the single shipped index.html.
   The game stays one self-contained file; src/ is where humans edit.
   Usage: node build.js [--watch]                                          */
const fs = require('fs'), path = require('path');

// Manifest order IS execution order — top-level consts and load-time calls
// depend on it. Add new chunks here, never rely on directory sorting.
const MANIFEST = [
  '00-util.js', '05-palette.js', '10-dom.js', '15-fx.js', '20-data.js',
  '25-save.js', '30-player.js', '35-enemies.js', '40-ults.js',
  '45-hazards.js', '50-archer.js', '55-duel.js', '60-net.js', '65-run.js',
  '70-ui.js', '80-audio.js', '90-render.js', '99-boot.js',
];
const MARKER = '<!--GAME_SCRIPT-->\n';

/* boundary lint — the src/MANIFEST.md contract, enforced at build time.
   Each rule: a pattern that may only appear in the allowlisted chunks.  */
const LINT = [
  { re: /localStorage/, name: 'localStorage',
    allow: ['25-save.js'],
    why: 'only the save layer touches storage' },
  { re: /document\./, name: 'document.*',
    allow: ['10-dom.js', '45-hazards.js', '55-duel.js', '60-net.js',
            '65-run.js', '70-ui.js', '80-audio.js', '99-boot.js'],
    why: 'sim/render chunks must not reach into the DOM' },
];
function lint() {
  const bad = [];
  for (const f of MANIFEST) {
    const src = fs.readFileSync(path.join('src', f), 'utf8');
    for (const rule of LINT)
      if (rule.re.test(src) && !rule.allow.includes(f))
        bad.push(f + ' uses ' + rule.name + ' — ' + rule.why);
  }
  if (bad.length) throw new Error('boundary lint failed:\n  ' + bad.join('\n  '));
}

function build() {
  const tpl = fs.readFileSync('index.template.html', 'utf8');
  if (!tpl.includes(MARKER)) throw new Error('template is missing ' + MARKER.trim());
  const onDisk = fs.readdirSync('src').filter(f => f.endsWith('.js')).sort();
  const missing = MANIFEST.filter(f => !onDisk.includes(f));
  const orphans = onDisk.filter(f => !MANIFEST.includes(f));
  if (missing.length) throw new Error('missing chunks: ' + missing.join(', '));
  if (orphans.length) throw new Error('chunks not in MANIFEST: ' + orphans.join(', '));
  lint();
  const body = MANIFEST.map(f => fs.readFileSync(path.join('src', f), 'utf8')).join('');
  fs.writeFileSync('index.html', tpl.replace(MARKER, body));
  console.log('built index.html — ' + MANIFEST.length + ' chunks, '
    + body.split('\n').length + ' script lines, lint clean');
}

build();
if (process.argv.includes('--watch')) {
  console.log('watching src/ + template…');
  let t = null;
  const kick = () => { clearTimeout(t); t = setTimeout(() => {
    try { build(); } catch (e) { console.error(e.message); } }, 60); };
  fs.watch('src', kick);
  fs.watch('index.template.html', kick);
}
