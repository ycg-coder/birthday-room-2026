/* ============================================================
   textures.js — 程序化 Canvas 贴图（木地板 / 蕾丝 / 猫脸 /
   字母气球 / 迎宾牌 / 信纸 / 纱幔 / 烟雾 等）
   ============================================================ */
import * as THREE from 'three';
import { rand } from './helpers.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function toTexture(canvas, { srgb = true, repeat = null, aniso = 8 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = aniso;
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat[0], repeat[1]); }
  return tex;
}
const FONT = (size, weight = 'bold') =>
  `${weight} ${size}px "PingFang SC","Hiragino Sans GB","Microsoft YaHei","Trebuchet MS","Arial Rounded MT Bold",sans-serif`;

/* ---------------- 浅原木地板 ---------------- */
export function woodFloorTexture() {
  const [c, ctx] = makeCanvas(1024, 1024);
  const rows = 7, plankH = 1024 / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * plankH;
    const shade = 232 + Math.random() * 14;
    ctx.fillStyle = `rgb(${shade},${shade - 12},${shade - 38})`;
    ctx.fillRect(0, y, 1024, plankH);
    // 木纹
    for (let g = 0; g < 9; g++) {
      ctx.strokeStyle = `rgba(150,124,92,${0.05 + Math.random() * 0.06})`;
      ctx.lineWidth = 1 + Math.random() * 2.2;
      ctx.beginPath();
      const gy = y + rand(8, plankH - 8);
      ctx.moveTo(0, gy);
      for (let x = 0; x <= 1024; x += 64) ctx.lineTo(x, gy + Math.sin(x * 0.011 + g + r) * 5);
      ctx.stroke();
    }
    // 板缝
    ctx.fillStyle = 'rgba(120,100,75,0.5)';
    ctx.fillRect(0, y, 1024, 2.5);
    // 随机短竖缝
    if (Math.random() > 0.35) {
      const jx = rand(120, 900);
      ctx.fillRect(jx, y, 2.5, plankH * rand(0.4, 0.9));
    }
    // 高光
    ctx.fillStyle = 'rgba(255,252,244,0.10)';
    ctx.fillRect(0, y + 2, 1024, plankH * 0.3);
  }
  return toTexture(c, { repeat: [3, 2.6] });
}

/* ---------------- 浅米白墙面（细腻肌理） ---------------- */
export function wallTexture() {
  const [c, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#f4f0e8';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(${180 + rand(-20, 20)},${168 + rand(-20, 20)},${148 + rand(-20, 20)},${rand(0.02, 0.06)})`;
    ctx.fillRect(rand(0, 512), rand(0, 512), rand(1, 2.4), rand(1, 2.4));
  }
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, 'rgba(255,255,255,0.10)');
  g.addColorStop(1, 'rgba(190,175,150,0.07)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  return toTexture(c, { repeat: [2, 1] });
}

/* ---------------- 浅米地毯 ---------------- */
export function carpetTexture() {
  const [c, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#f7f3ea';
  ctx.fillRect(0, 0, 512, 512);
  // 长绒毛笔触（白色蓬松）
  for (let i = 0; i < 6400; i++) {
    ctx.strokeStyle = `rgba(${rand(242, 255)},${rand(238, 252)},${rand(228, 246)},${rand(0.1, 0.28)})`;
    ctx.lineWidth = rand(1, 2.4);
    const x = rand(0, 512), y = rand(0, 512), l = rand(4, 12);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rand(-3, 3), y + l); ctx.stroke();
  }
  // 柔和阴影波纹
  for (let r = 40; r < 400; r += 46) {
    ctx.strokeStyle = 'rgba(226,216,198,0.14)';
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(256, 256, r, 0, 6.29); ctx.stroke();
  }
  return toTexture(c, { repeat: [2, 1.4] });
}

