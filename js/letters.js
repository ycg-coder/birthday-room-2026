/* ============================================================
   letters.js — 两封信的文案（运行时从加密 boot 解密，密码不写死在源码）

   密钥 = PBKDF2( 密码 + ':' + 链接令牌 )，所以「密码(1120)」和「链接里的令牌」
   二者缺一不可。令牌只存在于你发给她的那条链接（?k=...），不进源码、不上仓库。

   运行期：大门键盘输入密码 → decryptLetters(密码, 令牌) ：
     1) 取 boot.enc 头部的令牌哈希，与 SHA-256(链接令牌) 比对 → 判断是不是「合法链接」；
     2) 用 密码:令牌 派生密钥解密正文；
     3) 成功返回 { letters, trusted }；失败抛出 { trusted }（trusted 决定要不要锁人）。
   ============================================================ */
export let LETTERS = null; // 解密成功后由 decryptLetters 填充

const BOOT_URL = 'assets/boot.enc';
const PBKDF2_ITERATIONS = 500000;
const SALT_LEN = 16;
const IV_LEN = 12;
const HASH_LEN = 32;

async function deriveKey(secret, salt) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
  return r === 0;
}

/* 返回 { letters, trusted }；密码/令牌不对会抛错，且 err.trusted 标明链接是否合法 */
export async function decryptLetters(passphrase, token = '') {
  const res = await fetch(BOOT_URL);
  if (!res.ok) throw new Error('boot 资源缺失');
  const buf = new Uint8Array(await res.arrayBuffer());
  const salt = buf.slice(0, SALT_LEN);
  const iv = buf.slice(SALT_LEN, SALT_LEN + IV_LEN);
  const tokenHash = buf.slice(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + HASH_LEN);
  const ct = buf.slice(SALT_LEN + IV_LEN + HASH_LEN); // 含 GCM 认证标签

  // 1) 校验链接令牌（不暴露令牌明文，只比对哈希）
  const th = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));
  const trusted = constantTimeEqual(th, tokenHash);

  // 2) 派生密钥并解密
  const key = await deriveKey(`${passphrase}:${token}`, salt);
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    const data = JSON.parse(new TextDecoder().decode(plain));
    if (!data || data.marker !== 'BIRTHDAY_BOOT_v1') throw new Error('boot 校验失败');
    LETTERS = data.letters;
    return { letters: data.letters, trusted };
  } catch (e) {
    const err = new Error('暗号或令牌不对');
    err.trusted = trusted;
    throw err;
  }
}
