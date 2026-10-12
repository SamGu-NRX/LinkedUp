// Pinned fixture media content, encoder side — CONTRACT.md "Fixtures (D4)".
// Pure data + pure transforms: no I/O, no imports. The generator
// (scripts/generate-fixtures.mjs) adds file writing; the unit tests
// (lib/decoders.test.mjs) round-trip this module through lib/decoders.mjs so
// encoder and decoder geometry cannot drift silently.

export const WIDTH = 320;
export const HEIGHT = 240;
export const FPS = 30;
export const FRAME_COUNT = 300;

export const SAMPLE_RATE = 48000;
export const DURATION_S = 60;
export const TONE_AMPLITUDE = 0.6;
export const FADE_S = 0.02;

// Peer identity colors (D4): A/B/C, D for four-person calls, plus the second
// fake camera for H-05. D is amber, far from every other entry.
export const PEER_COLORS = {
  A: { r: 205, g: 35, b: 35 },
  B: { r: 35, g: 150, b: 85 },
  C: { r: 45, g: 85, b: 175 },
  D: { r: 210, g: 150, b: 30 },
  SECOND_CAMERA: { r: 170, g: 40, b: 170 },
};

// Distinct per-peer tones (D4): A 440 Hz, B 660 Hz, C 880 Hz, D 1100 Hz.
export const PEER_TONES_HZ = { A: 440, B: 660, C: 880, D: 1100 };

// Pinned barcode geometry, in 320x240 source pixels (CONTRACT.md):
// - band rows y = 200..239, background white rgb(235,235,235);
// - left sentinel x = 8..23 black; right sentinel x = 168..183 black;
// - 12 data bits, MSB first, each 12 px wide, starting x = 24
//   (bit 1 = black rgb(20,20,20), bit 0 = white);
// - counter = frameNumber mod 4096, incrementing once per frame.
export const BAND_TOP = 200;
export const SENTINEL_LEFT = { x0: 8, x1: 24 };
export const SENTINEL_RIGHT = { x0: 168, x1: 184 };
export const BIT_START_X = 24;
export const BIT_WIDTH = 12;
export const BIT_COUNT = 12;
export const COUNTER_MOD = 4096;
export const BLACK = { r: 20, g: 20, b: 20 };
export const WHITE = { r: 235, g: 235, b: 235 };

/** @typedef {{ r: number, g: number, b: number }} Color */

/** @typedef {{ y: Uint8Array, cb: Uint8Array, cr: Uint8Array }} I420Planes */

/** @typedef {{ data: Uint8ClampedArray, width: number, height: number }} ImageDataLike */

/**
 * @typedef {Object} WavOptions
 * @property {number} freqHz Sine frequency in Hz, in (0, sampleRate/2).
 * @property {number} [sampleRate]
 * @property {number} [durationS]
 * @property {number} [amplitude]
 * @property {number} [fadeS]
 */

/**
 * @param {number} frameNumber
 * @returns {number}
 */
export function counterForFrame(frameNumber) {
  return ((frameNumber % COUNTER_MOD) + COUNTER_MOD) % COUNTER_MOD;
}

// Color of one band pixel (half-open ranges, matching the pinned geometry).
/**
 * @param {number} x
 * @param {number} counter
 * @returns {Color}
 */
function bandColorAt(x, counter) {
  if (x >= SENTINEL_LEFT.x0 && x < SENTINEL_LEFT.x1) return BLACK;
  if (x >= SENTINEL_RIGHT.x0 && x < SENTINEL_RIGHT.x1) return BLACK;
  if (x >= BIT_START_X && x < BIT_START_X + BIT_WIDTH * BIT_COUNT) {
    const bitIndex = Math.floor((x - BIT_START_X) / BIT_WIDTH); // 0 = MSB
    const bit = (counter >> (BIT_COUNT - 1 - bitIndex)) & 1;
    return bit === 1 ? BLACK : WHITE;
  }
  return WHITE; // band background
}

