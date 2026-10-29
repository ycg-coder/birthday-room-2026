/* ============================================================
   audio.js — Web Audio 合成音效（无外部音频文件）
   生日歌 / 风铃 / 花瓣 / 浪漫 / 气泡 / 点燃 / 吹气
   ============================================================ */

const audio = {
  ctx: null,
  master: null,
  muted: false,
  _noise: null,

  /** 首次用户交互时解锁 */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -20;
      comp.ratio.value = 6;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.85;
  },

  /** 单音（柔和小三角波，带轻微失谐叠加，温暖不刺耳） */
  note(freq, when, dur, { type = 'triangle', vol = 0.14, attack = 0.02, detune = 0, pan = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let tail = out;
    if (pan !== 0 && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      out.connect(p);
      tail = p;
    }
    tail.connect(this.master);
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.connect(out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.12);
  },

  noiseBuffer() {
    if (this._noise) return this._noise;
    const len = this.ctx.sampleRate * 1.2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noise = buf;
    return buf;
  },

  /** 滤波噪声（吹气 / 沙沙声） */
  noise(when, dur, { vol = 0.1, freq = 900, q = 0.8, sweep = 0.4 } = {}) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(freq * (1 + sweep), 60), t0 + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  },

  /* ---------------- 场景音效 ---------------- */

  /** 生日歌（Happy Birthday，C 大调柔版） */
  happyBirthday() {
    this.unlock();
    if (!this.ctx || this.muted) return;
    const N = { G3: 196, A3: 220, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392 };
    const bpm = 106, b = 60 / bpm;
    const seq = [
      [N.G3, 0, 0.5], [N.G3, 0.5, 0.5], [N.A3, 1, 1], [N.G3, 2, 1], [N.C4, 3, 1], [N.B3, 4, 2],
      [N.G3, 6, 0.5], [N.G3, 6.5, 0.5], [N.A3, 7, 1], [N.G3, 8, 1], [N.D4, 9, 1], [N.C4, 10, 2],
      [N.G3, 12, 0.5], [N.G3, 12.5, 0.5], [N.G4, 13, 1], [N.E4, 14, 1], [N.C4, 15, 1], [N.B3, 16, 1], [N.A3, 17, 1],
      [N.F4, 18, 0.5], [N.F4, 18.5, 0.5], [N.E4, 19, 1], [N.C4, 20, 1], [N.D4, 21, 1], [N.C4, 22, 2.4],
    ];
    seq.forEach(([f, s, l]) => {
      this.note(f, s * b, l * b * 0.92, { vol: 0.11 });
      this.note(f, s * b, l * b * 0.85, { vol: 0.045, detune: 7, type: 'sine' });
    });
  },

  /** 风铃（轻快上行） */
  chime() {
    this.unlock();
    if (!this.ctx || this.muted) return;
    [880, 1108, 1318, 1760].forEach((f, i) => {
      this.note(f, i * 0.09, 0.7, { vol: 0.09, type: 'sine' });
    });
  },

  /** 花瓣（柔和气声 + 高频点缀） */
  petal() {
    this.unlock();
    if (!this.ctx || this.muted) return;
    this.noise(0, 0.9, { vol: 0.05, freq: 2200, q: 0.5, sweep: -0.3 });
    [1568, 2093, 2637].forEach((f, i) => this.note(f, 0.1 + i * 0.12, 0.9, { vol: 0.06, type: 'sine' }));
  },

  /** 浪漫（温暖琶音 + 长音垫） */
  romantic() {
    this.unlock();
    if (!this.ctx || this.muted) return;
    const chord = [261.63, 329.63, 392, 523.25];
    chord.forEach((f, i) => {
      this.note(f, i * 0.16, 1.6, { vol: 0.08, type: 'sine' });
      this.note(f * 2, 0.5 + i * 0.16, 1.2, { vol: 0.035, type: 'sine' });
    });
    this.noise(0.1, 1.4, { vol: 0.025, freq: 1400, q: 0.4, sweep: 0.5 });
  },

  /** 气泡弹出 */
  pop() {
    this.unlock();
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, t0);
    osc.frequency.exponentialRampToValueAtTime(240, t0 + 0.14);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    osc.connect(g); g.connect(this.master);
    osc.start(t0); osc.stop(t0 + 0.2);
  },

  /** 点燃烛火 */
  ignite() {
    this.unlock();
    if (!this.ctx || this.muted) return;
    this.noise(0, 0.22, { vol: 0.07, freq: 2600, q: 0.7, sweep: 0.8 });
    this.note(523, 0.03, 0.3, { vol: 0.06, type: 'sine' });
    this.note(784, 0.1, 0.35, { vol: 0.05, type: 'sine' });
  },

  /** 吹气 */
  whoosh() {
    this.unlock();
    if (!this.ctx || this.muted) return;
    this.noise(0, 0.5, { vol: 0.09, freq: 700, q: 0.5, sweep: 1.6 });
  },

  /** 纸屑喷出 */
  confettiSfx() {
    this.unlock();
    if (!this.ctx || this.muted) return;
    this.noise(0, 0.55, { vol: 0.06, freq: 3200, q: 0.4, sweep: -0.4 });
    [1046, 1318, 1568].forEach((f, i) => this.note(f, i * 0.05, 0.5, { vol: 0.07, type: 'sine' }));
  },

  /** 碰杯（玻璃高频三连响 + 金属噪声） */
  clink() {
    this.unlock();
    if (!this.ctx || this.muted) return;
    this.note(2093, 0, 0.5, { vol: 0.1, type: 'sine' });
    this.note(2637, 0.03, 0.45, { vol: 0.08, type: 'sine' });
    this.note(3136, 0.1, 0.4, { vol: 0.06, type: 'sine' });
    this.noise(0, 0.18, { vol: 0.05, freq: 5200, q: 2, sweep: 0.6 });
  },

  /** 烟花（vol 缩放总音量；发射口哨 + 爆炸低轰 + 噼啪星点） */
  firework(vol = 1) {
    this.unlock();
    if (!this.ctx || this.muted) return;
    const v = Math.max(0.2, Math.min(1, vol));
    // 发射：细哨上升
    this.noise(0, 0.5, { vol: 0.032 * v, freq: 480, q: 3.2, sweep: 2.4 });
    // 爆炸：低频轰响（缓降）+ 宽噪声躯干
    this.noise(0.42, 0.55, { vol: 0.11 * v, freq: 150, q: 0.5, sweep: -0.55 });
    this.noise(0.46, 0.32, { vol: 0.05 * v, freq: 900, q: 0.7, sweep: -0.4 });
    // 噼啪：一小串随机高频短音
    for (let i = 0; i < 7; i++) {
      this.note(1150 + Math.random() * 2300, 0.48 + Math.random() * 0.45, 0.07, { vol: 0.028 * v, type: 'sine' });
    }
  },
};

export { audio };
