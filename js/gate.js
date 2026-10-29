/* ============================================================
   gate.js — CSS 全屏大门 + 日期门禁 + 暗号输入

   配置区：
   GATE_CODE_LEN：大门键盘显示的位数（仅 UI 用，不是密码本身）。
   UNLOCK_DATE：允许出现暗号键盘的日期（YYYY-MM-DD）。
   UNLOCK_TIME_ZONE：日期判定时区，默认中国标准时间。

   暗号校验：密码不再写死在源码——由 js/letters.js 的 decryptLetters 用
   AES-256-GCM 解密 assets/boot.enc 来验证（密码只存在于构建脚本与你们记忆里）。
   日期之前：点心形门锁只播放施工播报，不展示键盘，也不提生日/日期。
   到达日期后：点门锁才显示数字键盘；暗号正确（能解密）后开门进入昏暗房间。
   注意：纯前端方案适合惊喜互动，不是绝对安全边界。
   ============================================================ */
import { audio } from './audio.js';
import { decryptLetters } from './letters.js';

/* 暗号不再写死在前端：改由 js/letters.js 的 decryptLetters 用 AES-GCM 解密
   assets/boot.enc 来验证。密码只存在于构建脚本 test/encrypt.mjs（环境变量）与
   你和她自己记忆里，源码/打包产物里搜不到。GATE_CODE_LEN 仅控制键盘位数显示。 */
export const GATE_CODE_LEN = 4;
/* ⚠⚠ 2026-10-29：这里原来是示例值 2026-12-31 —— 那样明天（10-30）点门锁
   只会一直播「正在搬砖」，键盘根本不出现，页面等于打不开。
   先改成 2026-10-29（今天），这样今晚就能自己走一遍全流程验收，
   明天当然也是开的（判定是 >= 当天即解锁，之后每天都开放）。
   如果真正的开放日期不是这天，改这一行即可。 */
export const UNLOCK_DATE = '2026-10-29';
export const UNLOCK_TIME_ZONE = 'Asia/Shanghai';

const WORK_NOTES = [
  { title: '袁成果正在搬砖……', copy: '今天的砖头有点重，但进度不能停。' },
  { title: '袁成果正在粉刷门框……', copy: '颜色再调柔和一点，细节不能将就。' },
  { title: '袁成果正在调试门锁……', copy: '咔哒——不行，再试一次。' },
  { title: '袁成果正在整理工具箱……', copy: '螺丝、胶带和一点点耐心，都要带齐。' },
  { title: '袁成果正在检查门缝……', copy: '不能漏风，也不能让小秘密提前溜出去。' },
  { title: '袁成果正在返工细节……', copy: '明明已经很好了，还是想再认真一点。' },
  { title: '袁成果正在假装不忙……', copy: '实际上一刻也没闲着。先保密，暂时不剧透。' },
  { title: '袁成果正在清理施工现场……', copy: '把边边角角收拾好，才算有始有终。' },
  { title: '袁成果正在最后检查……', copy: '再确认一遍：没有遗漏，没有偷懒。' },
];