/* ---------------- Bouclé 圈圈纱沙发肌理 ---------------- */
export function boucleTexture() {
  const [c, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#f8f3ea';
  ctx.fillRect(0, 0, 512, 512);
  // 圈圈纱环状纹理
  for (let i = 0; i < 2400; i++) {
    const x = rand(0, 512), y = rand(0, 512), r = rand(2.5, 6);
    ctx.strokeStyle = `rgba(${rand(215, 240)},${rand(205, 232)},${rand(190, 222)},${rand(0.25, 0.6)})`;
    ctx.lineWidth = rand(1, 1.8);
    ctx.beginPath(); ctx.arc(x, y, r, rand(0, 3), rand(3, 6.3)); ctx.stroke();
  }
  // 细噪点
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = `rgba(${rand(190, 225)},${rand(182, 218)},${rand(168, 205)},${rand(0.05, 0.16)})`;
    ctx.fillRect(rand(0, 512), rand(0, 512), 1.4, 1.4);
  }
  return toTexture(c, { repeat: [3, 2] });
}

/* ---------------- 蛋糕侧面（奶油白→浅粉渐变 + 波浪裱花） ---------------- */
export function cakeSideTexture() {
  const [c, ctx] = makeCanvas(256, 128);
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#faf1e2');
  g.addColorStop(0.55, '#f6e3d8');
  g.addColorStop(1, '#f2d7d4');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 128);
  // 细腻竖向奶油纹
  for (let x = 0; x < 256; x += 7) {
    ctx.fillStyle = `rgba(255,255,255,${rand(0.03, 0.1)})`;
    ctx.fillRect(x, 0, rand(2, 4), 128);
  }
  // 白色波浪裱花线条
  ctx.strokeStyle = 'rgba(255,253,248,0.85)';
  ctx.lineWidth = 3.2;
  for (const yy of [26, 66, 104]) {
    ctx.beginPath();
    for (let x = 0; x <= 256; x += 8) {
      ctx.lineTo(x, yy + Math.sin(x * 0.09) * 4.5);
    }
    ctx.stroke();
  }
  return toTexture(c);
}

/* ---------------- 蜡烛（奶油底 + 粉色斜纹） ---------------- */
export function candleTexture() {
  const [c, ctx] = makeCanvas(64, 128);
  ctx.fillStyle = '#fdf6ea';
  ctx.fillRect(0, 0, 64, 128);
  ctx.strokeStyle = '#f0c3cd';
  ctx.lineWidth = 9;
  for (let i = -128; i < 128; i += 22) {
    ctx.beginPath();
    ctx.moveTo(i, 128); ctx.lineTo(i + 128, 0);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(10, 0, 8, 128);
  return toTexture(c);
}

/* ---------------- 白色蕾丝花边（透明底） ---------------- */
export function laceTexture() {
  const [c, ctx] = makeCanvas(256, 176);
  ctx.clearRect(0, 0, 256, 176);
  const drawScallop = (x0, y0, x1, y1, n, r) => {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.29); ctx.fill();
    }
  };
  // 外圈扇贝
  drawScallop(14, 12, 242, 12, 13, 9);
  drawScallop(14, 164, 242, 164, 13, 9);
  drawScallop(12, 22, 12, 154, 8, 9);
  drawScallop(244, 22, 244, 154, 8, 9);
  // 内圈小圆点
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  for (let i = 0; i < 24; i++) {
    const t = i / 23;
    ctx.beginPath(); ctx.arc(30 + t * 196, 34, 2.6, 0, 6.29); ctx.fill();
    ctx.beginPath(); ctx.arc(30 + t * 196, 142, 2.6, 0, 6.29); ctx.fill();
  }
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    ctx.beginPath(); ctx.arc(34, 40 + t * 96, 2.6, 0, 6.29); ctx.fill();
    ctx.beginPath(); ctx.arc(222, 40 + t * 96, 2.6, 0, 6.29); ctx.fill();
  }
  // 内圈细线
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, 208, 128);
  return toTexture(c);
}

