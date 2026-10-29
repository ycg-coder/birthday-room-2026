/* ============================================================
   models.js — 真实 3D 模型装配清单
   把模型文件放进 assets/models/ 后，在下方 entries 里登记即可。
   未登记 / 文件缺失的槽位会自动回落到程序化模型（现有纯代码建模）。

   支持格式：.glb（推荐）/ .gltf / .fbx / .obj(+.mtl 同名文件)
   通用参数：
     targetSize  目标最大边长（米），自动等比缩放，0=用原始尺寸
     alignGround 最低点落地 y=0（默认 true）
     center      水平居中（默认 true）
     pos  [x,y,z] 相对槽位锚点的偏移（米）
     rotY 弧度
     flipY 模型正面朝向不对时整转 180°

   —— 槽位说明（挂载点 = 既有交互组的局部坐标系原点）——
   sofa       沙发        挂在场景原点附近，pos 为世界坐标偏移
   table      圆茶几      同上（含桌腿）
   rug        长毛地毯    同上
   arch       气球拱门    同上（整体替换程序化气球链）
   cake       蛋糕        挂在茶几面上 (TABLE 顶面)，含架体可整体建模
   bouquet    捧花        挂在茶几面上
   ringBox    戒指盒      挂在茶几面上；lidMesh: 模型里盒盖节点名（参与开合动画）
   envelope   信封        挂在茶几面上；flapMesh: 封口盖节点名（参与开合动画）
   board      迎宾牌      挂在地面，含画架
   figurine   Kitty 手办  挂在茶几面上
   envelope2  第二封信    满房揭晓后挂在茶几面上
   flute      香槟杯      挂在茶几面上
   ============================================================ */
