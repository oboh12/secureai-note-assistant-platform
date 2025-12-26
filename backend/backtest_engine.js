// backtest_engine.js
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { DATA_DIR, loadJsonFile, rmseMatrix } from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The rolling backtest trains (computes stats) on history slice and predicts next draw and compares.
// We compute RMSE across all predicted slots and average.

function computePredictionFromHistory(historyDraws) {
  // historyDraws: array of draws [ [n1..n5], ... ]
  const posCount = historyDraws[0].length;
  const positions = Array(posCount).fill(null).map(()=>[]);
  for (const d of historyDraws) d.forEach((v,i)=>positions[i].push(Number(v)));

  // compute median, ema, last and combine with same weights
  const weights = { median:0.45, ema:0.35, last:0.2 };
  const preds = positions.map(posArr=>{
    const s = [...posArr].sort((a,b)=>a-b);
    const mid = Math.floor(s.length/2);
    const med = s.length%2 ? s[mid] : (s[mid-1]+s[mid])/2;
    // ema
    const alpha = 2/(posArr.length+1);
    let se = posArr[0];
    for (let i=1;i<posArr.length;i++) se = alpha*posArr[i] + (1-alpha)*se;
    const raw = weights.median*med + weights.ema*se + weights.last*posArr[posArr.length-1];
    // clamp
    let v = Math.round(raw);
    if (v < 1) v = 1;
    if (v > 99) v = 99;
    return v;
  });

  return preds;
}

export async function runBacktest(gameName) {
  try {
    const filePath = path.join(DATA_DIR, `${gameName}.json`);
    if (!fs.existsSync(filePath)) {
      console.error(`Game file not found: ${filePath}`);
      return null;
    }
    const json = loadJsonFile(filePath);
    const draws = json.numbers;
    if (!Array.isArray(draws) || draws.length < 6) {
      console.error("Not enough draws for backtesting (need >=6).");
      return null;
    }

    let predMatrix = [];
    let actualMatrix = [];

    // start with minimal history of 5 draws
    for (let i = 5; i < draws.length; i++) {
      const history = draws.slice(0, i); // all previous draws
      const actual = draws[i];
      const predicted = computePredictionFromHistory(history);
      predMatrix.push(predicted);
      actualMatrix.push(actual.map(x=>Number(x)));
    }

    const score = rmseMatrix(actualMatrix, predMatrix);
    console.log(`✅ Backtest completed for ${gameName}`);
    console.log(`Test samples: ${predMatrix.length}`);
    console.log(`RMSE (multi-slot): ${score === null ? "N/A" : score.toFixed(3)}`);

    // save backtest results
    const resultsPath = path.join(__dirname, "results");
    if (!fs.existsSync(resultsPath)) fs.mkdirSync(resultsPath);
    const out = { game: gameName, tested_on: new Date().toISOString(), samples: predMatrix.length, rmse: score };
    fs.writeFileSync(path.join(resultsPath, `${gameName}_backtest.json`), JSON.stringify(out, null, 2), "utf8");
    return score;
  } catch (err) {
    console.error("Backtest error:", err.message || err);
    return null;
  }
}