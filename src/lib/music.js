import { CONFIG } from "../config.js";
// 찬양 플레이어
// 1) 피아노 반주: 저작권이 끝난 옛 찬송 선율을 브라우저가 직접 연주 (파일 필요 없음)
// 2) mp3 찬양: config.js 의 hymns 목록 (Suno 등으로 만든 AI 찬양, 공공영역 녹음 등)

const N = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const freq = (name) => {
  const m = name.match(/^([A-G])(#|b)?(\d)$/);
  const midi = 12 * (Number(m[3]) + 1) + N[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  return 440 * Math.pow(2, (midi - 69) / 12);
};
const CHORDS = {
  G: ["G2", "D3", "G3", "B3"], C: ["C3", "G3", "C4", "E4"], D: ["D3", "A3", "D4", "F#4"],
  A: ["A2", "E3", "A3", "C#4"], Em: ["E3", "B3", "E4", "G4"], Bm: ["B2", "F#3", "B3", "D4"],
};

// [음, 박자]  /  chords: [화음, 박자]
const SYNTH_SONGS = [
  {
    title: "피아노 · 나 같은 죄인 살리신 (Amazing Grace)",
    bpm: 76,
    melody: [
      ["D4", 1],
      ["G4", 2], ["B4", 0.5], ["G4", 0.5], ["B4", 2], ["A4", 1], ["G4", 2], ["E4", 1], ["D4", 2], ["D4", 1],
      ["G4", 2], ["B4", 0.5], ["G4", 0.5], ["B4", 2], ["A4", 1], ["D5", 3], ["D5", 2], ["B4", 1],
      ["D5", 2], ["B4", 0.5], ["G4", 0.5], ["B4", 2], ["A4", 1], ["G4", 2], ["E4", 1], ["D4", 2], ["D4", 1],
      ["G4", 2], ["B4", 0.5], ["G4", 0.5], ["B4", 2], ["A4", 1], ["G4", 3], [null, 3],
    ],
    chords: [
      [null, 1], ["G", 3], ["G", 3], ["C", 3], ["G", 3], ["G", 3], ["G", 3], ["D", 3], ["G", 3],
      ["G", 3], ["G", 3], ["C", 3], ["G", 3], ["G", 3], ["D", 3], ["G", 3], ["G", 3],
    ],
  },
  {
    title: "피아노 · 기뻐하며 경배하세 (베토벤 환희의 송가)",
    bpm: 84,
    melody: [
      ["F#4", 1], ["F#4", 1], ["G4", 1], ["A4", 1], ["A4", 1], ["G4", 1], ["F#4", 1], ["E4", 1],
      ["D4", 1], ["D4", 1], ["E4", 1], ["F#4", 1], ["F#4", 1.5], ["E4", 0.5], ["E4", 2],
      ["F#4", 1], ["F#4", 1], ["G4", 1], ["A4", 1], ["A4", 1], ["G4", 1], ["F#4", 1], ["E4", 1],
      ["D4", 1], ["D4", 1], ["E4", 1], ["F#4", 1], ["E4", 1.5], ["D4", 0.5], ["D4", 2],
      ["E4", 1], ["E4", 1], ["F#4", 1], ["D4", 1], ["E4", 1], ["F#4", 0.5], ["G4", 0.5], ["F#4", 1], ["D4", 1],
      ["E4", 1], ["F#4", 0.5], ["G4", 0.5], ["F#4", 1], ["E4", 1], ["D4", 1], ["E4", 1], ["A3", 2],
      ["F#4", 1], ["F#4", 1], ["G4", 1], ["A4", 1], ["A4", 1], ["G4", 1], ["F#4", 1], ["E4", 1],
      ["D4", 1], ["D4", 1], ["E4", 1], ["F#4", 1], ["E4", 1.5], ["D4", 0.5], ["D4", 2], [null, 2],
    ],
    chords: [
      ["D", 4], ["A", 4], ["D", 4], ["A", 4], ["D", 4], ["A", 4], ["D", 4], ["D", 4],
      ["A", 4], ["D", 4], ["A", 4], ["A", 4], ["D", 4], ["A", 4], ["D", 4], ["D", 4], [null, 2],
    ],
  },
];

export class Music {
  constructor() {
    this.ctx = null;
    this.volume = 0.6;
    this.ducked = false;
    this.playing = null; // { kind, index }
    this.audio = new Audio();
    this.audio.loop = true;
    this.mp3s = CONFIG.hymns || [];
  }

  get songs() {
    return [
      ...SYNTH_SONGS.map((s, i) => ({ title: s.title, kind: "synth", index: i })),
      ...this.mp3s.map((s, i) => ({ title: s.title, credit: s.credit, kind: "mp3", index: i })),
    ];
  }

  init() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      // 예배당 울림 (리버브)용 임펄스
      const len = this.ctx.sampleRate * 2.6;
      this.ir = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = this.ir.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
      }
    }
    this.ctx.resume();
  }

  // 곡마다 새 출력 버스 (멈출 때 이 버스만 줄이고 끊으면 예약된 음이 모두 정리됨)
  newBus() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.0001;
    const verb = ctx.createConvolver();
    verb.buffer = this.ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.bus = ctx.createBiquadFilter();
    this.bus.type = "lowpass";
    this.bus.frequency.value = 3200;
    this.bus.connect(this.master);
    this.bus.connect(verb).connect(wet).connect(this.master);
    this.master.connect(ctx.destination);
  }

  level() { return this.volume * (this.ducked ? 0.25 : 1); }

  applyVolume() {
    const v = this.level();
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.25);
    this.fadeAudio(v);
  }

  fadeAudio(target, done) {
    clearInterval(this.audioFade);
    const start = this.audio.volume;
    let i = 0;
    this.audioFade = setInterval(() => {
      i++;
      this.audio.volume = Math.max(0, Math.min(1, start + ((target - start) * i) / 15));
      if (i >= 15) { clearInterval(this.audioFade); done && done(); }
    }, 40);
  }

  setVolume(v) { this.volume = v; this.applyVolume(); }
  duck(on) { this.ducked = on; this.applyVolume(); }

  note(f, t, dur, gain) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(gain * 0.35, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, 0.3) + 1.2);
    g.connect(this.bus);
    [[1, "triangle", 1], [2, "sine", 0.25], [3, "sine", 0.08]].forEach(([m, type, k]) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f * m;
      const og = ctx.createGain();
      og.gain.value = k;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + dur + 1.6);
    });
  }

  playSynth(index) {
    this.init();
    this.newBus();
    const song = SYNTH_SONGS[index];
    const beat = 60 / song.bpm;
    const total = song.melody.reduce((a, [, b]) => a + b, 0) * beat;
    const schedule = (t0) => {
      let t = t0;
      song.melody.forEach(([n, b]) => { if (n) this.note(freq(n), t, b * beat, 0.22); t += b * beat; });
      t = t0;
      song.chords.forEach(([c, b]) => {
        if (c) CHORDS[c].forEach((n, i) => this.note(freq(n), t + i * 0.03, b * beat, i === 0 ? 0.12 : 0.06));
        t += b * beat;
      });
    };
    let next = this.ctx.currentTime + 0.1;
    schedule(next);
    next += total;
    // 끝나기 직전에 다음 회차를 예약해서 끊김 없이 반복
    this.loopTimer = setInterval(() => {
      if (next - this.ctx.currentTime < 2) { schedule(next); next += total; }
    }, 500);
  }

  play(kind, index) {
    this.stop(true);
    this.playing = { kind, index };
    if (kind === "synth") {
      this.playSynth(index);
      this.master.gain.setTargetAtTime(this.level(), this.ctx.currentTime, 0.4);
    } else {
      this.audio.src = this.mp3s[index].url;
      this.audio.volume = 0;
      this.audio.play().then(() => this.fadeAudio(this.level())).catch(() => {});
    }
  }

  stop(immediate = false) {
    clearInterval(this.loopTimer);
    if (this.master) {
      const old = this.master;
      old.gain.cancelScheduledValues(this.ctx.currentTime);
      old.gain.setTargetAtTime(0, this.ctx.currentTime, immediate ? 0.05 : 0.4);
      setTimeout(() => old.disconnect(), immediate ? 400 : 2500);
      this.master = null;
    }
    if (!this.audio.paused) this.fadeAudio(0, () => this.audio.pause());
    this.playing = null;
  }

  bell() {
    this.init();
    const ctx = this.ctx;
    [0, 1.4].forEach((d) => {
      [528, 1056].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = f;
        g.gain.setValueAtTime(i ? 0.06 : 0.25, ctx.currentTime + d);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 2.5);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + d);
        o.stop(ctx.currentTime + d + 2.6);
      });
    });
  }
}
