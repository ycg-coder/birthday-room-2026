/* ============================================================
   room.js — 房间结构：墙面 / 地板 / 窗户 / 沙发 / 地毯 / 茶几
   ============================================================ */
import * as THREE from 'three';
import {
  PALETTE, roundedBox, fabric, matte, ceramic, metal, bowGroup,
} from './helpers.js';
import {
  woodFloorTexture, wallTexture, carpetTexture, catFaceTexture, boucleTexture,
} from './textures.js';

/** 茶几参数（props.js 依赖）：真实模型的桌面高度约 0.186m，中心 z=0.15。
 * 道具根组保持世界尺度 1，避免真实模型被重复缩小；所有桌面交互物件都用米制世界比例。
 */
export const TABLE = {
  x: 0, z: 0.15, topY: 0.186, radius: 0.46, height: 0.42,
};

export function buildRoom() {
  const root = new THREE.Group();
  root.name = 'Room';

  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTexture(), color: 0xffffff, roughness: 0.96, metalness: 0,
  });
  const ceilMat = matte(PALETTE.ceiling, 0.96);
  const baseMat = ceramic(PALETTE.creamWhite, { rough: 0.35, clearcoat: 0.4 });

  /* ---------------- 地板 ---------------- */
  const floorGeo = new THREE.BoxGeometry(5.0, 0.14, 4.0);
  const floorMat = new THREE.MeshStandardMaterial({
    map: woodFloorTexture(), roughness: 0.72, metalness: 0,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(0, -0.07, -0.1);
  floor.receiveShadow = true;
  floor.name = 'Floor';
  root.add(floor);

  /* ---------------- 天花板 ---------------- */
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.12, 4.0), ceilMat);
  ceil.position.set(0, 2.86, -0.1);
  ceil.receiveShadow = true;
  ceil.name = 'Ceiling';
  root.add(ceil);

  /* ---------------- 三面墙 ---------------- */
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(5.0, 2.8, 0.12), wallMat);
  backWall.position.set(0, 1.4, -2.16);
  backWall.receiveShadow = true;
  backWall.name = 'BackWall';
  root.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.8, 4.0), wallMat);
  leftWall.position.set(-2.56, 1.4, -0.1);
  leftWall.receiveShadow = true;
  leftWall.name = 'LeftWall';
  root.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.8, 4.0), wallMat);
  rightWall.position.set(2.56, 1.4, -0.1);
  rightWall.receiveShadow = true;
  rightWall.name = 'RightWall';
  root.add(rightWall);

  /* ---------------- 踢脚线 ---------------- */
  const bbGeoBack = roundedBox(5.0, 0.1, 0.03, 0.012);
  const bbBack = new THREE.Mesh(bbGeoBack, baseMat);
  bbBack.position.set(0, 0.05, -2.085);
  bbBack.name = 'BaseboardBack';
  root.add(bbBack);
  const bbGeoSide = roundedBox(0.03, 0.1, 4.0, 0.012);
  const bbLeft = new THREE.Mesh(bbGeoSide, baseMat);
  bbLeft.position.set(-2.485, 0.05, -0.1);
  bbLeft.name = 'BaseboardLeft';
  root.add(bbLeft);
  const bbRight = new THREE.Mesh(bbGeoSide, baseMat);
  bbRight.position.set(2.485, 0.05, -0.1);
  bbRight.name = 'BaseboardRight';
  root.add(bbRight);

  /* ---------------- 左墙窗户 + 纱帘 ---------------- */
  const win = new THREE.Group();
  win.position.set(-2.49, 0, 0.1);
  win.rotation.y = Math.PI / 2;
  win.name = 'Window';
  root.add(win);

  const frameMat = ceramic(PALETTE.creamWhite, { rough: 0.3, clearcoat: 0.5 });
  // 外框
  const mkFrame = (w, h, d, x, y) => {
    const m = new THREE.Mesh(roundedBox(w, h, d, 0.02), frameMat);
    m.position.set(x, y, 0);
    m.castShadow = true;
    win.add(m);
    return m;
  };
  mkFrame(1.7, 0.07, 0.09, 0, 2.16);       // 上
  mkFrame(1.7, 0.09, 0.09, 0, 0.94);       // 下（窗台）
  mkFrame(0.07, 1.3, 0.09, -0.82, 1.55);   // 左
  mkFrame(0.07, 1.3, 0.09, 0.82, 1.55);    // 右
  mkFrame(0.045, 1.3, 0.06, 0, 1.55);      // 中梃
  mkFrame(1.7, 0.045, 0.06, 0, 1.55);      // 横梁
  // 玻璃
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(1.62, 1.22),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff, transparent: true, opacity: 0.1,
      roughness: 0.05, metalness: 0, side: THREE.DoubleSide,
    })
  );
  glass.position.set(0, 1.55, -0.01);
  win.add(glass);
  // 窗台板
  const sill = new THREE.Mesh(roundedBox(1.85, 0.035, 0.14, 0.015), frameMat);
  sill.position.set(0, 0.9, 0.045);
  sill.castShadow = true;
  win.add(sill);
  // 纱帘（左右两片，半透明）
  const curtainTex = gauzeCurtainTexture();
  const curtainMat = new THREE.MeshStandardMaterial({
    map: curtainTex, transparent: true, opacity: 0.85,
    roughness: 0.9, side: THREE.DoubleSide, depthWrite: false,
  });
  [-0.62, 0.62].forEach(cx => {
    const curtain = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 1.32, 6, 10), curtainMat);
    curtain.position.set(cx, 1.53, 0.06);
    curtain.castShadow = false;
    win.add(curtain);
  });
  // 窗帘杆
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 1.9, 10),
    metal(PALETTE.champagne, { rough: 0.35, metalness: 0.6 })
  );
  rod.rotation.x = Math.PI / 2;
  rod.position.set(0, 2.22, 0.09);
  win.add(rod);

  /* ---------------- 地毯 ---------------- */
  const carpet = new THREE.Mesh(
    roundedBox(2.9, 0.012, 2.0, 0.075, 4),
    new THREE.MeshStandardMaterial({
      map: carpetTexture(), roughness: 0.98, metalness: 0,
    })
  );
  carpet.position.set(0, 0.008, 0.0);
  carpet.receiveShadow = true;
  carpet.name = 'Carpet';
  root.add(carpet);

  /* ---------------- 沙发 ---------------- */
  const sofa = buildSofa();
  sofa.position.set(0, 0, -1.25);
  root.add(sofa);

  /* ---------------- 圆角茶几 ---------------- */
  const table = buildTable();
  // Room 根组会在 diorama 模式缩放到 0.42；换算回局部坐标，确保空房茶几仍落在世界 z=0.15。
  table.position.set(TABLE.x, 0, TABLE.z / 0.42);
  table.scale.set(2.15, 1, 2.15); // 与真实茶几保持约 0.84m 桌面直径，但保留原桌高
  root.add(table);

  return { root, sofa, table };
}