// RGB frame (Uint8Array, WIDTH*HEIGHT*3): peer color above the band, barcode
// band at the bottom. frameNumber (not yet reduced) is wrapped internally.
/**
 * @param {number} frameNumber
 * @param {Color} color
 * @returns {Uint8Array}
 */
export function buildFrameRgb(frameNumber, { r, g, b }) {
  const counter = counterForFrame(frameNumber);
  const frame = new Uint8Array(WIDTH * HEIGHT * 3);
  for (let i = 0; i < WIDTH * BAND_TOP; i++) {
    const o = i * 3;
    frame[o] = r;
    frame[o + 1] = g;
    frame[o + 2] = b;
  }
  for (let y = BAND_TOP; y < HEIGHT; y++) {
    const rowOff = y * WIDTH * 3;
    for (let x = 0; x < WIDTH; x++) {
      const c = bandColorAt(x, counter);
      const o = rowOff + x * 3;
      frame[o] = c.r;
      frame[o + 1] = c.g;
      frame[o + 2] = c.b;
    }
  }
  return frame;
}

/**
 * @param {number} v
 * @returns {number}
 */
function clampByte(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

// BT.601 with JPEG/JFIF full range — the conversion paired with the y4m
// `C420jpeg` colorspace token pinned by the contract.
/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {[number, number, number]} Y, Cb, Cr bytes
 */
export function rgbToYCbCr(r, g, b) {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
  const cr = 0.5 * r - 0.418688 * g - 0.081312 * b + 128;
  return [clampByte(Math.round(y)), clampByte(Math.round(cb)), clampByte(Math.round(cr))];
}

// RGB frame -> I420 planes. Chroma sample (u, v) is the BT.601 conversion of
// the 2x2 box-filtered RGB block at pixels (2u..2u+1, 2v..2v+1); the transform
// is linear in RGB, so this equals averaging per-pixel chroma for in-range
// colors. Arithmetic is inlined: the generator calls this 300x4 times.
/**
 * @param {Uint8Array} rgb
 * @returns {I420Planes}
 */
export function frameToI420(rgb) {
  if (!ArrayBuffer.isView(rgb) || rgb.length !== WIDTH * HEIGHT * 3) {
    throw new TypeError(`rgb frame must be a typed array of ${WIDTH * HEIGHT * 3} bytes`);
  }
  const y = new Uint8Array(WIDTH * HEIGHT);
  const cw = WIDTH / 2;
  const ch = HEIGHT / 2;
  const cb = new Uint8Array(cw * ch);
  const cr = new Uint8Array(cw * ch);
  for (let v = 0; v < ch; v++) {
    const rowA = (2 * v) * WIDTH;
    const rowB = rowA + WIDTH;
    for (let u = 0; u < cw; u++) {
      const x0 = 2 * u;
      const iA = (rowA + x0) * 3;
      const iB = (rowB + x0) * 3;
      const r = (rgb[iA] + rgb[iA + 3] + rgb[iB] + rgb[iB + 3]) / 4;
      const g = (rgb[iA + 1] + rgb[iA + 4] + rgb[iB + 1] + rgb[iB + 4]) / 4;
      const b = (rgb[iA + 2] + rgb[iA + 5] + rgb[iB + 2] + rgb[iB + 5]) / 4;
      const ci = v * cw + u;
      cb[ci] = clampByte(Math.round(-0.168736 * r - 0.331264 * g + 0.5 * b + 128));
      cr[ci] = clampByte(Math.round(0.5 * r - 0.418688 * g - 0.081312 * b + 128));
    }
    for (let x = 0; x < WIDTH; x++) {
      const i = (rowA + x) * 3;
      y[rowA + x] = clampByte(Math.round(0.299 * rgb[i] + 0.587 * rgb[i + 1] + 0.114 * rgb[i + 2]));
      const j = (rowB + x) * 3;
      y[rowB + x] = clampByte(Math.round(0.299 * rgb[j] + 0.587 * rgb[j + 1] + 0.114 * rgb[j + 2]));
    }
  }
  return { y, cb, cr };
}

// I420 planes -> ImageData-like ({ data RGBA, width, height }) as a canvas
// getImageData would produce. Chroma is taken from sample (x>>1, y>>1).
// Mirrors the JFIF full-range inverse of rgbToYCbCr.
/**
 * @param {I420Planes} frame
 * @returns {ImageDataLike}
 */
export function i420ToImageDataLike(frame) {
  const { y, cb, cr } = frame;
  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  const cw = WIDTH / 2;
  for (let py = 0; py < HEIGHT; py++) {
    for (let px = 0; px < WIDTH; px++) {
      const ci = (py >> 1) * cw + (px >> 1);
      const l = y[py * WIDTH + px];
      const cbb = cb[ci];
      const crr = cr[ci];
      const o = (py * WIDTH + px) * 4;
      data[o] = clampByte(Math.round(l + 1.402 * (crr - 128)));
      data[o + 1] = clampByte(Math.round(l - 0.344136 * (cbb - 128) - 0.714136 * (crr - 128)));
      data[o + 2] = clampByte(Math.round(l + 1.772 * (cbb - 128)));
      data[o + 3] = 255;
    }
  }
  return { data, width: WIDTH, height: HEIGHT };
}

// Canonical 44-byte-header RIFF/WAVE container, 16-bit mono PCM:
// sine at freqHz, amplitude 0.6, linear 20 ms fade in/out.
/**
 * @param {WavOptions} options
 * @returns {Buffer}
 */
export function buildWavPcm({
  freqHz,
  sampleRate = SAMPLE_RATE,
  durationS = DURATION_S,
  amplitude = TONE_AMPLITUDE,
  fadeS = FADE_S,
}) {
  if (!(freqHz > 0) || freqHz >= sampleRate / 2) {
    throw new RangeError(`freqHz must be in (0, ${sampleRate / 2}) Hz`);
  }
  const n = Math.round(sampleRate * durationS);
  const fadeN = Math.min(Math.round(sampleRate * fadeS), Math.floor(n / 2));
  const dataBytes = n * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16); // fmt chunk size (PCM)
  buf.writeUInt16LE(1, 20); // audio format: PCM
  buf.writeUInt16LE(1, 22); // channels: mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataBytes, 40);
  const peak = amplitude * 32767;
  for (let i = 0; i < n; i++) {
    let gain = 1;
    if (i < fadeN) gain = i / fadeN;
    else if (i >= n - fadeN) gain = (n - 1 - i) / fadeN;
    buf.writeInt16LE(
      Math.round(Math.sin((2 * Math.PI * freqHz * i) / sampleRate) * peak * gain),
      44 + i * 2,
    );
  }
  return buf;
}

