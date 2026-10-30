/* ============================================================
   main.js — 主入口：渲染器 / 相机 / 灯光 / 场景装配 / 主循环
   ============================================================ */
import * as THREE from 'three';
import { buildRoom } from './room.js';
import { buildDecor } from './decor.js';
import { buildProps } from './props.js';
import { setupInteractions } from './interact.js';
import { audio } from './audio.js';
import {
  ConfettiSystem, PetalSystem, updateTweens, tween, ease,
} from './helpers.js';
import { smokeTexture } from './textures.js';
import { MODELS } from './models.js';
import { loadModel, shellSwap, reparentTo } from './model-loader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { initAdjustPanel, applyAdjustOverrides } from './adjust.js';
import { setupGate } from './gate.js';
import { setupSurprise, showLetter } from './surprise.js';
import { setupFireworks } from './fireworks.js';

/* ============================================================
   场景装配（与渲染器解耦，便于测试）
   ============================================================ */
export function buildWorld() {
  const scene = new THREE.Scene();
  // 背景改为近黑：整个装饰场景压暗，窗外 3D 烟花才能清晰可见（用户要求）
  scene.background = new THREE.Color(0x05060a);

  /* ---------------- 固定相机 ----------------
     茶几前缘偏右，略高于茶几，四分之三俯视 */
  const camera = new THREE.PerspectiveCamera(52, 16 / 9, 0.1, 60);
  camera.position.set(0.7, 0.92, 1.62);
  camera.lookAt(0.04, 0.92, -0.5);

  /* ---------------- 灯光：暖柔漫射 ----------------
     窗边主光 + 室内暖白氛围灯 */
  const hemi = new THREE.HemisphereLight(0xfff6ea, 0xe6dccb, 0.5);
  hemi.name = 'LightHemi';
  scene.add(hemi);

  const amb = new THREE.AmbientLight(0xfff1e2, 0.32);
  amb.name = 'LightAmbient';
  scene.add(amb);

  // 窗边主光（左前方照入，柔和阴影）
  const sun = new THREE.DirectionalLight(0xfff2df, 1.55);
  sun.position.set(-4.2, 2.9, 1.4);
  sun.target.position.set(0.1, 0.5, -0.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -3.6;
  sun.shadow.camera.right = 3.6;
  sun.shadow.camera.top = 3.2;
  sun.shadow.camera.bottom = -1.2;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 12;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 5;
  sun.name = 'LightSun';
  scene.add(sun, sun.target);

  // 右侧补光
  const fill = new THREE.DirectionalLight(0xffffff, 0.2);
  fill.position.set(3.5, 2.2, 2.2);
  fill.name = 'LightFill';
  scene.add(fill);

  // 顶部暖白吸顶灯
  const ceiling = new THREE.PointLight(0xffe8cc, 14, 7.5, 2);
  ceiling.position.set(0, 2.55, -0.1);
  ceiling.name = 'LightCeiling';
  scene.add(ceiling);

  // 茶几上方暖池
  const tableGlow = new THREE.PointLight(0xffd9ae, 8, 3.4, 2);
  tableGlow.position.set(0, 1.4, 0.35);
  tableGlow.name = 'LightTable';
  scene.add(tableGlow);

  // 气球链暖光
  const garlandGlow = new THREE.PointLight(0xffe3c0, 7, 5, 2);
  garlandGlow.position.set(0, 2.1, -1.4);
  garlandGlow.name = 'LightGarland';
  scene.add(garlandGlow);

  /* ---------------- 装配 ---------------- */
  const room = buildRoom();
  scene.add(room.root);

  const decor = buildDecor();
  scene.add(decor.root);

  const props = buildProps(smokeTexture());
  scene.add(props.root);

  /* 纸屑池 200：揭晓瞬间要同时打三束（110+45+45），池子小了后面几束会被
     burst() 静默跳过（它只找 visible=false 的纸片）。 */
  const confetti = new ConfettiSystem(360);
  scene.add(confetti.group);
  const petals = new PetalSystem(44);
  scene.add(petals.group);

  /* ---------------- 待机动画汇总 ---------------- */
  const updaters = [
    ...props.updaters,
    ...decor.updaters,
    (t, dt) => { confetti.update(dt); petals.update(dt, t); },
  ];

  return {
    scene, camera, room, decor, props,
    confetti, petals,
    smokeSystem: props.smokeSystem,
    sparkleSystem: props.sparkleSystem,
    updaters,
  };
}

/* ============================================================
   diorama 模式：以真实「墙壁」模型为房间底盘的娃娃屋场景
   - 隐藏程序化房间壳体（地板/天花板/三面墙/踢脚线/窗户）
   - 隐藏程序化装饰（气球链/灯串/纱幔/彩带/亮片，由拱门模型接管）
   - 家具与道具整体缩小放进屋内
   - 相机与灯光切换为 diorama 取景
   ============================================================ */
function applyDiorama(world) {
  const d = MODELS.diorama;
  if (!d || !d.enabled) return;

  // 1. 隐藏程序化房间壳体（墙壁模型接管）
  const shellNames = [
    'Floor', 'Ceiling', 'BackWall', 'LeftWall', 'RightWall',
    'BaseboardBack', 'BaseboardLeft', 'BaseboardRight', 'Window',
  ];
  shellNames.forEach((n) => {
    const o = world.scene.getObjectByName(n);
    if (o) o.visible = false;
  });

  // 1b. 桌面装饰隐藏（真实茶几自带蕾丝桌垫与花瓣）
  ['Doily', 'TableScatter'].forEach((n) => {
    const o = world.scene.getObjectByName(n);
    if (o) o.visible = false;
  });

  // 2. 隐藏程序化装饰（气球链/数字/字母/灯串/纱幔/彩带/亮片）
  if (world.decor && world.decor.root) world.decor.root.visible = false;

  // 3. 地毯必须与房间底盘使用同一世界尺度。原实现把地毯留在 Room 根组里一起缩到 0.42，
  // 但 wall.glb 的地板没有缩放，导致地毯高度落到地板下面并产生穿模。把地毯拆出，
  // 按小屋真实尺寸放回地板表面；房间其余程序化家具仍缩放，作为真实模型未加载时的兜底。
  const carpet = world.scene.getObjectByName('Carpet');
  if (carpet) {
    carpet.removeFromParent();
    carpet.scale.set(0.60, 1, 0.60); // 约 1.74 × 1.2m，覆盖沙发前沿与茶几下方
    carpet.position.set(0, 0.008, 0.02); // wall.glb 已下移 0.099m，地板世界顶面 y=0；地毯抬高 8mm 防止 z-fighting
    world.scene.add(carpet);
    carpet.renderOrder = 1;
  }
  // 真实墙体与真实家具均按米制尺寸摆放。仅缩放隐藏的程序化房间壳体，桌面物件不再被二次缩小。
  const s = d.propsScale;
  world.room.root.scale.setScalar(s);
  world.props.root.scale.setScalar(1);

  // 4. 相机取景（响应式）：
  //   · 横屏/桌面：精致四分之三俯视原机位；
  //   · 竖屏（手机）：窄视场角会把小屋压成中央窄条、左侧窗户被切掉，
  //     故后退+加大视场角+略向左偏，让整间屋（含左侧窗外）进画面——代价是小屋略小，
  //     但竖屏能看到窗户惊喜，比窄条更实用。用户明确要“竖屏看窗外”。
  const cam = world.camera;
  const isPortrait = () => window.innerHeight > window.innerWidth;
  const camTarget = new THREE.Vector3(-0.04, 0.5, -0.03);
  const frameCamera = () => {
    const port = isPortrait();
    if (port) {
      cam.fov = 60;
      const tgt = new THREE.Vector3(-0.24, 0.52, -0.05); // 略向左偏，让左侧窗户完整入镜
      const dir = new THREE.Vector3(1.30, 1.05, 2.45);
      const k = 1.6;                                    // 竖屏退远到窗户完整入镜（宽房间在竖屏天生偏窄条，不强行填满）
      cam.position.set(tgt.x + dir.x * k, tgt.y + dir.y * k, tgt.z + dir.z * k);
      cam.lookAt(tgt);
    } else {
      cam.fov = 44;
      cam.position.set(1.25, 1.45, 2.45);              // 略后撤+左移，让构图居中、右侧暗带收窄
      cam.lookAt(new THREE.Vector3(-0.04, 0.5, -0.03));
    }
    cam.updateProjectionMatrix();
  };
  frameCamera();

  // 4b. 自由视角：轨道控制（拖动旋转 / 滚轮缩放），带阻尼。
  // 限制在室内前方可视半球：可以看向左侧窗户，但不允许绕到模型背后或平移出房间。
  let lastPort = isPortrait();
  const home = { pos: cam.position.clone(), target: isPortrait() ? new THREE.Vector3(-0.24, 0.52, -0.05) : camTarget.clone() };
  world.homeView = { pos: home.pos.clone(), target: home.target.clone() };
  if (world.renderer) {
    const makeOpts = (port) => ({
      enableDamping: true, dampingFactor: 0.085,
      enablePan: false, // 禁止把镜头平移到房屋外，避免看到墙体背面和模型边界
      minDistance: 0.98, maxDistance: port ? 6.5 : 2.85,
      minPolarAngle: 0.22, maxPolarAngle: Math.PI * 0.455,
      minAzimuthAngle: -0.88, maxAzimuthAngle: 0.92, // 可看窗户，但不绕到房屋背面
    });
    const makeControls = () => {
      const c = new OrbitControls(cam, world.renderer.domElement);
      Object.assign(c, makeOpts(isPortrait()));
      c.target.copy(home.target);
      c.update();
      return c;
    };
    let controls = makeControls();
    world.controls = controls;
    // 复位：先回位姿，再换全新实例——丢掉所有惯性残速，瞬间到位
    world.resetView = () => {
      cam.position.copy(home.pos);
      const c = makeControls();
      controls.dispose();
      controls = c;
      world.controls = c;
    };
  }

  /* 5. 灯光适配 diorama 尺度：提高环境光让墙面均匀受光，收敛顶光与侧光。
     ★ 2026-10-26 按新布局重排（墙 2.34m @ x=-0.38 之后，家具世界坐标全部跟着走）：
       · LightTable  → 正对茶几中心（桌面 y=0.187、桌心 z=0.144），暖池打在蛋糕/信封上
       · LightGarland→ 从拱门**内侧前方**打（旧值 z=-0.8 已经贴死后墙内表面 -0.815，
                        只剩 1.5cm，墙上会烫出一块硬光斑），现在贴拱环中空位置，
                        气球从内部被点亮，边缘自然透光
       · LightCeiling→ 跟着房间中心左移到 x≈0.02（墙包围盒中心 x=0.041） */
  /* ★ 2026-10-26 第四轮：用户在第三轮基础上还要"更温馨明亮一点"。
     在第三轮（hemi .46/amb .17/桌灯 .52/串灯 .46/顶灯 .34/日光 .40/补光 .09、曝光 .72）之上再整体抬一档：
     底光更柔（hemi .58/amb .24）、暖池更亮更散（桌灯 .66 距离 2.4、串灯 .58 距离 3.2、顶灯 .46 距离 3.4）、
     主光 .55、补光 .14，曝光提到 .85。暖色不变（仍是奶油/香槟调），整体更通透、更有温度。 */
  /* ★ 2026-10-26 第十轮：用户在第四轮（曝光 .85）基础上还要"布置好的房间还可以亮一点"。
     再整体抬一档（仅满房）：底光更柔（hemi .58→.67 / amb .24→.30）、
     暖池更亮更散（桌灯 .66→.75 距离 2.6、串灯 .58→.66 距离 3.4、顶灯 .46→.55 距离 3.6）、
     主光 .55→.63、补光 .14→.18，曝光 .85→.93。暖色不变，更通透温暖；空房不受影响。 */
  const hemi = world.scene.getObjectByName('LightHemi');
  if (hemi) hemi.intensity = 0.67;
  const amb = world.scene.getObjectByName('LightAmbient');
  if (amb) amb.intensity = 0.30;
  const table = world.scene.getObjectByName('LightTable');
  if (table) { table.position.set(0, 0.58, 0.16); table.intensity = 0.75; table.distance = 2.6; }
  const gar = world.scene.getObjectByName('LightGarland');
  if (gar) { gar.position.set(0.02, 1.02, -0.66); gar.intensity = 0.66; gar.distance = 3.4; }
  const ceil = world.scene.getObjectByName('LightCeiling');
  if (ceil) { ceil.position.set(0.02, 1.50, -0.02); ceil.intensity = 0.55; ceil.distance = 3.6; }
  const sun = world.scene.getObjectByName('LightSun');
  if (sun) sun.intensity = 0.63;
  const fill = world.scene.getObjectByName('LightFill');
  if (fill) fill.intensity = 0.18;
}

/* 不再叠加程序化踢脚线或纱幔；wall.glb 已包含房间壳体。 */

/* 拱门气球：新 "20" 与 "BIRTHDAY" 气球组挂到拱门组下，摆在拱环开口内
   （新拱门 = archballoon.glb 落地气球拱门；字母在环内、略靠前，参考图布局）。
   子节点世界尺寸 = targetSize × group.scale，故 targetSize 按比例折算。
   世界坐标："20"中心 (0,0.80,-0.70)、BIRTHDAY 中心 (0,0.47,-0.74)。 */
async function attachArchBalloons(archGroup) {
  const s = archGroup.scale.x || 1;
  const p = archGroup.position;
  const E = (MODELS.entries || {});
  // 参考图分层：20 在最上、两个 Kitty 贴纸分列 20 两侧、HAPPY BIRTHDAY 横幅在下。
  // ★ 以前这两个是硬编码的，导致布局面板（?adjust=1）里拖完导出也无法固化；
  //   现在优先读 models.js 的 entries.num20 / entries.happybirthday。
  //   local = 相对拱门组的局部坐标（面板里显示的就是它）；
  //   world = 世界坐标兜底（会按拱门位置与缩放换算成局部）。
  const read = (slot, dflt) => {
    const e = E[slot];
    if (!e) return null;
    if (Array.isArray(e.local)) return { size: e.targetSize || dflt.size, local: e.local };
    if (Array.isArray(e.world)) return { size: e.targetSize || dflt.size, world: e.world };
    return null;
  };
  const defs = [
    { file: 'assets/models/num20.glb', name: 'Num20', worldSize: 0.40, world: [0, 0.785, -0.78], slot: 'num20' },
    { file: 'assets/models/happybirthday.glb', name: 'HappyBirthday', worldSize: 0.44, world: [0, 0.52, -0.79], slot: 'happybirthday' },
  ];
  for (const d of defs) {
    try {
      const cfg = read(d.slot, { size: d.worldSize }) || { size: d.worldSize };
      const worldSize = cfg.size;
      const m = await loadModel(d.file, { targetSize: worldSize / s });
      // 材质覆盖：压缩模型自带 metalness=1，主场景无 envMap + ACES tone mapping 下纯金属会渲染成全黑
      m.object.traverse((o) => {
        if (o.isMesh && o.material) {
          o.material.metalness = Math.min(o.material.metalness, 0.15);
          o.material.roughness = Math.max(o.material.roughness, 0.55);
          o.material.needsUpdate = true;
        }
      });
      const local = cfg.local
        ? cfg.local.slice()
        : (cfg.world || d.world).map((v, i) => (v - [p.x, p.y, p.z][i]) / s);
      m.object.position.set(local[0], local[1], local[2]);
      // 命名：布局面板（?adjust=1）与测试按名查找，便于单独微调"20"与横幅位置
      m.object.name = d.name;
      archGroup.add(m.object);
    } catch (e) { console.warn('气球加载失败', d.file, e); }
  }
}

/* ============================================================
   房间状态系统：empty（昏暗空房，茶几上只有一封微微发光的第一封信）
                 full （布置好的房间，礼花变身后）
   - fullOnly / emptyOnly 两组对象按状态切换可见性
   - 灯光整体调光 + 背景压暗 + 曝光下降（空房氛围）
   - 第一封信：暖点光呼吸 + 信封材质自发光脉冲
   - 桌面高度：无装饰茶几比装饰版低 1.4cm，tabletop 随状态升降
   ============================================================ */
function initRoomState(world) {
  const scene = world.scene;
  const P = world.props;
  const byName = (n) => scene.getObjectByName(n);

  /* ---- 地毯贴回地板面（必须在真实墙模型装载之后做）----
     wall.glb 的缩放一变，地板顶面高度就跟着变：2.10m 版本地板顶面≈y=0，
     现在 2.34m @ y=-0.095 的版本射线实测是 y=0.0158。
     而 applyDiorama 里地毯高度是写死的 0.008（那时墙还没加载，没法量），
     于是整块地毯被埋进地板下面 1.8mm —— 不是被删了，是彻底看不见。
     这里实测地板顶面再把地毯抬上去（+2mm 防 z-fighting）。 */
  const carpet = scene.getObjectByName('Carpet');
  const wallModel = world.models && world.models.wall;
  if (carpet && wallModel) {
    wallModel.updateMatrixWorld(true); // 陈旧矩阵会让射线打歪（见 model-loader 的坑）
    const seat = new THREE.Raycaster(); seat.far = 4;
    seat.set(new THREE.Vector3(0, 1.6, 0.02), new THREE.Vector3(0, -1, 0));
    const hit = seat.intersectObject(wallModel, true)[0];
    if (hit) {
      carpet.position.y = hit.point.y + 0.002;
      world.debugCarpetY = carpet.position.y; // 测试钩子
    }
  }

  /* ---- 仅满房可见的装饰 ---- */
  const fullOnly = [];
  const addFull = (o) => { if (o && fullOnly.indexOf(o) < 0) fullOnly.push(o); };
  addFull(world.models.arch);          // 气球拱门组（NewArch）
  addFull(world.models.sofa);          // 装饰沙发
  addFull(world.models.table);         // 装饰茶几
  addFull(world.models.kittysticker);      // Kitty 墙饰（右）
  addFull(world.models.kittystickerLeft);   // Kitty 墙饰（左）
  addFull(P.board.group);                   // 迎宾牌
  addFull(P.cake.group);               // 蛋糕（含蜡烛/火焰/Kitty 头）
  addFull(P.bouquet.group);            // 花束
  addFull(P.ringBox.group);            // 戒指盒
  addFull(P.flute);                    // 酒杯
  addFull(world.models.envelope2);     // 第二封信（火漆信封）

  /* ---- 仅空房可见 ---- */
  const emptyOnly = [];
  const addEmpty = (o) => { if (o && emptyOnly.indexOf(o) < 0) emptyOnly.push(o); };
  addEmpty(world.models.sofaplain);    // 无装饰沙发（真实模型）
  // 空房茶几：优先真实模型 tableplain.glb；模型没加载成功才退回程序化 CoffeeTable
  const emptyTableModel = world.models && world.models.tableplain;
  addEmpty(emptyTableModel || byName('CoffeeTable'));

  /* ---- 灯光基准（diorama 调整后的强度）与调光参数 ---- */
  const lightNames = ['LightHemi', 'LightAmbient', 'LightSun', 'LightFill', 'LightCeiling', 'LightTable', 'LightGarland'];
  const lights = {};
  for (const n of lightNames) { const l = byName(n); if (l) lights[n] = l; }
  const lightBase = {};
  for (const n in lights) lightBase[n] = lights[n].intensity;
  const DIM = 0.34;                                  // 空房灯光系数
  const EXP_FULL = 1.02, EXP_EMPTY = 0.42;           // 曝光（满/空）★ 第十四轮：满房 .93→1.02（用户「布置好的房间亮度增加」）
  const FULL_BOOST = 0.14;                           // ★ 第十四轮：满房灯光整体再抬 14%（空房 k=0 不受影响）
  const bgFull = new THREE.Color(0x05060a);          // 近黑：装饰场景背景（烟花可见）
  const bgEmpty = new THREE.Color(0x2b251d);         // 深夜暖灰（空房氛围，第一封信微光）

  /* ---- 第一封信微光：暖点光 + 信封自发光脉冲 ---- */
  const glow = new THREE.PointLight(0xffd2a0, 0, 1.8, 2);
  glow.name = 'LetterGlow';
  scene.add(glow);
  const envMats = [];
  const envModel = P.envelope.group.getObjectByName('RealModel');
  if (envModel) {
    envModel.traverse((o) => {
      if (o.isMesh && o.material) {
        o.material.emissive.setHex(0xffb36b);
        o.material.emissiveIntensity = 0;
        envMats.push(o.material);
      }
    });
  }
  const glowAnchor = new THREE.Vector3();
  const updateGlowPos = () => {
    P.envelope.group.updateMatrixWorld(true);
    /* 微光锚点以前写死「信封局部 (0, 0.09, 0.03)」——那是信封**竖着**时的中心高度。
       信封 2026-10-26 起改成平躺（厚 3cm），这个高度会让光飘在信封上方 6cm，
       桌面上只有一个孤立的光斑。改成按可见包围盒顶面 +2cm 定位，
       以后信封姿态再变也不用回来改这个数。 */
    P.envelope.group.getWorldPosition(glowAnchor);
    const bb = new THREE.Box3();
    P.envelope.group.traverse((o) => {
      if (!o.isMesh) return;
      let q = o, vis = true;
      while (q) { if (!q.visible) vis = false; q = q.parent; }
      if (vis) bb.expandByObject(o);
    });
    const top = Number.isFinite(bb.max.y) ? bb.max.y : glowAnchor.y + 0.05;
    glow.position.set(glowAnchor.x, top + 0.02, glowAnchor.z + 0.03);
  };

  /* ---- 桌面高度：满房=装饰茶几顶，空房=无装饰茶几顶 ----
     两个茶几都是真实模型，桌高一律**实测可见包围盒顶面**，不再写死。
     （0.186 是程序化茶几的高度：装饰茶几被 main.js 只拉宽 X/Z（×2.15）而没拉高，
       实测顶面只有 0.1435 —— 照写 0.186 会让蛋糕/信封/戒指盒整组悬空 4.25cm。） */
  const measureTableTop = (m) => {
    if (!m) return null;
    const wasVisible = m.visible;
    m.visible = true; m.updateMatrixWorld(true);
    const bb = new THREE.Box3();
    m.traverse((o) => {
      if (!o.isMesh) return;
      let q = o, v = true;
      while (q) { if (!q.visible) v = false; q = q.parent; }
      if (v) bb.expandByObject(o);
    });
    m.visible = wasVisible;
    const topY = bb.max.y;
    return Number.isFinite(topY) && topY > 0 ? topY : null;
  };
  const decorTableTop = measureTableTop(world.models && world.models.table);
  const tabletopFullY = decorTableTop != null ? decorTableTop : P.tabletop.position.y;
  const plainTableTop = measureTableTop(emptyTableModel);
  const tabletopEmptyY = plainTableTop != null ? plainTableTop : 0.1764; // 退路：程序化茶几顶面

  /* ---- 满房初始态：蜡烛尚未插上（点击蛋糕后才插蜡烛，见 interact onCakeShow）---- */
  ['CakeCandle', 'CakeWick', 'CandleFlame'].forEach((n) => {
    const o = P.cake.group.getObjectByName(n);
    if (o) o.visible = false;
  });

  let state = 'empty';

  const applyLights = (k) => { // k: 1=满房亮度, 0=空房亮度
    for (const n in lights) lights[n].intensity = lightBase[n] * (DIM + (1 - DIM) * k) * (1 + FULL_BOOST * k);
    if (world.renderer) world.renderer.toneMappingExposure = EXP_FULL + (EXP_EMPTY - EXP_FULL) * (1 - k);
    scene.background.copy(bgFull).lerp(bgEmpty, 1 - k);
  };

  // 可见性与桌面高度切换（setRoomState 与初始化共用）
  const applyState = (full) => {
    for (const o of fullOnly) o.visible = full;
    for (const o of emptyOnly) o.visible = !full;
    if (world.models && world.models.envelope2) world.models.envelope2.visible = full;
    // 空房只允许第一封信：额外信封即使由异步模型加载，也在状态应用时强制隐藏。
    if (!full && world.models && world.models.envelope2) world.models.envelope2.visible = false;
    if (!full && world.props && world.props.envelope) world.props.envelope.group.visible = true;
    // 程序化茶几只在「真实素版茶几没加载成功」时兜底出现
    const cleanTable = byName('CoffeeTable');
    const plainTableModel = world.models && world.models.tableplain;
    if (cleanTable) cleanTable.visible = !full && !plainTableModel;
    if (plainTableModel) plainTableModel.visible = !full;
    if (world.models && world.models.table) world.models.table.visible = full;
    P.tabletop.position.y = full ? tabletopFullY : tabletopEmptyY;
    // 空房阶段不露出装饰提示与控制栏，避免提前剧透后续互动。
    const app = document.getElementById('app');
    if (app) {
      app.classList.toggle('room-full', full);
      app.classList.toggle('room-empty', !full);
    }
  }

  world.setRoomState = (next, opts = {}) => {
    const animate = opts.animate !== false;
    if (next === state) return;
    const full = next === 'full';
    state = next;
    world.roomState = state;
    applyState(full);
    // 家具/灯串可见性变了 → 阴影贴图重算一次（按需更新模式）
    if (world.refreshShadow) world.refreshShadow();
    if (!animate) { applyLights(full ? 1 : 0); return; }
    // 平滑调光：黑屏转场期间播放，"睁眼"时房间已焕然一新
    const from = {}, to = {};
    // ⚠ to[n] 必须和 applyLights(1) 的终值一致（含 FULL_BOOST），
    //   否则「带转场」的变身会比「不带转场」暗一档（两条路径亮度不一致的老坑）。
    for (const n in lights) { from[n] = lights[n].intensity; to[n] = full ? lightBase[n] * (1 + FULL_BOOST) : lightBase[n] * DIM; }
    const expFrom = world.renderer ? world.renderer.toneMappingExposure : EXP_FULL;
    const expTo = full ? EXP_FULL : EXP_EMPTY;
    const bgFrom = scene.background.clone();
    const bgTo = full ? bgFull : bgEmpty;
    tween({
      dur: 1.15, ease: ease.inOutCubic,
      onUpdate: (k) => {
        for (const n in lights) lights[n].intensity = from[n] + (to[n] - from[n]) * k;
        if (world.renderer) world.renderer.toneMappingExposure = expFrom + (expTo - expFrom) * k;
        scene.background.copy(bgFrom).lerp(bgTo, k);
      },
    });
  };

  /* ---- 每帧：信封微光呼吸（仅空房、且第一封信还没被打开）---- */
  world.updaters.push((t) => {
    if (state !== 'empty' || world.firstLetterOpened) {
      glow.intensity = 0;
      for (const m of envMats) m.emissiveIntensity = 0;
      return;
    }
    updateGlowPos();
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.7);
    // 下调微光：原强度过高使信封"太亮"，现改为极淡邀请暗示（点光峰值 ~0.95、自发光峰值 ~0.09）
    glow.intensity = 0.35 + pulse * 0.6;
    for (const m of envMats) m.emissiveIntensity = 0.02 + pulse * 0.07;
  });

  // 初始状态：直接套用空房（setRoomState 的同名早退不会触发，必须显式应用）
  applyState(false);
  applyLights(0);
  world.roomState = 'empty';
}

