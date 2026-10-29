/* ============================================================
   fireworks.js — 窗外烟花
   - 相机持续看向左墙窗户（ sustained ~0.5s ）→ 在窗外放一轮烟花
   - 烟花 = 升空火箭（带尾迹）→ 顶点炸开成辐射火花（加色粒子）
   - 单 InstancedMesh 绘制全部粒子（加色混合下"变黑"即淡出）
   - 每轮 3~4 枚，间隔 0.6~1.1s；冷却 9s，看向别处重置
   ============================================================ */
import * as THREE from 'three';
import { audio } from './audio.js';
import { rand, clamp } from './helpers.js';

/* 窗洞中心（世界坐标）——★ 2026-10-26 新布局重测：
   墙本体 targetSize 2.34 @ x=-0.38 之后，左墙内表面 x=-0.907 / 外表面 x=-1.036，
   窗洞范围 y 0.52~1.32、z 0.04~0.72 → 中心 (-0.97, 0.92, 0.38)。
   ⚠ 旧值 (-0.47, 0.82, 0.34) 是墙还在 x=0 时的测量结果，墙搬走以后
   发射点 x=-0.78 已经落到**屋内**（内表面 -0.907 之右），烟花会在窗前、
   窗帘前面炸开，加色粒子叠成一团死白，看上去像"窗前挂了一串彩球"。
   凡是和"窗外"有关的坐标都跟着墙一起左移，别再沿用旧值。 */
const WIN_CENTER = new THREE.Vector3(-0.97, 0.92, 0.38);
const LOOK_ANGLE = 30 * Math.PI / 180;   // 视线与窗洞中心夹角小于此值算"在看窗"
const SUSTAIN = 0.5;                     // 持续注视时长（秒）才触发
const COOLDOWN = 9;                      // 两轮烟花冷却（秒）
const LOOK_MAX_DIST = 4.2;               // 太远（屋外）不算

/* 左墙内表面所在的平面：只允许 x ≤ -0.88 的粒子被绘制，也就是"墙里侧一律不画"。
   为什么要这么狠：爆炸火花的速度是 1.45~2.25 m/s、寿命最长 2.35s，
   一枚烟花在窗外炸开后，很大一部分火花会飞过 1m 以上，直接穿过左墙进到屋里
   （实测 1855 颗里有 418 颗跑到 x>-0.907）。它们是 additive + depthWrite:false，
   虽然被墙挡住一部分，但在镜头和窗帘之间的那批会直接浮在半空，
   看上去像"屋子里下起了彩色雪"。加一个裁剪面最省事：
   墙内侧的粒子根本不参与绘制，窗外那半边完全不受影响。 */
const INDOOR_CLIP = new THREE.Plane(new THREE.Vector3(-1, 0, 0), -0.96);

const COLORS = [
  new THREE.Color(0xff6fa9), // 亮粉
  new THREE.Color(0xffbd55), // 香槟金
  new THREE.Color(0xfff6d9), // 奶油白
  new THREE.Color(0xc58bff), // 薰衣草紫
  new THREE.Color(0xff805e), // 珊瑚橘
  new THREE.Color(0x8ee7ff), // 冰蓝
];

/* ============================================================
   FireworkSystem：单一粒子池（火箭 / 尾迹 / 火花三态共用）
   ============================================================ */
export class FireworkSystem {
  constructor(max = 360) {
    this.max = max;
    this.geo = new THREE.OctahedronGeometry(0.029, 1);
    this.mat = new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    // 预建 instanceColor（黑色=加色下不可见）
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(0), 3);

