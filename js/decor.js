/* ============================================================
   decor.js — 背景装饰（非交互层级）
   球体气球簇拱门 / 心形气球 / 绕拱灯串 / "20" 数字气球 /
   "HAPPY BIRTHDAY" 字母气球 / Kitty 贴纸 / 灯串 / 纱幔 / 彩带 / 亮片
   ============================================================ */
import * as THREE from 'three';
import {
  PALETTE, matte, emissiveMat, rand, heartShape,
} from './helpers.js';
import {
  letterBalloonTexture, numberBalloonTexture, catFaceTexture,
  gauzeTexture,
} from './textures.js';

export function buildDecor() {
  const root = new THREE.Group();
  root.name = 'Decor';
  const updaters = [];
  const swayers = [];

  /* ============================================================
     1. 背景墙球体气球拱门（效果图同款：象牙白/香槟/玫瑰金，簇状蓬松）
     ============================================================ */
  const garland = new THREE.Group();
  garland.position.set(0, 0, 0); // 子物体一律使用世界坐标，避免双层偏移
  root.add(garland);

  // 拱门路径：右端近地面 → 墙面中央偏上 → 左端近地面（z 为世界坐标）
  const archPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(2.02, 0.46, -1.86),
    new THREE.Vector3(1.99, 1.15, -1.86),
    new THREE.Vector3(1.74, 1.8, -1.86),
    new THREE.Vector3(1.22, 2.12, -1.86),
    new THREE.Vector3(0.56, 2.25, -1.86),
    new THREE.Vector3(-0.14, 2.28, -1.86),
    new THREE.Vector3(-0.84, 2.23, -1.86),
    new THREE.Vector3(-1.48, 1.98, -1.86),
    new THREE.Vector3(-1.88, 1.5, -1.86),
    new THREE.Vector3(-2.0, 0.55, -1.86),
  ]);

  /* --- 球体气球：共享几何 + 按色缓存材质 --- */
  const sphereGeo = new THREE.SphereGeometry(1, 28, 20);
  const knotGeo = new THREE.ConeGeometry(1, 1.7, 8);
  const matCache = new Map();
  const STYLES = {
    ivory:    { c: 0xf9f4ea, m: 0,    r: 0.34 },
    ivory2:   { c: 0xf2ebdd, m: 0,    r: 0.36 },
    champ:    { c: 0xefe0c6, m: 0,    r: 0.36 },
    gold:     { c: 0xe3c9a0, m: 0.12, r: 0.3 },
    roseGold: { c: 0xc99a6b, m: 0.85, r: 0.24 },
    blush:    { c: 0xf0d3d8, m: 0.04, r: 0.32 },
  };
  const matFor = (name) => {
    if (!matCache.has(name)) {
      const s = STYLES[name];
      matCache.set(name, new THREE.MeshPhysicalMaterial({
        color: s.c, roughness: s.r, metalness: s.m,
        clearcoat: s.m > 0.5 ? 0.25 : 0.55, clearcoatRoughness: 0.28,
        sheen: 0.3, sheenColor: new THREE.Color(0xffffff),
      }));
    }
    return matCache.get(name);
  };
  const pickStyle = () => {
    const r = Math.random();
    if (r < 0.50) return 'ivory';
    if (r < 0.62) return 'ivory2';
    if (r < 0.78) return 'champ';
    if (r < 0.88) return 'gold';
    if (r < 0.97) return 'roseGold';
    return 'blush';
  };

  /* --- 防穿模放置器：边界收敛 + 全局间距检查 --- */
  const placed = [];   // {x,y,z,r}
  const GAP = 0.018;   // 球间最小间隙
  const fits = (x, y, z, r) => {
    for (const p of placed) {
      const dx = x - p.x, dy = y - p.y, dz = z - p.z;
      const min = r + p.r + GAP;
      if (dx * dx + dy * dy + dz * dz < min * min) return false;
    }
    return true;
  };
  const clampV = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  // z 层约束：球背面不得越过墙面(-2.10)/"20"前面(-2.06)/贴纸(-2.085)，前侧不越过 -1.78
  const Z_BACK_LIMIT = -2.04;
  const Z_FRONT_LIMIT = -1.78;
  const lowBalloons = [];

  /** 放置一颗球体气球（结在组原点，球心在上方，便于悬挂摆动；坐标为世界坐标） */
  const addBalloon = (cx, cy, cz, r, styleName) => {
    cx = clampV(cx, -2.28 + r, 2.28 - r);
    cy = clampV(cy, 0.1 + r, 2.62 - r);
    cz = clampV(cz, Z_BACK_LIMIT + r, Z_FRONT_LIMIT);
    if (!fits(cx, cy, cz, r)) return null;
    placed.push({ x: cx, y: cy, z: cz, r });

    const g = new THREE.Group();
    g.position.set(cx, cy - r * 1.04, cz);
    const ball = new THREE.Mesh(sphereGeo, matFor(styleName));
    ball.scale.setScalar(r);
    ball.position.y = r * 1.04;
    ball.castShadow = true;
    g.add(ball);
    const knot = new THREE.Mesh(knotGeo, matFor(styleName));
    knot.scale.set(r * 0.13, r * 0.22, r * 0.13);
    g.add(knot);
    garland.add(g);
    swayers.push({ obj: g, phase: rand(0, 6.28), amp: rand(0.012, 0.03) });
    if (cy < 1.15) lowBalloons.push({ x: cx, y: cy, z: cz, r });
    return g;
  };

  /* --- 心形气球 ×2（玫瑰金，先放入两端基座，圆球避开它） --- */
  const heartBalloonGeo = (() => {
    const g = new THREE.ExtrudeGeometry(heartShape(1), {
      depth: 0.5, bevelEnabled: true, bevelThickness: 0.22, bevelSize: 0.2, bevelSegments: 4, curveSegments: 10,
    });
    g.center();
    g.scale(0.15, 0.15, 0.15);
    return g;
  })();
  const heartDefs = [
    { x: -1.7, y: 0.82, s: 0.9 },
    { x: 1.76, y: 0.74, s: 1.0 },
  ];
  heartDefs.forEach(def => {
    const hr = 0.15 * def.s * 0.62;
    if (!fits(def.x, def.y, -1.84, hr)) return;
    placed.push({ x: def.x, y: def.y, z: -1.84, r: hr });
    const h = new THREE.Group();
    const heart = new THREE.Mesh(heartBalloonGeo, new THREE.MeshPhysicalMaterial({
      color: 0xc99a6b, roughness: 0.24, metalness: 0.85, clearcoat: 0.3, clearcoatRoughness: 0.25,
    }));
    heart.scale.setScalar(def.s);
    heart.scale.z *= 0.55;
    h.add(heart);
    const knot = new THREE.Mesh(knotGeo, matFor('roseGold'));
    knot.scale.set(0.012, 0.024, 0.012);
    knot.position.y = -0.085 * def.s;
    h.add(knot);
    h.position.set(def.x, def.y, -1.84);
    h.rotation.y = rand(-0.4, 0.4);
    h.rotation.z = rand(-0.14, 0.14);
    garland.add(h);
    swayers.push({ obj: h, phase: rand(0, 6.28), amp: rand(0.012, 0.026), baseRotZ: h.rotation.z });
  });

  /* --- 沿路径生成气球簇（两端浓密、中间舒展） --- */
  const NODES = 17;
  for (let i = 0; i < NODES; i++) {
    const t = i / (NODES - 1);
    const p = archPath.getPointAt(t);
    const tan = archPath.getTangentAt(t);
    const nrm = new THREE.Vector3(tan.y, -tan.x, 0).normalize(); // 外法向（背向拱门内侧）
    const edge = Math.pow(Math.abs(t - 0.5) * 2, 1.35);         // 0=中 → 1=端
    const mainR = 0.115 + edge * 0.075 + rand(-0.012, 0.014);

    // 主球（贴路径）
    addBalloon(
      p.x + nrm.x * 0.03, p.y + nrm.y * 0.03,
      -1.88 + rand(-0.05, 0.05), mainR, pickStyle()
    );

    // 环绕候选球（黄金角散开 + 内外三层 + 深度错层）
    const extra = 3 + Math.round(edge * 3.2) + (Math.random() < 0.6 ? 1 : 0);
    const a0 = rand(0, 6.28);
    for (let k = 0; k < extra; k++) {
      const a = a0 + k * 2.399 + rand(-0.4, 0.4);
      const layer = k % 3 === 2 ? 2.05 : (k % 2 === 0 ? 1 : 1.6);
      const r2 = mainR * (k % 3 === 2 ? rand(0.42, 0.66) : (k % 2 === 0 ? rand(0.7, 0.96) : rand(0.48, 0.72)));
      const d = (mainR + r2) * 0.94;
      const px = p.x + nrm.x * Math.cos(a) * d * layer * 0.92 + tan.x * Math.sin(a) * d * 0.6;
      const py = p.y + nrm.y * Math.cos(a) * d * layer * 0.92 + tan.y * Math.sin(a) * d * 0.6;
      const pz = -1.88 + rand(-0.08, 0.05) + (k % 3 === 0 ? 0.05 : (k % 3 === 2 ? -0.06 : 0));
      addBalloon(px, py, pz, r2, pickStyle());
    }

    // 两端基座下垂小球
    if (edge > 0.35 && Math.random() < 0.85) {
      const r3 = rand(0.07, 0.095);
      addBalloon(p.x + rand(-0.07, 0.07), p.y - mainR - r3 - 0.03, -1.88 + rand(-0.04, 0.04), r3, pickStyle());
    }
  }

  /* --- 低处气球垂下的细丝带（效果图细节） --- */
  const ribbonMatProto = new THREE.MeshPhysicalMaterial({
    color: PALETTE.champagne, roughness: 0.45, metalness: 0,
    sheen: 0.8, sheenColor: new THREE.Color(0xffffff), clearcoat: 0.2,
  });
  const streamerColors = [PALETTE.champagne, PALETTE.pinkDeep, PALETTE.gold];
  const streamers = [];
  lowBalloons.slice(0, 5).forEach((b, i) => {
    if (i % 2 !== 0) return;
    const len = rand(0.22, 0.4);
    const pts = [];
    for (let j = 0; j <= 6; j++) {
      const tt = j / 6;
      pts.push(new THREE.Vector3(Math.sin(tt * 2.4 + i) * 0.02 * tt, -tt * len, Math.sin(tt * 1.7 + i * 2) * 0.012 * tt));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const streamer = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 14, 0.006, 5),
      ribbonMatProto.clone()
    );
    streamer.material.color = new THREE.Color(streamerColors[i % streamerColors.length]);
    streamer.position.set(b.x, b.y - b.r - 0.02, b.z + 0.01);
    garland.add(streamer);
    streamers.push(streamer);
  });

  /* --- 绕拱门暖白灯串（在球层中穿行，灯珠被球遮挡处自然隐没） --- */
  const bulbs = [];
  const bulbGeo = new THREE.SphereGeometry(0.02, 8, 6);
  const wireMat = matte(0xcfc4b2, 0.9);
  const bulbMatProto = emissiveMat(0xffe9c4, { intensity: 1.7, opacity: 1, rough: 0.3 });
  const wirePts = [];
  for (let i = 0; i <= 44; i++) {
    const t = i / 44;
    const p = archPath.getPointAt(t);
    const tan = archPath.getTangentAt(t);
    const nrm = new THREE.Vector3(tan.y, -tan.x, 0).normalize();
    wirePts.push(new THREE.Vector3(
      p.x + nrm.x * 0.17,
      p.y + nrm.y * 0.17 + 0.05,
      -1.86 + Math.sin(i * 0.7) * 0.09
    ));
  }
  const wireCurve = new THREE.CatmullRomCurve3(wirePts);
  const wire = new THREE.Mesh(new THREE.TubeGeometry(wireCurve, 48, 0.0035, 5), wireMat);
  garland.add(wire);
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const p = wireCurve.getPointAt(t);
    const bulb = new THREE.Mesh(bulbGeo, bulbMatProto.clone());
    bulb.position.copy(p).add(new THREE.Vector3(0, 0.014, 0));
    bulb.userData.phase = rand(0, 6.28);
    bulbs.push(bulb);
    garland.add(bulb);
  }

  /* ============================================================
     2. 银色金属数字气球 "20"（墙面中央偏上，位于气球层之后）
     ============================================================ */
  const numGroup = new THREE.Group();
  numGroup.position.set(-0.12, 1.7, -2.06);
  garland.add(numGroup);

  const numBack = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 1.0),
    new THREE.MeshPhysicalMaterial({ color: 0xd6d6de, roughness: 0.3, metalness: 0.55, clearcoat: 0.3 })
  );
  numBack.position.z = -0.016;
  numGroup.add(numBack);

  const numFront = new THREE.Mesh(
    new THREE.PlaneGeometry(0.74, 0.93),
    new THREE.MeshStandardMaterial({
      map: numberBalloonTexture('20'), transparent: true, roughness: 0.28, metalness: 0.35,
    })
  );
  numGroup.add(numFront);

  const numKnot = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.034, 8), matte(0xe8e8ee, 0.4));
  numKnot.rotation.x = Math.PI;
  numKnot.position.set(0, -0.5, 0);
  numGroup.add(numKnot);
  const numString = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0016, 0.0016, 0.1, 4),
    matte(0xe8ddc8, 0.9)
  );
  numString.position.set(0, -0.56, 0);
  numGroup.add(numString);
  swayers.push({ obj: numGroup, phase: 1.2, amp: 0.018 });

  /* ============================================================
     3. "HAPPY BIRTHDAY" 手写字母气球（横排于 20 下方）
     ============================================================ */
  const letters = 'HAPPY BIRTHDAY'.split('');
  const wordGroup = new THREE.Group();
  wordGroup.position.set(-0.99, 1.12, -2.06);
  garland.add(wordGroup);

  const letterGeo = new THREE.PlaneGeometry(0.122, 0.16);
  const letterBackGeo = new THREE.PlaneGeometry(0.138, 0.176);
  letters.forEach((ch, i) => {
    const holder = new THREE.Group();
    const back = new THREE.Mesh(letterBackGeo, matte(0xbf9368, 0.4));
    back.position.z = -0.012;
    holder.add(back);
    const front = new THREE.Mesh(
      letterGeo,
      new THREE.MeshStandardMaterial({
        map: letterBalloonTexture(ch, 'gold'), transparent: true, roughness: 0.3, metalness: 0.3,
      })
    );
    holder.add(front);
    holder.position.set(i * 0.135, Math.sin(i * 0.9) * 0.013, 0);
    holder.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.03;
    wordGroup.add(holder);
    swayers.push({ obj: holder, phase: rand(0, 6.28), baseRotZ: holder.rotation.z, amp: rand(0.014, 0.026) });
  });

  /* ============================================================
     4. Hello Kitty 猫脸贴纸（20 与字母两侧）
     ============================================================ */
  const catTex = catFaceTexture(512);
  const stickerDefs = [
    [-1.3, 1.8, 0.085], [1.04, 1.76, 0.08],
    [-1.14, 1.1, 0.075], [0.94, 1.06, 0.075],
  ];
  stickerDefs.forEach(([x, y, s]) => {
    const sticker = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(s, 24),
      new THREE.MeshPhysicalMaterial({ color: 0xfffdf8, roughness: 0.35, clearcoat: 0.5 })
    );
    sticker.add(disc);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(s * 1.72, s * 1.72),
      new THREE.MeshStandardMaterial({ map: catTex, transparent: true, roughness: 0.35 })
    );
    face.position.z = 0.004;
    sticker.add(face);
    sticker.position.set(x, y, -2.085);
    sticker.rotation.y = rand(-0.15, 0.15);
    garland.add(sticker);
  });

  /* ============================================================
     5. 顶部横拉暖白灯串（沙发上方）
     ============================================================ */
  const stringCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.78, 1.98, -0.5),
    new THREE.Vector3(-0.9, 1.86, -0.85),
    new THREE.Vector3(0.1, 1.8, -1.05),
    new THREE.Vector3(1.1, 1.88, -0.8),
    new THREE.Vector3(1.78, 2.0, -0.42),
  ]);
  const wire2 = new THREE.Mesh(new THREE.TubeGeometry(stringCurve, 40, 0.004, 6), wireMat);
  root.add(wire2);
  for (let i = 0; i <= 14; i++) {
    const p = stringCurve.getPointAt(i / 14);
    const bulb = new THREE.Mesh(bulbGeo, bulbMatProto.clone());
    bulb.position.copy(p);
    bulb.userData.phase = rand(0, 6.28);
    bulbs.push(bulb);
    root.add(bulb);
  }

  /* ============================================================
     6. 白色细纱幔（顶部两角垂挂）
     ============================================================ */
  const gauzeMat = new THREE.MeshStandardMaterial({
    map: gauzeTexture(), transparent: true, opacity: 0.55,
    roughness: 0.95, side: THREE.DoubleSide, depthWrite: false,
  });
  const gauzePanels = [];
  [[-1.7, 2.32, -0.4], [1.72, 2.32, -0.3]].forEach(([x, y, z]) => {
    const geo = new THREE.PlaneGeometry(0.72, 0.95, 8, 10);
    const panel = new THREE.Mesh(geo, gauzeMat);
    panel.position.set(x, y, z);
    panel.rotation.y = x < 0 ? 0.5 : -0.5;
    gauzePanels.push(panel);
    root.add(panel);
  });

  /* ============================================================
     7. 浅粉彩带（悬挂流苏）
     ============================================================ */
  const ribbonDefs = [
    { x: -1.05, z: -1.95, color: PALETTE.pinkDeep, len: 0.62 },
    { x: 0.42, z: -1.92, color: PALETTE.champagne, len: 0.5 },
    { x: 1.42, z: -1.98, color: 0xfdfaf3, len: 0.7 },
  ];
  const ribbons = [];
  ribbonDefs.forEach((def, i) => {
    const pts = [];
    for (let j = 0; j <= 8; j++) {
      const t = j / 8;
      pts.push(new THREE.Vector3(
        Math.sin(t * 2.2 + i) * 0.035 * t,
        -t * def.len,
        Math.sin(t * 1.6 + i * 2) * 0.02 * t
      ));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const ribbon = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 20, 0.009, 6),
      new THREE.MeshPhysicalMaterial({
        color: def.color, roughness: 0.45, metalness: 0,
        sheen: 0.8, sheenColor: new THREE.Color(0xffffff),
        clearcoat: 0.25,
      })
    );
    ribbon.position.set(def.x, 2.62, def.z);
    ribbon.castShadow = true;
    ribbons.push(ribbon);
    root.add(ribbon);
  });

  /* ============================================================
     8. 透明亮片
     ============================================================ */
  const sequinGeo = new THREE.CircleGeometry(0.011, 12);
  const sequinMats = [
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.2, roughness: 0.1, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    new THREE.MeshPhysicalMaterial({ color: PALETTE.champagne, metalness: 0.5, roughness: 0.15, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    new THREE.MeshPhysicalMaterial({ color: PALETTE.pink, metalness: 0.2, roughness: 0.1, transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
  ];
  const sequins = [];
  for (let i = 0; i < 42; i++) {
    const s = new THREE.Mesh(sequinGeo, sequinMats[i % 3]);
    s.position.set(rand(-1.9, 1.9), rand(2.05, 2.66), rand(-2.05, -1.55));
    s.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    s.userData.phase = rand(0, 6.28);
    sequins.push(s);
    root.add(s);
  }

  /* ============================================================
     待机动画
     ============================================================ */
  updaters.push((t, dt) => {
    // 气球轻摆（绕气球结小幅摇摆）
    for (const s of swayers) {
      s.obj.rotation.z = (s.baseRotZ || 0) + Math.sin(t * 1.1 + s.phase) * s.amp;
      s.obj.rotation.x = Math.sin(t * 0.9 + s.phase * 1.3) * s.amp * 0.6;
    }
    // 灯串闪烁
    for (const b of bulbs) {
      b.material.emissiveIntensity = 1.45 + Math.sin(t * 2.4 + b.userData.phase) * 0.4 + Math.sin(t * 7.3 + b.userData.phase * 2) * 0.14;
    }
    // 纱幔波动
    gauzePanels.forEach((p, i) => {
      const pos = p.geometry.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        const x = pos.getX(v), y = pos.getY(v);
        pos.setZ(v, Math.sin(x * 3 + t * 0.8 + i * 2) * 0.022 + Math.sin(y * 4 + t * 0.6) * 0.012);
      }
      pos.needsUpdate = true;
    });
    // 彩带/丝带摇摆
    ribbons.forEach((r, i) => {
      r.rotation.z = Math.sin(t * 0.9 + i * 1.7) * 0.045;
      r.rotation.x = Math.cos(t * 0.7 + i * 2.1) * 0.03;
    });
    streamers.forEach((r, i) => {
      r.rotation.z = Math.sin(t * 1.1 + i * 2.3) * 0.05;
      r.rotation.x = Math.cos(t * 0.8 + i * 1.6) * 0.035;
    });
    // 亮片闪烁
    for (const s of sequins) {
      s.rotation.y += dt * 0.6;
      const base = s.material === sequinMats[0] ? 0.85 : s.material === sequinMats[1] ? 0.8 : 0.75;
      s.material.opacity = base * (0.55 + 0.45 * Math.sin(t * 3 + s.userData.phase));
    }
  });

  return { root, garland, updaters };
}
