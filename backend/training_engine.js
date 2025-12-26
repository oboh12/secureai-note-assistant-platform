// training_engine.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DATA_DIR, MODELS_DIR, ensureDirs, listGameFiles, loadJsonFile, saveJsonFile } from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Hybrid model training (D3)
// For each game we compute per-position: median, mean, ema, last value, count
// Save as models/<gameName>_model.json

function perPositionArrays(numbers) {
  // numbers: array of draws [ [n1..n5], ... ]
  const positions = numbers[0].map(() => []);
  for (const draw of numbers) {
    draw.forEach((v, idx) => positions[idx].push(Number(v)));
  }
  return positions;
}

export async function trainModel() {
  ensureDirs();
  const files = listGameFiles();
  if (!files.length) {
    console.log("⚠ No datasets found in game_data/");
    return;
  }
  console.log("📂 Datasets found:");
  for (const f of files) console.log(" -", f);

  console.log("⚙ Training hybrid models (D3) for all games...");
  for (const file of files) {
    try {
      const gameName = path.basename(file, ".json");
      const fullPath = path.join(DATA_DIR, file);
      const json = loadJsonFile(fullPath);

      if (!json.numbers || !Array.isArray(json.numbers) || json.numbers.length < 3) {
        console.log(` - Skipping ${file}: not enough data`);
        continue;
      }

      const positions = perPositionArrays(json.numbers);
      // compute stats per position
      const stats = positions.map(posArr => {
        const { mean: meanVal, median: medianVal, emaVal, last } = {
          mean: ((arr)=> (arr.reduce((a,b)=>a+b,0)/arr.length))(posArr),
          median: ((arr)=>{ const s=[...arr].sort((a,b)=>a-b); const m=Math.floor(s.length/2); return s.length%2? s[m] : (s[m-1]+s[m])/2; })(posArr),
          emaVal: null,
          last: posArr[posArr.length-1]
        };
        // simple EMA manual:
        let alpha = 2/(posArr.length + 1);
        let s = posArr[0];
        for (let i=1;i<posArr.length;i++) s = alpha*posArr[i] + (1-alpha)*s;
        const emaV = s;
        return {
          mean: meanVal,
          median: medianVal,
          ema: emaV,
          last: posArr[posArr.length-1],
          count: posArr.length
        };
      });

      const model = {
        game: json.game || gameName,
        date_trained: new Date().toISOString(),
        positions: stats,
        algorithm: "hybrid_median_ema_last_v1",
        weights: { median: 0.45, ema: 0.35, last: 0.20 } // used by prediction
      };

      const savePath = path.join(MODELS_DIR, `${gameName}_model.json`);
      saveJsonFile(savePath, model);
      console.log(`✅ Trained & saved model for ${gameName} -> models/${gameName}_model.json`);
    } catch (err) {
      console.error(`❌ Failed training for ${file}:`, err.message || err);
    }
  }
  console.log("✅ All training done.");
}