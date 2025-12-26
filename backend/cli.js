#!/usr/bin/env node
import { fileURLToPath } from "url";
import path from "path";
import { runPrediction } from "./predict_engine.js";
import { runBacktest } from "./backtest_engine.js";
import { trainModel } from "./training_engine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const command = args[0];
const gameName = args[1];

async function main() {
  try {
    switch (command) {
      case "predict":
        if (!gameName) {
          console.log("Usage: node cli.js predict <game_name>");
          process.exit(1);
        }
        await runPrediction(gameName);
        break;

      case "train":
        console.log("📊 Training models for all datasets in game_data/");
        await trainModel();
        break;

      case "backtest":
        if (!gameName) {
          console.log("Usage: node cli.js backtest <game_name>");
          process.exit(1);
        }
        await runBacktest(gameName);
        break;

      default:
        console.log("Available commands:");
        console.log(" predict <game_name> Run prediction for a game (e.g. premier_fairchance)");
        console.log(" train Train/save models for all games in game_data/");
        console.log(" backtest <game_name> Run rolling backtest for a game");
        console.log("\nExamples:");
        console.log(" node cli.js train");
        console.log(" node cli.js backtest premier_fairchance");
        console.log(" node cli.js predict premier_fairchance");
    }
  } catch (err) {
    console.error("CLI Error:", err.message || err);
    process.exit(1);
  }
}

main();