/* ---------------- 信纸文字 ---------------- */
export function letterTexture() {
  const [c, ctx] = makeCanvas(512, 360);
  ctx.fillStyle = '#fffdf6';
  ctx.fillRect(0, 0, 512, 360);
  ctx.strokeStyle = 'rgba(233,179,191,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, 484, 332);
  ctx.fillStyle = '#7a6a5c';
  ctx.font = FONT(30);
  ctx.fillText('亲爱的你：', 44, 76);
  ctx.font = FONT(44);
  ctx.fillStyle = '#e29aab';
  ctx.fillText('生日快乐！', 44, 136);
  ctx.font = FONT(21, 'normal');
  ctx.fillStyle = '#8a7a6a';
  const lines = [
    '愿你新的一岁，每天都被温柔与惊喜环绕。',
    '这个小客厅里的一切——蛋糕、花束、',
    '戒指盒里的小小心意，还有这封信，',
    '都是为你准备的。',
  ];
  lines.forEach((l, i) => ctx.fillText(l, 44, 186 + i * 34));
  ctx.font = FONT(20, 'normal');
  ctx.fillText('—— 永远想念你的人', 300, 322);
  // 小爱心与小花
  const heart = (x, y, s, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x + s, y - s * 0.4, x + s * 0.45, y - s, x, y - s * 0.35);
    ctx.bezierCurveTo(x - s * 0.45, y - s, x - s, y - s * 0.4, x, y + s * 0.3);
    ctx.fill();
  };
  heart(455, 60, 12, '#eeb7c2');
  heart(120, 310, 9, '#f3d5db');
  ctx.fillStyle = '#eeb7c2';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath(); ctx.arc(380 + i * 22, 316, 4, 0, 6.29); ctx.fill();
  }
  return toTexture(c);
}