    // 粒子数据（平行数组，避免每粒子一个对象）
    this.px = new Float32Array(max); this.py = new Float32Array(max); this.pz = new Float32Array(max);
    this.vx = new Float32Array(max); this.vy = new Float32Array(max); this.vz = new Float32Array(max);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.kind = new Uint8Array(max);      // 0 空闲 1 火箭 2 火花
    this.fuse = new Float32Array(max);    // 火箭引信（剩余秒）
    this.trail = new Float32Array(max);   // 火箭尾迹计时
    this.col = [];                         // 每粒基础色
    for (let i = 0; i < max; i++) this.col.push(COLORS[i % COLORS.length].clone());
    this._m = new THREE.Matrix4();
    this._c = new THREE.Color();
    this._v = new THREE.Vector3();
    this.activeCount = 0;
  }

  get group() { return this.mesh; }

  _alloc() {
    for (let i = 0; i < this.max; i++) if (this.kind[i] === 0) return i;
    return -1;
  }

  /** 发射一枚火箭（origin 世界坐标） */
  launch(origin) {
    const i = this._alloc();
    if (i < 0) return;
    this.kind[i] = 1;
    this.px[i] = origin.x + rand(-0.06, 0.06);
    this.py[i] = origin.y;
    this.pz[i] = origin.z + rand(-0.06, 0.06);
    this.vx[i] = rand(-0.16, 0.16);
    this.vy[i] = rand(1.75, 2.12);
    this.vz[i] = rand(-0.05, 0.05);
    this.fuse[i] = rand(0.58, 0.76);
    this.trail[i] = 0;
    this.life[i] = this.maxLife[i] = 1.4;
    this.col[i].copy(COLORS[(Math.random() * COLORS.length) | 0]);
  }

  /** 在 pos 炸开成一圈火花 */
  explode(pos, color) {
    const n = 168 + (Math.random() * 76 | 0);
    const speed = rand(1.45, 2.25);
    for (let k = 0; k < n; k++) {
      const i = this._alloc();
      if (i < 0) break;
      // 球面均匀方向
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const dx = s * Math.cos(th), dy = u, dz = s * Math.sin(th);
      const sp = speed * rand(0.55, 1);
      this.kind[i] = 2;
      this.px[i] = pos.x; this.py[i] = pos.y; this.pz[i] = pos.z;
      this.vx[i] = dx * sp; this.vy[i] = dy * sp + 0.25; this.vz[i] = dz * sp;
      this.life[i] = this.maxLife[i] = rand(1.5, 2.35);
      this.col[i].copy(color);
    }
    // 爆心一记大闪光（短寿命大粒子）
    const f = this._alloc();
    if (f >= 0) {
      this.kind[f] = 2;
      this.px[f] = pos.x; this.py[f] = pos.y; this.pz[f] = pos.z;
      this.vx[f] = 0; this.vy[f] = 0.05; this.vz[f] = 0;
      this.life[f] = this.maxLife[f] = 0.28;
      this.col[f].copy(color);
    }
  }

  update(dt, t) {
    let active = 0;
    for (let i = 0; i < this.max; i++) {
      const k = this.kind[i];
      if (k === 0) { this._write(i, 0, 0, 0, 0, this._c.setRGB(0, 0, 0)); continue; }
      active++;
      if (k === 1) {
        // 火箭：轻重力上升 + 定时引信 + 拖尾
        this.vy[i] -= 0.9 * dt;
        this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt; this.pz[i] += this.vz[i] * dt;
        this.fuse[i] -= dt;
        this.trail[i] -= dt;
        if (this.trail[i] <= 0) {
          this.trail[i] = 0.028;
          const j = this._alloc();
          if (j >= 0) {
            this.kind[j] = 2;
            this.px[j] = this.px[i]; this.py[j] = this.py[i]; this.pz[j] = this.pz[i];
            this.vx[j] = rand(-0.05, 0.05); this.vy[j] = rand(-0.1, 0.05); this.vz[j] = rand(-0.05, 0.05);
            this.life[j] = this.maxLife[j] = rand(0.3, 0.5);
            this.col[j].copy(this.col[i]).multiplyScalar(0.7);
          }
        }
        if (this.fuse[i] <= 0) {
          this.kind[i] = 0;
          this._v.set(this.px[i], this.py[i], this.pz[i]);
          this.explode(this._v, this.col[i]);
          audio.firework(0.35);
          continue;
        }
        const flick = 0.75 + 0.25 * Math.sin(t * 40 + i);
        this._write(i, this.px[i], this.py[i], this.pz[i], 1.15, this._c.copy(this.col[i]).multiplyScalar(flick));
      } else {
        // 火花：重力 + 阻力 + 闪烁淡出
        this.vy[i] -= 1.05 * dt;
        const drag = 1 - 1.5 * dt;
        this.vx[i] *= drag; this.vy[i] *= drag; this.vz[i] *= drag;
        this.px[i] += this.vx[i] * dt; this.py[i] += this.vy[i] * dt; this.pz[i] += this.vz[i] * dt;
        this.life[i] -= dt;
        if (this.life[i] <= 0) { this.kind[i] = 0; this._write(i, 0, 0, 0, 0, this._c.setRGB(0, 0, 0)); continue; }
        const k = this.life[i] / this.maxLife[i];
        const tw = k > 0.5 ? 1 : (0.55 + 0.45 * Math.sin(t * 26 + i * 1.7));
        const size = this.maxLife[i] > 0.9 ? 1 : 0.55; // 爆心闪光更大
        this._write(i, this.px[i], this.py[i], this.pz[i], size * (0.5 + 0.5 * k), this._c.copy(this.col[i]).multiplyScalar(tw * clamp(k * 1.6, 0, 1)));
      }
    }
    this.mesh.visible = active > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  _write(i, x, y, z, scale, color) {
    if (scale <= 0.001) {
      this._m.makeScale(0, 0, 0);
    } else {
      this._m.makeScale(scale, scale, scale);
      this._m.setPosition(x, y, z);
    }
    this.mesh.setMatrixAt(i, this._m);
    this.mesh.setColorAt(i, color);
  }
}

