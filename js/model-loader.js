/* ============================================================
   model-loader.js — 真实 3D 模型加载器
   支持 .glb / .gltf / .fbx / .obj(+.mtl)
   - 自动按扩展名选择加载器（GLTF / FBX / OBJ+MTL）
   - 自动归一化：落地(y=0)、水平居中、缩放到目标尺寸
   - 统一开启投影 / 接收阴影
   - KHR_draco 压缩解码器已内置（lib/addons/loaders/DRACOLoader.js）
   ============================================================ */
import * as THREE from 'three';
import { GLTFLoader } from '../lib/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from '../lib/addons/loaders/DRACOLoader.js';
import { FBXLoader } from '../lib/addons/loaders/FBXLoader.js';
import { OBJLoader } from '../lib/addons/loaders/OBJLoader.js';
import { MTLLoader } from '../lib/addons/loaders/MTLLoader.js';
import { MeshoptDecoder } from '../lib/addons/libs/meshopt_decoder.module.js';

// 无头验证环境兼容：HeadlessChrome 的 createImageBitmap(WebP) 可能永久挂起，
// 置空后 GLTFLoader 自动回退到 <img> 解码路径；真实浏览器不受影响。
if (typeof window !== 'undefined' && /HeadlessChrome/.test(navigator.userAgent)) {
  try { window.createImageBitmap = undefined; } catch (e) { /* ignore */ }
}

const dracoLoader = new DRACOLoader()
  .setDecoderPath('/lib/addons/libs/draco/'); // 站点根目录绝对路径，测试页与主页面均可命中

const gltfLoader = new GLTFLoader()
  .setDRACOLoader(dracoLoader)
  .setMeshoptDecoder(MeshoptDecoder);
const fbxLoader = new FBXLoader();
const objLoader = new OBJLoader();
const mtlLoader = new MTLLoader();

const extOf = (url) => url.split('?')[0].split('.').pop().toLowerCase();

/**
 * 加载一个模型文件并返回归一化后的 Object3D
 * @param {string} url  模型路径（相对站点根目录）
 * @param {object} opts
 *   targetSize  {number}  目标最大包围盒尺寸（米），0 = 不缩放
 *   alignGround {bool}    是否让模型最低点落在 y=0（默认 true）
 *   center      {bool}    是否水平居中到原点（默认 true）
 *   rotY        {number}  额外绕 Y 旋转（弧度）
 *   rotX        {number}  额外绕 X 旋转（弧度）——**在测量包围盒之前**应用，
 *                         所以「把立着的东西放平」这类操作会自动重新落地对齐：
 *                         例如信封原本是「立着、正面朝 +Z」，传 rotX=-Math.PI/2 后
 *                         正面朝上平躺，最低点仍会被对齐到 y=0（厚度变成高度）。
 *   flipY       {bool}    某些 FBX 导出朝向不对时使用
 *   onProgress  {fn}      加载进度回调 ({loaded, total})
 * @returns {Promise<{object: THREE.Object3D, size: THREE.Vector3}>}
 */
