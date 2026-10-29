/* ============================================================
   props.js — 五大交互道具
   Cake / Bouquet / RingBox / Envelope / WelcomeBoard
   每个对象均为独立模型组，独立命名，带动画句柄
   ============================================================ */
import * as THREE from 'three';
import {
  PALETTE, roundedBox, latheGeo, bowGroup, fabric, matte, ceramic, metal,
  velvet, emissiveMat, tween, ease, SmokeSystem, SparkleSystem, rand,
} from './helpers.js';
import {
  cakeSideTexture, candleTexture, laceTexture, letterTexture,
  boardArtTexture, catFaceTexture, smokeTexture, happyBirthdayTexture,
  doilyTexture, heartStickerTexture,
} from './textures.js';
import { TABLE } from './room.js';

export function buildProps(smokeTex) {
  const root = new THREE.Group();
  root.name = 'Props';

  // 桌面组（桌面局部坐标，y=0 为茶几表面）
  const tabletop = new THREE.Group();
  tabletop.name = 'TableTop';
  tabletop.position.set(TABLE.x, TABLE.topY, TABLE.z);
  root.add(tabletop);

  const smokeSystem = new SmokeSystem(30, smokeTex);
  const sparkleSystem = new SparkleSystem(40);
  root.add(smokeSystem.group, sparkleSystem.group);

  const cake = buildCake(smokeSystem, sparkleSystem);
  tabletop.add(cake.group);

  const bouquet = buildBouquet();
  tabletop.add(bouquet.group);

  const ringBox = buildRingBox(sparkleSystem);
  tabletop.add(ringBox.group);

  const envelope = buildEnvelope();
  tabletop.add(envelope.group);

  const board = buildWelcomeBoard(sparkleSystem);
  root.add(board.group);

  /* ---------------- 桌面装饰（非交互） ---------------- */
  // 蛋糕下白色蕾丝桌垫
  tabletop.add(buildDoily());

  // 高脚香槟杯 ×1（蛋糕右侧，效果图同款）
  const flute = buildChampagneGlass();
  flute.name = 'Flute';
  flute.position.set(0.29, 0, -0.16); // 右后侧，给右前方戒指盒与第二封信留空间
  flute.rotation.y = 0;
  tabletop.add(flute);

  // 不额外生成程序化 Kitty 手办；Kitty 只保留在蛋糕与墙饰模型中。
  const figurine = null;

  // 散落花瓣与爱心纸屑
  tabletop.add(buildTableScatter());

  /* ---------------- 待机动画 ---------------- */
  const flame = cake.flame;
  const updaters = [
    (t, dt) => {
      // 烛火摇曳
      if (flame.state !== 'out') {
        const m = flame.scaleMul || 1;
        const flick = 1 + Math.sin(t * 11.3) * 0.05 + Math.sin(t * 23.7 + 1.3) * 0.035;
        const flickX = Math.sin(t * 9.1 + 0.7) * 0.06 + Math.sin(t * 21) * 0.03;
        const k = flame.blowing ? 1.8 : 1;
        flame.body.scale.set(flick * (1 - flickX * 0.3) * m, flick * 1.05 * m, flick * (1 - flickX * 0.3) * m);
        flame.body.rotation.z = flickX * 0.24 * k;
        flame.body.position.x = flame.baseX + flickX * 0.006 * k;
        flame.light.intensity = (flame.blowing ? 3.4 : 5.2) * (0.82 + flick * 0.18);
      }
      smokeSystem.update(dt);
      sparkleSystem.update(dt, t);
    },
  ];

  return {
    root, tabletop, cake, bouquet, ringBox, envelope, board,
    flute, figurine,
    smokeSystem, sparkleSystem, updaters,
  };
}

/* ============================================================
   交互对象一：双层奶油生日蛋糕（独立模型组 "Cake"）
   ============================================================ */
