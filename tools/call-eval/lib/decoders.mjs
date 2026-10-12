// Pinned decoder API — CONTRACT.md "Decoder API (pinned); consumed by runner,
// unit-tested in fixtures thread". Pure functions over plain inputs: no DOM
// access and NO imports, so the runner can serialize these into the page and
// vitest can unit-test them directly.
//
// Barcode geometry mirrors CONTRACT.md "Fixtures (D4)" and is inlined here on
// purpose. The encoder twin is tools/call-eval/lib/fixture-media.mjs; the
// round-trip tests in decoders.test.mjs fail if the two ever drift.

const FRAME_W = 320; // pinned source geometry (pixels)
const FRAME_H = 240;
const BAND_TOP = 200; // band rows y = 200..239
const SENTINEL_LEFT_X0 = 8;
const SENTINEL_LEFT_X1 = 24;
const SENTINEL_RIGHT_X0 = 168;
const SENTINEL_RIGHT_X1 = 184;
const BIT_START_X = 24;
const BIT_WIDTH = 12;
const BIT_COUNT = 12;

// Band colors are pinned black rgb(20,20,20) on white rgb(235,235,235);
// 128 is the Rec.601 luma midpoint between them.
const LUMA_THRESHOLD = 128;

/**
 * The minimal image shape the decoders accept: exactly what canvas
 * `getImageData()` returns, and trivially constructible from any RGBA source.
 * The runner serializes these functions into the page, so types are plain.
 *
 * @typedef {Object} ImageDataLike
 * @property {Uint8ClampedArray} data RGBA, 4 bytes per pixel, row-major.
 * @property {number} width
 * @property {number} height
 */

/** @typedef {{ r: number, g: number, b: number }} Color */

/** @typedef {{ counter: number, ok: boolean }} CounterResult */

/** @typedef {{ peakHz: number, rms: number }} ToneResult */

/** @typedef {{ t: number, counter: number }} FpsSample */

/**
 * Runtime shape check that doubles as the narrowed destructure source.
 * @param {ImageDataLike} imageData
 * @returns {{ data: Uint8ClampedArray, width: number, height: number }}
 */
function validateImageData(imageData) {
  if (imageData === null || typeof imageData !== "object") {
    throw new TypeError("imageData must be an object like { data, width, height }");
  }
  const { data, width, height } = imageData;
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new TypeError("imageData.width/height must be positive integers");
  }
  const needed = width * height * 4;
  if (!(data instanceof Uint8ClampedArray) || data.length < needed) {
    throw new TypeError(`imageData.data must be a Uint8ClampedArray of at least ${needed} bytes`);
  }
  return { data, width, height };
}

// Dominant color of the frame region above the barcode band. Positions are
// proportional to the frame size: exact at the pinned 320x240, still correct
// for a same-frame capture at another resolution. Samples the region on a
// stride grid, picks the winning 5-bit-quantized color bucket, and returns the
// mean of that bucket's pixels (so the result keeps full 8-bit precision).
/**
 * @param {ImageDataLike} imageData
 * @returns {Color}
 */
export function decodeBarcodeColor(imageData) {
  const { data, width, height } = validateImageData(imageData);
  const bandTop = Math.round((BAND_TOP / FRAME_H) * height);
  const strideX = Math.max(1, Math.floor(width / 80));
  const strideY = Math.max(1, Math.floor(bandTop / 50));
  const buckets = new Map();
  for (let y = 0; y < bandTop; y += strideY) {
    for (let x = 0; x < width; x += strideX) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.n++;
        bucket.r += r;
        bucket.g += g;
        bucket.b += b;
      } else {
        buckets.set(key, { n: 1, r, g, b });
      }
    }
  }
  let /** @type {{ n: number, r: number, g: number, b: number } | null} */ best = null;
  for (const bucket of buckets.values()) {
    if (!best || bucket.n > best.n) best = bucket;
  }
  if (!best) throw new TypeError("imageData has no sampleable pixels above the band");
  return {
    r: Math.round(best.r / best.n),
    g: Math.round(best.g / best.n),
    b: Math.round(best.b / best.n),
  };
}

// Parses the pinned barcode band and returns { counter, ok }. ok=false (and
// counter=0) when either sentinel is missing or corrupt — the counter payload
// is not trusted in that case. Geometry is the pinned 320x240 layout applied
// proportionally (exact at 320x240); bit cells are sampled over their middle
// half so a pixel of scaling blur at cell edges cannot flip a bit.
/**
 * @param {ImageDataLike} imageData
 * @returns {CounterResult}
 */
