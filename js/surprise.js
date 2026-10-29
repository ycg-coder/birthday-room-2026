/* ============================================================
   surprise.js — 惊喜流程编排
   - showLetter(key, onClose)       信纸模态（第一/第二封信）
   - runSurpriseSequence(world)     蒙眼黑屏 → 房间变身 → 全屏礼花 + 生日歌
   - 全屏礼花为独立 2D 画布（奶油/粉/金色纸片），黑屏期间不可见，
     随"睁眼"（黑屏淡出）一起显现
   ============================================================ */
import * as THREE from 'three';
import { audio } from './audio.js';
import { LETTERS } from './letters.js';

let els = null;

function buildEls() {
  const app = document.getElementById('app');

  /* ---- 信纸模态 ---- */
  const modal = document.createElement('div');
  modal.id = 'letter-modal';
  modal.className = 'letter-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'letter-title');
  modal.setAttribute('aria-describedby', 'letter-body');
  modal.innerHTML = `
    <div class="letter-card" tabindex="-1">
      <div class="letter-seal">♥</div>
      <div class="letter-title" id="letter-title"></div>
      <div class="letter-body" id="letter-body"></div>
      <div class="letter-sign" id="letter-sign"></div>
      <button class="letter-close" id="letter-close" type="button"></button>
    </div>`;
  app.appendChild(modal);

  /* ---- 蒙眼黑屏 ---- */
  const blind = document.createElement('div');
  blind.id = 'blindfold';
  blind.className = 'blindfold';
  blind.innerHTML = '<div class="blind-text">蒙住眼～不许偷看哦</div>';
  app.appendChild(blind);

  /* ---- 全屏礼花画布 ---- */
  const canvas = document.createElement('canvas');
  canvas.id = 'confetti-canvas';
  app.appendChild(canvas);

  return {
    modal, blind, canvas,
    title: modal.querySelector('#letter-title'),
    body: modal.querySelector('#letter-body'),
    sign: modal.querySelector('#letter-sign'),
    close: modal.querySelector('#letter-close'),
    card: modal.querySelector('.letter-card'),
  };
}

/* ============================================================
   信纸模态
   ============================================================ */
let letterClosing = false;
export function showLetter(key, onClose) {
  if (!els) els = buildEls();
  const data = LETTERS[key];
  if (!data) return;
  letterClosing = false;
  els.title.textContent = data.title;
  // 文案用 textContent 写入，避免用户替换信件时意外注入 HTML。
  els.body.replaceChildren();
  data.paragraphs.forEach((text) => {
    const p = document.createElement('p');
    p.textContent = text;
    els.body.appendChild(p);
  });
  els.sign.textContent = data.sign;
  els.close.textContent = data.closeText;
  const closeLetter = () => {
    if (letterClosing) return;
    letterClosing = true;
    els.modal.classList.remove('show');
    audio.pop();
    if (onClose) setTimeout(onClose, 380); // 等信纸收起再走流程
    setTimeout(() => { letterClosing = false; }, 520);
  };
  els.close.onclick = closeLetter;
  els.modal.onkeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeLetter();
    }
  };
  els.modal.classList.add('show');
  audio.romantic();
  requestAnimationFrame(() => els.close.focus({ preventScroll: true }));
}

/* ============================================================
   全屏礼花（2D 画布）：顶部飘落 + 中心爆开两拨
   ============================================================ */