/* ============================================================
   setupFireworks：挂"看向窗户 → 放烟花"的守护更新
   ============================================================ */
export function setupFireworks(world) {
  const system = new FireworkSystem(1900);
  /* 裁剪面需要 renderer 打开 localClippingEnabled 才生效（只作用于烟花这个材质）。
     裁剪位置跟着墙体包围盒走：墙外表面 = bbox.min.x，再往里 8cm 作为切面，
     这样以后在 ?adjust=1 里再挪墙，烟花也不会漏进屋里。
     ⚠ setupFireworks 是在真实模型异步装配**之前**同步调用的，那时 world.models 还空着，
     所以这里只做兜底，真正测量放到第一次放烟花时（refreshClip）。 */
  if (world.renderer) world.renderer.localClippingEnabled = true;
  system.mat.clippingPlanes = [INDOOR_CLIP];
  let clipReady = false;
  const refreshClip = () => {
    if (clipReady) return;
    const wall = world.models && world.models.wall;
    if (!wall) return;
    wall.updateMatrixWorld(true); // 陈旧矩阵会把包围盒算歪（见 model-loader 的坑）
    const bb = new THREE.Box3().setFromObject(wall);
    if (Number.isFinite(bb.min.x)) { INDOOR_CLIP.constant = bb.min.x + 0.08; clipReady = true; }
  };
  world.scene.add(system.group);
  world.updaters.push((t, dt) => system.update(dt, t));
  world.fireworks = system;

  const gate = () => document.getElementById('gate');
  const gateOpen = () => { const g = gate(); return g && g.classList.contains('open'); };

  let lookTime = 0;     // 持续注视累计
  let cooldown = 0;     // 冷却剩余
  let lastCheck = 0;
  let hinted = false;   // 首次发现提示
  const camDir = new THREE.Vector3();
  const toWin = new THREE.Vector3();

  const playShow = () => {
    refreshClip();
    /* 发射点：墙体外侧下方（外表面 x=-1.036 → 再往外 0.26m），z 取窗洞中线。
       发射点 y 压到接近地面：火箭升空 ~0.9~1.35m 后在 y≈0.9~1.35 炸开，
       正好落在窗洞（0.52~1.32）的可视范围内；起飞点本身在窗台以下，
       不会在窗洞里"凭空出现一根火箭"。 */
    const origin = new THREE.Vector3(-1.300, 0.020, 0.380);
    const n = 9 + (Math.random() * 4 | 0);
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        system.launch(origin);
        if (i === 0) audio.firework(0.5);
      }, i * (220 + Math.random() * 330));
    }
  };

  world.updaters.push((t, dt) => {
    cooldown -= dt;
    if (t - lastCheck < 0.1) return; // 100ms 检查一次足够
    const step = t - lastCheck; lastCheck = t;
    // 烟花只在房间揭晓后触发，空房阶段不提前剧透。
    if (!gateOpen() || world.roomState !== 'full') { lookTime = 0; return; }
    const cam = world.camera;
    cam.getWorldDirection(camDir);
    toWin.copy(WIN_CENTER).sub(cam.position);
    const dist = toWin.length();
    if (dist > LOOK_MAX_DIST || cam.position.x < -0.80) { lookTime = 0; return; } // 屋内才算（左墙内表面 x=-0.907）
    toWin.divideScalar(dist);
    const dot = camDir.dot(toWin);
    if (dot > Math.cos(LOOK_ANGLE)) {
      lookTime += step;
      if (!hinted) {
        hinted = true;
        if (world.toast) world.toast('🎆 窗外好像有动静…烟花放起来啦！', 3200);
      }
      if (lookTime >= SUSTAIN && cooldown <= 0) {
        lookTime = 0;
        cooldown = COOLDOWN;
        playShow();
      }
    } else {
      lookTime = 0;
    }
  });

  // 调试/测试钩子
  world.launchFireworks = playShow;
  return system;
}