// Minimal parser for the canonical 44-byte-header PCM16 mono WAVs written by
// buildWavPcm (self-check / tests only, not a general WAV reader).
/**
 * @param {Buffer} buf
 * @returns {{ sampleRate: number, channels: number, bitsPerSample: number, samples: Float32Array }}
 */
export function parseWavPcm(buf) {
  if (
    buf.length < 44 ||
    buf.toString("ascii", 0, 4) !== "RIFF" ||
    buf.toString("ascii", 8, 12) !== "WAVE" ||
    buf.toString("ascii", 12, 16) !== "fmt " ||
    buf.toString("ascii", 36, 40) !== "data"
  ) {
    throw new Error("not a canonical RIFF/WAVE PCM file");
  }
  const audioFormat = buf.readUInt16LE(20);
  const channels = buf.readUInt16LE(22);
  const sampleRate = buf.readUInt32LE(24);
  const bitsPerSample = buf.readUInt16LE(34);
  if (audioFormat !== 1 || channels !== 1 || bitsPerSample !== 16) {
    throw new Error(`expected 16-bit mono PCM, got format=${audioFormat} ch=${channels} bits=${bitsPerSample}`);
  }
  const dataBytes = buf.readUInt32LE(40);
  const count = Math.floor(dataBytes / 2);
  const samples = new Float32Array(count);
  for (let i = 0; i < count; i++) samples[i] = buf.readInt16LE(44 + i * 2) / 32768;
  return { sampleRate, channels, bitsPerSample, samples };
}
