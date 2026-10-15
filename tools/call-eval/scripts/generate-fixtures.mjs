#!/usr/bin/env node
// Generates the D4 media fixtures pinned in tools/call-eval/CONTRACT.md:
//
//   tools/call-eval/fixtures/peer-A.y4m  peer-B.y4m  peer-C.y4m  peer-D.y4m
//   tools/call-eval/fixtures/second-camera.y4m            (H-05 second camera)
//   tools/call-eval/fixtures/peer-A.wav  peer-B.wav  peer-C.wav  peer-D.wav
//
// Pure Node, zero dependencies. y4m: I420 (`C420jpeg`), 320x240, 30 fps,
// 300 frames; peer color above the barcode band, frame-counter barcode in the
// bottom band. wav: 48 kHz mono 16-bit PCM, 60 s, sine 440/660/880/1100 Hz.
//
// After writing, a self-check decodes frames back out of the artifacts (and
// in-memory wrap frames for frameNumbers 4095/4096, which do not exist inside
// a 300-frame file) with the pinned decoders from lib/decoders.mjs, prints the
// decoded counter + color (+ tone Hz for wavs), and exits nonzero on any
// mismatch.
//
// Usage: pnpm call-eval:fixtures [--out=<dir>]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  FRAME_COUNT,
  FPS,
  HEIGHT,
  PEER_COLORS,
  PEER_TONES_HZ,
  WIDTH,
  buildFrameRgb,
  buildWavPcm,
  counterForFrame,
  frameToI420,
  i420ToImageDataLike,
  parseWavPcm,
} from "../lib/fixture-media.mjs";
import { decodeBarcodeColor, decodeFrameCounter, decodeToneHz } from "../lib/decoders.mjs";

/** @typedef {import("../lib/fixture-media.mjs").Color} Color */
/** @typedef {import("../lib/fixture-media.mjs").ImageDataLike} ImageDataLike */
/** @typedef {{ counter: number, ok: boolean, color?: Color }} CheckResult */

const DEFAULT_OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

const Y4M_FILES = {
  A: { name: "peer-A.y4m", color: PEER_COLORS.A },
  B: { name: "peer-B.y4m", color: PEER_COLORS.B },
  C: { name: "peer-C.y4m", color: PEER_COLORS.C },
  D: { name: "peer-D.y4m", color: PEER_COLORS.D },
  SECOND_CAMERA: { name: "second-camera.y4m", color: PEER_COLORS.SECOND_CAMERA },
};

const WAV_FILES = {
  A: { name: "peer-A.wav", freqHz: PEER_TONES_HZ.A },
  B: { name: "peer-B.wav", freqHz: PEER_TONES_HZ.B },
  C: { name: "peer-C.wav", freqHz: PEER_TONES_HZ.C },
  D: { name: "peer-D.wav", freqHz: PEER_TONES_HZ.D },
};

const frameBytes = (WIDTH * HEIGHT * 3) / 2; // I420
const yBytes = WIDTH * HEIGHT;

/**
 * @returns {string}
 */
function outDir() {
  const arg = process.argv.find((a) => a.startsWith("--out="));
  return arg ? path.resolve(arg.slice("--out=".length)) : DEFAULT_OUT_DIR;
}

/**
 * @param {string} filePath
 * @param {Color} color
 * @returns {void}
 */
function writeY4m(filePath, color) {
  const header = `YUV4MPEG2 W${WIDTH} H${HEIGHT} F${FPS}:1 Ip A1:1 C420jpeg\n`;
  const frameBuf = Buffer.alloc(6 + frameBytes);
  frameBuf.write("FRAME\n", 0, "ascii");
  const headerBuf = Buffer.from(header, "ascii");
  const fd = fs.openSync(filePath, "w");
  try {
    // Buffer overload without a position: writes at (and advances) the file
    // offset. The string overload with an explicit position uses pwrite,
    // which leaves the offset at 0 and would let the first frame clobber the
    // header.
    fs.writeSync(fd, headerBuf, 0, headerBuf.length);
    for (let frameNumber = 0; frameNumber < FRAME_COUNT; frameNumber++) {
      const { y, cb, cr } = frameToI420(buildFrameRgb(frameNumber, color));
      Buffer.from(y).copy(frameBuf, 6);
      Buffer.from(cb).copy(frameBuf, 6 + yBytes);
      Buffer.from(cr).copy(frameBuf, 6 + yBytes + yBytes / 4);
      fs.writeSync(fd, frameBuf, 0, frameBuf.length);
    }
  } finally {
    fs.closeSync(fd);
  }
}

// Parses frame `frameNumber` out of a y4m we just wrote and turns it into an
// ImageData-like object through the same full-range BT.601 inverse a canvas
// uses, so the self-check exercises the real decode path end to end.
/**
 * @param {string} filePath
 * @param {number} frameNumber
 * @returns {ImageDataLike}
 */
function readFrameAt(filePath, frameNumber) {
  const buf = fs.readFileSync(filePath);
  const headerEnd = buf.indexOf(0x0a);
  const header = buf.toString("ascii", 0, headerEnd);
  if (!header.startsWith(`YUV4MPEG2 W${WIDTH} H${HEIGHT} F${FPS}:1`) || !header.includes("C420jpeg")) {
    throw new Error(`${filePath}: unexpected y4m header: ${header}`);
  }
  const stride = 6 + frameBytes;
  const start = headerEnd + 1 + frameNumber * stride;
  const frame = buf.subarray(start, start + stride);
  if (frame.length < stride || frame.toString("ascii", 0, 6) !== "FRAME\n") {
    throw new Error(`${filePath}: frame ${frameNumber} not found or malformed`);
  }
  return i420ToImageDataLike({
    y: frame.subarray(6, 6 + yBytes),
    cb: frame.subarray(6 + yBytes, 6 + yBytes + yBytes / 4),
    cr: frame.subarray(6 + yBytes + yBytes / 4, 6 + frameBytes),
  });
}