/* ---------------- 迎宾牌面板（粉裙 Kitty 抱蛋糕 · 画框风） ---------------- */
export function boardArtTexture() {
  const W = 620, H = 1420;
  const [c, ctx] = makeCanvas(W, H);
  ctx.clearRect(0, 0, W, H);
  const pink = '#e29aab';
  const pinkSoft = '#f3d5db';
  const gold = '#cfa96e';

  /* --- 画框：原木外框 + 奶油内衬 --- */
  ctx.fillStyle = '#e6d3b6';
  roundRect(ctx, 10, 10, W - 20, H - 20, 28);
  ctx.fill();
  ctx.strokeStyle = 'rgba(176,146,106,0.85)';
  ctx.lineWidth = 7;
  roundRect(ctx, 10, 10, W - 20, H - 20, 28);
  ctx.stroke();
  // 原木纹
  ctx.strokeStyle = 'rgba(176,146,106,0.28)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 10; i++) {
    const yy = 26 + i * 34 + (i % 2) * 9;
    ctx.beginPath();
    ctx.moveTo(24, yy);
    for (let x = 24; x <= W - 24; x += 40) ctx.lineTo(x, yy + Math.sin(x * 0.05 + i) * 4);
    ctx.stroke();
  }
  // 奶油内衬
  ctx.fillStyle = '#fdf8f1';
  roundRect(ctx, 40, 40, W - 80, H - 80, 20);
  ctx.fill();
  ctx.strokeStyle = 'rgba(226,154,171,0.55)';
  ctx.lineWidth = 3;
  roundRect(ctx, 40, 40, W - 80, H - 80, 20);
  ctx.stroke();

  /* --- 内芯（裁剪在衬纸中） --- */
  ctx.save();
  roundRect(ctx, 56, 56, W - 112, H - 112, 16);
  ctx.clip();

  // 淡粉晕染背景
  const bg = ctx.createRadialGradient(W / 2, H * 0.44, 40, W / 2, H * 0.44, 470);
  bg.addColorStop(0, 'rgba(253,244,238,0.95)');
  bg.addColorStop(1, 'rgba(247,234,228,0.2)');
  ctx.fillStyle = bg;
  ctx.fillRect(56, 56, W - 112, H - 112);
  // 背景小点饰
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(226,154,171,0.15)' : 'rgba(207,169,110,0.15)';
    ctx.beginPath();
    ctx.arc(80 + Math.random() * (W - 160), 80 + Math.random() * (H - 160), 4 + Math.random() * 4, 0, 6.29);
    ctx.fill();
  }

  // 顶部 HAPPY BIRTHDAY 手绘体
  ctx.textAlign = 'center';
  ctx.font = FONT(50);
  const title = 'HAPPY BIRTHDAY';
  const colors = [pink, gold, pink, '#c0a37c', pink, gold, pink, '#c0a37c', pink, gold, pink, '#c0a37c', pink];
  let tx = 0;
  for (let i = 0; i < title.length; i++) {
    ctx.fillStyle = colors[i % colors.length];
    const wch = ctx.measureText(title[i]).width;
    ctx.fillText(title[i], 92 + tx + wch / 2, 132 + (i % 2) * 9);
    tx += wch + 2;
  }
  // 标题下波浪线
  ctx.strokeStyle = 'rgba(226,154,171,0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 120; x <= W - 120; x += 10) ctx.lineTo(x, 158 + Math.sin(x * 0.09) * 5);
  ctx.stroke();

  /* --- 中央：粉裙 Kitty 抱蛋糕 --- */
  drawKittyCake(ctx, W / 2, H * 0.46, 1);

  /* --- 四角小装饰 --- */
  const star = (x, y, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.45;
      const a = (i / 10) * 6.283 - 1.57;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  };
  const heart = (x, y, s, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x + s, y - s * 0.4, x + s * 0.45, y - s, x, y - s * 0.35);
    ctx.bezierCurveTo(x - s * 0.45, y - s, x - s, y - s * 0.4, x, y + s * 0.3);
    ctx.fill();
  };
  const flower = (x, y, r) => {
    ctx.fillStyle = pinkSoft;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * 6.283;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.62, r * 0.42, a, 0, 6.29);
      ctx.fill();
    }
    ctx.fillStyle = '#f7e6c8';
    ctx.beginPath(); ctx.arc(x, y, r * 0.42, 0, 6.29); ctx.fill();
  };
  star(108, 244, 14, gold); star(516, 240, 11, pinkSoft); star(300, 212, 8, pinkSoft);
  heart(118, 386, 15, pink); heart(508, 378, 12, pinkSoft);
  flower(112, H * 0.73, 24); flower(512, H * 0.75, 18);
  heart(140, H * 0.81, 13, pinkSoft);
  star(496, H * 0.83, 10, gold);

  /* --- 底部丝带 + 生日快乐 --- */
  ctx.save();
  ctx.translate(W / 2, H - 128);
  ctx.fillStyle = pink;
  ctx.beginPath();
  ctx.moveTo(-150, -26); ctx.quadraticCurveTo(-196, 6, -150, 34);
  ctx.quadraticCurveTo(-116, 14, -104, 0); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(150, -26); ctx.quadraticCurveTo(196, 6, 150, 34);
  ctx.quadraticCurveTo(116, 14, 104, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = pink;
  roundRect(ctx, -118, -30, 236, 60, 28);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  roundRect(ctx, -112, -25, 224, 22, 12);
  ctx.fill();
  ctx.restore();
  ctx.textAlign = 'center';
  ctx.font = FONT(46);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('生日快乐', W / 2, H - 88);
  ctx.fillStyle = 'rgba(226,154,171,0.55)';
  ctx.fillText('生日快乐', W / 2 + 2, H - 86);
  star(W / 2 - 150, H - 106, 8, '#ffffff');
  star(W / 2 + 152, H - 106, 8, '#ffffff');
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = i % 2 ? gold : pinkSoft;
    ctx.beginPath(); ctx.arc(160 + i * 38, H - 54, 3.4, 0, 6.29); ctx.fill();
  }
  ctx.restore();
  return toTexture(c);
}