function buildCake(smokeSystem, sparkleSystem) {
  const group = new THREE.Group();
  group.name = 'Cake';
  group.position.set(0.04, 0, -0.02); // 效果图：蛋糕略偏桌心右侧
  // 内部 body 组：承载回弹/悬停缩放，避免与悬停动画冲突
  const body = new THREE.Group();
  group.add(body);
  group.userData.interactId = 'cake';

  /* --- 白色陶瓷高脚蛋糕架 --- */
  const standMat = ceramic(PALETTE.creamWhite, { rough: 0.16, clearcoat: 0.9 });
  const standBase = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.115, 0.014, 36), standMat);
  standBase.position.y = 0.007;
  standBase.castShadow = true; standBase.receiveShadow = true;
  body.add(standBase);

  const standStem = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.042, 0.052, 20), standMat);
  standStem.position.y = 0.04;
  standStem.castShadow = true;
  body.add(standStem);

  const standPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.148, 0.014, 40), standMat);
  standPlate.position.y = 0.073;
  standPlate.castShadow = true; standPlate.receiveShadow = true;
  body.add(standPlate);

  // 蛋糕主体组：整体抬高到架面之上
  const PLATE_TOP = 0.08;
  const cakeBody = new THREE.Group();
  cakeBody.position.y = PLATE_TOP;
  body.add(cakeBody);

  /* --- 抹面材质（奶油白→浅粉渐变） --- */
  const sideTex = cakeSideTexture();
  const cakeSide = new THREE.MeshStandardMaterial({
    map: sideTex, roughness: 0.62, metalness: 0,
  });
  const cakeTop = matte(0xfaf1e2, 0.6);

  /* --- 下层 --- */
  const bottomLayer = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.122, 0.075, 40), cakeSide);
  bottomLayer.position.y = 0.0515;
  bottomLayer.castShadow = true; bottomLayer.receiveShadow = true;
  cakeBody.add(bottomLayer);

  const bottomTop = new THREE.Mesh(new THREE.CylinderGeometry(0.1255, 0.1255, 0.002, 40), cakeTop);
  bottomTop.position.y = 0.0895;
  cakeBody.add(bottomTop);

  /* --- 上层 --- */
  const topLayer = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.086, 0.062, 36), cakeSide);
  topLayer.position.y = 0.12;
  topLayer.castShadow = true; topLayer.receiveShadow = true;
  cakeBody.add(topLayer);

  const topTop = new THREE.Mesh(new THREE.CylinderGeometry(0.0885, 0.0885, 0.002, 36), cakeTop);
  topTop.position.y = 0.1515;
  cakeBody.add(topTop);

  /* --- 白色波浪裱花（圆环 + 奶油球） --- */
  const pipeMat = matte(0xfffdf6, 0.5);
  const mkPipeRing = (r, y) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0085, 10, 44), pipeMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    ring.castShadow = true;
    cakeBody.add(ring);
  };
  mkPipeRing(0.117, 0.0085);   // 底部（架面上）
  mkPipeRing(0.1215, 0.0895);  // 下层顶缘
  mkPipeRing(0.085, 0.1515);   // 上层顶缘

  // 奶油球（下层顶缘一环）
  const dollopGeo = new THREE.SphereGeometry(0.011, 10, 8);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const d = new THREE.Mesh(dollopGeo, pipeMat);
    d.scale.y = 0.62;
    d.position.set(Math.cos(a) * 0.112, 0.095, Math.sin(a) * 0.112);
    d.castShadow = true;
    cakeBody.add(d);
  }
  // 架面上一环
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.13;
    const d = new THREE.Mesh(dollopGeo, pipeMat);
    d.scale.y = 0.55;
    d.position.set(Math.cos(a) * 0.108, 0.009, Math.sin(a) * 0.108);
    cakeBody.add(d);
  }
  // 上层顶缘一环（效果图同款裥花边）
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.07;
    const d = new THREE.Mesh(dollopGeo, pipeMat);
    d.scale.y = 0.6;
    d.position.set(Math.cos(a) * 0.079, 0.1565, Math.sin(a) * 0.079);
    d.castShadow = true;
    cakeBody.add(d);
  }

  /* --- 水果与糖珠 --- */
  // 草莓 ×3（上层顶面外圈）
  const berryMat = matte(0xe29aa2, 0.55);
  const leafMat = matte(0x9fbb8e, 0.7);
  [[0.9], [2.9], [5.1]].forEach(([a0]) => {
    const a = a0;
    const berry = new THREE.Mesh(new THREE.SphereGeometry(0.0135, 12, 10), berryMat);
    berry.scale.y = 1.12;
    berry.position.set(Math.cos(a) * 0.058, 0.162, Math.sin(a) * 0.058);
    berry.castShadow = true;
    cakeBody.add(berry);
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.012, 8), leafMat);
    leaf.position.set(Math.cos(a) * 0.058, 0.173, Math.sin(a) * 0.058);
    leaf.rotation.x = Math.PI;
    cakeBody.add(leaf);
  });
  // 蓝莓 ×5
  const blueGeo = new THREE.SphereGeometry(0.008, 10, 8);
  const blueMat = matte(0x93a3c6, 0.5);
  [[0.4, 0.02], [1.8, 0.03], [3.6, -0.02], [4.6, 0.03], [5.9, -0.01]].forEach(([a, r]) => {
    const b = new THREE.Mesh(blueGeo, blueMat);
    b.position.set(Math.cos(a) * 0.045 * (1 + r), 0.1595, Math.sin(a) * 0.045 * (1 + r));
    b.castShadow = true;
    cakeBody.add(b);
  });
  // 白色糖珠
  const pearlGeo = new THREE.SphereGeometry(0.0032, 6, 6);
  const pearlMat = ceramic(0xffffff, { rough: 0.15, clearcoat: 0.9 });
  for (let i = 0; i < 14; i++) {
    const a = rand(0, 6.28), r = rand(0.02, 0.066);
    const p = new THREE.Mesh(pearlGeo, pearlMat);
    p.position.set(Math.cos(a) * r, 0.1575, Math.sin(a) * r);
    cakeBody.add(p);
  }
  // 粉色小糖花 ×4 簇
  const flowerPetalGeo = new THREE.SphereGeometry(0.0042, 6, 5);
  const flowerMat = matte(0xf3c9d4, 0.55);
  for (let c = 0; c < 4; c++) {
    const ca = (c / 4) * 6.283 + 0.5;
    for (let i = 0; i < 5; i++) {
      const a = ca + (i - 2) * 0.09;
      const p = new THREE.Mesh(flowerPetalGeo, flowerMat);
      p.position.set(Math.cos(ca) * 0.062 + Math.cos(a) * 0.012, 0.1585, Math.sin(ca) * 0.062 + Math.sin(a) * 0.012);
      cakeBody.add(p);
    }
  }

  /* --- Hello Kitty 蝴蝶结插牌（蛋糕后侧） --- */
  const pickStick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.003, 0.003, 0.055, 8),
    matte(0xfdfaf3, 0.6)
  );
  pickStick.position.set(0, 0.178, -0.045);
  cakeBody.add(pickStick);

  const charmDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.034, 0.034, 0.006, 28),
    ceramic(0xffffff, { rough: 0.25, clearcoat: 0.7 })
  );
  charmDisc.rotation.x = Math.PI / 2 - 0.18;
  charmDisc.position.set(0, 0.205, -0.047);
  charmDisc.castShadow = true;
  cakeBody.add(charmDisc);

  const charmFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.056, 0.056),
    new THREE.MeshStandardMaterial({ map: catFaceTexture(512), transparent: true, roughness: 0.35 })
  );
  charmFace.position.set(0, 0.206, -0.0435);
  charmFace.rotation.x = -0.18;
  cakeBody.add(charmFace);

  const charmBow = bowGroup(PALETTE.blush, 0.62, { tails: true });
  charmBow.position.set(0, 0.238, -0.05);
  cakeBody.add(charmBow);

  /* --- 细长生日蜡烛（中央） --- */
  const candle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0065, 0.0068, 0.085, 14),
    new THREE.MeshStandardMaterial({ map: candleTexture(), roughness: 0.45, metalness: 0 })
  );
  candle.position.set(0, 0.1935, 0.022);
  candle.castShadow = true;
  candle.name = 'CakeCandle'; // shellSwap keep 用：换真实蛋糕模型后重挂到新蛋糕上
  cakeBody.add(candle);

  const wick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0012, 0.0016, 0.009, 6),
    matte(0x4a4540, 0.9)
  );
  wick.position.set(0, 0.2405, 0.022);
  wick.name = 'CakeWick';
  cakeBody.add(wick);

  /* --- 烛火（独立模型组 "CandleFlame"） --- */
  const flameGroup = new THREE.Group();
  flameGroup.name = 'CandleFlame';
  flameGroup.position.set(0, 0.2475, 0.022);
  // 内层 body：承载摇曳/点燃缩放，悬停缩放作用于外层
  const flameBody = new THREE.Group();
  flameGroup.add(flameBody);

  const flameOuter = new THREE.Mesh(
    latheGeo([
      [0.0012, 0], [0.0055, 0.006], [0.0085, 0.016],
      [0.0072, 0.026], [0.004, 0.0325], [0.0012, 0.036],
    ], 16),
    emissiveMat(PALETTE.flame, { intensity: 2.4, opacity: 0.92, rough: 0.35 })
  );
  flameBody.add(flameOuter);

  const flameCore = new THREE.Mesh(
    latheGeo([
      [0.001, 0.002], [0.0038, 0.008], [0.0045, 0.016], [0.0022, 0.023], [0.001, 0.026],
    ], 12),
    emissiveMat(PALETTE.flameCore, { intensity: 3.2, opacity: 0.95, rough: 0.3 })
  );
  flameBody.add(flameCore);

  const flameLight = new THREE.PointLight(0xffb35c, 5.2, 1.6, 2);
  flameLight.position.set(0, 0.012, 0);
  flameGroup.add(flameLight);
  cakeBody.add(flameGroup);

  // 烟雾发射锚点
  const smokeAnchor = new THREE.Object3D();
  smokeAnchor.position.set(0, 0.252, 0.022);
  cakeBody.add(smokeAnchor);

  const flame = {
    group: flameGroup,
    body: flameBody,
    light: flameLight,
    baseX: 0,
    scaleMul: 1,
    state: 'lit',        // lit | blowing | out
    blowing: false,
  };

  /* 交互回调由 interact.js 注入 */
  group.userData.interactId = 'cake';
  flameGroup.userData.interactId = 'flame';

  return { group, body, flame, candle, smokeAnchor, smokeSystem, sparkleSystem };
}