/** @type {string[]} */
const failures = [];

// 8-bit I420 storage quantizes Y/Cb/Cr to integers, so a YUV round-trip can
// legitimately move a channel by 1 (e.g. rgb(45,85,175) -> g=84). The
// identity colors are checked to that quantization floor, not exact equality.
/**
 * @param {Color} a
 * @param {Color} b
 * @param {number} [tol]
 * @returns {boolean}
 */
function colorMatches(a, b, tol = 1) {
  return Math.abs(a.r - b.r) <= tol && Math.abs(a.g - b.g) <= tol && Math.abs(a.b - b.b) <= tol;
}

/**
 * @param {string} label
 * @param {CheckResult} actual
 * @param {CheckResult} expected
 * @returns {void}
 */
function check(label, actual, expected) {
  const ok =
    actual.counter === expected.counter &&
    actual.ok === expected.ok &&
    (!expected.color || (actual.color !== undefined && colorMatches(actual.color, expected.color)));
  console.log(
    `[self-check] ${label}: ${JSON.stringify(actual)}${ok ? " — PASS" : ` — FAIL, expected ${JSON.stringify(expected)}`}`,
  );
  if (!ok) failures.push(label);
}

/**
 * @param {string} dir
 * @param {keyof typeof Y4M_FILES} key
 * @param {number[]} frameNumbers
 * @returns {void}
 */
function checkY4m(dir, key, frameNumbers) {
  const { name, color } = Y4M_FILES[key];
  const filePath = path.join(dir, name);
  for (const frameNumber of frameNumbers) {
    const image = readFrameAt(filePath, frameNumber);
    const counter = decodeFrameCounter(image);
    const colorDecoded = decodeBarcodeColor(image);
    check(
      `${name} frame ${frameNumber}`,
      { counter: counter.counter, ok: counter.ok, color: colorDecoded },
      { counter: counterForFrame(frameNumber), ok: true, color },
    );
  }
}

// Wrap frames 4095 / 4096 do not exist inside a 300-frame file, so they are
// encoded in memory through the same buildFrameRgb/frameToI420 path that
// produced the files, then decoded with the pinned decoders.
/**
 * @returns {void}
 */
function checkWrap() {
  for (const frameNumber of [4095, 4096]) {
    const image = i420ToImageDataLike(frameToI420(buildFrameRgb(frameNumber, PEER_COLORS.A)));
    const counter = decodeFrameCounter(image);
    check(
      `in-memory wrap frame ${frameNumber}`,
      { counter: counter.counter, ok: counter.ok },
      { counter: counterForFrame(frameNumber), ok: true },
    );
  }
}

/**
 * @param {string} dir
 * @param {keyof typeof WAV_FILES} key
 * @returns {void}
 */
function checkWav(dir, key) {
  const { name, freqHz } = WAV_FILES[key];
  const filePath = path.join(dir, name);
  const wav = parseWavPcm(fs.readFileSync(filePath));
  const { peakHz, rms } = decodeToneHz(wav.samples, wav.sampleRate);
  const ok = Math.abs(peakHz - freqHz) <= 1 && rms > 0.3;
  console.log(
    `[self-check] ${name}: sampleRate=${wav.sampleRate} peakHz=${peakHz} rms=${rms.toFixed(3)} (expect ${freqHz} Hz +/-1, rms > 0.3)${ok ? " — PASS" : " — FAIL"}`,
  );
  if (!ok) failures.push(name);
}

function main() {
  const dir = outDir();
  fs.mkdirSync(dir, { recursive: true });
  const started = Date.now();
  for (const key of /** @type {(keyof typeof Y4M_FILES)[]} */ (Object.keys(Y4M_FILES))) {
    writeY4m(path.join(dir, Y4M_FILES[key].name), Y4M_FILES[key].color);
  }
  for (const key of /** @type {(keyof typeof WAV_FILES)[]} */ (Object.keys(WAV_FILES))) {
    fs.writeFileSync(path.join(dir, WAV_FILES[key].name), buildWavPcm({ freqHz: WAV_FILES[key].freqHz }));
  }
  console.log(
    `[fixtures] wrote ${Object.keys(Y4M_FILES).length} y4m + ${Object.keys(WAV_FILES).length} wav files to ${dir} in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );

  // Spot-decode the written artifacts: frame 0 of every peer file (color
  // identity), extra frames 137 and 299 of peer-A (counter spot checks), the
  // mod-4096 wrap on in-memory frames, and all three tones.
  checkY4m(dir, "A", [0, 137, 299]);
  checkY4m(dir, "B", [0]);
  checkY4m(dir, "C", [0]);
  checkY4m(dir, "D", [0]);
  checkY4m(dir, "SECOND_CAMERA", [0]);
  checkWrap();
  checkWav(dir, "A");
  checkWav(dir, "B");
  checkWav(dir, "C");
  checkWav(dir, "D");

  if (failures.length > 0) {
    console.error(`[self-check] ${failures.length} mismatch(es): ${failures.join(", ")}`);
    process.exit(1);
  }
  console.log("[self-check] all fixture checks passed");
}

// Run only when executed directly (never on import).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
