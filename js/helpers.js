/* ============================================================
   helpers.js — 几何体 / 材质 / 补间 / 粒子系统
   ============================================================ */
import * as THREE from 'three';

/* ---------------- 调色板（奶油 ins 风，低饱和） ---------------- */
export const PALETTE = {
  wall:        0xf4f0e8,
  wallShade:   0xeae4d9,
  ceiling:     0xf7f4ee,
  floor:       0xe9dfcb,
  floorSeam:   0xd6c8ae,
  cream:       0xf8f2e7,
  creamWhite:  0xfdfaf3,
  beige:       0xe9ddc8,
  carpet:      0xece3d1,
  wood:        0xdcbf9c,
  woodDeep:    0xc0a37c,
  woodDark:    0xa9885f,
  pink:        0xf3d5db,
  pinkDeep:    0xe9b3bf,
  pinkSoft:    0xf9e7ea,
  blush:       0xe9b9c4,
  champagne:   0xecd9b4,
  gold:        0xd9b98a,
  goldMetal:   0xcba76d,
  brown:       0xb3906b,
  brownSoft:   0xc4a484,
  lavender:    0xd9cbe8,
  green:       0xa9bf9a,
  ink:         0x5a534c,
  flame:       0xffc76b,
  flameCore:   0xfff0c8,
};

/* ---------------- 基础数学 ---------------- */
export const rand  = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
export const lerp  = (a, b, t) => a + (b - a) * t;

/* ---------------- 缓动 ---------------- */
export const ease = {
  outCubic:  t => 1 - Math.pow(1 - t, 3),
  inCubic:   t => t * t * t,
  inOutCubic:t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outQuad:   t => 1 - (1 - t) * (1 - t),
  outBack:   (t, s = 1.9) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  outElastic:t => {
    if (t === 0 || t === 1) return t;
    const c = (2 * Math.PI) / 3;
    return Math.pow(2, -9 * t) * Math.sin((t * 9 - 0.75) * c) + 1;
  },
  outBounce: t => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

/* ---------------- 补间管理 ---------------- */
const tweens = [];
export function tween(opts) {
  const tw = {
    t: -(opts.delay || 0),
    dur: Math.max(opts.dur || 0.001, 0.001),
    easeFn: opts.ease || ease.outCubic,
    onUpdate: opts.onUpdate || null,
    onComplete: opts.onComplete || null,
  };
  tweens.push(tw);
  return tw;
}
export function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    if (tw.t < 0) continue;
    const k = clamp(tw.t / tw.dur, 0, 1);
    if (tw.onUpdate) tw.onUpdate(tw.easeFn(k), k);
    if (k >= 1) {
      tweens.splice(i, 1);
      if (tw.onComplete) tw.onComplete();
    }
  }
}
export function clearTweens() { tweens.length = 0; }

/* ---------------- 几何体工具 ---------------- */

/** 圆角盒子（ExtrudeGeometry + bevel，边界圆滑） */
export function roundedBox(w, h, d, r = 0.02, seg = 3) {
  const rr = Math.min(r, w / 2 - 0.0015, h / 2 - 0.0015, d / 2 - 0.0015);
  const bs = Math.min(rr * 0.85, w * 0.28, h * 0.28);
  const bt = Math.min(rr * 0.85, d * 0.3);
  const s = new THREE.Shape();
  const x = -(w - 2 * bs) / 2, y = -(h - 2 * bs) / 2;
  const sw = w - 2 * bs, sh = h - 2 * bs;
  s.moveTo(x + rr, y);
  s.lineTo(x + sw - rr, y);
  s.quadraticCurveTo(x + sw, y, x + sw, y + rr);
  s.lineTo(x + sw, y + sh - rr);
  s.quadraticCurveTo(x + sw, y + sh, x + sw - rr, y + sh);
  s.lineTo(x + rr, y + sh);
  s.quadraticCurveTo(x, y + sh, x, y + sh - rr);
  s.lineTo(x, y + rr);
  s.quadraticCurveTo(x, y, x + rr, y);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(d - bt * 2, 0.002),
    bevelEnabled: true, bevelThickness: bt, bevelSize: bs,
    bevelOffset: 0, bevelSegments: seg, curveSegments: 6,
  });
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

