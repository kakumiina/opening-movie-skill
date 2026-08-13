#!/usr/bin/env node
// オープニング映像用のBGMを合成する（外部依存なし・WAV出力）
//
//   node make_bgm.mjs --duration 20 --bpm 120 --out bgm.wav
//
// シーンの切り替わりを小節の頭に合わせる前提で作ってある。
// BPM120（4拍子）なら1小節=2秒なので、切替は2秒の倍数に置くと映像と音のキメが揃う。
// --cuts で切替時刻を渡すと、その位置にインパクト音を置く（既定は4小節ごと）。

import fs from "fs";

// ---- 引数 ----
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};

const SR = 44100;
const DUR = Number(arg("duration", 20));
const BPM = Number(arg("bpm", 120));
const OUT = arg("out", "bgm.wav");
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const N = Math.floor(SR * DUR);
const TOTAL_BARS = Math.ceil(DUR / BAR);

const cutsArg = arg("cuts", "");
const CUTS = cutsArg
  ? cutsArg.split(",").map(Number).filter((n) => !Number.isNaN(n))
  : Array.from({ length: Math.ceil(DUR / (BAR * 2)) }, (_, i) => i * BAR * 2);

const L = new Float32Array(N);
const R = new Float32Array(N);

const add = (t, sample, pan = 0) => {
  const i = Math.floor(t * SR);
  if (i < 0 || i >= N) return;
  L[i] += sample * (1 - Math.max(0, pan));
  R[i] += sample * (1 + Math.min(0, pan));
};

const noteHz = (semitonesFromA4) => 440 * Math.pow(2, semitonesFromA4 / 12);
const NOTE = { A2: -24, C3: -21, F2: -28, G2: -26, G4: -2, B4: 2, D5: 5, A4: 0, C5: 3, E5: 7, A5: 12 };

// ---- コード進行（Am - F - C - G のループ）----
const AM = { root: NOTE.A2, arp: [NOTE.A4, NOTE.C5, NOTE.E5, NOTE.A5] };
const F = { root: NOTE.F2, arp: [NOTE.C5, NOTE.E5, NOTE.A5, NOTE.C5 + 12] };
const C = { root: NOTE.C3, arp: [NOTE.C5, NOTE.E5, NOTE.G4 + 12, NOTE.C5 + 12] };
const G = { root: NOTE.G2, arp: [NOTE.B4, NOTE.D5, NOTE.G4 + 12, NOTE.D5 + 12] };
const PROGRESSION = [AM, F, C, G];

// ---- 音色 ----
function kick(t0, gain = 1) {
  for (let n = 0; n < 0.22 * SR; n += 1) {
    const t = n / SR;
    const env = Math.exp(-t * 26);
    const f = 58 + 95 * Math.exp(-t * 42);
    const click = (Math.random() * 2 - 1) * Math.exp(-t * 420) * 0.25;
    add(t0 + t, (Math.sin(2 * Math.PI * f * t) * env + click) * 0.85 * gain);
  }
}

function hat(t0, gain = 1, open = false) {
  const len = open ? 0.16 : 0.045;
  for (let n = 0; n < len * SR; n += 1) {
    const t = n / SR;
    const env = Math.exp(-t * (open ? 22 : 95));
    add(t0 + t, ((Math.random() * 2 - 1) * 0.16 - (Math.random() * 2 - 1) * 0.05) * env * gain, 0.25);
  }
}

function bass(t0, semi, len, gain = 1) {
  const hz = noteHz(semi);
  for (let n = 0; n < len * SR; n += 1) {
    const t = n / SR;
    const env = Math.min(1, t * 90) * Math.exp(-t * 2.6);
    const s =
      Math.sin(2 * Math.PI * hz * t) * 0.6 +
      Math.sin(2 * Math.PI * hz * 2 * t) * 0.18 +
      Math.sin(2 * Math.PI * hz * 3 * t) * 0.07;
    add(t0 + t, s * env * 0.5 * gain);
  }
}

