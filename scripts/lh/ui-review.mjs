import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, sleep } from './chrome.mjs';
import { researchRoot, serveUiResearch } from './ui-preview.mjs';

const directions = (process.env.LH_UI_DIRECTIONS || 'mosslight,fieldnotes,tideglass').split(',');
const states = (process.env.LH_UI_STATES || 'locked,exploring,defeat,pause,party,map,gear,title,rewards,entering,leaving,controls,low-health,pet-knocked-out,boss-phase-two').split(',');
const themes = (process.env.LH_UI_THEMES || 'day,dusk,rain').split(',');
const sizes = (process.env.LH_UI_SIZES || '1280x800,390x844').split(',').map(size => size.split('x').map(Number));
const server = await serveUiResearch();
const results = [];
try {
  for (const [width, height] of sizes) {
    const app = await launch({ width, height, scale: 1, reducedMotion: true });
    try {
      for (const direction of directions) for (const theme of themes) for (const state of states) {
        await app.navigate(`${server.url}/mocks/${direction}.html?theme=${theme}&state=${state}`);
        for (let attempt = 0; attempt < 100 && !await app.js('Boolean(window.__uiReady)'); attempt++) await sleep(50);
        if (!await app.js('Boolean(window.__uiReady)')) throw new Error(`Mock did not load: ${direction} ${state} ${theme}`);
        const layout = await app.js(`(() => {
          const visible = n => n.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true });
          const bounds = n => { const b = n.getBoundingClientRect(); return { text: n.textContent.trim().slice(0, 80), class: n.className, x: b.x, y: b.y, width: b.width, height: b.height }; };
          const elements = [...document.querySelectorAll('.region,button')].filter(visible).map(bounds);
          const regions = [...document.querySelectorAll('.region')].filter(visible);
          const overlaps = regions.flatMap((a, i) => regions.slice(i+1).filter(b => !a.contains(b) && !b.contains(a)).filter(b => { const x = bounds(a), y = bounds(b); return Math.min(x.x+x.width,y.x+y.width)-Math.max(x.x,y.x) > 1 && Math.min(x.y+x.height,y.y+y.height)-Math.max(x.y,y.y) > 1; }).map(b => [bounds(a),bounds(b)]));
          return { ready: window.__uiReady, scrollWidth: document.documentElement.scrollWidth, width: innerWidth, height: innerHeight, overlaps, outside: elements.filter(b => b.x < -1 || b.y < -1 || b.x+b.width > innerWidth+1 || b.y+b.height > innerHeight+1), clippedText: [...document.querySelectorAll('button,.meter-label,.pet-name,.skill,.boss-line')].filter(visible).filter(n=>n.scrollWidth > n.clientWidth+1).map(bounds), smallTouchTargets: innerWidth < 600 ? [...document.querySelectorAll('button')].filter(visible).map(bounds).filter(b=>b.width < 44 || b.height < 44) : [], runningAnimations: document.getAnimations().filter(a=>a.playState === 'running').length, elements };
        })()`);
        const folder = join(researchRoot, 'shots', direction);
        mkdirSync(folder, { recursive: true });
        await app.shot(join(folder, `${width}x${height}-${theme}-${state}.png`));
        if (state === 'locked' && direction !== 'baseline') for (const name of ['vitals', 'companion', 'boss']) {
          const clip = await app.js(`(() => { const b = document.querySelector('.${name}').getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height, scale: 2 }; })()`);
          const shot = await app.send('Page.captureScreenshot', { format: 'png', clip });
          writeFileSync(join(folder, `${width}x${height}-${theme}-${name}-2x.png`), Buffer.from(shot.data, 'base64'));
        }
        const ok = layout.scrollWidth === width && !layout.outside.length && !layout.overlaps.length && !layout.clippedText.length && !layout.smallTouchTargets.length && !layout.runningAnimations;
        results.push({ direction, theme, state, width, height, ok, layout });
        if (!ok) console.log(JSON.stringify({ direction, theme, state, overlaps: layout.overlaps, outside: layout.outside, clippedText: layout.clippedText, smallTouchTargets: layout.smallTouchTargets }));
      }
      if (app.errors.length) throw new Error(app.errors.join('\n'));
    } finally { await app.close(); }
  }
} finally {
  const report = ['LH_UI_DIRECTIONS', 'LH_UI_STATES', 'LH_UI_THEMES', 'LH_UI_SIZES'].some(name => process.env[name]) ? 'layout-review-subset.json' : 'layout-review.json';
  writeFileSync(join(researchRoot, report), JSON.stringify(results, null, 2));
  await server.close();
}
console.log(`${results.filter(r=>r.ok).length}/${results.length} layouts pass. Screenshots require visual review.`);
if (results.some(r=>!r.ok)) process.exitCode = 1;