/** 旋转体（车削） */
export function latheGeo(points, seg = 24) {
  const pts = points.map(p => new THREE.Vector2(Math.max(p[0], 0.0006), p[1]));
  return new THREE.LatheGeometry(pts, seg);
}

/** 气球外形（底部收口的椭球） */
export function balloonGeo() {
  return latheGeo([
    [0.001, 0], [0.016, 0.012], [0.048, 0.05], [0.088, 0.13],
    [0.112, 0.27], [0.12, 0.41], [0.104, 0.54], [0.068, 0.64],
    [0.028, 0.695], [0.001, 0.705],
  ], 26);
}

/** 五角星路径 */
export function starShape(outer, inner, points = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

/** 爱心路径 */
export function heartShape(s = 1) {
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.32 * s);
  sh.bezierCurveTo(0.48 * s, 0.06 * s, 0.3 * s, 0.4 * s, 0, 0.2 * s);
  sh.bezierCurveTo(-0.3 * s, 0.4 * s, -0.48 * s, 0.06 * s, 0, -0.32 * s);
  return sh;
}

/**  extruded 星星网格 */
export function starMeshGeo(outer = 0.16, inner = 0.072, depth = 0.05) {
  const g = new THREE.ExtrudeGeometry(starShape(outer, inner), {
    depth, bevelEnabled: true, bevelThickness: depth * 0.25,
    bevelSize: depth * 0.25, bevelSegments: 2, curveSegments: 5,
  });
  g.center();
  return g;
}

/** 蝴蝶结（两个环 + 结心 + 飘带） */
export function bowGroup(color, scale = 1, opts = {}) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color, roughness: opts.roughness ?? 0.55,
    sheen: 0.7, sheenColor: new THREE.Color(0xffffff),
    sheenRoughness: 0.5, clearcoat: opts.clearcoat ?? 0.12,
    side: opts.side ?? THREE.FrontSide,
  });
  const loopGeo = new THREE.SphereGeometry(0.05, 14, 10);
  const mkLoop = (sx) => {
    const m = new THREE.Mesh(loopGeo, mat);
    m.scale.set(1.55, 0.95, 0.6);
    m.position.set(sx * 0.056, 0, 0);
    m.rotation.z = sx * 0.24;
    return m;
  };
  g.add(mkLoop(-1), mkLoop(1));
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), mat);
  g.add(knot);
  if (opts.tails !== false) {
    const tailMat = mat.clone();
    tailMat.color = new THREE.Color(color).multiplyScalar(0.92);
    [-1, 1].forEach(sx => {
      const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.022, 0.085, 3, 8), tailMat);
      tail.material.side = THREE.DoubleSide;
      tail.position.set(sx * 0.018, -0.06, 0);
      tail.rotation.set(-0.5, 0, sx * 0.42);
      g.add(tail);
    });
  }
  g.scale.setScalar(scale);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}

/* ---------------- 材质工厂 ---------------- */
export function matte(color, rough = 0.85) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
}
export function fabric(color, { rough = 0.92, sheen = 0.6 } = {}) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: rough, metalness: 0,
    sheen: Math.min(sheen, 1), sheenColor: new THREE.Color(0xfff6ec), sheenRoughness: 0.6,
  });
}
export function velvet(color, { rough = 1 } = {}) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: rough, metalness: 0,
    sheen: 1, sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.35),
    sheenRoughness: 0.45,
  });
}
export function ceramic(color, { rough = 0.22, clearcoat = 0.7 } = {}) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: rough, metalness: 0,
    clearcoat, clearcoatRoughness: 0.18,
  });
}
export function metal(color, { rough = 0.32, metalness = 0.85 } = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness });
}
export function emissiveMat(color, { intensity = 2, opacity = 1, rough = 0.5 } = {}) {
  return new THREE.MeshStandardMaterial({
    color, emissive: new THREE.Color(color),
    emissiveIntensity: intensity, roughness: rough, metalness: 0,
    transparent: opacity < 1, opacity,
  });
}

/* ============================================================
   粒子系统
   ============================================================ */