function startConfetti(canvas, duration = 6.5) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  const resize = () => {
    W = Math.floor(window.innerWidth * dpr);
    H = Math.floor(window.innerHeight * dpr);
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  };
  resize();
  const onResize = () => resize();
  window.addEventListener('resize', onResize);

  // ★ 第三轮：更华丽的调色板（奶油 / 胭脂 / 香槟金 / 亮白）
  const COLORS = ['#f6c9d3', '#e7a6b6', '#d99aab', '#e9c98a', '#f3e3cf', '#ffffff', '#f7d9de', '#cfa96e'];
  const parts = [];
  const rand = (a, b) => a + Math.random() * (b - a);

  // 顶部飘落：片数翻倍、尺寸更大，并混入细长缎带（kind 2）
  for (let i = 0; i < 230; i++) {
    const ribbon = Math.random() < 0.22;
    parts.push({
      x: Math.random() * W, y: -Math.random() * H * 0.7 - 20 * dpr,
      w: (ribbon ? (3 + Math.random() * 3) : (6 + Math.random() * 11)) * dpr,
      h: (ribbon ? (20 + Math.random() * 26) : (9 + Math.random() * 13)) * dpr,
      vx: (Math.random() - 0.5) * 60 * dpr, vy: (120 + Math.random() * 180) * dpr,
      rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 8,
      color: COLORS[(Math.random() * COLORS.length) | 0], sway: Math.random() * Math.PI * 2,
      kind: ribbon ? 2 : 0,
    });
  }
  // 中心爆开（从画面中上方径向喷射）—— 两波叠爆更有层次
  const cx = W * 0.5, cy = H * 0.34;
  const burst = (delay, count, power) => {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = power * (0.45 + Math.random() * 0.95) * dpr;
      parts.push({
        x: cx, y: cy,
        w: (7 + Math.random() * 9) * dpr, h: (7 + Math.random() * 9) * dpr,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 180 * dpr,
        rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 14,
        color: COLORS[(Math.random() * COLORS.length) | 0], sway: 0,
        kind: 1, born: performance.now() + delay,
      });
    }
  };
  burst(0, 120, 460);
  burst(420, 90, 380);

  let raf = 0;
  let last = performance.now();
  const t0 = last;
  const fadeStart = t0 + duration * 1000;

  const tick = (now) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    ctx.clearRect(0, 0, W, H);
    const alpha = now < fadeStart ? 1 : Math.max(0, 1 - (now - fadeStart) / 1100);
    if (alpha <= 0) {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      ctx.clearRect(0, 0, W, H);
      return;
    }
    ctx.globalAlpha = alpha;
    for (const p of parts) {
      if (p.born && now < p.born) continue;     // 第二波延迟出场
      p.vy += 540 * dpr * dt;                    // 重力
      p.vx *= (1 - 1.1 * dt);                    // 空气阻力
      if (p.kind === 0 || p.kind === 2) p.sway += dt * 2.6;
      p.x += (p.vx + (p.kind === 0 || p.kind === 2 ? Math.sin(p.sway) * 30 * dpr : 0)) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.y > H + 40 * dpr) { p.y = -30 * dpr; p.x = Math.random() * W; p.vy = 100 * dpr; }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      // 亮白/金色碎片加一点高光，更有"闪"感
      if (p.color === '#ffffff' || p.color === '#cfa96e') {
        ctx.shadowColor = p.color; ctx.shadowBlur = 6 * dpr;
      }
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

/* ============================================================
   变身序列：蒙眼 →（黑屏中切房间）→ 睁眼 + 礼花 + 生日歌
   ============================================================ */
let surpriseSequenceRunning = false;
export function runSurpriseSequence(world) {
  if (surpriseSequenceRunning) return;
  surpriseSequenceRunning = true;
  if (!els) els = buildEls();
  const { blind, canvas } = els;
  audio.unlock();

  // 1. 蒙眼：上下两层黑色眼睑合拢，不是突兀地盖一块矩形黑屏。
  blind.classList.remove('opening', 'dismissed');
  blind.classList.add('show');

  // 黑屏期间回到全景构图，并把房间切换成布置好的状态，避免近景视角突然揭晓。
  setTimeout(() => {
    if (world.returnHomeView) world.returnHomeView({ silent: true });
    if (world.setRoomState) world.setRoomState('full');
  }, 1400);

  // 2. 睁眼：眼睑向上下滑开，礼花与生日歌藏在“睁眼”瞬间出现。
  setTimeout(() => {
    blind.classList.add('opening');
  }, 2050);

  // 眼睑已经打开一部分、房间灯光接近完全点亮时，再同步播放生日歌与礼花。
  setTimeout(() => {
    audio.happyBirthday();
    startConfetti(canvas, 5);
    if (world.confetti) {
      /* 三条彩带束（3D 空间碎片）按新布局落点（2026-10-26 重排）：
         茶几顶（装饰版）现约 y=0.31、桌心 z=0.13，拱门中心 (0.025,0.7,-0.617)，地毯 x∈[-0.87,0.87]。
         主束打在拱门正下方偏前（会从"HAPPY BIRTHDAY"下方窜上去再落下来），
         两束打在茶几前的地毯上，让纸屑在整个地毯范围内铺开。
         ★ 第三轮：池子已扩到 360 片，三条 150+60+60=270 ≤ 360，三束都稳出。 */
      world.confetti.burst(new THREE.Vector3(0.02, 0.92, -0.05), 150, 2.0);
      world.confetti.burst(new THREE.Vector3(-0.46, 0.70, 0.26), 60, 1.4);
      world.confetti.burst(new THREE.Vector3(0.50, 0.70, 0.26), 60, 1.4);
    }
  }, 2500);

  // 眼睑离开视野后淡出覆盖层；延迟清掉 opening，避免眼睑动画在隐藏时反向复位。
  setTimeout(() => blind.classList.add('dismissed'), 3200);
  setTimeout(() => blind.classList.remove('show', 'opening', 'dismissed'), 3500);

  // 3. 引导提示
  setTimeout(() => {
    if (world.toast) world.toast('🎉 生日快乐！慢慢看看，这间小屋里还藏着一些心意。', 4600);
  }, 3900);
  setTimeout(() => { surpriseSequenceRunning = false; }, 6800);
}

/* 测试钩子 */
export function setupSurprise(world) {
  if (!els) els = buildEls();
  world.showLetter = showLetter;
  world.runSurpriseSequence = runSurpriseSequence;
  window.__surprise = { showLetter, runSurpriseSequence };
  return { showLetter, runSurpriseSequence };
}