/** 粉裙 Kitty 抱蛋糕（迎宾牌面板用） */
function drawKittyCake(ctx, cx, cy, k = 1) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(k, k);
  const ink = 'rgba(74,68,62,0.85)';
  ctx.lineJoin = 'round';

  /* --- 粉色钟形裙 --- */
  const dressG = ctx.createLinearGradient(0, -40, 0, 130);
  dressG.addColorStop(0, '#f6d3da');
  dressG.addColorStop(1, '#efb9c6');
  ctx.fillStyle = dressG;
  ctx.strokeStyle = 'rgba(214,141,160,0.9)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-52, -46);
  ctx.quadraticCurveTo(-118, 40, -104, 112);
  ctx.quadraticCurveTo(0, 132, 104, 112);
  ctx.quadraticCurveTo(118, 40, 52, -46);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // 裙摆波浪边
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  for (let i = -104; i <= 104; i += 26) ctx.lineTo(i, 112 - Math.sin(i * 0.16) * 5 - 5);
  ctx.stroke();
  // 裙上小爱心
  const heart = (x, y, s, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x + s, y - s * 0.4, x + s * 0.45, y - s, x, y - s * 0.35);
    ctx.bezierCurveTo(x - s * 0.45, y - s, x - s, y - s * 0.4, x, y + s * 0.3);
    ctx.fill();
  };
  heart(-56, 40, 12, 'rgba(255,255,255,0.7)');
  heart(58, 62, 10, 'rgba(255,255,255,0.7)');

  /* --- 白色上衣胸口 --- */
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = ink;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(0, -56, 46, 26, 0, 0, 6.29);
  ctx.fill(); ctx.stroke();

  /* --- 手臂（抱蛋糕） --- */
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = ink;
  ctx.lineWidth = 4;
  [-1, 1].forEach(s => {
    ctx.beginPath();
    ctx.ellipse(s * 66, 4, 15, 34, s * 0.35, 0, 6.29);
    ctx.fill(); ctx.stroke();
  });

  /* --- 双脚 --- */
  [-1, 1].forEach(s => {
    ctx.beginPath();
    ctx.ellipse(s * 52, 122, 20, 13, 0, 0, 6.29);
    ctx.fill(); ctx.stroke();
  });

  /* --- 头 --- */
  ctx.beginPath();
  ctx.ellipse(0, -138, 86, 76, 0, 0, 6.29);
  ctx.fill(); ctx.stroke();
  // 耳朵
  [[-84, -190], [84, -190]].forEach(([ex, ey]) => {
    ctx.beginPath();
    ctx.moveTo(ex, ey + 52);
    ctx.lineTo(ex + 30, ey - 62);
    ctx.lineTo(ex + 78, ey - 14);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  });
  // 眼睛
  ctx.fillStyle = ink;
  ctx.beginPath(); ctx.ellipse(-32, -142, 9, 12.5, 0.08, 0, 6.29); ctx.fill();
  ctx.beginPath(); ctx.ellipse(32, -142, 9, 12.5, -0.08, 0, 6.29); ctx.fill();
  // 黄鼻子
  ctx.fillStyle = '#f2c94c';
  ctx.beginPath(); ctx.ellipse(0, -116, 12, 9, 0, 0, 6.29); ctx.fill();
  ctx.strokeStyle = ink; ctx.lineWidth = 3.5; ctx.stroke();
  // 胡须
  ctx.strokeStyle = ink; ctx.lineWidth = 4;
  [-1, 1].forEach(s => {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(s * 52, -128 + i * 14);
      ctx.lineTo(s * 100, -140 + i * 20);
      ctx.stroke();
    }
  });
  // 耳朵蝴蝶结
  ctx.save();
  ctx.translate(112, -196);
  ctx.scale(0.5, 0.5);
  drawBow(ctx, 0, 0, 1, '#f2b9c6', 'rgba(214,141,160,0.9)');
  ctx.restore();

  /* --- 身前小蛋糕（抱着） --- */
  drawCakeDoodle(ctx, 0, 66, 0.92);

  // 前爪搭在蛋糕上
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = ink; ctx.lineWidth = 4;
  [-1, 1].forEach(s => {
    ctx.beginPath();
    ctx.ellipse(s * 40, 60, 12, 9, 0, 0, 6.29);
    ctx.fill(); ctx.stroke();
  });
  ctx.restore();
}