export const MODELS = {
  /* ---- diorama 模式 ----
     以真实「墙壁」模型作为房间底盘（开放式转角小屋），
     程序化家具/道具整体缩小后放入屋内，相机切换为斜俯视取景。 */
  diorama: {
    enabled: true,
    propsScale: 0.42, // 仅缩放隐藏的程序化房间兜底结构；真实桌面道具保持世界尺度 1
  },

  /* 文件就绪后在这里登记，例如：
  cake:     { file: 'assets/models/cake.glb',     targetSize: 0.34, pos: [0, 0, 0] },
  bouquet:  { file: 'assets/models/bouquet.fbx',  targetSize: 0.30, pos: [-0.2, 0, -0.17], rotY: 0.35 },
  ringBox:  { file: 'assets/models/ringbox.glb',  targetSize: 0.12, pos: [0.2, 0, -0.16], lidMesh: 'lid' },
  envelope: { file: 'assets/models/envelope.glb', targetSize: 0.16, pos: [0.19, 0, 0.22], flapMesh: 'flap' },
  sofa:     { file: 'assets/models/sofa.glb',     targetSize: 2.2,  pos: [0, 0, -1.05] },
  table:    { file: 'assets/models/table.glb',    targetSize: 1.15, pos: [0, 0, 0.32] },
  arch:     { file: 'assets/models/arch.glb',     targetSize: 4.4,  pos: [0, 0, -1.7] },
  */

  entries: {
    /* 房间底盘（真实模型，世界坐标）：★ 2026-10-26 放大到 2.34m @ x=-0.38（原 2.10m @ x=0）。
       之后"房间边界"类旧值（地面 x∈[-0.60,1.35] 等）已失效。
       墙面光滑：法线强度压低、粗糙度下调、轻微环境反射。 */
    wall: { file: 'assets/models/wall.glb', targetSize: 2.340, pos: [-0.380, -0.095, 0.000],
      mat: { normalScale: 0.12, roughness: 0.45, metalness: 0, envMapIntensity: 0.7 } },

    /* 气球拱门（真实模型 archballoon.glb，自带两侧落地立柱）。
       ★ 第五轮：targetSize **1.690** → 顶 ≈1.699，与墙顶齐平（该模型高度≈targetSize）。
       ★ 第八/九/十轮：pos.y 逐步下沉 0 → -0.070 → -0.120 → **-0.180**（整体下移累计 18cm，
       顶 ≈1.51，比墙顶低 ~19cm）。"20"/横幅是世界高度固定的子节点，每轮同步把它们的 local.y
       上抬相同量（抵消拱门下陷），所以它们**不下沉**、只随本轮回的"放大"变大。
       代价：落地立柱随之陷进地板（地板面以下被地面遮挡，视觉只剩更矮的拱顶，干净）；若想零陷地，
       改用"缩小 targetSize"会更矮但立柱仍踩地（代价是拱门整体变小、20/横幅相对更高）。 */
    /* ★ 2026-10-29 第十四轮：用户「单独气球拱门可以大一点，最高不要超过墙壁高度」。
       targetSize 1.690 → **1.840**（+8.9%）。拱门高度≈targetSize，顶 = pos.y + targetSize
       = -0.180 + 1.840 = **1.660**，比墙顶实测 1.699 低约 4cm（不再顶到墙外）。
       pos.y 保持 -0.180（第十轮定下的下沉量，不动）。 */
    arch: { file: 'assets/models/archballoon.glb', targetSize: 1.840, pos: [0.010, -0.180, -0.580],
      mat: { normalScale: 0.6, roughness: 0.55, metalness: 0.1 } },

    /* "20" 与 HAPPY BIRTHDAY：拱门子节点，坐标必须是 relative local（不是世界坐标）。
       面板导出已自动转 local，无需再换算。
       ★ 第十轮：用户要"稍微大一点、但不下沉"。拱门本轮回 pos.y -0.120→-0.180（又沉 6cm），
       这两个子节点的世界高度 = arch.pos.y + local.y，故把 local.y 各 +0.060（num20 0.950→1.010、
       happybirthday 0.547→0.607）抵消下陷，使其世界高度与第九轮一致、只变大不下滑；
       同时 targetSize 各放大 ~11%（num20 0.310→0.345、happybirthday 0.840→0.930）。z/x 不变。 */
    /* ★ 第十四轮：「20」气球往上移 7cm：local.y 1.010 → **1.080**
       （世界底 0.830 → 0.900、顶 1.095 → 1.165；拱门顶 1.660，仍在拱环内）。 */
    num20: { file: 'assets/models/num20.glb', targetSize: 0.345, local: [-0.025, 1.200, -0.170] },
    happybirthday: { file: 'assets/models/happybirthday.glb', targetSize: 0.930, local: [0.000, 0.607, -0.200] },

    /* 沙发（满房）：面板导出 targetSize 1.190。
       ⚠ 与空房 sofaplain(1.40) 尺寸不一致——变身满↔空会有轻微缩放跳变，见汇报。 */
    sofa: { file: 'assets/models/sofa.glb', targetSize: 1.190, pos: [-0.045, 0.000, -0.580],
      mat: { normalScale: 0.8, roughness: 0.95 } },

    /* 茶几（满房）：★ targetSize 已按 ÷2.15 还原（main.js 装载时再拉宽一次；
       X/Y/Z 各 ×2.15，桌面高约 0.309，不再被压扁）。 */
    table: { file: 'assets/models/table.glb', targetSize: 0.377, pos: [0.000, 0.000, 0.150], rotY: -0.384,
      mat: { normalScale: 0.6, roughness: 0.55, metalness: 0 } },

    /* 迎宾牌 → 木制画架（换壳进 WelcomeBoard 槽位；与沙发同向，正对镜头）。面板导出值。 */
    board: { file: 'assets/models/easel.glb', targetSize: 0.580, pos: [0.680, -0.010, -0.300], rotY: -0.087,
      mat: { normalScale: 0.55, roughness: 0.85 } },

    /* 桌上唯一的信：envelope2.glb 单封（粉信封 + 蜡封），符合"桌上只放一封信"。
       rotX = -90° 平躺在茶几上（物理正确、俯视可见全文）；rotX 面板调不了，已按原值保留。
       ★ pos.y 改回 0.000（导出 -0.025 会让信陷进桌面 2.5cm）。 */
    envelope: { file: 'assets/models/envelope2.glb', targetSize: 0.140, pos: [-0.150, 0.000, 0.195], rotY: 0.349, rotX: -Math.PI / 2,
      mat: { normalScale: 0.6, roughness: 0.85, metalness: 0 } },

    /* 蛋糕：居中略偏左；Kitty 头在 main.js 中挂到同一 RealModel 内，整体作为一个交互目标。 */
    cake: { file: 'assets/models/cakeheadless.glb', targetSize: 0.3, pos: [0, 0, -0.04],
      mat: { normalScale: 0.5, roughness: 0.8 } },

    /* 戒指盒 → 成品盒（已开盖、金戒指已烘焙在模型里）。直接换壳，不再走程序化开合动画；
       不覆盖 roughness/metalness（金戒指/盒体材质由模型自带）。 */
    ringBox: { file: 'assets/models/ringbox.glb', targetSize: 0.140, pos: [0.235, 0.000, 0.085], rotY: -0.300,
      mat: { normalScale: 0.3 } },

    /* 香槟杯：摆在蛋糕右后侧，保持真实透明材质。 */
    flute: { file: 'assets/models/flute.glb', targetSize: 0.200, pos: [0.215, 0.000, -0.070],
      mat: { normalScale: 0.2 } },

    /* Kitty 墙饰：贴后墙（离墙 4~5cm）；模型自带 metalness=1，主场景无 envMap 会渲染成灰黑
       → 拉回哑光纸质 + 轻微自发光。 */
    kittysticker: { file: 'assets/models/kittysticker.glb', targetSize: 0.170, pos: [0.310, 0.520, -0.830],
      mat: { normalScale: 0.5, roughness: 0.8, metalness: 0.05, emissive: 0xffffff, emissiveIntensity: 0.18 } },
    kittystickerLeft: { file: 'assets/models/kittysticker.glb', targetSize: 0.190, pos: [-0.375, 0.535, -0.845],
      mat: { normalScale: 0.5, roughness: 0.8, metalness: 0.05, emissive: 0xffffff, emissiveIntensity: 0.18 } },

    /* ---- 空房间状态（礼花变身前）：无装饰沙发/茶几 ---- */
    /* 空房沙发：与满房 sofa 同位置（后背贴后墙，≈-0.926，离墙内表面 -0.929 仅 3mm）。 */
    sofaplain: { file: 'assets/models/sofaplain.glb', targetSize: 1.400, pos: [0.045, 0.000, -0.580],
      mat: { normalScale: 0.8, roughness: 0.95 } },

    /* 空房茶几：★ 必须保留（main.js 的 world.models.tableplain 依赖它；删了空房茶几会退回程序化 CoffeeTable）。
       等比 0.70（比满房小），前移 z 0.30 给沙发让位；main.js 装载时同样 ×2.15 拉宽。 */
    tableplain: { file: 'assets/models/tableplain.glb', targetSize: 0.70, pos: [0, 0, 0.30],
      mat: { normalScale: 0.6, roughness: 0.55, metalness: 0 } },

    /* 捧花：★ 2026-10-29 换成真实模型 bouquet.glb（原 74.9MB 扫描件，
       weld→simplify(2%)→meshopt+webp1024 压到 0.9MB / 7.9万面）。
       ⚠ 该模型 metalness=1 且带 metallicRoughness 贴图：主场景无 envMap，
       保持原值会渲染成灰黑色「金属花」，故 metalness 强制归 0、roughness 0.82。
       程序化捧花（props.js buildBouquet）仍保留为 file:null 时的兜底。 */
    bouquet: { file: 'assets/models/bouquet.glb', targetSize: 0.200, pos: [-0.255, 0.000, -0.025], rotY: 0.350,
      mat: { normalScale: 0.35, roughness: 0.82, metalness: 0 } },

    /* 第二封信：按需求已撤掉桌面第二封，保持 file:null（点桌上那封切换 two letters 文案）。 */
    envelope2: { file: null, targetSize: 0.16, pos: [0.10, 0, 0.27], rotY: -0.10,
      mat: { normalScale: 0.5, roughness: 0.82 } },
  },
};