/* ============================================================
   交互对象二：粉色韩式捧花（独立模型组 "Bouquet"）
   ============================================================ */
function buildBouquet() {
  const group = new THREE.Group();
  group.name = 'Bouquet';
  group.position.set(-0.26, 0, -0.02); // 布局参考：左侧，贴近蛋糕但不压住前缘信封
  group.rotation.y = 0.35;
  // 内部 body 组：承载摇摆动画，悬停缩放作用于外层。
  // 目前没有独立 bouquet.glb，放大程序化占位花束；未来替换 GLB 时只换壳，不继承此缩放。
  const body = new THREE.Group();
  body.scale.setScalar(1.65);
  group.add(body);

  /* --- 双层包装纸（圆锥） --- */
  const paperOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.072, 0.042, 0.14, 24, 1, true, 0.4, 4.9),
    new THREE.MeshStandardMaterial({
      color: 0xf6dfe0, roughness: 0.85, side: THREE.DoubleSide,
    })
  );
  paperOuter.position.y = 0.07;
  paperOuter.rotation.z = -0.1;
  paperOuter.castShadow = true;
  body.add(paperOuter);

  const paperInner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.058, 0.034, 0.115, 24, 1, true, 1.1, 4.4),
    new THREE.MeshStandardMaterial({
      color: 0xf7e6d4, roughness: 0.85, side: THREE.DoubleSide,
    })
  );
  paperInner.position.y = 0.062;
  paperInner.rotation.z = 0.07;
  body.add(paperInner);

  // 前侧翻折纸角
  const flap = new THREE.Mesh(
    roundedBox(0.1, 0.075, 0.012, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xf6dfe0, roughness: 0.85 })
  );
  flap.position.set(0, 0.115, 0.062);
  flap.rotation.x = -0.32;
  flap.castShadow = true;
  body.add(flap);

  /* --- 花茎 --- */
  const stemMat = matte(0x8fae7f, 0.8);
  const stemGeo = new THREE.CylinderGeometry(0.0035, 0.004, 0.15, 6);
  [[-0.03, 0.16, -0.02], [0.03, 0.17, 0.01], [0, 0.185, 0], [-0.015, 0.155, 0.025], [0.02, 0.165, -0.03]].forEach(([x, h, z]) => {
    const s = new THREE.Mesh(stemGeo, stemMat);
    s.scale.y = h / 0.15;
    s.position.set(x, 0.06 + h / 2 - 0.01, z);
    s.rotation.z = -x * 0.8;
    s.rotation.x = z * 0.8;
    body.add(s);
  });

  /* --- 多层花瓣玫瑰 ×14：粉、蜜桃、奶油白与柔紫错落排布 ---
     用 InstancedMesh 按材质批次绘制花瓣/花蕊/叶片，避免数百个独立 Mesh 造成移动端 draw call 过高。 */
  const roseMat = fabric(0xf2c6cf, { rough: 0.82, sheen: 0.62 });
  const roseCoreMat = fabric(0xe4a0b3, { rough: 0.78, sheen: 0.55 });
  const peachRoseMat = fabric(0xf2bcae, { rough: 0.82, sheen: 0.62 });
  const peachCoreMat = fabric(0xe6a08f, { rough: 0.78, sheen: 0.55 });
  const creamRoseMat = fabric(0xffe0d3, { rough: 0.82, sheen: 0.58 });
  const creamCoreMat = fabric(0xe8b9ad, { rough: 0.78, sheen: 0.5 });
  const purpleRoseMat = fabric(0xd8bfdf, { rough: 0.84, sheen: 0.58 });
  const purpleCoreMat = fabric(0xb99acb, { rough: 0.78, sheen: 0.5 });
  const rosePetalGeo = new THREE.SphereGeometry(0.0072, 9, 7);
  const roseBudGeo = new THREE.SphereGeometry(0.0065, 10, 8);
  const roseLayout = [
    [-0.052, 0.177, -0.027, 0.98, roseMat, roseCoreMat],
    [-0.027, 0.191, -0.035, 0.94, creamRoseMat, creamCoreMat],
    [ 0.001, 0.201, -0.034, 1.05, peachRoseMat, peachCoreMat],
    [ 0.030, 0.191, -0.029, 0.98, purpleRoseMat, purpleCoreMat],
    [ 0.052, 0.178, -0.014, 0.91, roseMat, roseCoreMat],
    [-0.058, 0.174,  0.000, 0.88, peachRoseMat, peachCoreMat],
    [-0.031, 0.187,  0.004, 1.02, roseMat, roseCoreMat],
    [ 0.000, 0.193,  0.006, 1.08, creamRoseMat, creamCoreMat],
    [ 0.031, 0.186,  0.008, 1.00, peachRoseMat, peachCoreMat],
    [ 0.056, 0.174,  0.014, 0.88, purpleRoseMat, purpleCoreMat],
    [-0.044, 0.159,  0.033, 0.88, purpleRoseMat, purpleCoreMat],
    [-0.014, 0.166,  0.039, 1.00, peachRoseMat, peachCoreMat],
    [ 0.017, 0.166,  0.040, 0.98, roseMat, roseCoreMat],
    [ 0.044, 0.160,  0.032, 0.86, creamRoseMat, creamCoreMat],
  ];
  const rosePetals = new Map();
  const roseBuds = new Map();
  const record = (map, material, item) => {
    if (!map.has(material)) map.set(material, []);
    map.get(material).push(item);
  };
  const addBatch = (name, geometry, material, items) => {
    if (!items.length) return null;
    const mesh = new THREE.InstancedMesh(geometry, material, items.length);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const dummy = new THREE.Object3D();
    items.forEach((item, i) => {
      dummy.position.set(item.p[0], item.p[1], item.p[2]);
      dummy.rotation.set(item.r[0], item.r[1], item.r[2]);
      dummy.scale.set(item.s[0], item.s[1], item.s[2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    body.add(mesh);
    return mesh;
  };
  const layers = [
    { count: 7, radius: 0.0105, y: -0.001, scale: 1.15, tilt: 0.44 },
    { count: 6, radius: 0.0072, y: 0.004, scale: 0.88, tilt: 0.26 },
    { count: 5, radius: 0.0037, y: 0.008, scale: 0.63, tilt: 0.12 },
  ];
  roseLayout.forEach(([x, y, z, s, petalM, coreM]) => {
    record(roseBuds, coreM, { p: [x, y + 0.003 * s, z], r: [0, 0, 0], s: [0.9 * s, 1.18 * s, 0.9 * s] });
    layers.forEach((layer, li) => {
      for (let i = 0; i < layer.count; i++) {
        const a = (i / layer.count) * Math.PI * 2 + li * 0.43;
        record(rosePetals, petalM, {
          p: [x + Math.cos(a) * layer.radius * s, y + layer.y * s + Math.sin(a * 2) * 0.0015 * s, z + Math.sin(a) * layer.radius * s],
          r: [-Math.cos(a) * layer.tilt, -a, Math.sin(a) * layer.tilt],
          s: [layer.scale * s, 0.58 * layer.scale * s, 0.92 * layer.scale * s],
        });
      }
    });
  });
  let batchIndex = 0;
  for (const [material, items] of rosePetals) addBatch(`RosePetals_${batchIndex++}`, rosePetalGeo, material, items);
  batchIndex = 0;
  for (const [material, items] of roseBuds) addBatch(`RoseCores_${batchIndex++}`, roseBudGeo, material, items);

  /* --- 满天星：细枝 + 小花头，批次渲染 --- */
  const babyMat = matte(0xfffcf5, 0.72);
  const babyGeo = new THREE.SphereGeometry(0.0035, 7, 6);
  const babyStemMat = matte(0x9cb28b, 0.82);
  const babyStemGeo = new THREE.CylinderGeometry(0.0012, 0.0016, 0.065, 5);
  const babyClusters = [
    [-0.055, 0.186, -0.045], [-0.025, 0.205, -0.050], [0.015, 0.214, -0.040],
    [0.048, 0.193, -0.034], [0.061, 0.185, 0.018], [-0.065, 0.185, 0.018],
    [-0.036, 0.182, 0.052], [0.008, 0.190, 0.055], [0.047, 0.181, 0.045],
  ];
  const stemItems = [], babyPetals = [], babyCores = [];
  babyClusters.forEach(([x, y, z], ci) => {
    stemItems.push({ p: [x * 0.86, y - 0.026, z * 0.86], r: [rand(-0.3, 0.3), rand(-0.4, 0.4), rand(-0.34, 0.34)], s: [1, 1, 1] });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + ci * 0.7;
      const fx = x + Math.cos(a) * 0.009;
      const fy = y + Math.sin(a) * 0.007;
      const fz = z + Math.sin(a) * 0.008;
      babyCores.push({ p: [fx, fy, fz], r: [0, 0, 0], s: [1, 1, 1] });
      for (let j = 0; j < 4; j++) {
        const pa = (j / 4) * Math.PI * 2;
        babyPetals.push({ p: [fx + Math.cos(pa) * 0.0038, fy + Math.sin(pa) * 0.0038, fz], r: [0, 0, 0], s: [1, 1, 0.65] });
      }
    }
  });
  addBatch('BabyBreathStems', babyStemGeo, babyStemMat, stemItems);
  addBatch('BabyBreathPetals', babyGeo, babyMat, babyPetals);
  addBatch('BabyBreathCores', new THREE.SphereGeometry(0.0021, 6, 5), creamCoreMat, babyCores);

  /* --- 尤加利与鲜叶：圆叶大小错落，边缘伸出包装形成自然轮廓 --- */
  const leafMat = matte(0x9bb28a, 0.79);
  const leafLightMat = matte(0xb7c8a5, 0.8);
  const leafGeo = new THREE.SphereGeometry(0.012, 10, 7);
  const leafDefs = [
    [-0.067,0.153,-0.025,-0.40,0.62],[-0.070,0.169,0.006,0.72,0.75],[-0.054,0.186,0.050,-0.55,0.55],
    [-0.026,0.205,0.055,0.34,0.68],[0.006,0.219,0.044,-0.44,0.52],[0.040,0.205,0.052,0.52,0.62],
    [0.067,0.182,0.028,-0.72,0.72],[0.068,0.165,-0.004,0.46,0.62],[0.051,0.200,-0.045,-0.28,0.56],
    [-0.050,0.198,-0.055,0.48,0.58],[0.015,0.157,0.057,-0.38,0.55],
  ];
  const leaves = new Map();
  leafDefs.forEach(([x, y, z, angle, sz], i) => {
    const m = i % 3 === 0 ? leafLightMat : leafMat;
    record(leaves, m, { p: [x, y, z], r: [rand(-0.4, 0.4), angle, rand(-0.35, 0.35)], s: [1.25 * sz, 0.34 * sz, 0.58 * sz] });
  });
  batchIndex = 0;
  for (const [material, items] of leaves) addBatch(`EucalyptusLeaves_${batchIndex++}`, leafGeo, material, items);

  /* --- 浅粉绸缎蝴蝶结 --- */
  const ribbonBow = bowGroup(PALETTE.pinkDeep, 0.52, { tails: true });
  ribbonBow.position.set(0, 0.082, 0.068);
  ribbonBow.rotation.x = -0.25;
  body.add(ribbonBow);

  group.userData.interactId = 'bouquet';
  return { group, body };
}

/* ============================================================
   交互对象三：粉色丝绒戒指盒（独立模型组 "RingBox"）
   ============================================================ */
function buildRingBox(sparkleSystem) {
  const group = new THREE.Group();
  group.name = 'RingBox';
  group.position.set(0.27, 0, 0.04); // 布局参考：桌面右侧，避开第二封信与酒杯
  group.rotation.y = -0.3;

  /* --- 外盒 --- */
  const base = new THREE.Mesh(
    roundedBox(0.088, 0.026, 0.088, 0.008),
    velvet(0xe3b8c0, { rough: 0.98 })
  );
  base.position.y = 0.013;
  base.castShadow = true; base.receiveShadow = true;
  group.add(base);

  /* --- 米白植绒内衬 --- */
  const insert = new THREE.Mesh(
    roundedBox(0.076, 0.02, 0.076, 0.006),
    velvet(0xf2ede2, { rough: 1 })
  );
  insert.position.y = 0.024;
  insert.receiveShadow = true;
  group.add(insert);

  /* --- 盒盖（带旋转轴，可继续开合） --- */
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.026, -0.044); // 后边缘铰链
  group.add(lidPivot);
  const REST = 0, FULL = -1.62; // 闭合 / 打开约 93°

  const lid = new THREE.Mesh(
    roundedBox(0.092, 0.02, 0.092, 0.008),
    velvet(0xe3b8c0, { rough: 0.98 })
  );
  lid.position.set(0, 0.01, 0.046);
  lid.castShadow = true;
  lidPivot.add(lid);

  // 盒盖内衬（关闭时朝下）
  const lidLining = new THREE.Mesh(
    new THREE.PlaneGeometry(0.08, 0.08),
    velvet(0xf2ede2, { rough: 1 })
  );
  lidLining.rotation.x = Math.PI / 2;
  lidLining.position.set(0, -0.0105, 0.046);
  lidPivot.add(lidLining);

  // 铰链轴
  const hinge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.004, 0.09, 8),
    metal(PALETTE.champagne, { rough: 0.3, metalness: 0.75 })
  );
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0, 0.026, -0.044);
  group.add(hinge);

  lidPivot.rotation.x = REST; // 入口阶段保持闭合，点开后才看到戒指

  /* --- 简约素圈黄金戒指（哑光金，反射柔和） --- */
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xcba76d, roughness: 0.38, metalness: 0.92,
    emissive: new THREE.Color(0x8a6524), emissiveIntensity: 0,
  });
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.0105, 0.0018, 10, 36),
    ringMat
  );
  ring.position.set(0, 0.0355, 0.006);
  ring.castShadow = true;
  ring.visible = false; // 盒子默认闭合，戒指只在开盒后出现
  group.add(ring);

  // 戒指暖光
  const ringLight = new THREE.PointLight(0xffd9a0, 0, 0.5, 2);
  ringLight.position.set(0, 0.05, 0.006);
  group.add(ringLight);

  group.userData.interactId = 'ringbox';

  let isFull = false; // 初始闭合，点击后开盒
  let toggling = false;

  /** 开盒揭示戒指；合盒时将戒指和暖光一起收回；动画期间忽略重复点击。 */
  const toggle = () => {
    if (toggling) return null;
    toggling = true;
    isFull = !isFull;
    const from = lidPivot.rotation.x;
    const to = isFull ? FULL : REST;
    if (isFull) ring.visible = true;
    tween({
      dur: 0.9, ease: ease.inOutCubic,
      onUpdate: k => { lidPivot.rotation.x = from + (to - from) * k; },
      onComplete: () => { if (!isFull) ring.visible = false; },
    });
    if (isFull) {
      tween({ dur: 0.55, ease: ease.outCubic, onUpdate: k => { ringLight.intensity = 3.4 * k; ringMat.emissiveIntensity = 0.24 * k; } });
      tween({ dur: 1.1, delay: 0.55, ease: ease.inOutCubic, onUpdate: k => { ringLight.intensity = 3.4 - 2.1 * k; ringMat.emissiveIntensity = 0.24 - 0.12 * k; } });
    } else {
      tween({ dur: 0.3, ease: ease.inOutCubic, onUpdate: k => { ringLight.intensity = 1.3 * (1 - k); ringMat.emissiveIntensity = 0.12 * (1 - k); } });
    }
    window.setTimeout(() => { toggling = false; }, isFull ? 1650 : 900);
    return isFull;
  };

  return { group, lidPivot, ring, ringMat, ringLight, toggle, REST, FULL };
}

