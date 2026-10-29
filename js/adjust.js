/* ============================================================
   adjust.js — 可视化布局调整面板（?adjust=1 打开）
   - 选择对象 → 滑块/输入框实时调整 位置 / 旋转 / 大小
   - 场景内点击可直接选取对象
   - 调整自动存入 localStorage，刷新不丢失
   - 「导出配置」生成 models.js entries 代码，复制后发我即可固化
   ============================================================ */
import * as THREE from 'three';

// 布局版本号：本次按参考图重排了墙面装饰/桌面物件/画架，
// 旧键名为避免用户浏览器里残留的旧微调覆盖新摆位，故升到 v3。
const KEY = 'birthday-adjust-v3-layoutref';
const PROPS_SCALE = 0.42; // diorama 模式家具缩放（models.js diorama.propsScale）

/* 可调整对象表：world=场景级坐标；local=props.root 局部坐标（世界=值×propsScale）
   ★ 场景里出现的每一个模型都要在面板里能单独拎出来调：
     - arch/num20/happybirthday 三者独立（两个气球字是拱门组的子节点，
       坐标以拱门为原点；整体搬家用「气球拱门」，单独微调用下面两条）；
     - carpet 是程序化地毯，也从 Room 根组里拆出来单独可动。
     - envelope2（第二封信）已按需求从桌面撤掉，需要时把 models.js 的 file 填回即可。 */
const TARGETS = [
  { slot: 'wall', label: '墙壁（房间）', space: 'world' },
  { slot: 'arch', label: '气球拱门', space: 'world' },
  { slot: 'num20', label: '气球「20」', space: 'world' },
  { slot: 'happybirthday', label: 'HAPPY BIRTHDAY 横幅', space: 'world' },
  { slot: 'sofa', label: '沙发', space: 'world' },
  { slot: 'table', label: '茶几', space: 'world' },
  { slot: 'carpet', label: '地毯', space: 'world' },
  { slot: 'board', label: '迎宾牌（画架）', space: 'local' },
  { slot: 'envelope', label: '信封', space: 'local' },
  { slot: 'cake', label: '蛋糕', space: 'local' },
  { slot: 'bouquet', label: '捧花', space: 'local' },
  { slot: 'ringBox', label: '戒指盒', space: 'local' },
  { slot: 'flute', label: '香槟杯', space: 'local' },
  { slot: 'kittysticker', label: 'Kitty 墙饰（右）', space: 'world' },
  { slot: 'kittystickerLeft', label: 'Kitty 墙饰（左）', space: 'world' },
  /* 空房态沙发：礼花变身前可见的“无装饰”沙发。
     单独列出，保证空房间也不被省略、且能在布局面板里独立摆位。
     空房茶几（tableplain.glb）也不单独登记一行——「茶几」那一行会自动挑
     当前可见的那件（deco / plain / 程序化 CoffeeTable），见 targetParts。 */
  { slot: 'sofaplain', label: '沙发（空房）', space: 'world' },
];

/* 按场景节点名查找的槽位（不是 world.models / world.props 里的条目） */
const NAMED_SLOTS = {
  num20: 'Num20',
  happybirthday: 'HappyBirthday',
  carpet: 'Carpet',
};

const loadSaved = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const saveAll = (d) => localStorage.setItem(KEY, JSON.stringify(d));

