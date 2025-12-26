/**
 * ROLLING BACKTEST + CALIBRATION CHECK
 * ------------------------------------
 * Run: node backtest_calibration.js
 * Requires: npm install fs
 */

import fs from "fs";

const gameDir = "./game_data";
const files = fs.readdirSync(gameDir).filter(f => f.endsWith(".json"));

// Simulate your model's prediction output (replace with real ML predictions)
function fakePredict(nums) {
  return nums.map(n => n + Math.random() * 5 - 2.5); // small jitter
}

let results = [];

for (const file of files) {
  const raw = JSON.parse(fs.readFileSync(`${gameDir}/${file}`, "utf8"));
  const { game, numbers } = raw;
  for (let i = 1; i < numbers.length; i++) {
    const past = numbers[i - 1];
    const actual = numbers[i];
    const preds = fakePredict(past);
    results.push({
      game,
      actual,
      preds,
    });
  }
}

// ==== Compute RMSE + Calibration ====
let totalErr = 0;
let totalCount = 0;
let calibration = [];

for (const r of results) {
  const err =
    r.actual.reduce((sum, val, idx) => sum + Math.pow(val - r.preds[idx], 2), 0) /
    r.actual.length;
  totalErr += err;
  totalCount++;
  calibration.push(Math.sqrt(err));
}

const rmse = Math.sqrt(totalErr / totalCount);
const avgCalib = calibration.reduce((a, b) => a + b, 0) / calibration.length;

console.log("📊 Backtest Summary:");
console.log(`Total games evaluated: ${results.length}`);
console.log(`Overall RMSE: ${rmse.toFixed(3)}`);
console.log(`Avg calibration (lower = better): ${avgCalib.toFixed(3)}`);