/* ============================================================
   交互对象四：浅粉蕾丝信封（独立模型组 "Envelope"）
   ============================================================ */
function buildEnvelope() {
  const group = new THREE.Group();
  group.name = 'Envelope';
  group.position.set(-0.17, 0, 0.19); // 布局参考：第一封信位于桌面前缘左侧
  group.rotation.y = -0.3;

  /* --- 信封主体（奶油色，效果图同款） --- */
  const body = new THREE.Mesh(
    roundedBox(0.115, 0.006, 0.078, 0.004),
    matte(0xf6eeda, 0.75)
  );
  body.position.y = 0.003;
  body.castShadow = true; body.receiveShadow = true;
  group.add(body);

  /* --- 白色蕾丝花边 --- */
  const lace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.132, 0.092),
    new THREE.MeshStandardMaterial({
      map: laceTexture(), transparent: true, roughness: 0.85,
    })
  );
  lace.position.y = 0.0072;
  group.add(lace);

  /* --- 封口（微微上翘） --- */
  const flapPivot = new THREE.Group();
  flapPivot.position.set(0, 0.006, -0.039);
  group.add(flapPivot);

  const flapShape = new THREE.Shape();
  flapShape.moveTo(-0.0575, 0);
  flapShape.lineTo(0.0575, 0);
  flapShape.lineTo(0, 0.05);
  flapShape.closePath();
  const flapGeo = new THREE.ShapeGeometry(flapShape);
  const flap = new THREE.Mesh(flapGeo, new THREE.MeshStandardMaterial({
    color: 0xf1e6cf, roughness: 0.75, side: THREE.DoubleSide,
  }));
  flap.position.z = 0.026;
  flapPivot.add(flap);
  flapPivot.rotation.x = 0.52;

  /* --- 圆形金色火漆印 --- */
  const wax = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0115, 0.0115, 0.0028, 24),
    new THREE.MeshStandardMaterial({ color: 0xd9b98a, roughness: 0.42, metalness: 0.55 })
  );
  wax.rotation.x = -0.52;
  wax.position.set(0, 0.0028, 0.0495);
  flapPivot.add(wax);
  const waxRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.008, 0.0012, 8, 24),
    metal(0xc19a62, { rough: 0.35, metalness: 0.8 })
  );
  waxRing.rotation.x = -0.52 + Math.PI / 2;
  waxRing.position.set(0, 0.0046, 0.0498);
  flapPivot.add(waxRing);

  /* --- 刚拆开的露出的信纸 --- */
  const peek = new THREE.Mesh(
    new THREE.PlaneGeometry(0.095, 0.045),
    matte(0xfffdf6, 0.8)
  );
  peek.position.set(0, 0.0092, -0.004);
  peek.rotation.x = -0.22;
  group.add(peek);

  /* --- 信纸组（点击后上浮） --- */
  const letterGroup = new THREE.Group();
  const paper = new THREE.Mesh(
    roundedBox(0.1, 0.0035, 0.135, 0.003),
    matte(0xfffdf6, 0.8)
  );
  paper.castShadow = true;
  letterGroup.add(paper);
  const letterText = new THREE.Mesh(
    new THREE.PlaneGeometry(0.092, 0.125),
    new THREE.MeshStandardMaterial({
      map: letterTexture(), transparent: true, roughness: 0.85,
    })
  );
  letterText.rotation.x = -Math.PI / 2 + 0.06;
  letterText.position.set(-0.002, 0.0036, 0.002);
  letterGroup.add(letterText);
  // 火漆小爱心
  const heart = new THREE.Mesh(
    new THREE.PlaneGeometry(0.016, 0.016),
    new THREE.MeshStandardMaterial({ color: 0xe29aab, roughness: 0.5 })
  );
  heart.rotation.x = -Math.PI / 2 + 0.06;
  heart.position.set(0.032, 0.0038, -0.045);
  letterGroup.add(heart);

  letterGroup.position.y = 0.006;
  letterGroup.visible = false;
  group.add(letterGroup);

  group.userData.interactId = 'envelope';

  let opened = false;
  const FLAP_CLOSED = 0.52, FLAP_OPEN = 1.32;

  const toggle = () => {
    opened = !opened;
    if (opened) {
      tween({ dur: 0.7, ease: ease.outCubic, onUpdate: k => { flapPivot.rotation.x = FLAP_CLOSED + (FLAP_OPEN - FLAP_CLOSED) * k; } });
      letterGroup.visible = true;
      letterGroup.position.y = 0.006;
      letterGroup.rotation.x = 0;
      letterText.material.opacity = 0;
      letterText.material.transparent = true;
      tween({ dur: 0.9, delay: 0.25, ease: ease.outCubic, onUpdate: k => { letterGroup.position.y = 0.006 + 0.072 * k; } });
      tween({ dur: 1.1, delay: 0.35, ease: ease.inOutCubic, onUpdate: k => { letterGroup.rotation.x = -0.62 * k; } });
      tween({ dur: 0.8, delay: 0.75, ease: ease.outQuad, onUpdate: k => { letterText.material.opacity = k; } });
    } else {
      tween({ dur: 0.5, ease: ease.outCubic, onUpdate: k => { letterText.material.opacity = 1 - k; } });
      tween({ dur: 0.6, delay: 0.15, ease: ease.inOutCubic, onUpdate: k => {
        letterGroup.position.y = 0.006 + 0.072 * (1 - k);
        letterGroup.rotation.x = -0.62 * (1 - k);
      }, onComplete: () => { letterGroup.visible = false; } });
      tween({ dur: 0.7, delay: 0.5, ease: ease.outCubic, onUpdate: k => { flapPivot.rotation.x = FLAP_OPEN + (FLAP_CLOSED - FLAP_OPEN) * k; } });
    }
    return { opened };
  };

  return { group, flapPivot, letterGroup, letterText, toggle };
}