/* ---------------- 白色蕾丝桌垫（圆形） ---------------- */
export function doilyTexture() {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  ctx.clearRect(0, 0, S, S);
  const cx = S / 2, cy = S / 2;
  const scallopRing = (r, n, dot, color) => {
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, dot, 0, 6.29);
      ctx.fill();
    }
  };
  // 圆盘底
  ctx.fillStyle = 'rgba(255,253,248,0.92)';
  ctx.beginPath(); ctx.arc(cx, cy, 228, 0, 6.29); ctx.fill();
  // 外圈扇贝
  scallopRing(232, 44, 15, 'rgba(255,255,255,0.95)');
  // 蕾丝孔洞（镂空）
  ctx.globalCompositeOperation = 'destination-out';
  scallopRing(196, 32, 9, 'rgba(0,0,0,1)');
  scallopRing(150, 24, 7, 'rgba(0,0,0,1)');
  ctx.beginPath(); ctx.arc(cx, cy, 8, 0, 6.29); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // 细线环
  ctx.strokeStyle = 'rgba(235,225,210,0.85)';
  ctx.lineWidth = 2;
  [170, 124, 96].forEach(r => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.29); ctx.stroke(); });
  // 放射细线
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * 6.283;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 100, cy + Math.sin(a) * 100);
    ctx.lineTo(cx + Math.cos(a) * 165, cy + Math.sin(a) * 165);
    ctx.stroke();
  }
  return toTexture(c);
}

/* ---------------- 字母气球（蓬松立体手写体） ---------------- */
export function letterBalloonTexture(text, variant = 'gold') {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  ctx.clearRect(0, 0, S, S);
  ctx.font = `italic bold 168px "Segoe Script","Brush Script MT","Comic Sans MS","Trebuchet MS",cursive,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // 底部投影
  ctx.fillStyle = variant === 'gold' ? 'rgba(140,98,64,0.5)' : 'rgba(150,140,130,0.5)';
  ctx.fillText(text, S / 2 + 5, S / 2 + 9);
  // 主体（深玫瑰金手写体）
  const g = ctx.createLinearGradient(0, 40, 0, S - 30);
  if (variant === 'gold') {
    g.addColorStop(0, '#c99a6b'); g.addColorStop(0.45, '#b0805a'); g.addColorStop(1, '#96634a');
  } else {
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#f5f1e8'); g.addColorStop(1, '#e5ddd0');
  }
  ctx.fillStyle = g;
  ctx.fillText(text, S / 2, S / 2);
  // 金属高光
  ctx.fillStyle = 'rgba(255,240,220,0.5)';
  ctx.beginPath();
  ctx.ellipse(S / 2 - 46, S / 2 - 58, 24, 11, -0.5, 0, 6.29);
  ctx.fill();
  return toTexture(c);
}

/* ---------------- 数字气球 "20" ---------------- */
export function numberBalloonTexture(text = '20') {
  const W = 512, H = 640;
  const [c, ctx] = makeCanvas(W, H);
  ctx.clearRect(0, 0, W, H);
  ctx.font = `italic bold 380px "Segoe Script","Brush Script MT","Trebuchet MS",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(120,118,126,0.55)';
  ctx.fillText(text, W / 2 + 10, H / 2 + 18);
  const g = ctx.createLinearGradient(60, 40, W - 40, H - 40);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.3, '#e8e8ee');
  g.addColorStop(0.5, '#c9c9d2');
  g.addColorStop(0.72, '#eeeef4');
  g.addColorStop(1, '#b6b6c0');
  ctx.fillStyle = g;
  ctx.fillText(text, W / 2, H / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.ellipse(W / 2 - 60, H / 2 - 190, 150, 34, -0.12, 0, 6.29); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.ellipse(W / 2 + 90, H / 2 + 170, 110, 24, -0.1, 0, 6.29); ctx.fill();
  // 小星星点缀
  ctx.fillStyle = 'rgba(233,179,191,0.9)';
  [[80, 90], [430, 120], [70, 520], [440, 540]].forEach(([x, y]) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 16 : 7;
      const a = (i / 10) * 6.283 - 1.57;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
  });
  return toTexture(c);
}

