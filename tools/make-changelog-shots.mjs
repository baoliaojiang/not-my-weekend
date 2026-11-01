/* =========================================================
   更新日志配图：抓真实游戏画面 → assets/ui/changelog/
   ---------------------------------------------------------
   更新日志要"让玩家一眼看出这次改了什么"，
   配图直接抓游戏本体，不画示意图。

   原则（用户要求）：
     · 每个大方向配一张主图，说到哪儿贴到哪儿
     · 细节条目再适当补图
     · 同一张图不要在日志里重复出现

   产出：
     hud-light.png / hud-dark.png   顶栏展开（浅 / 深）
     contrast.gif                    深浅配色切换动效
     campus-score.png                校园通成绩单
     campus-timetable.png            校园通课表
     campus-leave.png                校园通请假回执
     phone-home.png                  手机桌面
     settings.png                    设置页
     versions.png                    版本管理页
     update-notice.png               「有新版本」弹窗
     dialog.png                      对话框（立绘 + 文字）

   用法：node tools/make-changelog-shots.mjs
   ========================================================= */
import puppeteer from 'file:///C:/Users/12821/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets', 'ui', 'changelog');
const TMP = path.join(ROOT, 'build', '_clshots');
const BASE = process.env.ZB_BASE || 'http://127.0.0.1:8899';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

const wait = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required']
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
await wait(1500);

/* ---------- 整屏截图 ---------- */
async function fullShot(file) {
  const p = path.join(TMP, file);
  await page.screenshot({ path: p, type: 'png' });
  return p;
}

/* ---------- 取元素矩形 ---------- */
async function rectOf(sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return null;
    return {
      x: Math.max(0, Math.round(r.x)), y: Math.max(0, Math.round(r.y)),
      width: Math.round(r.width), height: Math.round(r.height)
    };
  }, sel);
}

/* =========================================================
   一、开一局新游戏
   ---------------------------------------------------------
   顺序不能乱：启动画面 → 标题页「开始游戏」→ 覆盖存档确认
   → 免责声明 → 序章开场卡板。
   ========================================================= */
await page.evaluate(() => {
  const s = document.querySelector('#bootSkip'); if (s) s.click();
  const bs = document.querySelector('#bootSeq'); if (bs) bs.remove();
});
await wait(800);
await page.evaluate(() => {
  const n = document.querySelector('[data-act="new"]'); if (n) n.click();
});
await wait(900);
/* 已有自动存档时会先弹「覆盖，重新开始」 */
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => /覆盖/.test(x.textContent || ''));
  if (b) b.click();
});
await wait(700);
/* 免责声明 */
await page.evaluate(() => {
  const o = document.querySelector('#disclaimerOk'); if (o) o.click();
});
await wait(2000);

/* =========================================================
   二、推进剧情
   ---------------------------------------------------------
   三种拦路虎：
     · 开场卡板（#curtain）要单独点掉
     · 「你是哪一位」选人面板的按钮文案是「就这样，开始」
     · 顶栏「菜单」会弹出「继续游戏」面板，要关掉
   ========================================================= */