/* ============================================================
   桌面装饰（非交互）：蕾丝桌垫 / 高脚香槟杯 / Kitty 手办 / 花瓣爱心
   ============================================================ */
function buildDoily() {
  const g = new THREE.Group();
  g.name = 'Doily';
  const doily = new THREE.Mesh(
    new THREE.CircleGeometry(0.225, 56),
    new THREE.MeshStandardMaterial({
      map: doilyTexture(), transparent: true, roughness: 0.95, metalness: 0,
    })
  );
  doily.rotation.x = -Math.PI / 2;
  doily.position.y = 0.0015;
  doily.receiveShadow = true;
  g.add(doily);
  return g;
}

function buildChampagneGlass() {
  const g = new THREE.Group();
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, transparent: true, opacity: 0.22,
    roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const bowl = new THREE.Mesh(latheGeo([
    [0.0, 0.0], [0.048, 0.0], [0.048, 0.006], [0.026, 0.009], [0.009, 0.014],
    [0.009, 0.175], [0.028, 0.205], [0.042, 0.25], [0.047, 0.305], [0.045, 0.345],
    [0.043, 0.352], [0.0, 0.352],
  ], 24), glassMat);
  bowl.castShadow = true;
  g.add(bowl);

  // 杯内香槟酒液
  const wine = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0405, 0.0375, 0.1, 24),
    new THREE.MeshStandardMaterial({ color: 0xf3dd9f, roughness: 0.32, metalness: 0 })
  );
  wine.position.y = 0.3;
  g.add(wine);
  return g;
}