function pluck(t0, semi, len, gain = 1, pan = 0) {
  const hz = noteHz(semi);
  for (let n = 0; n < len * SR; n += 1) {
    const t = n / SR;
    const env = Math.min(1, t * 300) * Math.exp(-t * 11);
    const s =
      Math.sin(2 * Math.PI * hz * t) * 0.5 +
      Math.sin(2 * Math.PI * hz * 2.01 * t) * 0.22 +
      Math.sin(2 * Math.PI * hz * 3.02 * t) * 0.1;
    add(t0 + t, s * env * 0.34 * gain, pan);
    add(t0 + t + BEAT * 0.75, s * env * 0.13 * gain, -pan); // 付点8分ディレイ
  }
}

function riser(t0, len) {
  for (let n = 0; n < len * SR; n += 1) {
    const t = n / SR;
    const p = t / len;
    const env = Math.pow(p, 2.2) * 0.3;
    const noise = (Math.random() * 2 - 1) * env * 0.5;
    const sweep = Math.sin(2 * Math.PI * (300 + 2600 * Math.pow(p, 2)) * t) * env * 0.25;
    add(t0 + t, noise + sweep, Math.sin(p * 12) * 0.4);
  }
}

function impact(t0, gain = 1) {
  for (let n = 0; n < 1.4 * SR; n += 1) {
    const t = n / SR;
    const env = Math.exp(-t * 4.2);
    const sub = Math.sin(2 * Math.PI * (48 + 30 * Math.exp(-t * 12)) * t) * env * 0.55;
    const crash = (Math.random() * 2 - 1) * Math.exp(-t * 6) * 0.1;
    add(t0 + t, (sub + crash) * gain);
  }
}

// ---- 配置 ----
riser(0, Math.min(1.95, BAR));
CUTS.forEach((t, i) => impact(t, i === 0 ? 0.7 : i === CUTS.length - 1 ? 1.0 : 0.5));

const OUTRO_BARS = 2; // 最後の2小節はスローガンを浮かせる
for (let bar = 0; bar < TOTAL_BARS; bar += 1) {
  const t0 = bar * BAR;
  if (t0 >= DUR) break;
  const chord = PROGRESSION[bar % PROGRESSION.length];
  const isOutro = bar >= TOTAL_BARS - OUTRO_BARS;

  if (!isOutro) {
    for (let b = 0; b < 4; b += 1) {
      const t = t0 + b * BEAT;
      if (t < BAR / 2) continue; // 冒頭はライザーだけで引っ張る
      kick(t, bar === 0 ? 0.8 : 1.0);
    }
  } else if (bar === TOTAL_BARS - OUTRO_BARS) {
    kick(t0, 1.0);
  }

  if (bar >= 1 && !isOutro) {
    for (let s = 0; s < 8; s += 1) {
      hat(t0 + s * (BEAT / 2), s % 2 === 1 ? 1.0 : 0.55, s === 7 && bar === TOTAL_BARS - OUTRO_BARS - 1);
    }
  }

  if (bar >= 1) {
    bass(t0, chord.root, isOutro ? BAR : BAR, isOutro ? 0.9 : 1.0);
    if (!isOutro) bass(t0 + BEAT * 2.5, chord.root, BEAT * 1.5, 0.7);
  }

  if (bar >= 1) {
    const steps = isOutro ? 4 : 8;
    for (let s = 0; s < steps; s += 1) {
      pluck(t0 + s * (BEAT / 2), chord.arp[s % chord.arp.length], 0.5, isOutro ? 0.8 : 1.0, s % 2 === 0 ? 0.35 : -0.35);
    }
  }
}

// ---- 書き出し（末尾フェード＋ノーマライズ）----
const fadeStart = Math.floor((DUR - 0.6) * SR);
for (let i = fadeStart; i < N; i += 1) {
  const g = 1 - (i - fadeStart) / (N - fadeStart);
  L[i] *= g;
  R[i] *= g;
}
let peak = 0;
for (let i = 0; i < N; i += 1) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const norm = peak > 0 ? 0.89 / peak : 1;

const buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + N * 4, 4);
buf.write("WAVE", 8);
buf.write("fmt ", 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i += 1) {
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * norm)) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * norm)) * 32767), 44 + i * 4 + 2);
}

fs.writeFileSync(OUT, buf);
console.log(`wrote ${OUT} (${DUR}s / BPM${BPM} / ${TOTAL_BARS}bars, cuts at ${CUTS.join(", ")})`);