async function advance() {
  return page.evaluate(() => {
    /* 1. 开场卡板 */
    const c = document.querySelector('#curtain');
    if (c && !c.hidden) { c.click(); return 'card'; }
    /* 2. 选人面板 / 各种确认框。
          注意：必须过滤掉不可见的按钮——免责声明那个
          「我已了解，进入游戏」在 DOM 里一直都在，
          只是被 hidden 掉了，但文字一样能被 /进入游戏/ 匹配上，
          不排除的话每一步都在点它，剧情就永远推不动。 */
    const btns = [...document.querySelectorAll('button')].filter(b2 => {
      if (b2.closest('[hidden]')) return false;
      const r = b2.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    const ask = btns.find(x => /就这样|我已了解|进入游戏|继续$|确定/.test((x.textContent || '').trim()));
    if (ask) { ask.click(); return 'ask'; }
    /* 3. 弹出的浮层（继续游戏等），先关掉 */
    const x = document.querySelector('.panel-close, .modal-close, [data-close]');
    if (x) { x.click(); return 'close'; }
    return null;
  });
}

let steps = 0;
for (; steps < 260; steps++) {
  const r = await advance();
  if (r) { await wait(700); continue; }
  await page.keyboard.press('Space').catch(() => { });
  await page.evaluate(() => { const s = document.querySelector('#stage'); if (s) s.click(); });
  await wait(220);
  /* 已经走到有立绘的剧情就收手 */
  const got = await page.evaluate(() => {
    const sp = document.querySelector('#spriteLayer');
    return !!(sp && sp.children.length) && !document.querySelector('#curtain.on');
  });
  if (got) break;
}
console.log('  推进步数：' + steps);

/* 关掉可能残留的浮层，让画面干净 */
await page.evaluate(() => {
  const u = window.__ZBNX && window.__ZBNX.ui;
  if (u && u.closePanel) { try { u.closePanel(); } catch (e) { /* 忽略 */ } }
});
await wait(600);

/* 对话框：立绘 + 文字 */
await fullShot('_dialog.png');
const dlgRect = await rectOf('#stage');

/* =========================================================
   三、顶栏展开（浅 / 深）+ 配色切换动效
   ========================================================= */
await page.evaluate(() => {
  const h = document.querySelector('#hud');
  const t = document.querySelector('#hudToggle');
  if (h && h.classList.contains('is-min') && t) {
    t.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }
});
await wait(900);

/* 顶栏整条：左边章节名 + 右边功能按钮，信息比只截右侧完整 */
const hudRect = await page.evaluate(() => {
  const h = document.querySelector('#hud');
  if (!h) return null;
  const r = h.getBoundingClientRect();
  return {
    x: 0, y: Math.max(0, Math.round(r.y)),
    width: 1280, height: Math.round(r.height) + 10
  };
});

await page.evaluate(() => document.body.classList.remove('night'));
await wait(600);
await fullShot('_hud_light.png');
await page.evaluate(() => document.body.classList.add('night'));
await wait(600);
await fullShot('_hud_dark.png');

/* 动效帧：顶栏浅 ↔ 深 */
for (let i = 1; i <= 4; i++) {
  await page.evaluate((k) => {
    document.body.classList.toggle('night', k % 2 === 0);
  }, i);
  await wait(500);
  await fullShot('_g' + i + '.png');
}
await page.evaluate(() => document.body.classList.remove('night'));
await wait(400);

/* =========================================================
   四、更新日志面板
   ========================================================= */
await page.evaluate(() => {
  const m = window.__ZBNX;
  if (m && m.ui) m.ui.openChangelog();
});
await wait(1800);
const clogRect = await rectOf('#panelBody') || await rectOf('.clog');
await fullShot('_clog.png');
await page.evaluate(() => { const u = window.__ZBNX.ui; u.closePanel(); });
await wait(500);

/* =========================================================
   五、手机：桌面 / 校园通各功能页 / 设置 / 版本管理
   ========================================================= */
async function phoneHome() {
  await page.evaluate(() => {
    const u = window.__ZBNX && window.__ZBNX.ui;
    if (!u) return;
    u._mintStack = [];
    u._renderPhoneHome();
  });
  await wait(800);
}
async function pushApp(id, label) {
  await page.evaluate((i, lb) => {
    const u = window.__ZBNX && window.__ZBNX.ui;
    if (!u) return;
    u._pushApp(i, lb);
  }, id, label || '');
  await wait(1100);
}
async function clickText(re) {
  return page.evaluate((r) => {
    const rx = new RegExp(r);
    const el = [...document.querySelectorAll('button, .crow, .mitem, .menu-item, li, div')]
      .filter(x => rx.test(x.textContent || '') && x.children.length < 6)
      .pop();
    if (el) { el.click(); return true; }
    return false;
  }, re);
}

/* 5.1 手机桌面 */
await phoneHome();
const homeRect = await rectOf('.mos');
await fullShot('_phone_home.png');

/* 5.2 校园通：成绩单 / 课表 / 请假回执
       校园通不是 _pushApp 的独立应用，是 _phoneApp('campus') 推进手机页栈的；
       入口按钮靠 data-cp 认，不认文字。 */
async function openCampus() {
  await phoneHome();
  await page.evaluate(() => {
    const u = window.__ZBNX && window.__ZBNX.ui;
    if (!u) return;
    u._phoneApp('campus', '校园通');
  });
  await wait(1200);
}
async function clickCp(cp) {
  return page.evaluate((k) => {
    const el = document.querySelector('[data-cp="' + k + '"]');
    if (el) { el.click(); return true; }
    return false;
  }, cp);
}

await openCampus();
console.log('  成绩查询入口：' + await clickCp('score'));
await wait(1200);
await page.evaluate(() => {
  const el = document.querySelector('[data-score]');
  if (el) el.click();
});
await wait(1200);
const scoreRect = await rectOf('.mos');
await fullShot('_campus_score.png');

await openCampus();
console.log('  课表入口：' + await clickCp('timetable'));
await wait(1200);
const timetableRect = await rectOf('.mos');
await fullShot('_campus_timetable.png');

await openCampus();
console.log('  请假入口：' + await clickCp('leave'));
await wait(1200);
const leaveRect = await rectOf('.mos');
await fullShot('_campus_leave.png');

/* 5.3 设置页 */
await phoneHome();
await pushApp('settings');
const settingsRect = await rectOf('.mos');
await fullShot('_settings.png');

/* 5.4 版本管理页（塞示例数据，截图才有内容） */
await phoneHome();
await pushApp('versions');
await page.evaluate(() => {
  const box = document.querySelector('#vpList');
  if (!box) return;
  box.innerHTML = `
    <div class="vp-item" data-vrow="0.6.6.0">
      <div class="vp-head"><span class="vp-ver">v0.6.6.0</span><span class="vp-date">2026-11-01</span>
        <button class="vp-btn vp-btn-up" type="button" data-vp="0.6.6.0">更新</button></div>
      <div class="vp-title">版本自己说了算：想更新就更新，想回旧版就回旧版</div>
    </div>
    <div class="vp-item is-cur" data-vrow="0.6.5.0">
      <div class="vp-head"><span class="vp-ver">v0.6.5.0</span><span class="vp-date">2026-11-01</span>
        <span class="vp-cur">当前版本</span></div>
      <div class="vp-title">看得清、点得到：界面的字在什么背景下都读得出来</div>
    </div>
    <div class="vp-item" data-vrow="0.6.4.0">
      <div class="vp-head"><span class="vp-ver">v0.6.4.0</span><span class="vp-date">2026-10-20</span>
        <button class="vp-btn vp-btn-down" type="button" data-vp="0.6.4.0">回滚</button></div>
      <div class="vp-title">手机第一次像一台真的手机</div>
    </div>`;
});
await wait(700);
const vpRect = await rectOf('.mapp-vp') || await rectOf('.mos');
await fullShot('_versions.png');

await browser.close();

/* =========================================================
   六、裁剪并生成 GIF
   ========================================================= */
const PY = `
import sys, os
from PIL import Image
out, tmp = sys.argv[1], sys.argv[2]
def parse(s):
    if not s: return None
    return tuple(int(x) for x in s.split(','))
def crop(src, dst, box=None, maxw=900):
    im = Image.open(os.path.join(tmp, src)).convert('RGB')
    if box:
        b = parse(box)
        if b:
            im = im.crop(b)
    if im.width > maxw:
        im = im.resize((maxw, int(im.height * maxw / im.width)), Image.LANCZOS)
    im.save(os.path.join(out, dst), optimize=True)
    print('  ' + dst, im.size)

crop('_hud_light.png', 'hud-light.png', sys.argv[3], 1100)
crop('_hud_dark.png',  'hud-dark.png',  sys.argv[3], 1100)
crop('_dialog.png',    'dialog.png',    sys.argv[4], 1100)
crop('_clog.png',      'update-notice.png', sys.argv[5], 900)
crop('_phone_home.png','phone-home.png', sys.argv[6], 520)
crop('_campus_score.png', 'campus-score.png', sys.argv[7], 520)
crop('_campus_timetable.png', 'campus-timetable.png', sys.argv[8], 520)
crop('_campus_leave.png', 'campus-leave.png', sys.argv[9], 520)
crop('_settings.png',  'settings.png',  sys.argv[10], 520)
crop('_versions.png',  'versions.png',  sys.argv[11], 520)

# 动效：顶栏浅 → 深 → 浅 → 深
seq = ['_g1.png', '_g2.png', '_g3.png', '_g4.png']
frames = []
for s in seq:
    im = Image.open(os.path.join(tmp, s)).convert('RGB')
    b = parse(sys.argv[3])
    if b: im = im.crop(b)
    if im.width > 620:
        im = im.resize((620, int(im.height * 620 / im.width)), Image.LANCZOS)
    frames.append(im.convert('P', palette=Image.ADAPTIVE, colors=160))
frames[0].save(os.path.join(out, 'contrast.gif'), save_all=True,
               append_images=frames[1:], duration=1100, loop=0, optimize=True)
print('  contrast.gif', frames[0].size)
`;

const pyFile = path.join(TMP, '_mk.py');
fs.writeFileSync(pyFile, PY, 'utf8');
const box = (r) => (r ? `${r.x},${r.y},${r.x + r.width},${r.y + r.height}` : '');
execFileSync('python', [
  pyFile, OUT, TMP,
  box(hudRect), box(dlgRect), box(clogRect),
  box(homeRect), box(scoreRect), box(timetableRect), box(leaveRect),
  box(settingsRect), box(vpRect)
], { stdio: 'inherit' });

console.log('\n输出：' + OUT);
for (const f of fs.readdirSync(OUT).sort()) {
  console.log('  ' + f + '  ' + (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0) + ' KB');
}