function buildKittyFigurine() {
  /* 小 Hello Kitty 手办：坐姿、粉裙子、抱爱心（效果图蛋糕左侧同款） */
  const g = new THREE.Group();
  const whiteMat = ceramic(0xfffdf8, { rough: 0.28, clearcoat: 0.65 });
  const pinkMat = matte(0xf3c9d4, 0.5);
  const pinkDeep = matte(0xe8a9bd, 0.5);

  // 粉色小裙子（喇叭口）
  const dress = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.04, 0.038, 18, 1, true),
    pinkMat
  );
  dress.position.y = 0.024;
  dress.castShadow = true;
  g.add(dress);
  const dressHem = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.005, 8, 18), pinkDeep);
  dressHem.rotation.x = Math.PI / 2;
  dressHem.position.y = 0.006;
  g.add(dressHem);

  // 白色身体
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 12), whiteMat);
  body.scale.set(1, 1.06, 0.9);
  body.position.y = 0.048;
  body.castShadow = true;
  g.add(body);

  // 双脚
  [[-0.015], [0.015]].forEach(([x]) => {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), whiteMat);
    foot.scale.set(1, 0.62, 1.15);
    foot.position.set(x, 0.009, 0.014);
    foot.castShadow = true;
    g.add(foot);
  });

  // 双手（前伸抱姿）
  [[-0.026], [0.026]].forEach(([x]) => {
    const arm = new THREE.Mesh(new THREE.SphereGeometry(0.0105, 10, 8), whiteMat);
    arm.scale.set(0.8, 0.8, 1.3);
    arm.position.set(x, 0.042, 0.024);
    arm.castShadow = true;
    g.add(arm);
  });

  // 怀中爱心
  const heartGeo = new THREE.Shape();
  heartGeo.moveTo(0, -0.011);
  heartGeo.bezierCurveTo(0.017, 0.002, 0.011, 0.014, 0, 0.007);
  heartGeo.bezierCurveTo(-0.011, 0.014, -0.017, 0.002, 0, -0.011);
  const heart = new THREE.Mesh(
    new THREE.ExtrudeGeometry(heartGeo, {
      depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2,
    }),
    pinkDeep
  );
  heart.position.set(0, 0.044, 0.03);
  heart.castShadow = true;
  g.add(heart);

  // 头
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.031, 18, 14), whiteMat);
  head.scale.set(1, 0.94, 0.92);
  head.position.y = 0.094;
  head.castShadow = true;
  g.add(head);

  // 耳朵
  [[-0.018], [0.018]].forEach(([x]) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.0115, 0.017, 10), whiteMat);
    ear.position.set(x, 0.117, 0);
    ear.castShadow = true;
    g.add(ear);
  });

  // 脸（贴图）
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.052, 0.052),
    new THREE.MeshStandardMaterial({ map: catFaceTexture(256), transparent: true, roughness: 0.35 })
  );
  face.position.set(0, 0.094, 0.0295);
  g.add(face);

  // 左耳蝴蝶结
  const bow = bowGroup(PALETTE.blush, 0.5, { tails: false });
  bow.position.set(-0.024, 0.114, 0.004);
  bow.rotation.z = -0.45;
  g.add(bow);

  return g;
}