/* ---------------- 可爱猫脸（透明底，可缩放绘制） ---------------- */
export function catFaceTexture(size = 512) {
  const [c, ctx] = makeCanvas(size, size);
  ctx.clearRect(0, 0, size, size);
  drawCatFace(ctx, size / 2, size / 2, size / 300, size);
  return toTexture(c);
}

/** 绘制猫脸：cx,cy 中心，k 缩放 */
export function drawCatFace(ctx, cx, cy, k = 1, size = 512) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(k, k);
  const ink = 'rgba(74,68,62,0.92)';
  ctx.lineJoin = 'round';
  // 耳朵
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = ink;
  ctx.lineWidth = 7;
  [[-118, -118], [118, -118]].forEach(([ex, ey]) => {
    ctx.beginPath();
    ctx.moveTo(ex, ey + 66);
    ctx.lineTo(ex + 34, ey - 78);
    ctx.lineTo(ex + 96, ey - 20);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  });
  // 头
  ctx.beginPath();
  ctx.ellipse(0, 6, 152, 132, 0, 0, 6.29);
  ctx.fill(); ctx.stroke();
  // 眼睛
  ctx.fillStyle = ink;
  ctx.beginPath(); ctx.ellipse(-56, -2, 10.5, 14.5, 0.1, 0, 6.29); ctx.fill();
  ctx.beginPath(); ctx.ellipse(56, -2, 10.5, 14.5, -0.1, 0, 6.29); ctx.fill();
  // 鼻子
  ctx.fillStyle = '#f2c94c';
  ctx.beginPath(); ctx.ellipse(0, 30, 13, 9.5, 0, 0, 6.29); ctx.fill();
  ctx.strokeStyle = ink; ctx.lineWidth = 4;
  ctx.stroke();
  // 胡须
  ctx.strokeStyle = ink;
  ctx.lineWidth = 5;
  [-1, 1].forEach(s => {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(s * 74, 16 + i * 17);
      ctx.lineTo(s * 138, 4 + i * 24);
      ctx.stroke();
    }
  });
  // 蝴蝶结（右耳）
  ctx.save();
  ctx.translate(150, -108);
  ctx.scale(0.62, 0.62);
  ctx.fillStyle = '#f2b9c6';
  ctx.strokeStyle = 'rgba(214,141,160,0.9)';
  ctx.lineWidth = 8;
  [-1, 1].forEach(s => {
    ctx.beginPath();
    ctx.moveTo(s * 8, 0);
    ctx.quadraticCurveTo(s * 62, -44, s * 66, -4);
    ctx.quadraticCurveTo(s * 60, 34, s * 8, 12);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  });
  ctx.fillStyle = '#eeb7c2';
  ctx.beginPath(); ctx.arc(0, 6, 17, 0, 6.29); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

/* ---------------- 蝴蝶结（2D，面板用） ---------------- */
export function drawBow(ctx, x, y, k, main, deep) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.fillStyle = main;
  ctx.strokeStyle = deep;
  ctx.lineWidth = 6;
  [-1, 1].forEach(s => {
    ctx.beginPath();
    ctx.moveTo(s * 10, 0);
    ctx.quadraticCurveTo(s * 78, -52, s * 82, -6);
    ctx.quadraticCurveTo(s * 74, 42, s * 10, 14);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  });
  ctx.fillStyle = deep;
  ctx.beginPath(); ctx.arc(0, 7, 21, 0, 6.29); ctx.fill(); ctx.stroke();
  // 飘带
  ctx.fillStyle = main;
  [-1, 1].forEach(s => {
    ctx.beginPath();
    ctx.moveTo(s * 14, 16);
    ctx.quadraticCurveTo(s * 44, 40, s * 26, 92);
    ctx.quadraticCurveTo(s * 6, 70, s * 4, 22);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  });
  ctx.restore();
}