export function loadModel(url, opts = {}) {
  const { targetSize = 0, alignGround = true, center = true,
    rotY = 0, rotX = 0, flipY = false, onProgress = null } = opts;
  const ext = extOf(url);
  const prog = (e) => { if (onProgress) onProgress({ loaded: e.loaded || 0, total: e.total || 0 }); };

  return new Promise((resolve, reject) => {
    const done = (object) => {
      try {
        if (flipY) object.rotation.y = Math.PI;

        // 统一材质与阴影
        object.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
            if (o.material && o.material.map) {
              o.material.map.colorSpace = THREE.SRGBColorSpace;
            }
          }
        });

        /* 归一化：先转 rotY / rotX，再测量包围盒。
           ⚠ 顺序很重要：旋转必须发生在缩放/居中/落地之前，否则"放平"之后
           最低点会对不上桌面（绕 X 转 90° 会把厚度变成高度，一半沉进桌子里）。 */
        if (rotY) object.rotation.y += rotY;
        if (rotX) object.rotation.x += rotX;
        object.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        object.userData.naturalSize = size.clone(); // 缩放前的原始尺寸（调整面板用）

        if (targetSize > 0) {
          const maxDim = Math.max(size.x, size.y, size.z);
          if (maxDim > 0) {
            const s = targetSize / maxDim;
            object.scale.multiplyScalar(s);
            object.updateMatrixWorld(true);
            size.multiplyScalar(s);
          }
        }

        if (center) {
          const box2 = new THREE.Box3().setFromObject(object);
          const c = box2.getCenter(new THREE.Vector3());
          object.position.x -= c.x;
          object.position.z -= c.z;
        }
        if (alignGround) {
          const box3 = new THREE.Box3().setFromObject(object);
          object.position.y -= box3.min.y;
        }
        object.updateMatrixWorld(true);
        resolve({ object, size });
      } catch (e) {
        reject(e);
      }
    };

    switch (ext) {
      case 'glb':
      case 'gltf':
        gltfLoader.load(url, (gltf) => done(gltf.scene), prog, (e) => reject(new Error(e && e.message ? e.message : 'GLTF 加载失败')));
        break;
      case 'fbx':
        fbxLoader.load(url, done, prog, (e) => reject(new Error(e && e.message ? e.message : 'FBX 加载失败')));
        break;
      case 'obj': {
        // 若同名 .mtl 存在则一并加载
        const mtlUrl = url.slice(0, -4) + '.mtl';
        fetch(mtlUrl, { method: 'HEAD' })
          .then((r) => {
            if (r.ok) {
              mtlLoader.load(mtlUrl, (mtl) => {
                mtl.preload();
                objLoader.setMaterials(mtl);
                objLoader.load(url, done, undefined, reject);
              }, undefined, () => { objLoader.load(url, done, undefined, reject); });
            } else {
              objLoader.load(url, done, undefined, reject);
            }
          })
          .catch(() => objLoader.load(url, done, undefined, reject));
        break;
      }
      default:
        reject(new Error(`不支持的模型格式: .${ext}（支持 glb/gltf/fbx/obj）`));
    }
  });
}

/**
 * 在父组内"换壳"：隐藏父组里现有的可视化子物体（保留命名结构/动画句柄/交互标记），
 * 再把加载的真实模型挂进去。
 * @param {THREE.Group} slotGroup  槽位组（如 props.cake.group）
 * @param {THREE.Object3D} model   已归一化的模型
 * @param {object} opts
 *   keep     {string[]} 需要保留可见的子物体名（如 ['CandleFlame']）
 *   offset   {[x,y,z]}   模型在槽位局部坐标内的位置
 *   extraRotY {number}   槽位内额外旋转
 */
export function shellSwap(slotGroup, model, opts = {}) {
  const { keep = [], offset = [0, 0, 0], extraRotY = 0 } = opts;
  const keepSet = new Set(keep);

  slotGroup.traverse((o) => {
    if (o.isMesh || o.isSprite) o.visible = false;
  });
  // 恢复需要保留的（按名字递归恢复）
  keepSet.forEach((name) => {
    slotGroup.traverse((o) => { if (o.name === name) showTree(o); });
  });

  const holder = new THREE.Group();
  holder.name = 'RealModel';
  holder.add(model);
  holder.position.set(...offset);
  if (extraRotY) holder.rotation.y = extraRotY;
  slotGroup.add(holder);
  return holder;
}

function showTree(o) {
  o.visible = true;
  o.traverse((c) => { c.visible = true; });
}

/** 按名字（不区分大小写、模糊匹配）在模型里找 mesh/group */
export function findNode(root, name) {
  let found = null;
  const key = name.toLowerCase();
  root.traverse((o) => {
    if (!found && o.name && o.name.toLowerCase().includes(key)) found = o;
  });
  return found;
}

/**
 * 把模型中的某个节点重新挂到既有动画句柄下（保留世界变换）
 * 例如：模型的 "lid" 网格挂到戒指盒的 lidPivot 上参与开合动画
 */
export function reparentTo(model, nodeName, pivot) {
  const node = findNode(model, nodeName);
  if (!node || !pivot) return null;
  pivot.updateMatrixWorld(true);
  node.updateMatrixWorld(true);
  pivot.attach(node);
  return node;
}