function buildTableScatter() {
  const g = new THREE.Group();
  g.name = 'TableScatter';

  // 散落花瓣
  const petalMatA = matte(0xf2c6cf, 0.7);
  const petalMatB = matte(0xfaf1e2, 0.7);
  const petalGeo = new THREE.SphereGeometry(0.014, 8, 6);
  [
    [-0.09, 0.26, 0.4], [0.08, 0.3, 1.2], [0.3, 0.12, 2.2], [0.34, -0.16, 0.7],
    [0.02, -0.32, 1.8], [-0.14, -0.3, 2.9], [-0.36, -0.04, 0.9], [-0.3, 0.22, 1.5],
  ].forEach(([x, z, ra], i) => {
    const p = new THREE.Mesh(petalGeo, i % 2 ? petalMatA : petalMatB);
    p.scale.set(1, 0.13, 0.55);
    p.position.set(x, 0.0025, z);
    p.rotation.y = ra;
    g.add(p);
  });

  // 爱心小纸屑
  [
    [-0.16, 0.16, '#e29aab', 0.3], [0.24, 0.26, '#cfa96e', 1.1],
    [0.38, 0.0, '#f3d5db', 2.0], [-0.38, 0.14, '#e29aab', 1.4],
    [0.1, -0.28, '#cfa96e', 0.6], [-0.24, -0.26, '#f3d5db', 2.4],
  ].forEach(([x, z, color, ra]) => {
    const h = new THREE.Mesh(
      new THREE.PlaneGeometry(0.026, 0.026),
      new THREE.MeshStandardMaterial({ map: heartStickerTexture(color), transparent: true, roughness: 0.7 })
    );
    h.rotation.x = -Math.PI / 2;
    h.rotation.z = ra;
    h.position.set(x, 0.003, z);
    g.add(h);
  });
  return g;
}