export function decodeFrameCounter(imageData) {
  const { data, width, height } = validateImageData(imageData);
  const bandTop = Math.round((BAND_TOP / FRAME_H) * height);
  const bandH = height - bandTop;
  if (bandH < 1) return { counter: 0, ok: false };
  const mid = bandTop + Math.floor(bandH / 2);
  const ys = [
    Math.max(bandTop, mid - 4),
    mid,
    Math.min(height - 1, mid + 4),
  ];
  const sx0 = /** @param {number} x */ (x) => Math.min(width, Math.round((x / FRAME_W) * width));
  const lumaAt = /** @param {number} x @param {number} y */ (x, y) => {
    const i = (y * width + x) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  };
  // Mean luma over the middle half of [x0, x1) at the sampled band rows.
  const meanLuma = /** @param {number} x0 @param {number} x1 */ (x0, x1) => {
    const inset = Math.floor((x1 - x0) / 4);
    let sum = 0;
    let n = 0;
    for (const y of ys) {
      for (let x = x0 + inset; x < x1 - inset; x++) {
        sum += lumaAt(x, y);
        n++;
      }
    }
    return n > 0 ? sum / n : 255;
  };
  const leftMean = meanLuma(sx0(SENTINEL_LEFT_X0), sx0(SENTINEL_LEFT_X1));
  const rightMean = meanLuma(sx0(SENTINEL_RIGHT_X0), sx0(SENTINEL_RIGHT_X1));
  // The band background margins (outside both sentinels) must stay bright: a
  // dark margin means the band itself is absent or painted over, which dark
  // sentinels alone cannot distinguish (peer colors are dark too).
  const marginLeftMean = meanLuma(0, sx0(SENTINEL_LEFT_X0));
  const marginRightMean = meanLuma(sx0(SENTINEL_RIGHT_X1), width);
  if (leftMean >= LUMA_THRESHOLD || rightMean >= LUMA_THRESHOLD) {
    return { counter: 0, ok: false };
  }
  if (marginLeftMean < LUMA_THRESHOLD || marginRightMean < LUMA_THRESHOLD) {
    return { counter: 0, ok: false };
  }
  let counter = 0;
  for (let i = 0; i < BIT_COUNT; i++) {
    const x0 = sx0(BIT_START_X + BIT_WIDTH * i);
    const x1 = sx0(BIT_START_X + BIT_WIDTH * (i + 1));
    // Pinned polarity: bit 1 = black rgb(20,20,20), bit 0 = white.
    if (meanLuma(x0, x1) < LUMA_THRESHOLD) counter |= 1 << (BIT_COUNT - 1 - i);
  }
  return { counter, ok: true };
}

// Frame rate from samples of a remote video: Array<{ t, counter }> where t is
// in MILLISECONDS (performance.now convention) and counter is the decoded
// frame counter (mod 4096). Counts OBSERVED advances: a sample advances only
// when its counter differs from the previous sample's, and fps is the advance
// count over the elapsed window. Duplicate counters (repeated frames) count 0,
// the mod-4096 wrap (4095 -> 0) counts as one advance like any other counter
// change — no wrap special-casing — and skipped counters are NOT summed as
// gaps: a dropped frame LOWERS the observed rate, because the receiver never
// saw it.
/**
 * @param {FpsSample[]} samples
 * @returns {number}
 */
export function computeFps(samples) {
  if (!Array.isArray(samples)) {
    throw new TypeError("samples must be an array of { t, counter }");
  }
  for (const s of samples) {
    if (!s || typeof s !== "object" || !Number.isFinite(s.t) || !Number.isFinite(s.counter)) {
      throw new TypeError("each sample must be { t: number(ms), counter: number }");
    }
  }
  if (samples.length < 2) return 0;
  const elapsedMs = samples[samples.length - 1].t - samples[0].t;
  if (elapsedMs <= 0) return 0;
  let advances = 0;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].counter !== samples[i - 1].counter) advances++;
  }
  if (advances === 0) return 0;
  return (advances / elapsedMs) * 1000;
}

// Spectral peak of a mono buffer (Goertzel): coarse 1 Hz scan over 50..2000 Hz
// (clamped to Nyquist), then a 0.05 Hz refinement pass around the peak — well
// inside the +-5 Hz the harness requires on 440/660/880 Hz tones. Returns
// { peakHz, rms }; pure digital silence yields peakHz 0. The analysis window
// is capped at 12000 samples (~0.25 s at 48 kHz), so cost is bounded even for
// long buffers.
/**
 * @param {Float32Array | ArrayLike<number>} samples
 * @param {number} sampleRate
 * @returns {ToneResult}
 */
export function decodeToneHz(samples, sampleRate) {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new TypeError("sampleRate must be a positive number");
  }
  const x = samples instanceof Float32Array ? samples : Float32Array.from(samples ?? []);
  const n = Math.min(x.length, 12000, sampleRate);
  if (n < 2) return { peakHz: 0, rms: 0 };
  let sumSq = 0;
  for (let i = 0; i < n; i++) sumSq += x[i] * x[i];
  const rms = Math.sqrt(sumSq / n);
  if (rms < 1e-6) return { peakHz: 0, rms };
  const fMin = 50;
  const fMax = Math.min(2000, Math.floor(sampleRate / 2) - 1);
  if (fMax <= fMin) return { peakHz: 0, rms };
  let bestF = fMin;
  let bestP = -Infinity;
  for (let f = fMin; f <= fMax; f += 1) {
    const p = goertzelPower(x, n, f, sampleRate);
    if (p > bestP) {
      bestP = p;
      bestF = f;
    }
  }
  for (let f = Math.max(fMin, bestF - 1); f <= Math.min(fMax, bestF + 1) + 1e-9; f += 0.05) {
    const p = goertzelPower(x, n, f, sampleRate);
    if (p > bestP) {
      bestP = p;
      bestF = f;
    }
  }
  return { peakHz: Math.round(bestF * 10) / 10, rms };
}

/**
 * Goertzel power of `freq` over x[0..n).
 * @param {Float32Array} x
 * @param {number} n
 * @param {number} freq
 * @param {number} sampleRate
 * @returns {number}
 */
function goertzelPower(x, n, freq, sampleRate) {
  const coeff = 2 * Math.cos((2 * Math.PI * freq) / sampleRate);
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < n; i++) {
    const s0 = x[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return s1 * s1 + s2 * s2 - coeff * s1 * s2;
}