/* ---------------- 纱帘贴图（并入 textures 的延展） ---------------- */
function gauzeCurtainTexture() {
  const [c, ctx] = (() => {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 256;
    return [cv, cv.getContext('2d')];
  })();
  ctx.clearRect(0, 0, 128, 256);
  for (let x = 0; x < 128; x += 10) {
    const a = 0.16 + 0.24 * Math.abs(Math.sin(x * 0.09 + 1));
    const g = ctx.createLinearGradient(x, 0, x + 10, 0);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(0.5, `rgba(255,255,255,${Math.min(a + 0.12, 0.5)})`);
    g.addColorStop(1, `rgba(255,255,255,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 10, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ---------------- 沙发 ---------------- */
function buildSofa() {
  const g = new THREE.Group();
  g.name = 'Sofa';
  const boucle = boucleTexture();
  boucle.repeat.set(2.5, 1.6);
  const sofaFabric = new THREE.MeshPhysicalMaterial({
    map: boucle, color: 0xfffdf6, roughness: 0.97, metalness: 0,
    sheen: 0.65, sheenRoughness: 0.9, sheenColor: new THREE.Color(0xfff6ea),
  });
  const woodLeg = matte(PALETTE.woodDark, 0.7);

  // 木脚
  [[-0.98, -0.3], [0.98, -0.3], [-0.98, 0.3], [0.98, 0.3]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.036, 0.09, 10), woodLeg);
    leg.position.set(x, 0.045, z);
    leg.castShadow = true;
    g.add(leg);
  });

  // 底座
  const base = new THREE.Mesh(roundedBox(2.16, 0.3, 0.84, 0.06), sofaFabric);
  base.position.set(0, 0.24, 0);
  base.castShadow = true; base.receiveShadow = true;
  g.add(base);

  // 坐垫 ×2
  [-0.53, 0.53].forEach(x => {
    const cushion = new THREE.Mesh(roundedBox(1.02, 0.17, 0.74, 0.08), sofaFabric);
    cushion.position.set(x, 0.475, 0.01);
    cushion.rotation.x = -0.03;
    cushion.castShadow = true; cushion.receiveShadow = true;
    g.add(cushion);
  });

  // 靠背框架
  const back = new THREE.Mesh(roundedBox(2.16, 0.62, 0.26, 0.09), sofaFabric);
  back.position.set(0, 0.66, -0.3);
  back.castShadow = true; back.receiveShadow = true;
  g.add(back);

  // 靠枕 ×2
  [-0.53, 0.53].forEach(x => {
    const cushion = new THREE.Mesh(roundedBox(1.0, 0.52, 0.2, 0.08), sofaFabric);
    cushion.position.set(x, 0.63, -0.26);
    cushion.rotation.x = -0.14;
    cushion.castShadow = true; cushion.receiveShadow = true;
    g.add(cushion);
  });

  // 扶手 ×2
  [-1.0, 1.0].forEach(x => {
    const arm = new THREE.Mesh(roundedBox(0.24, 0.46, 0.86, 0.11), sofaFabric);
    arm.position.set(x, 0.48, -0.01);
    arm.castShadow = true; arm.receiveShadow = true;
    g.add(arm);
  });

  /* ----- 抱枕们（按效果图重排：焦糖棕 / Kitty / 白星 / 粉爱心） ----- */
  // 1. 焦糖棕抱枕（左）
  const brownPillow = new THREE.Mesh(
    roundedBox(0.38, 0.38, 0.13, 0.08),
    fabric(0xb56f4a, { rough: 0.96 })
  );
  brownPillow.position.set(-0.72, 0.78, -0.05);
  brownPillow.rotation.set(-0.16, 0.18, 0.05);
  brownPillow.castShadow = true;
  g.add(brownPillow);

  // 2. Hello Kitty 抱枕（左中）
  const kittyPillow = new THREE.Group();
  const kittyBody = new THREE.Mesh(roundedBox(0.35, 0.35, 0.12, 0.07), fabric(0xfdfaf3, { rough: 0.95 }));
  kittyBody.castShadow = true;
  const kittyFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.3),
    new THREE.MeshStandardMaterial({
      map: catFaceTexture(512), transparent: true, roughness: 0.9,
    })
  );
  kittyFace.position.z = 0.061;
  kittyPillow.add(kittyBody, kittyFace);
  kittyPillow.position.set(-0.24, 0.78, -0.06);
  kittyPillow.rotation.set(-0.16, -0.14, -0.04);
  g.add(kittyPillow);

  // 3. 白色星形生日抱枕（右中）
  const starPillow = new THREE.Mesh(
    (() => {
      const gg = new THREE.ExtrudeGeometry(
        starP(0.185, 0.082), { depth: 0.07, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.018, bevelSegments: 2 }
      );
      gg.center();
      return gg;
    })(),
    fabric(0xfdfaf3, { rough: 0.95 })
  );
  starPillow.position.set(0.26, 0.79, -0.05);
  starPillow.rotation.set(-0.1, 0.16, 0.05);
  starPillow.castShadow = true;
  g.add(starPillow);

  // 4. 浅粉爱心抱枕（右）
  const heartGeo = new THREE.ExtrudeGeometry(
    (() => {
      const s = new THREE.Shape();
      s.moveTo(0, -0.16);
      s.bezierCurveTo(0.24, 0.03, 0.15, 0.2, 0, 0.1);
      s.bezierCurveTo(-0.15, 0.2, -0.24, 0.03, 0, -0.16);
      return s;
    })(),
    { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 }
  );
  heartGeo.center();
  const heartPillow = new THREE.Mesh(heartGeo, fabric(0xf0c3cc, { rough: 0.95 }));
  heartPillow.position.set(0.72, 0.79, -0.06);
  heartPillow.rotation.set(-0.12, -0.12, 0.04);
  heartPillow.castShadow = true;
  g.add(heartPillow);

  // 移除额外程序化 Kitty 毛绒公仔，保留蛋糕与墙饰中的 Kitty。

  return g;
}

function starP(outer, inner) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

/* ---------------- 毛绒公仔 ---------------- */
function buildPlush() {
  const g = new THREE.Group();
  const bodyMat = fabric(0xfdf8f1, { rough: 1, sheen: 0.8 });
  const pinkMat = fabric(0xf3d5db, { rough: 1, sheen: 0.7 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.105, 18, 14), bodyMat);
  body.scale.set(1, 0.92, 0.9);
  body.position.y = 0.1;
  body.castShadow = true;
  g.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.082, 18, 14), bodyMat);
  head.position.y = 0.235;
  head.castShadow = true;
  g.add(head);

  // 耳朵
  [[-0.05, 0.05], [0.05, -0.05]].forEach(() => {});
  [[-0.052], [0.052]].forEach(([x]) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.055, 10), bodyMat);
    ear.position.set(x, 0.3, 0);
    ear.castShadow = true;
    g.add(ear);
  });

  // 脸（贴图）
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.15, 0.15),
    new THREE.MeshStandardMaterial({ map: catFaceTexture(512), transparent: true, roughness: 1 })
  );
  face.position.set(0, 0.235, 0.077);
  g.add(face);

  // 粉色小围巾
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.016, 8, 18), pinkMat);
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 0.16;
  scarf.castShadow = true;
  g.add(scarf);

  // 尾巴
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), bodyMat);
  tail.position.set(0, 0.06, -0.1);
  tail.scale.set(0.8, 1.1, 1.1);
  g.add(tail);

  // 小爪子
  [-0.045, 0.045].forEach(x => {
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), bodyMat);
    paw.position.set(x, 0.03, 0.075);
    paw.scale.y = 0.7;
    g.add(paw);
  });

  return g;
}

/* ---------------- 圆角茶几 ---------------- */
function buildTable() {
  const g = new THREE.Group();
  g.name = 'CoffeeTable';
  const topWood = new THREE.MeshPhysicalMaterial({
    color: PALETTE.wood, roughness: 0.55, metalness: 0,
    clearcoat: 0.35, clearcoatRoughness: 0.25,
  });
  const creamEdge = ceramic(PALETTE.creamWhite, { rough: 0.3, clearcoat: 0.6 });

  // 圆形桌面
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.045, 48), topWood);
  top.position.y = 0.42;
  top.castShadow = true; top.receiveShadow = true;
  g.add(top);

  // 桌面奶油色包边
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.012, 10, 48), creamEdge);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.42;
  g.add(rim);

  // 下层奶油搁板
  const shelf = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.022, 36), creamEdge);
  shelf.position.y = 0.13;
  shelf.castShadow = true; shelf.receiveShadow = true;
  g.add(shelf);

  // 四根外撇木腿
  const legPos = [[0.33, 0.33], [-0.33, 0.33], [0.33, -0.33], [-0.33, -0.33]];
  legPos.forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.045, 0.42, 12), topWood);
    leg.position.set(x, 0.21, z);
    leg.rotation.z = -Math.sign(x) * 0.07;
    leg.rotation.x = Math.sign(z) * 0.07;
    leg.castShadow = true;
    g.add(leg);
  });

  return g;
}