/* ============================================================
   交互对象五：落地迎宾牌（独立模型组 "WelcomeBoard"）
   ============================================================ */
function buildWelcomeBoard(sparkleSystem) {
  const group = new THREE.Group();
  group.name = 'WelcomeBoard';
  group.position.set(1.08, 0, -0.30); // 与 easel.glb 槽位一致：房间右侧地面（参考图：沙发右侧靠墙）
  group.rotation.y = 0;

  /* --- 面板 --- */
  const panel = new THREE.Mesh(
    roundedBox(0.36, 0.92, 0.03, 0.02),
    ceramic(0xfdfaf3, { rough: 0.32, clearcoat: 0.5 })
  );
  panel.position.y = 0.82;
  panel.castShadow = true; panel.receiveShadow = true;
  group.add(panel);

  /* --- 浅原木边框 --- */
  const frameMat = matte(0xdcbf9c, 0.6);
  const mkBar = (w, h, d, x, y) => {
    const b = new THREE.Mesh(roundedBox(w, h, d, 0.012), frameMat);
    b.position.set(x, y, 0.016);
    b.castShadow = true;
    group.add(b);
  };
  mkBar(0.4, 0.05, 0.045, 0, 1.255);
  mkBar(0.4, 0.05, 0.045, 0, 0.385);
  mkBar(0.05, 0.95, 0.045, -0.185, 0.82);
  mkBar(0.05, 0.95, 0.045, 0.185, 0.82);

  /* --- 面板彩绘 --- */
  const faceMat = new THREE.MeshStandardMaterial({
    map: boardArtTexture(), transparent: true, roughness: 0.55, metalness: 0,
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 0.71), faceMat);
  face.name = 'BoardArt'; // 使用真实画架时保留这块画布，避免模型替换后迎宾牌变成空白
  face.position.set(0, 0.82, 0.026);
  group.add(face);

  /* --- 画架腿（A 字） --- */
  const legGeo = roundedBox(0.035, 0.42, 0.028, 0.012);
  const frontLeg = new THREE.Mesh(legGeo, frameMat);
  frontLeg.position.set(0, 0.17, 0.06);
  frontLeg.rotation.x = -0.32;
  frontLeg.castShadow = true;
  group.add(frontLeg);
  const backLeg = new THREE.Mesh(legGeo, frameMat);
  backLeg.position.set(0, 0.17, -0.09);
  backLeg.rotation.x = 0.32;
  backLeg.castShadow = true;
  group.add(backLeg);
  // 横撑
  const cross = new THREE.Mesh(roundedBox(0.03, 0.028, 0.2, 0.01), frameMat);
  cross.position.set(0, 0.09, -0.015);
  cross.rotation.x = 0.12;
  group.add(cross);

  /* --- 牌面灯光 --- */
  const glowLight = new THREE.PointLight(0xffe2b8, 0, 2.6, 2);
  glowLight.position.set(0, 0.85, 0.28);
  group.add(glowLight);

  /* --- 弹出提示「生日快乐」 --- */
  const popMat = new THREE.MeshStandardMaterial({
    map: happyBirthdayTexture(), transparent: true, roughness: 0.5,
  });
  const popPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.1625), popMat);
  popPlane.position.set(0, 1.48, 0.06);
  popPlane.visible = false;
  group.add(popPlane);

  group.userData.interactId = 'board';

  let busy = false;
  const sparkleOnly = () => {
    // 真实画架模型已接管（程序化画布/边框/弹出文字都被换壳隐藏）：
    // 只放一次星火，不再弹任何程序化内容，牌面保持模型原本的样子。
    group.updateMatrixWorld(true);
    sparkleSystem.burst(group.localToWorld(new THREE.Vector3(0, 0.9, 0.1)), 16, 1.1);
  };
  const trigger = () => {
    if (busy) return;
    if (!face.visible) { sparkleOnly(); return; }
    busy = true;
    // 牌面灯光亮起
    tween({ dur: 0.5, ease: ease.outCubic, onUpdate: k => { glowLight.intensity = 3.2 * k; } });
    tween({ dur: 1.2, delay: 0.5, ease: ease.inOutCubic, onUpdate: k => { glowLight.intensity = 3.2 + 0.9 * Math.sin(k * Math.PI); } });
    // 图形弹出（弹性缩放）
    tween({ dur: 0.9, ease: ease.outElastic, onUpdate: k => { face.scale.setScalar(0.6 + 0.4 * k); } });
    tween({ dur: 0.6, ease: ease.outCubic, onUpdate: k => { faceMat.opacity = 0.35 + 0.65 * k; }, });
    faceMat.transparent = true;
    // 文字弹出
    popPlane.visible = true;
    popPlane.scale.setScalar(0.01);
    popMat.opacity = 0;
    tween({ dur: 0.75, ease: ease.outBack, onUpdate: k => { popPlane.scale.setScalar(Math.max(0.01, k)); } });
    tween({ dur: 0.4, ease: ease.outQuad, onUpdate: k => { popMat.opacity = k; } });
    // 上浮淡出
    tween({
      dur: 1.2, delay: 2.2, ease: ease.outCubic,
      onUpdate: k => {
        popPlane.position.y = 1.48 + 0.12 * k;
        popMat.opacity = 1 - k;
      },
      onComplete: () => { popPlane.visible = false; busy = false; },
    });
    // 星光（使用世界坐标）
    group.updateMatrixWorld(true);
    sparkleSystem.burst(group.localToWorld(new THREE.Vector3(0, 0.9, 0.1)), 16, 1.1);
  };

  return { group, face, faceMat, popPlane, glowLight, trigger };
}