/* ============================================================
   真实 3D 模型装配（models.js 登记了文件才会生效，
   未登记或加载失败的槽位自动保留程序化模型）
   ============================================================ */export async function applyRealModels(world) {
  applyDiorama(world); // diorama 模式（同步调整，先于模型加载）
  const entries = MODELS.entries || {};
  const loaded = {};

  // 非交互大件：隐藏既有组，整体替换
  const bigParts = {
    sofa: () => world.scene.getObjectByName('Sofa'),
    // 注意：TableTop 是桌面道具挂载的隐形表面组，不能隐藏；可见茶几在 room.js 里
    // table / tableplain 都顶替同一张程序化茶几（CoffeeTable）：装饰版在满房用，素版在空房用
    table: () => world.scene.getObjectByName('CoffeeTable'),
    tableplain: () => world.scene.getObjectByName('CoffeeTable'),
    arch: () => world.decor.garland,
    wall: () => null, // 壳体隐藏由 applyDiorama 处理
  };

  // 材质覆盖（贴图烘焙模型常有过强法线/高光，此处统一压一层）
  const applyMat = (model, mat) => {
    if (!mat) return;
    model.traverse((o) => {
      if (o.isMesh && o.material) {
        const m = o.material;
        if (mat.normalScale != null && m.normalMap) m.normalScale.setScalar(mat.normalScale);
        if (mat.roughness != null) m.roughness = mat.roughness;
        if (mat.metalness != null) m.metalness = mat.metalness;
        if (mat.color != null) m.color.set(mat.color);
        if (mat.envMapIntensity != null) m.envMapIntensity = mat.envMapIntensity;
        // 轻微自发光：用于墙面贴纸这类「纸质印刷品」，暗场里靠环境光只会发灰
        if (mat.emissive != null) m.emissive.set(mat.emissive);
        if (mat.emissiveIntensity != null) m.emissiveIntensity = mat.emissiveIntensity;
        m.needsUpdate = true;
      }
    });
  };

  const rotateOnInteractiveAnchor = new Set(['cake', 'bouquet', 'ringBox', 'envelope', 'board', 'figurine', 'flute']);
  /* ★ 2026-10-29 性能优化：19 个模型以前在 for 循环里逐个 await，
     总耗时 = 各模型耗时**之和**（每个都要等一次首包往返）。
     各槽位之间互不依赖（shellSwap 挂点、world.scene.add 都只写自己的对象），
     改成并发池（最多 6 个同时在飞）后加载时间大幅缩短，开门更快。 */
  const jobs = [];
  for (const [slot, cfg] of Object.entries(entries)) {
    if (!cfg || !cfg.file) continue;
    /* "20" 与 HAPPY BIRTHDAY 横幅由 attachArchBalloons 挂进气球拱门组（用的是 local 局部坐标），
       绝不能在这里再装配一遍：它们没有 cfg.pos，会落到世界原点，
       在蛋糕正上方凭空长出一组一模一样的气球字。 */
    if (slot === 'num20' || slot === 'happybirthday') continue;
    jobs.push(async () => {
    try {
      const { object: model } = await loadModel(cfg.file, {
        targetSize: cfg.targetSize || 0,
        // 交互槽位的旋转统一写在外层 group 上，避免模型自身与 group 各转一次造成角度翻倍。
        rotY: rotateOnInteractiveAnchor.has(slot) ? 0 : (cfg.rotY || 0),
        /* rotX 是"把模型本身放平"用的（如信封从立着改成平躺），必须在 loader 内部
           归一化之前生效，这里只是透传。外层 group 的 rotation.y 再负责桌面上朝向。 */
        rotX: cfg.rotX || 0,
        flipY: !!cfg.flipY,
      });
      applyMat(model, cfg.mat);
      // 茶几 GLB 原始归一化直径只有约 0.393m。只扩展 X/Z 到约 0.84m，
      // 不扩展 Y，避免桌面变高；与空房程序化茶几及桌面道具锚点保持一致。
      // 空房素版茶几（tableplain）是同一张模型，同样要拉宽，否则空房茶几会小一圈。
      if (slot === 'table') {
        model.scale.x *= 2.15; model.scale.z *= 2.15;
        /* ★ 2026-10-26 第三轮：之前只拉宽 X/Z（×2.15）不拉高，装饰茶几被压成 14cm 高的"扁盘"，
           用户说"太扁了"。这里把 Y 也按同样比例（×2.15）放大，恢复等比，
           茶几顶面从 0.144m 升到约 0.31m —— 一张正常高度的小茶几。
           桌面道具锚点由 initRoomState 的 measureTableTop() 实测，会自动跟着抬高。 */
        model.scale.y *= 2.15;
        model.updateMatrixWorld(true);
      }

      if (slot === 'cake' || slot === 'bouquet' || slot === 'ringBox' ||
          slot === 'envelope' || slot === 'board' ||
          slot === 'figurine' || slot === 'flute') {
        // 交互对象：换壳（保留交互句柄/动画结构）
        const group = world.props[slot] && world.props[slot].group
          ? world.props[slot].group
          : world.props[slot];
        // 蛋糕换真实模型后，蜡烛/灯芯/火焰要保留（吹气互动）并重挂到新蛋糕上
        const keep = slot === 'cake'
          ? ['CakeCandle', 'CakeWick', 'CandleFlame']
          : (cfg.keep || []);
        shellSwap(group, model, { keep });
        if (cfg.pos) group.position.set(...cfg.pos);
        if (cfg.rotY != null) group.rotation.y = cfg.rotY;

        // 盒盖 / 封口盖重新挂到动画句柄
        if (slot === 'ringBox' && cfg.lidMesh) {
          reparentTo(model, cfg.lidMesh, world.props.ringBox.lidPivot);
        }
        // 成品盒（已开盖、戒指已烘焙）：无 lidMesh，不需要 reparent；
        // 但程序化 ringLight（PointLight，非 mesh，shellSwap 不会隐藏）会残留，手动关掉
        if (slot === 'ringBox') {
          const rl = world.props.ringBox && world.props.ringBox.ringLight;
          if (rl) rl.visible = false;
        }
        if (slot === 'envelope' && cfg.flapMesh) {
          reparentTo(model, cfg.flapMesh, world.props.envelope.flapPivot);
        }
        if (slot === 'cake') {
          // 无头蛋糕装配：① 蜡烛/灯芯/火焰/烟雾锚重挂到 holder 局部坐标
          // （Kitty 头居中，蜡烛让位到 Kitty 右后方、已验证不悬浮）；② Kitty 头装进顶部居中。
          const holder = group.getObjectByName('RealModel');
          const cakeRef = world.props.cake;
          if (holder && cakeRef) {
            /* ★ 2026-10-29 第十五轮+：用户「Kitty 一定要在中间，蜡烛别插偏」。
               蜡烛从右后方 (0.075,-0.03) 改为 **Kitty 正后方中轴线 (0, -0.09)**，
               这样从正面看蜡烛在 Kitty 正后方、左右完全对称，不偏一侧。
               （Kitty 头顶正上方不能放——会插进 Kitty 头里穿插。）
               落点高度一律向下射线实测，不写死。 */
            const cx = 0.000, cz = -0.070; // 蜡烛让位到 Kitty 正后方中轴（对称不偏）；贴近 Kitty 使蜡烛顶在正面露出
            // 向下射线实测顶面高度（每次现算：排除蜡烛/灯芯/火焰自身，且只算可见网格）
            const rayDown = (x, z, fallback) => {
              holder.updateMatrixWorld(true); // 陈旧矩阵会让射线打歪（model-loader 的坑）
              const ray = new THREE.Raycaster(); ray.far = 4;
              const skip = new Set(['CakeCandle', 'CakeWick', 'CandleFlame']);
              const solids = [];
              holder.traverse((o) => {
                if (!o.isMesh || !o.visible) return;
                let q = o, named = false;
                while (q) { if (q.name && skip.has(q.name)) named = true; q = q.parent; }
                if (!named) solids.push(o);
              });
              if (!solids.length) return fallback;
              ray.set(holder.localToWorld(new THREE.Vector3(x, 1.2, z)), new THREE.Vector3(0, -1, 0));
              const hit = ray.intersectObjects(solids, false)[0];
              return hit ? holder.worldToLocal(hit.point.clone()).y : fallback;
            };
            const cakeTopY = rayDown(cx, cz, 0.20);
            world.debugCakeTopY = cakeTopY; // 测试钩子：smoke-v5 用它验证蜡烛确实插进去了
            const CANDLE_HALF = 0.0425; // 蜡烛圆柱半高（CylinderGeometry 高 0.085）
            const SINK = 0.012;         // 插进奶油里的深度，别让蜡烛"浮"在表面
            const cy = cakeTopY - SINK + CANDLE_HALF;
            if (cakeRef.candle) { cakeRef.candle.position.set(cx, cy, cz); holder.add(cakeRef.candle); }
            const wick = group.getObjectByName('CakeWick');
            if (wick) { wick.position.set(cx, cy + 0.047, cz); holder.add(wick); }
            if (cakeRef.flame && cakeRef.flame.group) {
              cakeRef.flame.group.position.set(cx, cy + 0.054, cz);
              holder.add(cakeRef.flame.group);
            }
            if (cakeRef.smokeAnchor) { cakeRef.smokeAnchor.position.set(cx, cy + 0.093, cz); holder.add(cakeRef.smokeAnchor); }
            try {
              const kitty = await loadModel('assets/models/kittyhead.glb', { targetSize: 0.09 });
              /* Kitty 头回正中央 (0, 0)：正中央奶油面实测 ≈0.129（grid 中心），平坦不悬空。
                 落点同样用射线实测，避免悬空或陷进奶油。 */
              const KX = 0.000, KZ = 0.000; // Kitty 头居中（用户本轮硬性要求）
              const kittyY = rayDown(KX, KZ, 0.129);
              kitty.object.position.set(KX, kittyY, KZ);
              holder.add(kitty.object);
              world.debugKitty = { x: KX, y: +kittyY.toFixed(4), z: KZ };
            } catch (e) { console.warn('Kitty 头加载失败', e); }
          }
        }
      } else if (bigParts[slot]) {
        const old = bigParts[slot]();
        if (old) old.visible = false;
        if (slot === 'arch') {
          // 新拱门 = 单独落地气球拱门（archballoon.glb，自带两侧气球立柱），
          // "20"/"BIRTHDAY"气球挂进拱环内配合（旧一体 arch.glb / archplain+程序立柱方案弃用）
          const archGroup = new THREE.Group();
          archGroup.name = 'NewArch';
          archGroup.userData.modelKey = 'arch'; // adjust 面板/测试标记
          const pos = cfg.pos || [0, 0, 0];
          archGroup.position.set(pos[0], pos[1], pos[2]);
          world.scene.add(archGroup);
          model.position.set(0, 0, 0); // 模型最低点已在 y=0，直接落地
          archGroup.add(model);
          await attachArchBalloons(archGroup);
        } else {
          const pos = cfg.pos || [0, 0, 0];
          model.position.set(pos[0], pos[1], pos[2]);
          model.userData.modelKey = slot; // 调试/测试标记
          world.scene.add(model);
          /* ⚠ 这里以前调用 attachDioramaDetails(world, model)（给墙体额外挂踢脚线/纱幔），
             但那个函数已在「wall.glb 自带壳体」改造中被删除，只留下调用点：
             ReferenceError 会被外层 try 吞掉，于是 wall 槽位永远注册不进 world.models，
             布局面板里「墙壁（房间）」永远显示"该对象尚未加载"，模型也没法微调。
             踢脚线/纱幔现在由 wall.glb 自带，无需再挂，故删掉该调用。 */
        }
      } else if (slot === 'envelope2') {
        // 第二封信：以 models.js 的 tabletop 局部坐标摆放；默认在前缘右侧。
        // 位置相对第一封信向右错开，与戒指盒保持可见间距，不再使用旧的硬编码 z 偏移。
        model.position.set(...(cfg.pos || [0.18, 0, 0.24]));
        world.props.tabletop.add(model);
        model.userData.modelKey = 'envelope2';
        if (world.registerInteract) {
          world.registerInteract('envelope2', model, { hoverScale: 1.05 });
          world.setInteractHandler('envelope2', () => {
            if (world.hideInspect) world.hideInspect();
            audio.pop();
            world.sparkleSystem.burst(model.localToWorld(new THREE.Vector3(0, 0.02, 0)), 10, 0.7);
            showLetter('second');
          });
        }
      } else {
        // rug 等自由槽位：直接按世界坐标摆放
        const pos = cfg.pos || [0, 0, 0];
        model.position.set(pos[0], pos[1], pos[2]);
        model.userData.modelKey = slot; // 调试/测试标记
        world.scene.add(model);
      }

      // 不向沙发或地面复制程序化 Kitty 玩偶。
      // arch 槽位登记整组（NewArch），保证调整面板移动拱门时弧/立柱/气球一起动
      loaded[slot] = (slot === 'arch' && world.scene.getObjectByName('NewArch')) || model;
      console.info(`[models] 已载入 ${slot} ← ${cfg.file}`);
    } catch (e) {
      console.warn(`[models] ${slot} 加载失败，保留程序化模型:`, e.message);
    } finally {
      // 真实加载进度（加载遮罩的进度条读它，不再是纯假动画）
      if (typeof window !== 'undefined') window.__modelsDone = (window.__modelsDone || 0) + 1;
    }
    });
  }
  if (typeof window !== 'undefined') window.__modelsTotal = jobs.length;
  // 并发池跑起来（顺序仍按 entries 登记顺序启动，只是不再互相等待）
  const LOAD_CONCURRENCY = 6;
  let cursor = 0;
  const runJob = async () => { while (cursor < jobs.length) { await jobs[cursor++](); } };
  await Promise.all(Array.from({ length: Math.min(LOAD_CONCURRENCY, jobs.length) }, runJob));

  world.models = loaded;
  applyAdjustOverrides(world); // 应用本地保存的布局微调（?adjust=1 面板产生）
  initRoomState(world);        // 空/满房间状态（初始：空房 + 第一封信微光）
  if (typeof window !== 'undefined') window.__modelsReady = true; // 测试钩子
  return loaded;
}