function getDateInTimeZone(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function isGateDateUnlocked(now = new Date()) {
  /* 开发预览后门：URL 带 ?preview 时无视日期，方便上线前自查全流程。
     ?adjust=1（布局微调面板）同样跳过日期 —— 它是作者自己调摆位用的开发工具，
     日期没到却连自己的房子都进不去（点门锁只播"正在搬砖"、键盘永远不出现）。
     ⚠ 正式分享给寿星的链接必须是不带这两个参数的裸链接，否则日期门禁形同虚设。 */
  if (typeof location !== 'undefined') {
    const q = new URLSearchParams(location.search);
    if (q.has('preview') || q.has('adjust')) return true;
  }
  // ISO 格式 YYYY-MM-DD 可按字典序比较，前提是配置值格式正确。
  if (!/^\d{4}-\d{2}-\d{2}$/.test(UNLOCK_DATE)) return false;
  try {
    return getDateInTimeZone(UNLOCK_TIME_ZONE, now) >= UNLOCK_DATE;
  } catch (err) {
    console.error('[gate] 日期时区配置无效：', err);
    return false;
  }
}

export function setupGate({ onUnlock } = {}) {
  const gate = document.getElementById('gate');
  const dotsBox = document.getElementById('gate-dots');
  const msg = document.getElementById('gate-msg');
  const keysBox = document.getElementById('gate-keys');
  const lockButton = document.getElementById('gate-lock');
  const entry = document.getElementById('gate-entry');
  const cancelButton = document.getElementById('gate-cancel');
  const title = document.getElementById('gate-title');
  const copy = document.getElementById('gate-copy');
  const overline = document.getElementById('gate-overline');
  const copyPanel = document.querySelector('.gate-copy-panel');
  if (!gate || !dotsBox || !keysBox || !lockButton || !entry) return null;

  let input = '';
  let busy = false;
  let noteIndex = 0;
  let resetTimer = 0;
  let failCount = 0;     // 非合法链接（无/错令牌）的输错计数
  let locked = false;    // 达到阈值后锁死键盘，需刷新页面
  const LOCK_THRESHOLD = 3;
  const dots = [];
  const OPENING_MS = 1480;

  for (let i = 0; i < GATE_CODE_LEN; i++) {
    const dot = document.createElement('span');
    dot.className = 'gate-dot';
    dot.setAttribute('aria-hidden', 'true');
    dotsBox.appendChild(dot);
    dots.push(dot);
  }

  const renderDots = () => {
    dots.forEach((dot, i) => dot.classList.toggle('filled', i < input.length));
  };

  const animateCopy = () => {
    if (!copyPanel) return;
    copyPanel.classList.remove('message-pop');
    // 强制重新触发布局，让每次播报都有相同的轻入场。
    void copyPanel.offsetWidth;
    copyPanel.classList.add('message-pop');
  };

  const setStatus = (text = '') => {
    if (msg) msg.textContent = text;
  };

  const showWorkNote = () => {
    const note = WORK_NOTES[noteIndex % WORK_NOTES.length];
    noteIndex += 1;
    if (title) title.textContent = note.title;
    if (copy) copy.textContent = note.copy;
    if (overline) overline.textContent = `WORK NOTE · ${String(noteIndex).padStart(2, '0')}`;
    setStatus('');
    gate.classList.add('lock-tap');
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => gate.classList.remove('lock-tap'), 420);
    animateCopy();
    audio.pop();
  };

  const openKeypad = () => {
    gate.classList.add('keypad-open');
    entry.hidden = false;
    entry.setAttribute('aria-hidden', 'false');
    lockButton.setAttribute('aria-expanded', 'true');
    if (title) title.textContent = '这一次，可以试试暗号了';
    if (copy) copy.textContent = '输入你收到的那串数字，门后的小世界就会为你打开。';
    if (overline) overline.textContent = 'PRIVATE ENTRY · CODE REQUIRED';
    setStatus('');
    animateCopy();
    audio.chime();
  };

  const closeKeypad = ({ reset = true } = {}) => {
    gate.classList.remove('keypad-open');
    entry.hidden = true;
    entry.setAttribute('aria-hidden', 'true');
    lockButton.setAttribute('aria-expanded', 'false');
    if (reset) {
      input = '';
      renderDots();
    }
    setStatus('');
  };

  const disableKeys = () => {
    keysBox.querySelectorAll('button').forEach((b) => { b.disabled = true; });
  };

  const waitForModels = () => new Promise((resolve) => {
    if (window.__modelsReady) return resolve(true);
    const deadline = Date.now() + 30000;
    const poll = () => {
      if (window.__modelsReady) return resolve(true);
      if (Date.now() >= deadline) return resolve(false);
      setTimeout(poll, 180);
    };
    poll();
  });

  const openDoor = async () => {
    if (busy) return;
    busy = true;
    lockButton.disabled = true;
    keysBox.querySelectorAll('button').forEach((button) => { button.disabled = true; });
    setStatus('里面还在整理，稍等一下。');
    const ready = await waitForModels();
    if (!ready) {
      busy = false;
      lockButton.disabled = false;
      keysBox.querySelectorAll('button').forEach((button) => { button.disabled = false; });
      setStatus('房间还在加载，请过一会儿再试。');
      return;
    }

    setStatus('');
    gate.classList.add('unlocked');
    audio.unlock();
    audio.chime();
    window.setTimeout(() => {
      gate.classList.add('open');
      if (typeof onUnlock === 'function') onUnlock();
      window.dispatchEvent(new CustomEvent('birthday-door-open'));
    }, OPENING_MS);
  };

  const tryUnlock = async () => {
    if (busy || locked) return;
    setStatus('正在验证暗号……');
    const token = new URLSearchParams(location.search).get('k') || ''; // 你发给她的链接里的令牌
    try {
      const { trusted } = await decryptLetters(input, token); // 密码+令牌都对应才解的开
      setStatus('');
      openDoor(); // openDoor 内部会自行置 busy=true 并走开门动画
    } catch (err) {
      const trusted = !!(err && err.trusted); // 合法链接（带正确令牌）即使输错也允许无限重试
      busy = true;
      audio.pop();
      gate.classList.add('shake');
      clearTimeout(resetTimer);
      if (trusted) {
        setStatus('暗号不太对，再试一次。');
        resetTimer = setTimeout(() => {
          gate.classList.remove('shake');
          input = '';
          renderDots();
          setStatus('');
          busy = false;
        }, 620);
      } else {
        // 非合法链接：输错即计数，达到阈值锁死键盘
        failCount += 1;
        const left = LOCK_THRESHOLD - failCount;
        if (failCount >= LOCK_THRESHOLD) {
          clearTimeout(resetTimer); // 避免上一次输错的复位定时器把锁定提示清掉
          locked = true;
          disableKeys();
          gate.classList.remove('shake');
          setStatus(`尝试次数过多，已锁定，请刷新页面后重试。`);
          input = '';
          renderDots();
        } else {
          setStatus(`暗号不太对，还剩 ${left} 次机会。`);
          resetTimer = setTimeout(() => {
            gate.classList.remove('shake');
            input = '';
            renderDots();
            setStatus('');
            busy = false;
          }, 620);
        }
      }
    }
  };

  const check = () => {
    if (busy || !gate.classList.contains('keypad-open') || input.length !== GATE_CODE_LEN) return;
    tryUnlock();
  };

  const press = (key) => {
    if (busy || locked || !gate.classList.contains('keypad-open')) return;
    if (key === 'del') {
      input = input.slice(0, -1);
      renderDots();
      setStatus('');
      return;
    }
    if (key === 'clear') {
      input = '';
      renderDots();
      setStatus('');
      return;
    }
    if (!/^\d$/.test(key) || input.length >= GATE_CODE_LEN) return;
    input += key;
    renderDots();
    setStatus('');
    if (input.length === GATE_CODE_LEN) setTimeout(check, 180);
  };

  lockButton.addEventListener('click', () => {
    if (busy || gate.classList.contains('open')) return;
    if (!isGateDateUnlocked()) {
      showWorkNote();
      return;
    }
    if (gate.classList.contains('keypad-open')) {
      closeKeypad();
    } else {
      openKeypad();
    }
  });

  keysBox.addEventListener('click', (event) => {
    const button = event.target.closest('.gate-key');
    if (button && !button.disabled) press(button.dataset.key);
  });

  if (cancelButton) cancelButton.addEventListener('click', () => closeKeypad());

  const onKeyDown = (event) => {
    if (gate.classList.contains('open')) return;
    if (event.key === 'Escape' && gate.classList.contains('keypad-open')) {
      closeKeypad();
      return;
    }
    if (!gate.classList.contains('keypad-open')) return;
    if (/^\d$/.test(event.key)) press(event.key);
    else if (event.key === 'Backspace') press('del');
    else if (event.key === 'Enter') check();
  };
  window.addEventListener('keydown', onKeyDown);

  renderDots();
  window.__gate = {
    press, check, openDoor,
    isGateDateUnlocked,
    get input() { return input; },
    get noteIndex() { return noteIndex; },
    get failCount() { return failCount; },
    get locked() { return locked; },
    get busy() { return busy; },
  };
  return window.__gate;
}