/* 取对象的变换载体（transform）与缩放载体（scaleObj）+ 原始最大边长 */
function targetParts(world, slot) {
  // 按场景节点名查找的槽位（拱门里的两个气球字 / 地毯）
  if (NAMED_SLOTS[slot]) {
    const o = world.scene && world.scene.getObjectByName(NAMED_SLOTS[slot]);
    if (!o) return null;
    return { transform: o, scaleObj: o, naturalMax: maxOf(o.userData.naturalSize) };
  }
  // 沙发/茶几：装饰件与空房件（sofaplain / 程序化 CoffeeTable）二选一，
  // 始终操作当前可见的那件，避免"空房态下可见的是另一件、面板却只登记隐藏那件"导致移动无效。
  if (slot === 'sofa' || slot === 'table') {
    const deco = world.models && world.models[slot];
    const plain = world.models && world.models[slot + 'plain'];
    // 退路：tableplain.glb 没启用/加载失败时才回程序化 CoffeeTable
    const procedural = slot === 'table' && world.scene ? world.scene.getObjectByName('CoffeeTable') : null;
    const list = [deco, plain, procedural].filter(Boolean);
    const pick = list.find((o) => o.visible) || list[0] || null;
    if (!pick) return null;
    return { transform: pick, scaleObj: pick, naturalMax: maxOf(pick.userData.naturalSize) };
  }
  // 桌面道具：board/envelope/cake/bouquet/ringBox 换壳后带 .group；flute 是裸 Group
  const propKeys = ['board', 'envelope', 'cake', 'bouquet', 'ringBox', 'flute'];
  if (propKeys.includes(slot)) {
    const entry = world.props && world.props[slot];
    const g = entry && (entry.group || entry);
    if (!g) return null;
    const holder = g.getObjectByName('RealModel');
    const model = holder && holder.children[0];
    if (model) return { transform: g, scaleObj: model, naturalMax: maxOf(model.userData.naturalSize) };
    return { transform: g, scaleObj: g, naturalMax: 1 };
  }
  const m = world.models && world.models[slot];
  if (!m) return null;
  return { transform: m, scaleObj: m, naturalMax: maxOf(m.userData.naturalSize) };
}

const maxOf = (v) => (v ? Math.max(v.x, v.y, v.z) : 1);

/* 把本地保存的调整应用到场景（main.js 在模型装载完成后调用） */
export function applyAdjustOverrides(world) {
  const saved = loadSaved();
  for (const [slot, ov] of Object.entries(saved)) {
    const parts = targetParts(world, slot);
    if (!parts || !ov) continue;
    try {
      if (Array.isArray(ov.pos)) parts.transform.position.set(ov.pos[0], ov.pos[1], ov.pos[2]);
      if (ov.rotY != null) parts.transform.rotation.y = ov.rotY;
      if (ov.size != null && parts.naturalMax > 0) parts.scaleObj.scale.setScalar(ov.size / parts.naturalMax);
    } catch (e) { /* 忽略单槽位错误 */ }
  }
}

/* 读取对象当前值（含未保存的实时状态） */
function readCurrent(world, slot) {
  const parts = targetParts(world, slot);
  if (!parts) return null;
  const p = parts.transform.position;
  const r = parts.transform.rotation.y;
  const size = parts.scaleObj.scale.x * parts.naturalMax;
  return { pos: [p.x, p.y, p.z], rotY: r, size };
}