/** 纸屑（薄片，带旋转与重力） */
export class ConfettiSystem {
  constructor(count = 150) {
    this.pool = [];
    this.geo = new THREE.PlaneGeometry(0.026, 0.042);
    this.colors = [0xf3d5db, 0xe9b3bf, 0xecd9b4, 0xd9b98a, 0xfdfaf3, 0xc4a484, 0xd9cbe8];
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.geo, new THREE.MeshStandardMaterial({
        color: this.colors[i % this.colors.length], roughness: 0.5, metalness: 0,
        side: THREE.DoubleSide, transparent: true, opacity: 1, depthWrite: false,
      }));
      m.visible = false;
      m.userData = { vel: new THREE.Vector3(), ang: new THREE.Vector3(), life: 0, max: 1 };
      this.pool.push(m);
    }
    this.group = new THREE.Group();
    this.pool.forEach(p => this.group.add(p));
  }
  burst(origin, count = 130, power = 1.6) {
    let used = 0;
    for (const p of this.pool) {
      if (used >= count) break;
      if (p.visible) continue;
      used++;
      p.visible = true;
      p.position.copy(origin);
      p.rotation.set(rand(0, 6.28), rand(0, 6.28), rand(0, 6.28));
      const a = rand(0, Math.PI * 2), up = rand(0.55, 1);
      const r = rand(0.35, 1) * power;
      p.userData.vel.set(Math.cos(a) * r, up * power * 1.35, Math.sin(a) * r);
      p.userData.ang.set(rand(-9, 9), rand(-9, 9), rand(-9, 9));
      p.userData.max = p.userData.life = rand(2.4, 3.6);
      p.material.opacity = 1;
    }
  }
  update(dt) {
    for (const p of this.pool) {
      if (!p.visible) continue;
      const u = p.userData;
      u.life -= dt;
      u.vel.y -= 2.6 * dt;
      u.vel.multiplyScalar(1 - 1.6 * dt);
      p.position.addScaledVector(u.vel, dt);
      p.rotation.x += u.ang.x * dt;
      p.rotation.y += u.ang.y * dt;
      p.rotation.z += u.ang.z * dt;
      if (u.life < 0.9) p.material.opacity = clamp(u.life / 0.9, 0, 1);
      if (u.life <= 0) { p.visible = false; }
    }
  }
}

/** 花瓣（椭圆薄片，飘落摇摆） */
export class PetalSystem {
  constructor(count = 44) {
    this.pool = [];
    this.geo = new THREE.PlaneGeometry(0.026, 0.016);
    this.colors = [0xf3d5db, 0xe9b3bf, 0xf9e7ea, 0xf0c9d2];
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.geo, new THREE.MeshStandardMaterial({
        color: this.colors[i % this.colors.length], roughness: 0.65,
        side: THREE.DoubleSide, transparent: true, opacity: 1, depthWrite: false,
      }));
      m.visible = false;
      m.userData = { vel: new THREE.Vector3(), life: 0, max: 1, phase: rand(0, 6.28), spin: rand(-2, 2) };
      this.pool.push(m);
    }
    this.group = new THREE.Group();
    this.pool.forEach(p => this.group.add(p));
  }
  burst(origin, count = 30, power = 1) {
    let used = 0;
    for (const p of this.pool) {
      if (used >= count) break;
      if (p.visible) continue;
      used++;
      p.visible = true;
      p.position.copy(origin);
      p.userData.vel.set(rand(-0.5, 0.5) * power, rand(0.5, 1.1) * power, rand(-0.5, 0.5) * power);
      p.userData.max = p.userData.life = rand(3.2, 4.6);
      p.material.opacity = 1;
    }
  }
  update(dt, t) {
    for (const p of this.pool) {
      if (!p.visible) continue;
      const u = p.userData;
      u.life -= dt;
      u.vel.y -= 0.5 * dt;
      u.vel.x += Math.sin(t * 1.6 + u.phase) * 0.35 * dt;
      u.vel.z += Math.cos(t * 1.3 + u.phase * 1.7) * 0.3 * dt;
      u.vel.multiplyScalar(1 - 0.55 * dt);
      p.position.addScaledVector(u.vel, dt);
      p.rotation.x += u.spin * 0.7 * dt;
      p.rotation.y += u.spin * dt;
      p.rotation.z = Math.sin(t * 2 + u.phase) * 0.7;
      if (u.life < 1.1) p.material.opacity = clamp(u.life / 1.1, 0, 1);
      if (u.life <= 0) p.visible = false;
    }
  }
}

