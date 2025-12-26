// predict_engine.js
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { DATA_DIR, MODELS_DIR, ensureDirs, loadJsonFile, saveJsonFile } from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// hybrid prediction for 5 numbers per draw
function combineHybrid(stats, weights) {
  // stats: { median, mean, ema, last }
  // weights: { median, ema, last } - must sum to 1
  const wMedian = weights.median ?? 0.45;
  const wEma = weights.ema ?? 0.35;
  const wLast = weights.last ?? 0.20;
  const val = (wMedian * stats.median) + (wEma * stats.ema) + (wLast * stats.last);
  return val;
}

function clampToRange(n) {
  if (!Number.isFinite(n)) return 1;
  const r = Math.round(n);
  if (r < 1) return 1;
  if (r > 99) return 99;
  return r;
}

export function loadModelForGame(gameName) {
  const modelPath = path.join(MODELS_DIR, `${gameName}_model.json`);
  if (!fs.existsSync(modelPath)) return null;
  return loadJsonFile(modelPath);
}

export function predictUsingModel(model) {
  if (!model || !model.positions) throw new Error("Invalid model");
  const weights = model.weights ?? { median:0.45, ema:0.35, last:0.2 };
  const raw = model.positions.map(pos => {
    return combineHybrid(pos, weights);
  });
  return raw.map(clampToRange);
}

// If model missing, compute on the fly and return prediction (doesn't save)
export function computeModelFromData(numbers) {
  // numbers: array of draws [ [n1..n5], ... ]
  const posCount = numbers[0].length;
  const positions = Array(posCount).fill(null).map(()=>[]);
  for (const draw of numbers) {
    draw.forEach((v,i)=>positions[i].push(Number(v)));
  }
  const stats = positions.map(posArr=>{
    // compute median
    const s = [...posArr].sort((a,b)=>a-b);
    const m = Math.floor(s.length/2);
    const medianVal = s.length%2 ? s[m] : (s[m-1]+s[m])/2;
    const meanVal = posArr.reduce((a,b)=>a+b,0)/posArr.length;
    // ema
    const alpha = 2/(posArr.length+1);
    let s_ = posArr[0];
    for (let i=1;i<posArr.length;i++) s_ = alpha*posArr[i] + (1-alpha)*s_;
    const emaVal = s_;
    return { median: medianVal, mean: meanVal, ema: emaVal, last: posArr[posArr.length-1], count: posArr.length };
  });

  // apply same weights
  const weights = { median:0.45, ema:0.35, last:0.2 };
  const raw = stats.map(st => (weights.median*st.median + weights.ema*st.ema + weights.last*st.last));
  return raw.map(clampToRange);
}

export async function runPrediction(gameName) {
  ensureDirs();
  try {
    const dataPath = path.join(DATA_DIR, `${gameName}.json`);
    if (!fs.existsSync(dataPath)) {
      console.error(`Game file not found: ${dataPath}`);
      return null;
    }
    const j = loadJsonFile(dataPath);
    if (!j.numbers || !Array.isArray(j.numbers) || !j.numbers.length) {
      throw new Error("Invalid game data format: expected { numbers: [ [..], ... ] }");
    }
    const numbers = j.numbers;
    // load model if exists
    let model = loadModelForGame(gameName);
    if (!model) {
      // compute on the fly and also save a model for next time
      console.log("⚠ No saved model found — computing model from data and saving it.");
      const positions = numbers[0].map(()=>[]);
      for (const d of numbers) d.forEach((v,i)=>positions[i].push(Number(v)));
      const stats = positions.map(posArr=>{
        // median
        const s = [...posArr].sort((a,b)=>a-b);
        const mid = Math.floor(s.length/2);
        const med = s.length%2? s[mid] : (s[mid-1]+s[mid])/2;
        // ema
        let alpha = 2/(posArr.length+1);
        let s_ = posArr[0];
        for (let i=1;i<posArr.length;i++) s_ = alpha*posArr[i] + (1-alpha)*s_;
        return { median: med, mean: posArr.reduce((a,b)=>a+b,0)/posArr.length, ema: s_, last: posArr[posArr.length-1], count: posArr.length };
      });
      model = { game: j.game || gameName, date_trained: new Date().toISOString(), positions: stats, algorithm: "hybrid_median_ema_last_v1", weights: { median:0.45, ema:0.35, last:0.2 } };
      const savePath = path.join(MODELS_DIR, `${gameName}_model.json`);
      saveJsonToDisk(savePath, model);
      console.log(`Saved model to models/${gameName}_model.json`);
    }

    const prediction = predictUsingModel(model);
    console.log(`\n=== Prediction for ${gameName} ===`);
    console.log(`Predicted Next Draw: [ ${prediction.join(" , ")} ]`);

    // compute RMSE on last 5 draws
    const lastActuals = numbers.slice(-5);
    // predictedMatrix: replicate prediction for each of the lastActuals length
    const predictedMatrix = Array(lastActuals.length).fill(prediction);
    const { rmseMatrix } = await import("./utils.js");
    const rmseVal = rmseMatrix(lastActuals, predictedMatrix);
    console.log(`RMSE (last ${lastActuals.length} draws): ${ (rmseVal===null) ? "N/A" : rmseVal.toFixed(3) }`);

    // append to prediction_log.csv
    const resultsDir = path.join(__dirname, "results");
    if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir);
    const logPath = path.join(resultsDir, "prediction_log.csv");
    if (!fs.existsSync(logPath)) fs.writeFileSync(logPath, "timestamp,game,prediction,rmse\n", "utf8");
    const row = `${new Date().toISOString()},${gameName},"${prediction.join(",")}",${rmseVal===null? "": rmseVal.toFixed(3)}\n`;
    fs.appendFileSync(logPath, row, "utf8");

    return { prediction, rmse: rmseVal };
  } catch (err) {
    console.error("Prediction error:", err.message || err);
    return null;
  }
}

// helper to save model (avoid circular import)
function saveJsonToDisk(fullPath, obj) {
  fs.writeFileSync(fullPath, JSON.stringify(obj, null, 2), "utf8");
}