/* ============================================================
   浏览器启动
   ============================================================ */
function boot() {
  const canvas = document.getElementById('scene-canvas');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, powerPreference: 'high-performance',
    });
  } catch (err) {
    console.error('[startup] WebGL 初始化失败：', err);
    const loading = document.getElementById('loading');
    if (loading) loading.classList.add('done');
    const title = document.getElementById('gate-title');
    const copy = document.getElementById('gate-copy');
    const overline = document.getElementById('gate-overline');
    const lock = document.getElementById('gate-lock');
    if (title) title.textContent = '这台设备暂时打不开小世界';
    if (copy) copy.textContent = '请尝试使用最新版 Chrome、Edge 或 Safari，并开启硬件加速。';
    if (overline) overline.textContent = 'WEBGL IS REQUIRED';
    if (lock) lock.disabled = true;
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.matchMedia('(max-width: 720px)').matches ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  /* ★ 2026-10-29 性能优化：主光阴影贴图 2048²，默认**每帧**重渲染一遍全部投影物体。
     真实模型加起来几十万面，手机上这笔开销很实在。场景里真正会动的东西
     （烛火、星火、花瓣）都不投影，所以改成「按需更新」：
     模型装完 / 房间状态切换 / 插蜡烛时各刷新一次即可，视觉几乎无差别。 */
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.58;

  const world = buildWorld();
  const { scene, camera } = world;
  window.__birthdayWorld = world; // 调试钩子
  window.__THREE = THREE;         // 测试钩子（射线探测等）
  world.renderer = renderer;      // 调试钩子（测试页可停掉主循环）
  // 阴影按需刷新（见上面 shadowMap.autoUpdate = false）
  world.refreshShadow = () => { renderer.shadowMap.needsUpdate = true; };

  /* ---------------- UI ---------------- */
  const ui = {
    btnMic: document.getElementById('btn-mic'),
    btnMute: document.getElementById('btn-mute'),
    btnView: document.getElementById('btn-view'),
    toast: document.getElementById('toast'),
    inspectCard: document.getElementById('inspect-card'),
    inspectTitle: document.getElementById('inspect-title'),
    inspectCopy: document.getElementById('inspect-copy'),
    btnInspectAction: document.getElementById('btn-inspect-action'),
    btnInspectBack: document.getElementById('btn-inspect-back'),
    btnInspectClose: document.getElementById('btn-inspect-close'),
    inspectCanvas: document.getElementById('inspect-model-canvas'),
    hintItems: Array.from(document.querySelectorAll('.hint-item')),
  };

  const interactions = setupInteractions({ renderer, camera, world, ui });
  world.registerInteract = interactions.register;   // 异步模型就绪后延迟挂交互
  world.setInteractHandler = interactions.setHandler;
  world.debugPick = interactions.debugPick;         // 测试拾取调试
  setupSurprise(world); // 惊喜流程（信纸模态 / 蒙眼 / 礼花 / 变身）
  setupFireworks(world); // 窗外烟花（相机看向左墙窗户时触发）

  // 大门密码锁屏：输对密码推门进入（开门后是昏暗空房 + 发光的第一封信）
  setupGate({
    onUnlock: () => {
      interactions.toast('推门进来啦…茶几上好像有什么在发光 ✨', 4200);
    },
  });

  // 真实模型装配（异步，不阻塞主循环；放在交互/大门就绪之后，
  // 保证 envelope2 等延迟交互挂载时 registerInteract 已存在）
  const adjustMode = new URLSearchParams(location.search).has('adjust');
  applyRealModels(world).then(() => {
    // 模型刚装完：立刻刷一次阴影，再延迟 1.2s 补一次
    // （换壳/挂载有异步尾巴，避免留下缺阴影的第一帧）
    if (world.refreshShadow) { world.refreshShadow(); setTimeout(() => world.refreshShadow && world.refreshShadow(), 1200); }
    if (adjustMode) {
      // 布局模式默认进入满房态：装饰沙发/茶几/蛋糕/信封等全部可见，才能被面板选中移动
      // （默认空房态下可见的是 sofaplain/tableplain，而面板只登记了装饰件，导致"沙发动不了"）
      try { world.setRoomState('full', { animate: false }); } catch (e) {}
      initAdjustPanel(world, MODELS); // 布局微调面板（?adjust=1）
    }
  }).catch((err) => {
    console.error('[models] 场景装配失败：', err);
    // 不让门禁永久等待未完成的 Promise；程序化基础场景仍可用于排查。
    window.__modelsReady = true;
    if (world.toast) world.toast('部分装饰没有载入，基础场景仍可继续使用。', 5000);
  });

  // 复位视角（轨道控制后想回到初始构图时用）
  if (ui.btnView) ui.btnView.addEventListener('click', () => {
    if (interactions.returnHome) interactions.returnHome();
    else if (world.resetView) world.resetView();
  });

  /* ---------------- 主循环 ---------------- */
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    updateTweens(dt);
    for (const u of world.updaters) u(t, dt);
    interactions.update(dt, performance.now());
    if (world.controls) {
      // 平移边界：target 锁在房间范围内，防止平移到屋外看地板边
      const t = world.controls.target;
      t.x = THREE.MathUtils.clamp(t.x, -1.05, 1.05);
      t.y = THREE.MathUtils.clamp(t.y, 0.06, 1.3);
      t.z = THREE.MathUtils.clamp(t.z, -0.95, 1.15);
      world.controls.update(); // 轨道控制阻尼
    }
    renderer.render(scene, camera);
  });

  /* ---------------- 自适应 ---------------- */
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // 横竖屏切换时按新比例重新取景（仅切方向时触发，避免拖动中频繁跳变）
    const port = window.innerHeight > window.innerWidth;
    if (port !== lastPort && world.controls) {
      lastPort = port;
      frameCamera();
      world.controls.target.copy(isPortrait() ? new THREE.Vector3(-0.24, 0.52, -0.05) : camTarget);
      world.controls.maxDistance = port ? 6.5 : 2.85;
      world.controls.update();
    }
  });

  /* ---------------- 加载遮罩 ---------------- */
  const loading = document.getElementById('loading');
  const fill = document.getElementById('load-fill');
  const tip = document.getElementById('load-tip');
  const tips = [
    '充好奶油，准备裱花',
    '给沙发摆上抱枕',
    '吹起背景墙气球链',
    '别上蝴蝶结，点亮灯串',
    '一切就绪，推门进去吧',
  ];
  let p = 0;
  const tick = setInterval(() => {
    /* ★ 2026-10-29：进度条以前是纯假动画（匀速爬到 92% 就停住等），
       慢网时看着像"卡住了"。现在以**真实加载完成度**为上限：
       已载入模型数 / 模型总数 决定能走到哪（最高 92%），上限内再柔和爬升。 */
    if (window.__modelsReady) {
      p = 100;
    } else {
      const total = window.__modelsTotal || 0;
      const real = total ? (window.__modelsDone || 0) / total : 0;
      p = Math.min(Math.min(92, 6 + 88 * real), p + rand2(1.1, 3.0));
    }
    if (p >= 100) {
      p = 100;
      clearInterval(tick);
      setTimeout(() => loading.classList.add('done'), 280);
    }
    fill.style.width = p + '%';
    tip.textContent = p >= 100 ? '小屋准备好了' : tips[Math.min(Math.floor(p / 22), tips.length - 1)];
  }, 110);

  function rand2(a, b) { return a + Math.random() * (b - a); }

  // 首次交互解锁音频
  const unlockOnce = () => { audio.unlock(); window.removeEventListener('pointerdown', unlockOnce); };
  window.addEventListener('pointerdown', unlockOnce);
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}