/** 烟雾（半透明加色精灵） */
export class SmokeSystem {
  constructor(count = 30, texture = null) {
    this.pool = [];
    this.texture = texture;
    for (let i = 0; i < count; i++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture, color: 0xd8d2c8, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.NormalBlending,
      }));
      m.visible = false;
      m.userData = { vel: new THREE.Vector3(), life: 0, max: 1, from: 0.02, to: 0.09 };
      this.pool.push(m);
    }
    this.group = new THREE.Group();
    this.pool.forEach(p => this.group.add(p));
  }
  emit(origin, count = 14) {
    let used = 0;
    for (const p of this.pool) {
      if (used >= count) break;
      if (p.visible) continue;
      used++;
      p.visible = true;
      p.position.copy(origin).add(new THREE.Vector3(rand(-0.004, 0.004), rand(0, 0.01), rand(-0.004, 0.004)));
      p.userData.vel.set(rand(-0.05, 0.05), rand(0.16, 0.3), rand(-0.05, 0.05));
      p.userData.max = p.userData.life = rand(1.6, 2.4);
      p.userData.from = rand(0.014, 0.02);
      p.userData.to = rand(0.07, 0.11);
      p.material.opacity = 0;
      p.scale.setScalar(p.userData.from);
    }
  }
  update(dt) {
    for (const p of this.pool) {
      if (!p.visible) continue;
      const u = p.userData;
      u.life -= dt;
      const k = 1 - clamp(u.life / u.max, 0, 1);
      p.position.addScaledVector(u.vel, dt);
      u.vel.multiplyScalar(1 - 0.7 * dt);
      u.vel.x += Math.sin(performance.now() * 0.001 + u.life * 9) * 0.06 * dt;
      const s = lerp(u.from, u.to, k);
      p.scale.setScalar(s);
      p.material.opacity = 0.34 * Math.sin(Math.min(k * 1.15, 1) * Math.PI);
      if (u.life <= 0) { p.visible = false; p.material.opacity = 0; }
    }
  }
}

/** 星光（加色小八面体，闪烁） */
export class SparkleSystem {
  constructor(count = 40) {
    this.pool = [];
    this.geo = new THREE.OctahedronGeometry(0.0075, 0);
    this.colors = [0xffe6b8, 0xfff6e2, 0xf3d5db, 0xd9b98a];
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({
        color: this.colors[i % this.colors.length], transparent: true, opacity: 1,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      m.visible = false;
      m.userData = { vel: new THREE.Vector3(), life: 0, max: 1, phase: rand(0, 6.28), spin: rand(-4, 4) };
      this.pool.push(m);
    }
    this.group = new THREE.Group();
    this.pool.forEach(p => this.group.add(p));
  }
  burst(origin, count = 18, power = 1) {
    let used = 0;
    for (const p of this.pool) {
      if (used >= count) break;
      if (p.visible) continue;
      used++;
      p.visible = true;
      p.position.copy(origin);
      const a = rand(0, 6.28);
      p.userData.vel.set(Math.cos(a) * rand(0.1, 0.4) * power, rand(0.3, 0.9) * power, Math.sin(a) * rand(0.1, 0.4) * power);
      p.userData.max = p.userData.life = rand(0.9, 1.7);
      p.material.opacity = 1;
    }
  }
  update(dt, t) {
    for (const p of this.pool) {
      if (!p.visible) continue;
      const u = p.userData;
      u.life -= dt;
      u.vel.y -= 0.55 * dt;
      u.vel.multiplyScalar(1 - 1.1 * dt);
      p.position.addScaledVector(u.vel, dt);
      p.rotation.y += u.spin * dt;
      p.rotation.x += u.spin * 0.6 * dt;
      const tw = 0.55 + 0.45 * Math.sin(t * 9 + u.phase);
      p.material.opacity = tw * clamp(u.life / (u.max * 0.5), 0, 1);
      if (u.life <= 0) p.visible = false;
    }
  }
}