/* ---------------- 手绘小蛋糕（面板用） ---------------- */
function drawCakeDoodle(ctx, x, y, k) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  const ink = 'rgba(138,122,104,0.9)';
  // 底层
  ctx.fillStyle = '#f9efe0';
  ctx.strokeStyle = ink; ctx.lineWidth = 5;
  roundRect(ctx, -58, 0, 116, 56, 14); ctx.fill(); ctx.stroke();
  // 上层
  ctx.fillStyle = '#f3d7d4';
  roundRect(ctx, -38, -52, 76, 54, 12); ctx.fill(); ctx.stroke();
  // 奶油波浪
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6;
  ctx.beginPath();
  for (let i = -58; i <= 58; i += 14) {
    ctx.lineTo(i, 0 - Math.sin(i * 0.3) * 4 - 4);
  }
  ctx.stroke();
  ctx.beginPath();
  for (let i = -38; i <= 38; i += 12) {
    ctx.lineTo(i, -52 - Math.sin(i * 0.35) * 4 - 4);
  }
  ctx.stroke();
  // 蜡烛
  ctx.strokeStyle = '#e29aab'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(0, -52); ctx.lineTo(0, -88); ctx.stroke();
  ctx.fillStyle = '#ffd27a';
  ctx.beginPath(); ctx.ellipse(0, -98, 7, 11, 0, 0, 6.29); ctx.fill();
  // 点缀
  ctx.fillStyle = '#e29aab';
  [[-30, 24], [26, 30], [0, 24]].forEach(([dx, dy]) => {
    ctx.beginPath(); ctx.arc(dx, dy, 5, 0, 6.29); ctx.fill();
  });
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------------- 纱幔 ---------------- */
export function gauzeTexture() {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.clearRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) {
    const a = 0.1 + 0.22 * Math.abs(Math.sin(x * 0.05));
    const g = ctx.createLinearGradient(x, 0, x + 16, 0);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(0.5, `rgba(255,255,255,${a + 0.1})`);
    g.addColorStop(1, `rgba(255,255,255,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 16, 256);
  }
  return toTexture(c);
}

/* ---------------- 烟雾团 ---------------- */
export function smokeTexture() {
  const [c, ctx] = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.45, 'rgba(246,242,234,0.5)');
  g.addColorStop(1, 'rgba(240,236,228,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return toTexture(c);
}

/* ---------------- 弹出文字「生日快乐」 ---------------- */
export function happyBirthdayTexture() {
  const W = 640, H = 200;
  const [c, ctx] = makeCanvas(W, H);
  ctx.clearRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = FONT(96);
  ctx.fillStyle = 'rgba(190,150,120,0.45)';
  ctx.fillText('生日快乐', W / 2 + 5, H / 2 + 8);
  const g = ctx.createLinearGradient(0, 40, 0, H - 30);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.5, '#fdf3ef');
  g.addColorStop(1, '#f5d9d2');
  ctx.fillStyle = g;
  ctx.fillText('生日快乐', W / 2, H / 2);
  ctx.strokeStyle = 'rgba(226,154,171,0.85)';
  ctx.lineWidth = 4;
  ctx.strokeText('生日快乐', W / 2, H / 2);
  // 两侧星星
  ctx.fillStyle = '#e29aab';
  [[64, 70], [576, 70], [96, 140], [544, 140]].forEach(([x, y]) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 15 : 6.5;
      const a = (i / 10) * 6.283 - 1.57;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
  });
  return toTexture(c);
}

/* ---------------- 小爱心贴纸（墙面/桌面点缀） ---------------- */
export function heartStickerTexture(color = '#e29aab') {
  const [c, ctx] = makeCanvas(128, 128);
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(64, 108);
  ctx.bezierCurveTo(10, 66, 26, 18, 64, 44);
  ctx.bezierCurveTo(102, 18, 118, 66, 64, 108);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.ellipse(44, 52, 10, 6, -0.6, 0, 6.29); ctx.fill();
  return toTexture(c);
}

export { makeCanvas, toTexture, roundRect, FONT };