export function initAdjustPanel(world, MODELS) {
  const saved = loadSaved();
  let current = TARGETS[0].slot;

  /* ---------- DOM ---------- */
  const root = document.createElement('div');
  root.id = 'adjust-panel';
  root.innerHTML = `
    <style>
      #adjust-panel{position:fixed;top:16px;right:16px;width:262px;z-index:9999;
        background:rgba(255,255,255,.96);border-radius:14px;box-shadow:0 8px 30px rgba(120,100,80,.22);
        font:12px/1.5 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#5a4f45;
        padding:12px 14px;backdrop-filter:blur(8px);user-select:none}
      #adjust-panel .ap-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
      #adjust-panel .ap-title{font-weight:600;font-size:13px}
      #adjust-panel .ap-fold{cursor:pointer;color:#a89880;padding:0 4px}
      #adjust-panel select{width:100%;padding:5px 8px;border:1px solid #e6ddcf;border-radius:8px;
        background:#fff;color:#5a4f45;font-size:12px;margin-bottom:8px}
      #adjust-panel .ap-row{display:flex;align-items:center;gap:6px;margin:5px 0}
      #adjust-panel .ap-row label{width:34px;color:#8a7c68;flex:none}
      #adjust-panel input[type=range]{flex:1;height:18px;accent-color:#d9a8b8}
      #adjust-panel input[type=number]{width:58px;padding:2px 5px;border:1px solid #e6ddcf;
        border-radius:6px;font-size:11px;color:#5a4f45;background:#fff}
      #adjust-panel .ap-note{font-size:10.5px;color:#a89880;margin:6px 0 4px}
      #adjust-panel .ap-btns{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
      #adjust-panel button{flex:1;min-width:56px;padding:5px 8px;border:1px solid #e6ddcf;border-radius:8px;
        background:#fff;color:#6b5f52;font-size:11.5px;cursor:pointer}
      #adjust-panel button:hover{background:#faf5ec}
      #adjust-panel button.primary{background:#f3dfe4;border-color:#e8c8d2;color:#a05c72}
      #adjust-panel textarea{width:100%;height:118px;margin-top:8px;border:1px solid #e6ddcf;border-radius:8px;
        font:10.5px/1.5 ui-monospace,Consolas,monospace;padding:6px;color:#5a4f45;background:#fffdf9;
        box-sizing:border-box;display:none;white-space:pre;overflow:auto}
      #adjust-panel.folded .ap-body{display:none}
    </style>
    <div class="ap-head">
      <span class="ap-title">🎀 布局微调</span>
      <span class="ap-fold" id="ap-fold">收起 ▾</span>
    </div>
    <div class="ap-body">
      <select id="ap-slot"></select>
      <div class="ap-row"><label>X</label><input type="range" id="ap-x" step="0.005"><input type="number" id="ap-xn" step="0.005"></div>
      <div class="ap-row"><label>Y</label><input type="range" id="ap-y" step="0.005"><input type="number" id="ap-yn" step="0.005"></div>
      <div class="ap-row"><label>Z</label><input type="range" id="ap-z" step="0.005"><input type="number" id="ap-zn" step="0.005"></div>
      <div class="ap-row"><label>旋转</label><input type="range" id="ap-r" min="-180" max="180" step="1"><input type="number" id="ap-rn" step="1"></div>
      <div class="ap-row"><label>大小</label><input type="range" id="ap-s" min="0.05" max="3" step="0.01"><input type="number" id="ap-sn" step="0.01"></div>
      <div class="ap-note" id="ap-note"></div>
      <div class="ap-btns">
        <button id="ap-state" style="flex-basis:100%">🔁 当前：满房（点此切空房）</button>
      </div>
      <div class="ap-btns">
        <button id="ap-reset">重置此物</button>
        <button id="ap-clear">清除全部</button>
        <button id="ap-export" class="primary">导出配置</button>
        <button id="ap-view">🔄 复位视角</button>
      </div>
      <textarea id="ap-out" spellcheck="false"></textarea>
    </div>`;
  document.body.appendChild(root);

  const $ = (id) => root.querySelector('#' + id);
  const sel = $('ap-slot');
  TARGETS.forEach((t) => {
    const o = document.createElement('option');
    o.value = t.slot; o.textContent = t.label;
    sel.appendChild(o);
  });

  const ranges = { x: $('ap-x'), y: $('ap-y'), z: $('ap-z'), r: $('ap-r'), s: $('ap-s') };
  const nums = { x: $('ap-xn'), y: $('ap-yn'), z: $('ap-zn'), r: $('ap-rn'), s: $('ap-sn') };

  /* 动态设置滑块量程（按对象当前位置 ±1.5m） */
  function setRange(slot) {
    const cur = readCurrent(world, slot) || { pos: [0, 0, 0] };
    const span = (base) => {
      const lo = Math.min(-1.5, base - 1.2), hi = Math.max(1.5, base + 1.2);
      ranges.x.min = lo.toFixed(2); ranges.x.max = hi.toFixed(2);
      ranges.y.min = '-0.5'; ranges.y.max = '2.5';
      ranges.z.min = lo.toFixed(2); ranges.z.max = hi.toFixed(2);
    };
    span(cur.pos[0]);
  }

  /* 刷新面板显示 */
  function refresh() {
    const t = TARGETS.find((x) => x.slot === current);
    const cur = readCurrent(world, current);
    if (!cur) { $('ap-note').textContent = '该对象尚未加载'; return; }
    setRange(current);
    ranges.x.value = cur.pos[0]; ranges.y.value = cur.pos[1]; ranges.z.value = cur.pos[2];
    ranges.r.value = THREE.MathUtils.radToDeg(cur.rotY);
    ranges.s.value = cur.size.toFixed(3);
    nums.x.value = (+cur.pos[0]).toFixed(3); nums.y.value = (+cur.pos[1]).toFixed(3); nums.z.value = (+cur.pos[2]).toFixed(3);
    nums.r.value = Math.round(THREE.MathUtils.radToDeg(cur.rotY));
    nums.s.value = (+cur.size).toFixed(3);
    if (['num20', 'happybirthday'].includes(current)) {
      $('ap-note').textContent = '相对「气球拱门」的局部坐标（整体搬家用气球拱门，这里单独微调）';
    } else if (current === 'board') {
      $('ap-note').textContent = '道具根节点局部坐标；场景坐标还会乘以 0.42';
    } else if (['envelope', 'cake', 'bouquet', 'ringBox', 'flute'].includes(current)) {
      $('ap-note').textContent = '茶几桌面局部坐标；世界位置会叠加桌面中心并乘以 0.42';
    } else {
      $('ap-note').textContent = '坐标为场景世界坐标（米）';
    }
  }

  /* 应用一次修改（写场景 + 存 localStorage） */
  function apply(slot, patch) {
    const parts = targetParts(world, slot);
    if (!parts) return;
    const cur = readCurrent(world, slot);
    const next = {
      pos: patch.pos || cur.pos,
      rotY: patch.rotY != null ? patch.rotY : cur.rotY,
      size: patch.size != null ? patch.size : cur.size,
    };
    parts.transform.position.set(next.pos[0], next.pos[1], next.pos[2]);
    parts.transform.rotation.y = next.rotY;
    if (parts.naturalMax > 0) parts.scaleObj.scale.setScalar(next.size / parts.naturalMax);
    const d = loadSaved();
    d[slot] = { pos: next.pos.map((v) => +v.toFixed(4)), rotY: +next.rotY.toFixed(4), size: +next.size.toFixed(4) };
    saveAll(d);
  }

  /* 控件事件 */
  sel.addEventListener('change', () => { current = sel.value; refresh(); });
  const bind = (key, get, isDeg = false) => {
    const commit = () => {
      const cur = readCurrent(world, current);
      if (!cur) return;
      const patch = {};
      if (key === 'r') patch.rotY = isDeg ? THREE.MathUtils.degToRad(+ranges.r.value) : +ranges.r.value;
      else if (key === 's') patch.size = +ranges.s.value;
      else { const p = cur.pos.slice(); p[{ x: 0, y: 1, z: 2 }[key]] = +ranges[key].value; patch.pos = p; }
      apply(current, patch);
      refresh();
    };
    ranges[key].addEventListener('input', commit);
    nums[key].addEventListener('change', () => { ranges[key].value = nums[key].value; commit(); });
  };
  bind('x'); bind('y'); bind('z'); bind('r', null, true); bind('s');

  $('ap-reset').addEventListener('click', () => {
    const d = loadSaved(); delete d[current]; saveAll(d);
    location.reload(); // 重置后按 models.js 初始配置重载
  });
  $('ap-clear').addEventListener('click', () => {
    localStorage.removeItem(KEY); location.reload();
  });

  /* 导出 models.js entries 代码。
     ★ 2026-10-26：面板只能调「位置 / 旋转Y / 缩放」这三样，但 models.js 里还有几项
       是面板调不了、却必须原样带走的。以前导出会把它们丢掉，照抄就出问题：
         ① 信封的 rotX（平躺用 -90°）—— 丢了信就又竖起来戳在桌上；
         ② 「20」/ 横幅挂在拱门组下，坐标是**局部**坐标 —— 写成 pos 会落到世界原点；
         ③ 茶几在 main.js 里会被 X/Z ×2.15 拉宽 —— 面板量到的是拉宽后的尺寸，
            直接填回 models.js 会再拉一次，桌面变成 1.8m。
       这里按 models.js 里的原值自动还原，导出的代码可以直接照抄。 */
  const ARCH_CHILD_SLOTS = new Set(['num20', 'happybirthday']);
  const fmtRot = (v) => {
    if (Math.abs(v + Math.PI / 2) < 1e-6) return '-Math.PI / 2';
    if (Math.abs(v - Math.PI / 2) < 1e-6) return 'Math.PI / 2';
    return (+v).toFixed(3);
  };
  /* 按 models.js 里现成的条目原样渲染一行（保留 file/targetSize/local/pos/rotY/rotX/mat）。
     ⚠ 没被用户动过的槽位必须走这条路，不能用面板测量值：
       · arch 的 naturalSize 挂在模型节点上，而面板量的是 NewArch 组（恒为 1）→ 会导出成 1.000；
       · 同理若干槽位的测量基准并不可靠，原样输出才不会把没动过的东西改坏。 */
  const renderFromEntry = (slot, e) => {
    const fields = [];
    if (e.file) fields.push(`file: '${e.file}'`);
    if (e.targetSize != null) fields.push(`targetSize: ${e.targetSize}`);
    if (Array.isArray(e.local)) fields.push(`local: [${e.local.join(', ')}]`);
    else if (Array.isArray(e.pos)) fields.push(`pos: [${e.pos.join(', ')}]`);
    if (e.rotY != null) fields.push(`rotY: ${e.rotY}`);
    if (e.rotX != null) fields.push(`rotX: ${fmtRot(e.rotX)}`);
    return `    ${slot}: { ${fields.join(', ')}${e.mat ? `,\n      mat: ${JSON.stringify(e.mat)}` : ''} },`;
  };
  $('ap-export').addEventListener('click', () => {
    const E = (MODELS && MODELS.entries) ? MODELS.entries : {};
    const saved = loadSaved(); // 只包含用户真正拖过的槽位
    const notes = [];
    const lines = TARGETS.map((t) => {
      const old = E[t.slot];
      /* ⚠ 文件名以 models.js 的实际配置为准，不能用 MODELS_ENTRY 那张硬编码表：
         它写死 bouquet: 'bouquet.glb'，而这个文件根本不存在
         （models.js 里是 file: null），照抄会每次进页面 404。 */
      const file = old ? old.file : null;
      if (!file) return null; // 程序化对象（地毯）或尚未接模型的槽位（捧花）→ 不写进 models.js
      const cur = readCurrent(world, t.slot);
      // 用户没动过这一项 → 原样输出，不做任何测量与换算
      if (!saved[t.slot] || !cur) return renderFromEntry(t.slot, old);
      const pos = `[${cur.pos.map((v) => (+v).toFixed(3)).join(', ')}]`;
      const rot = Math.abs(cur.rotY) > 0.0005 ? `, rotY: ${(+cur.rotY).toFixed(3)}` : '';
      const rotX = old.rotX != null ? `, rotX: ${fmtRot(old.rotX)}` : '';
      const matStr = old.mat ? `,\n      mat: ${JSON.stringify(old.mat)}` : '';
      // 挂在拱门组下的子节点（以及 models.js 里本来就用 local 的）：坐标必须写成 local
      const coordKey = (ARCH_CHILD_SLOTS.has(t.slot) || Array.isArray(old.local)) ? 'local' : 'pos';
      let size = +cur.size;
      if (t.slot === 'table') {
        size = +(size / 2.15).toFixed(3); // 还原 main.js 装载后的 X/Z ×2.15 拉宽
        notes.push('茶几 targetSize 已按 ÷2.15 还原（main.js 装载时会再拉宽一次，别再改回拉宽后的值）');
      }
      if (old.rotX != null) notes.push(`${t.slot} 的 rotX（面板调不了）已按 models.js 原值保留`);
      if (coordKey === 'local') notes.push(`${t.slot} 挂在拱门组下，坐标写成 relative local（不是世界坐标）`);
      return `    ${t.slot}: { file: '${file}', targetSize: ${size.toFixed(3)}, ${coordKey}: ${pos}${rot}${rotX}${matStr} },`;
    }).filter(Boolean);
    const out = $('ap-out');
    out.style.display = 'block';
    const noteStr = notes.length
      ? '// 已自动处理：\n' + [...new Set(notes)].map((n) => `//   · ${n}`).join('\n') + '\n'
      : '';
    out.value = `${noteStr}// 复制下面代码，替换 js/models.js 里的 entries：\n  entries: {\n${lines.join('\n')}\n  },`;
    out.select();
    try { document.execCommand('copy'); } catch {}
  });

  /* 场景内点击选取（拖动转视角不算点击：位移 >7px 忽略） */
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  let downX = 0, downY = 0;
  if (world.renderer) {
    world.renderer.domElement.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; });
    world.renderer.domElement.addEventListener('click', (e) => {
      if (e.target !== world.renderer.domElement) return;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 7) return;
      ptr.x = (e.clientX / window.innerWidth) * 2 - 1;
      ptr.y = -(e.clientY / window.innerHeight) * 2 + 1;
      ray.setFromCamera(ptr, world.camera);
      const roots = TARGETS.map((t) => targetParts(world, t.slot)).filter(Boolean).map((p) => p.transform);
      const hits = ray.intersectObjects(roots, true);
      if (!hits.length) return;
      let o = hits[0].object;
      while (o) {
        const t = TARGETS.find((x) => { const p = targetParts(world, x.slot); return p && p.transform === o; });
        if (t) { current = t.slot; sel.value = t.slot; refresh(); return; }
        o = o.parent;
      }
    });
  }

  $('ap-view').addEventListener('click', () => { if (world.resetView) world.resetView(); });

  /* 切换 空房/满房：两种状态都能看到并独立摆位
     （满足“空房间也不能少，物体都能调试位置”——空房家具单独列在 TARGETS 里） */
  const btnState = $('ap-state');
  const syncStateBtn = () => {
    const full = world.roomState === 'full';
    if (btnState) btnState.textContent = full ? '🔁 当前：满房（点此切空房）' : '🔁 当前：空房（点此切满房）';
  };
  if (btnState && world.setRoomState) {
    btnState.addEventListener('click', () => {
      const next = world.roomState === 'full' ? 'empty' : 'full';
      try { world.setRoomState(next, { animate: false }); } catch (e) {}
      syncStateBtn();
      refresh(); // 重新读取可见对象的实时位置（sofa/table 会随可见件切换）
    });
  }
  syncStateBtn();

  $('ap-fold').addEventListener('click', () => {
    root.classList.toggle('folded');
    $('ap-fold').textContent = root.classList.contains('folded') ? '展开 ▸' : '收起 ▾';
  });

  refresh();
}

/* 2026-10-29：这张硬编码表已废弃并删除。
   它曾是"每次换个模型就要同步改两处"的坑源（写死 bouquet: 'bouquet.glb'，
   而 models.js 当时是 file: null，照抄会 404；也漏过 tableplain 等槽位）。
   导出现在一律以 models.js 的 MODELS.entries 实际配置为准（见 ap-export）。 */
