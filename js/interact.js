/* ============================================================
   interact.js — 网页三维交互层
   射线拾取 / 悬停高亮 / 点击交互 / 吹气检测（麦克风+按钮+按键）
   ============================================================ */
import * as THREE from 'three';
import { ease, tween, clamp, lerp } from './helpers.js';
import { audio } from './audio.js';
import { showLetter, runSurpriseSequence } from './surprise.js';

export function setupInteractions(ctx) {
  const { renderer, camera, world, ui } = ctx;
  const dom = renderer.domElement;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const tmpV = new THREE.Vector3();

  /* ---------------- 可交互对象登记 ---------------- */
  const entries = [];
  const register = (id, object, { hoverScale = 1.025 } = {}) => {
    object.userData.interactId = id;
    entries.push({ id, object, hoverScale, hoverK: 0, hoverTarget: 0, hoverOn: false });
    return object;
  };

  // 对象自身及所有祖先均可见才可交互（房间状态切换时隐藏的道具不可点）
  const isVisible = (o) => {
    let n = o;
    while (n) { if (!n.visible) return false; n = n.parent; }
    return true;
  };

  const P = world.props;
  register('cake', P.cake.group);
  register('bouquet', P.bouquet.group, { hoverScale: 1.03 });
  register('ringbox', P.ringBox.group, { hoverScale: 1.03 });
  register('envelope', P.envelope.group, { hoverScale: 1.03 });
  register('board', P.board.group, { hoverScale: 1.012 });
  register('flame', P.cake.flame.group, { hoverScale: 1.1 });
  register('flute', P.flute, { hoverScale: 1.06 }); // 碰杯

  /* ---------------- Toast ---------------- */
  let toastTimer = null;
  const toast = (text, ms = 2600) => {
    if (!ui.toast) return;
    ui.toast.textContent = text;
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), ms);
  };

  /* ---------------- 独立物品展台：独立 WebGL 视图 + 背景虚化 ---------------- */
  let inspectOpen=false, inspectRaf=0, inspectRenderer=null, inspectScene=null, inspectCamera=null, inspectRoot=null, inspectSource=null, inspectId=null, inspectDrag=null, inspectBusy=false, inspectMaxDim=0;
  const clearInspectAction=()=>{const a=ui.btnInspectAction;if(a){a.hidden=true;a.disabled=false;a.onclick=null;}};
  const setInspectAction=(label,fn,{disabled=false}={})=>{const a=ui.btnInspectAction;if(a){a.textContent=label;a.disabled=disabled;a.hidden=false;a.onclick=fn;}};
  const resizeViewer=()=>{if(!inspectRenderer||!inspectCamera||!ui.inspectCanvas)return;const h=ui.inspectCanvas.parentElement,w=Math.max(1,h.clientWidth),hh=Math.max(1,h.clientHeight);inspectRenderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));inspectRenderer.setSize(w,hh,false);inspectCamera.aspect=w/hh;inspectCamera.updateProjectionMatrix();};
  const ensureViewer=()=>{if(inspectRenderer||!ui.inspectCanvas)return;try{inspectRenderer=new THREE.WebGLRenderer({canvas:ui.inspectCanvas,alpha:true,antialias:true,powerPreference:'low-power'});inspectRenderer.setClearColor(0,0);inspectRenderer.outputColorSpace=renderer.outputColorSpace;inspectRenderer.toneMapping=THREE.ACESFilmicToneMapping;inspectRenderer.toneMappingExposure=0.95;inspectScene=new THREE.Scene();inspectCamera=new THREE.PerspectiveCamera(32,1,0.01,100);inspectScene.add(new THREE.HemisphereLight(0xfff4e9,0x786354,1.5),new THREE.AmbientLight(0xfff8f1,.85));const k=new THREE.DirectionalLight(0xfff0df,2.25);k.position.set(2.5,3.5,3.2);inspectScene.add(k);const f=new THREE.DirectionalLight(0xf5dce5,1.15);f.position.set(-3,1.3,1.8);inspectScene.add(f);ui.inspectCanvas.addEventListener('pointerdown',e=>{inspectDrag={x:e.clientX,y:e.clientY,lx:e.clientX,ly:e.clientY,moved:false};ui.inspectCanvas.setPointerCapture?.(e.pointerId);});ui.inspectCanvas.addEventListener('pointermove',e=>{if(!inspectDrag||!inspectRoot)return;const dx=e.clientX-inspectDrag.lx,dy=e.clientY-inspectDrag.ly;if(Math.hypot(e.clientX-inspectDrag.x,e.clientY-inspectDrag.y)>5)inspectDrag.moved=true;if(inspectDrag.moved){inspectRoot.rotation.y+=dx*.009;inspectRoot.rotation.x=THREE.MathUtils.clamp(inspectRoot.rotation.x+dy*.0045,-.45,.45);}inspectDrag.lx=e.clientX;inspectDrag.ly=e.clientY;});ui.inspectCanvas.addEventListener('pointerup',()=>{inspectDrag=null;});ui.inspectCanvas.addEventListener('pointercancel',()=>{inspectDrag=null;});window.addEventListener('resize',resizeViewer,{passive:true});}catch(e){console.warn('[inspect] viewer unavailable',e);}};
  const setInspectModel=(object,id)=>{inspectSource=object;inspectId=id;ensureViewer();if(!inspectRenderer||!object)return;if(inspectRoot)inspectScene.remove(inspectRoot);object.updateWorldMatrix(true,true);const clone=object.clone(true);clone.visible=true;clone.updateMatrixWorld(true);
  /* ★ 2026-10-29：只按**可见**网格算包围盒。换过真实模型的槽位里，
     被 shellSwap 隐藏的程序化网格（如捧花的占位花束、蛋糕的占位体）仍在 clone 里，
     Box3.setFromObject 会把它们一起算进来 → 取景框偏大 → 真实模型在展台上显得又小又偏。 */
  const box=new THREE.Box3();let anyVis=false;
  clone.traverse(o=>{if(!o.isMesh)return;let q=o,v=true;while(q){if(!q.visible)v=false;q=q.parent;}if(!v)return;box.union(new THREE.Box3().setFromObject(o));anyVis=true;});
  if(!anyVis)box.setFromObject(clone);
  if(box.isEmpty())return;const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());clone.position.sub(center);inspectRoot=new THREE.Group();inspectRoot.add(clone);
  /* 取景系数：★ 2026-10-29 1.22 → 1.45。相机距离 3.18 / fov 32 的可见高度约 1.82，
     1.22 只占 67%，展台上留白太多、看着像缩略图；1.45 ≈ 80%，细节更清楚又不顶边。 */
  const maxDim=Math.max(size.x,size.y,size.z,.001);inspectMaxDim=+maxDim.toFixed(4);
  inspectRoot.scale.setScalar(1.45/Math.max(size.x,size.y,size.z,.001));inspectScene.add(inspectRoot);inspectRoot.rotation.set(0,0,0);inspectCamera.up.set(0,1,0);if(['first-letter','envelope','second-letter'].includes(id)){inspectCamera.position.set(.04,2.55,.18);inspectCamera.up.set(0,0,-1);}else inspectCamera.position.set(1.55,1.2,2.5);inspectCamera.lookAt(0,0,0);resizeViewer();};
  const renderViewer=()=>{if(!inspectOpen){inspectRaf=0;return;}if(inspectRenderer&&inspectScene&&inspectCamera){if(inspectRoot&&!inspectDrag&&['cake','bouquet','ringbox','flute'].includes(inspectId))inspectRoot.rotation.y+=.0015;inspectRenderer.render(inspectScene,inspectCamera);}inspectRaf=requestAnimationFrame(renderViewer);};
  const hideInspect=({immediate=false}={})=>{inspectOpen=false;inspectBusy=false;document.getElementById('app')?.classList.remove('inspecting');clearInspectAction();world.focusedItem=null;const c=ui.inspectCard;if(!c)return;c.classList.remove('show');if(immediate)c.hidden=true;else setTimeout(()=>{if(!c.classList.contains('show'))c.hidden=true;},280);};
  const showInspect=(id,title,description,object=null)=>{clearInspectAction();if(ui.inspectTitle)ui.inspectTitle.textContent=title;if(ui.inspectCopy)ui.inspectCopy.textContent=description;if(ui.inspectCard){ui.inspectCard.hidden=false;ui.inspectCard.classList.remove('show');void ui.inspectCard.offsetWidth;ui.inspectCard.classList.add('show');}document.getElementById('app')?.classList.add('inspecting');world.focusedItem=id;inspectOpen=true;inspectId=id;if(object)setInspectModel(object,id);if(!inspectRaf)inspectRaf=requestAnimationFrame(renderViewer);requestAnimationFrame(resizeViewer);};
  const refreshInspectModel=()=>{if(inspectOpen&&inspectSource)setInspectModel(inspectSource,inspectId);};
  ui.btnInspectBack?.addEventListener('click',()=>hideInspect());ui.btnInspectClose?.addEventListener('click',()=>hideInspect());document.getElementById('inspect-backdrop')?.addEventListener('click',()=>hideInspect());window.addEventListener('keydown',e=>{if(e.key==='Escape'&&inspectOpen)hideInspect();});world.hideInspect=hideInspect;world.showInspect=showInspect;world.setInspectAction=setInspectAction;
  // 调试/测试钩子：展台取景（缩放系数、模型最大边长、相机距离）好不好量一下就知道
  world.debugInspect=()=>({ scale:inspectRoot?+inspectRoot.scale.x.toFixed(3):null, maxDim:inspectMaxDim, camDist:inspectCamera?+inspectCamera.position.length().toFixed(3):null });

  /* ---------------- 世界坐标辅助 ---------------- */
  const worldPos = (obj, lx = 0, ly = 0, lz = 0) => {
    obj.updateMatrixWorld(true);
    return obj.localToWorld(new THREE.Vector3(lx, ly, lz));
  };

  /* ============================================================
     各对象点击行为
     ============================================================ */
  let cakeCooldown = 0;
  let candleInserted = false; // 满房状态下蛋糕是否已插蜡烛

  const cakeHolder = () => P.cake.group.getObjectByName('RealModel');
  const bouquetHolder = () => P.bouquet.group.getObjectByName('RealModel');

  function syncCakeActions(){if(world.focusedItem!=='cake')return;const flame=P.cake.flame;if(!candleInserted){if(ui.inspectCopy)ui.inspectCopy.textContent='先看看 Kitty 蛋糕。准备好后，亲手插上蜡烛，再许一个愿。';setInspectAction('插上生日蜡烛',()=>{if(inspectBusy||candleInserted)return;inspectBusy=true;candleInserted=true;setInspectAction('正在插上蜡烛…',()=>{},{disabled:true});insertCandles(()=>{inspectBusy=false;refreshInspectModel();if(ui.inspectCopy)ui.inspectCopy.textContent='蜡烛亮起来了。闭上眼睛许个愿，准备好后吹灭它。';syncCakeActions();});});return;}if(flame.state==='lit'){if(ui.inspectCopy)ui.inspectCopy.textContent='蜡烛已经点亮。许好愿后，按下按钮吹灭蜡烛。';setInspectAction('我许好愿了 · 吹灭蜡烛',()=>{if(inspectBusy||flame.state!=='lit')return;inspectBusy=true;setInspectAction('愿望正在飞出去…',()=>{},{disabled:true});blowOut(()=>{inspectBusy=false;refreshInspectModel();if(ui.inspectCopy)ui.inspectCopy.textContent='愿望已经送出去了。把这份甜蜜好好记住吧。';syncCakeActions();});});}else{if(ui.inspectCopy)ui.inspectCopy.textContent='愿望已经送出去了。';setInspectAction('重新点燃烛火',()=>{if(inspectBusy)return;inspectBusy=true;relightFlame(()=>{inspectBusy=false;refreshInspectModel();syncCakeActions();});});}}
  function onCake(){if(world.roomState!=='full'||performance.now()<cakeCooldown)return;cakeCooldown=performance.now()+650;showInspect('cake','Kitty 生日蛋糕','专属蛋糕就在眼前。慢慢欣赏，准备好后再插蜡烛。',P.cake.group);audio.pop();syncCakeActions();}
  function insertCandles(onComplete=null){const candle=P.cake.candle,flame=P.cake.flame,wick=P.cake.group.getObjectByName('CakeWick');if(!candle){if(onComplete)onComplete();return;}const baseY=candle.position.y,wickY=wick?wick.position.y:baseY+.085,DROP=.34;candle.visible=true;if(wick)wick.visible=true;candle.position.y=baseY+DROP;if(wick)wick.position.y=wickY+DROP;tween({dur:.75,ease:ease.inQuad,onUpdate:k=>{candle.position.y=baseY+DROP*(1-k);if(wick)wick.position.y=wickY+DROP*(1-k);},onComplete:()=>{if(world.refreshShadow)world.refreshShadow(); // 蜡烛是投影物体，插上后补一次阴影
      if(flame){flame.state='out';relightFlame(()=>{if(onComplete)onComplete();});world.sparkleSystem.burst(worldPos(flame.group,0,.02,0),10,.6);}else if(onComplete)onComplete();toast('🕯️ 蜡烛插好了——许个愿吧。',5000);}});}

  function onBouquet() {
    showInspect('bouquet', '给你的一束花', '粉色玫瑰、白色满天星和柔软的缎带，慢慢看每一片花瓣。', P.bouquet.group);
    audio.petal();
    const origin = worldPos(P.bouquet.group, 0, 0.2, 0);
    world.petals.burst(origin, 30, 1);
    world.sparkleSystem.burst(origin, 10, 0.7);
    // 捧花轻轻抬起致意：有真实 GLB 时动 RealModel；没有时动占位 body，槽位与交互仍可测试。
    const h = bouquetHolder() || P.bouquet.body;
    if (h) {
      const y0 = h.position.y, r0 = h.rotation.z;
      tween({ dur: 0.3, ease: ease.outQuad, onUpdate: (k) => { h.position.y = y0 + 0.03 * k; h.rotation.z = r0 + 0.07 * k; } });
      tween({ dur: 0.75, delay: 0.3, ease: ease.inOutCubic, onUpdate: (k) => { h.position.y = y0 + 0.03 * (1 - k); h.rotation.z = r0 + 0.07 * (1 - k); } });
    }
    toast('🌸 花香飘出来啦，花瓣为你跳舞');
  }

  function onRingBox() {
    // 正式 GLB 是已开盖的成品盒：点击后聚焦展示；若模型加载失败，则回退到程序化盒盖开合。
    const h = P.ringBox.group.getObjectByName('RealModel');
    let detail = '盒盖早已为你打开，里面静静躺着一枚金色素圈，等你发现。';
    let toastText = '💍 一枚金戒指，正等着被你发现';
    if (!h && typeof P.ringBox.toggle === 'function') {
      const isOpen = P.ringBox.toggle();
      if (isOpen === null) return; // 动画期间忽略连点
      detail = isOpen
        ? '盒盖轻轻打开了，里面是一枚金色素圈。愿这份小小的心意，让你感到被认真放在心上。'
        : '戒指盒轻轻合上了。再点一次，还可以重新看看这份心意。';
      toastText = isOpen ? '💍 戒指盒打开了' : '💗 戒指盒已合上';
    }
    showInspect('ringbox', '一份小小的心意', detail, P.ringBox.group);
    audio.chime();
    const origin = worldPos(P.ringBox.group, 0, 0.04, 0);
    world.sparkleSystem.burst(origin, 16, 0.9);
    toast(toastText);
    // 轻弹 RealModel holder（换壳后模型挂在名为 RealModel 的 group 下）
    if (h) {
      const s0 = h.scale.x || 1;
      tween({ dur: 0.22, ease: ease.outQuad, onUpdate: (k) => h.scale.setScalar(s0 * (1 + 0.05 * k)) });
      tween({ dur: 0.6, delay: 0.22, ease: ease.outElastic, onUpdate: (k) => h.scale.setScalar(s0 * (1.05 - 0.05 * k)) });
    }
  }

  /* 第一封信流程状态（空房）：点开信封 → 等封口/信纸展开 → 再点开信纸 → 看完进蒙眼变身 */
  let firstLetterOpened = false;
  let firstLetterCanRead = false;
  // 满房后同一封信先给「睁眼之后」那封（第二封信），读过一次后再点就回到第一封信
  let secondLetterRead = false;

  function animateEnvelopePeek() {
    const holder = P.envelope.group.getObjectByName('RealModel');
    if (!holder) {
      // 没有真实模型时保留程序化封口动画。
      P.envelope.toggle();
      return;
    }
    const y0 = holder.position.y;
    const rz0 = holder.rotation.z;
    tween({
      dur: 0.26, ease: ease.outCubic,
      onUpdate: (k) => { holder.position.y = y0 + 0.024 * k; holder.rotation.z = rz0 - 0.075 * k; },
      onComplete: () => tween({
        dur: 0.48, ease: ease.inOutCubic,
        onUpdate: (k) => { holder.position.y = y0 + 0.024 * (1 - k); holder.rotation.z = rz0 - 0.075 * (1 - k); },
      }),
    });
    // 信封平躺后厚度只剩 3cm，星火要撒在信纸上方（原来是 0.025，会埋进信封里）
    const point = worldPos(P.envelope.group, 0, 0.05, 0.02);
    world.sparkleSystem.burst(point, 8, 0.55);
  }

  function onEnvelope() {
    if (world.roomState === 'empty') {
      if (!firstLetterOpened) {
        // 第一次点：近景弹出信封，停止微光，给展开动画留出节奏。
        firstLetterOpened = true;
        firstLetterCanRead = false;
        world.firstLetterOpened = true;
        animateEnvelopePeek();
        showInspect('first-letter', '第一封信', '封口轻轻松开了……等信纸展开，再点下面的按钮读读里面的话。', P.envelope.group);
        audio.romantic();
        toast('💌 有一封信正等着你，稍等一下再打开');
        setInspectAction('信封正在展开…', () => {
          toast('💌 信纸还在慢慢展开，再等一小会儿～', 1800);
        }, { disabled: true });
        window.setTimeout(() => {
          firstLetterCanRead = true;
          if (world.focusedItem === 'first-letter') {
            setInspectAction('打开信封', () => {
              hideInspect();
              showLetter('first', () => runSurpriseSequence(world));
            });
          }
        }, 850);
      } else if (!firstLetterCanRead) {
        toast('💌 信纸还在慢慢展开，再等一小会儿～', 1800);
      } else {
        // 第二次点：看信；看完 → 蒙眼 → 礼花 → 房间变身
        hideInspect();
        showLetter('first', () => runSurpriseSequence(world));
      }
      return;
    }
    /* 满房后：
       桌面上只有这一封信（第二个信封已按需求撤掉），所以「睁眼之后」那封信（second）
       就挂在同一个信封上：第一次点 = 读第二封信，之后再点 = 重读第一封信。
       没有更换真实 GLB 后的 flap 动画——封口网格已被替换，旧动画只会动到隐藏对象。 */
    hideInspect();
    if (!secondLetterRead) {
      secondLetterRead = true;
      showLetter('second');
    } else {
      showLetter('first');
    }
  }

  let boardMessageRevealed = false;
  function onBoard() {
    if (!boardMessageRevealed) {
      boardMessageRevealed = true;
      showInspect('board', '给你的迎宾牌', '牌面上的小画先亮起来了……再轻轻点一次，看看藏着的话。', P.board.group);
      P.board.trigger();
      audio.chime();
      toast('✨ 牌子亮起来了，还有一句话想给你看');
      return;
    }
    showInspect('board', '写给你的话', '愿你往后的每一天，都有被认真对待的温柔，也一直有勇气去喜欢自己喜欢的一切。', P.board.group);
    audio.romantic();
    world.sparkleSystem.burst(worldPos(P.board.group, 0, 0.95, 0.1), 12, 0.75);
    toast('💗 这句话，只想认真地说给你听。', 3200);
  }

  function onFlame() {
    const flame = P.cake.flame;
    if (flame.state === 'out') {
      relightFlame();
    } else if (flame.state === 'lit') {
      // 点击烛火 = 吹气熄灭
      if (performance.now() - lastBlowTime > 1200) {
        lastBlowTime = performance.now();
        blowOut();
      }
    }
  }

  /* 酒杯：碰杯音效 + 轻举杯 */
  function onFlute() {
    showInspect('flute', '碰个杯吧', '听见清脆的一声了吗？这一刻值得慢慢记住。', P.flute);
    audio.clink();
    const f = P.flute;
    const y0 = f.position.y, r0 = f.rotation.z;
    tween({ dur: 0.25, ease: ease.outQuad, onUpdate: (k) => { f.position.y = y0 + 0.035 * k; f.rotation.z = r0 - 0.13 * k; } });
    tween({ dur: 0.5, delay: 0.25, ease: ease.inOutCubic, onUpdate: (k) => { f.position.y = y0 + 0.035 * (1 - k); f.rotation.z = r0 - 0.13 * (1 - k); } });
    world.sparkleSystem.burst(worldPos(f, 0, 0.12, 0), 8, 0.6);
    toast('🥂 干杯！祝 20 岁生日快乐～');
  }

  const handlers = {
    cake: onCake, bouquet: onBouquet, ringbox: onRingBox,
    envelope: onEnvelope, board: onBoard, flame: onFlame, flute: onFlute,
  };

  /* ============================================================
     烛火状态机：点燃 → 吹灭 → 再点燃
     ============================================================ */
  function blowOut(onComplete=null) {
    const flame = P.cake.flame;
    if (flame.state !== 'lit') return;
    flame.state = 'blowing';
    flame.blowing = true;
    audio.whoosh();
    tween({
      dur: 0.55, ease: ease.inOutCubic,
      onUpdate: k => {
        // 晃动加剧
        flame.group.rotation.z = Math.sin(k * 34) * 0.3 * (1 - k * 0.4);
        flame.light.intensity = 5.2 * (1 - k * 0.55);
      },
      onComplete: () => {
        flame.state = 'out';
        flame.blowing = false;
        flame.group.visible = false;
        flame.light.intensity = 0;
        // 烟雾粒子
        const origin = worldPos(P.cake.flame.group, 0, 0, 0);
        const emit = () => world.smokeSystem.emit(origin, 3);
        emit();
        setTimeout(emit, 220);
        setTimeout(emit, 460);
        setTimeout(emit, 700);
        setTimeout(emit, 980);
        toast('💨 烛火熄灭了，飘起淡淡烟雾…'); if(onComplete)onComplete();
      },
    });
  }

  function relightFlame(onComplete=null) {
    const flame = P.cake.flame;
    if (flame.state === 'lit') { if(onComplete)onComplete(); return; }
    flame.state = 'lit';
    flame.group.visible = true;
    flame.scaleMul = 0.01;
    tween({ dur: 0.5, ease: ease.outBack, onUpdate: k => { flame.scaleMul = Math.max(0.01, k); } });
    tween({ dur: 0.45, ease: ease.outCubic, onUpdate: k => { flame.light.intensity = 5.2 * k; } });
    audio.ignite();
    world.sparkleSystem.burst(worldPos(P.cake.flame.group, 0, 0.01, 0), 8, 0.5);
    toast('✨ 烛火重新亮起来啦'); if(onComplete)setTimeout(onComplete,520);
  }
  /* ============================================================
     吹气检测：麦克风 + 按钮 + B 键
     ============================================================ */
  let micOn = false;
  let micStream = null;
  let analyser = null;
  let micBuf = null;
  let blowEnergy = 0;
  let lastBlowTime = -10;

  async function toggleMic() {
    if (micOn) {
      if (micStream) micStream.getTracks().forEach(t => t.stop());
      micOn = false; analyser = null; micStream = null;
      ui.btnMic.textContent = '🎤 开启吹气检测';
      ui.btnMic.classList.remove('active');
      toast('麦克风检测已关闭');
      return;
    }
    try {
      audio.unlock();
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const src = audio.ctx.createMediaStreamSource(micStream);
      analyser = audio.ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      src.connect(analyser);
      micBuf = new Uint8Array(analyser.fftSize);
      micOn = true;
      ui.btnMic.textContent = '🎤 吹气检测中';
      ui.btnMic.classList.add('active');
      toast('麦克风已开启，对着吹一口气试试～');
    } catch (err) {
      toast('无法访问麦克风，请用「吹气灭烛火」按钮或按 B 键');
    }
  }

  function checkMicVolume(dt, now) {
    if (!micOn || !analyser) return;
    analyser.getByteTimeDomainData(micBuf);
    let sum = 0;
    for (let i = 0; i < micBuf.length; i++) {
      const v = (micBuf[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / micBuf.length);
    // 持续高声能量累积
    if (rms > 0.16) blowEnergy += dt; else blowEnergy = Math.max(0, blowEnergy - dt * 2);
    if (blowEnergy > 0.22 && now - lastBlowTime > 1.2) {
      lastBlowTime = now;
      blowEnergy = 0;
      blowOut();
    }
  }

  /* ============================================================
     指针事件
     ============================================================ */
  let downX = 0, downY = 0, downTime = 0;
  let hovered = null;

  function setPointer(e) {
    const r = dom.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }

  function pick() {
    raycaster.setFromCamera(pointer, camera);
    const targets = entries.filter((en) => isVisible(en.object)).map((en) => en.object);
    const hits = raycaster.intersectObjects(targets, true);
    if (!hits.length) return null;
    // 向上查找带 interactId 的根
    let o = hits[0].object;
    while (o) {
      if (o.userData && o.userData.interactId) return o.userData.interactId;
      o = o.parent;
    }
    return null;
  }

  function onPointerMove(e) {
    setPointer(e);
    const id = pick();
    hovered = id;
    dom.classList.toggle('hovering', !!id);
  }

  function onPointerDown(e) {
    setPointer(e);
    downX = e.clientX; downY = e.clientY; downTime = performance.now();
  }

  function onPointerUp(e) {
    const dx = e.clientX - downX, dy = e.clientY - downY;
    if (Math.hypot(dx, dy) > 7 || performance.now() - downTime > 600) return; // 拖拽不算点击
    setPointer(e);
    const id = pick();
    if (id && handlers[id]) {
      audio.unlock();
      handlers[id]();
    }
  }

  dom.addEventListener('pointermove', onPointerMove);
  dom.addEventListener('pointerdown', onPointerDown);
  dom.addEventListener('pointerup', onPointerUp);
  dom.addEventListener('pointerleave', () => { hovered = null; dom.classList.remove('hovering'); });

  /* ---------------- 键盘 ---------------- */
  const onKey = (e) => {
    if (e.repeat) return;
    if ((e.key === 'b' || e.key === 'B') && world.roomState === 'full' && !document.querySelector('.letter-modal.show')) {
      audio.unlock();
      if (performance.now() - lastBlowTime > 1200) {
        lastBlowTime = performance.now();
        blowOut();
      }
    }
  };
  window.addEventListener('keydown', onKey);

  /* ---------------- UI 接线 ---------------- */
  ui.btnMic.addEventListener('click', toggleMic);
  ui.btnMute.addEventListener('click', () => {
    audio.unlock();
    audio.setMuted(!audio.muted);
    ui.btnMute.textContent = audio.muted ? '🔇 音效关' : '🔊 音效开';
    ui.btnMute.classList.toggle('active', audio.muted);
  });

  /* ============================================================
     每帧更新：悬停缩放 + 麦克风检测
     ============================================================ */
  function update(dt, now) {
    // 悬停弹性缩放（隐藏对象跳过）。
    // 关键：进入悬停时记住当前缩放作基准，退出时原样恢复——
    // 不能每帧 setScalar(1)，否则会毁掉 loadModel 归一化出的非 1 缩放
    //（如第二封信 envelope2 scale=0.18，被置 1 后会放大 5 倍盖住桌面挡住点击）
    for (const en of entries) {
      if (!isVisible(en.object)) continue;
      const isHover = hovered === en.id;
      if (isHover && !en.hoverOn) { en.hoverOn = true; en.baseScale = en.object.scale.clone(); }
      if (!isHover && en.hoverOn) { en.hoverOn = false; en.object.scale.copy(en.baseScale); }
      en.hoverTarget = isHover ? 1 : 0;
      en.hoverK = lerp(en.hoverK, en.hoverTarget, 1 - Math.exp(-12 * dt));
      if (en.hoverOn) {
        const s = 1 + (en.hoverScale - 1) * en.hoverK;
        en.object.scale.copy(en.baseScale).multiplyScalar(s);
      }
    }
    checkMicVolume(dt, now);
  }

  world.toast = toast; // 供惊喜流程（surprise.js）复用提示
  // 调试/测试：从屏幕坐标手动拾取，返回命中链信息
  const debugPick = (sx, sy) => {
    const r = dom.getBoundingClientRect();
    pointer.x = ((sx - r.left) / r.width) * 2 - 1;
    pointer.y = -((sy - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const targets = entries.filter((en) => isVisible(en.object)).map((en) => en.object);
    const hits = raycaster.intersectObjects(targets, true);
    return {
      targetCount: targets.length,
      hitCount: hits.length,
      hits: hits.slice(0, 8).map((h) => {
        const c = []; let o = h.object;
        while (o) { c.push(o.name || o.type); o = o.parent; }
        return {
          name: h.object.name || h.object.type,
          dist: +h.distance.toFixed(3),
          pt: h.point.toArray().map((v) => +v.toFixed(3)),
          chain: c,
        };
      }),
      picked: pick(),
    };
  };
  /* ---------------- 返回全景 ----------------
     全屏展示层打开时不移动主相机，所以这里只需关掉展示层并把相机复位到 homeView。
     注意：早期版本把「镜头推近被点物件」的缓动逻辑删掉了，函数体却漏删，
     导致返回对象的简写 returnHome 抛出 ReferenceError，整个 boot() 中断
     （页面永远停在"正在布置生日客厅…"）。此函数必须始终存在。 */
  const returnHome = ({ silent = false } = {}) => {
    hideInspect({ immediate: silent });
    world.focusedItem = null;
    if (typeof world.resetView === 'function') world.resetView();
  };
  world.returnHomeView = returnHome;

  // 延迟注册：异步加载的模型（如第二封信）就绪后再挂交互
  return {
    update, blowOut, relightFlame, toast,
    register: (id, object, opts) => register(id, object, opts),
    setHandler: (id, fn) => { handlers[id] = fn; },
    debugPick,
    returnHome,
    hideInspect,
  };
}
