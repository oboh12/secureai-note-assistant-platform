// utils.js - small helper functions used across engines
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DATA_DIR = path.join(__dirname, "game_data");
export const MODELS_DIR = path.join(__dirname, "models");
export const RESULTS_DIR = path.join(__dirname, "results");

export function ensureDirs() {
  if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR);
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR);
}

// safe JSON loader
export function loadJsonFile(fullPath) {
  if (!fs.existsSync(fullPath)) throw new Error(`File not found: ${fullPath}`);
  const raw = fs.readFileSync(fullPath, "utf8").trim();
  return JSON.parse(raw);
}

// mean
export function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a,b)=>a+b,0) / arr.length;
}

// median
export function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a,b)=>a-b);
  const mid = Math.floor(s.length/2);
  if (s.length % 2 === 1) return s[mid];
  return (s[mid-1] + s[mid]) / 2;
}

// EMA (exponential moving average) — stronger weight on recent entries.
// alpha between 0..1 (recommended ~ 2/(N+1) but we allow custom)
export function ema(arr, alpha = null) {
  if (!arr.length) return 0;
  const N = arr.length;
  const a = alpha === null ? (2/(N+1)) : alpha;
  let s = arr[0];
  for (let i=1;i<arr.length;i++) {
    s = a * arr[i] + (1 - a) * s;
  }
  return s;
}

// clamp and integer rounding to 1..99
export function clampToValid(n, min=1, max=99) {
  if (!Number.isFinite(n)) return min;
  let v = Math.round(n);
  if (v < min) v = min;
  if (v > max) v = max;
  return v;
}

// RMSE between two arrays (flattened)
export function rmseMatrix(actualMatrix, predictedMatrix) {
  const a = actualMatrix.flat();
  const p = predictedMatrix.flat();
  if (a.length !== p.length || a.length === 0) return null;
  let s = 0;
  for (let i=0;i<a.length;i++) {
    const e = a[i] - p[i];
    s += e*e;
  }
  return Math.sqrt(s / a.length);
}

// read all game filenames in data dir
export function listGameFiles() {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));
}

// load game JSON by name (gameName is filename without .json)
export function loadGameByName(gameName) {
  const filePath = path.join(DATA_DIR, `${gameName}.json`);
  return loadJsonFile(filePath);
}

// save JSON file
export function saveJsonFile(fullPath, obj) {
  fs.writeFileSync(fullPath, JSON.stringify(obj, null, 2), "utf8");
}