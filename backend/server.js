import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import bodyParser from "body-parser";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// --- Analyze Function (handles arrays and objects with "numbers") ---
const analyzeResults = (results) => {
  let allNumbers = [];

  if (Array.isArray(results)) {
    if (results.every((r) => Array.isArray(r))) {
      allNumbers = results.flat();
    } else if (results.every((r) => typeof r === "number")) {
      allNumbers = results;
    } else if (results.every((r) => r.draw)) {
      allNumbers = results.flatMap((r) => r.draw);
    }
  } else if (results.numbers && Array.isArray(results.numbers)) {
    // Handle object with "numbers" property
    allNumbers = results.numbers.flat();
  }

  if (!allNumbers.length) throw new Error("Invalid or empty game data");

  // Validate numbers are in range 1-99
  const invalidNumbers = allNumbers.filter((n) => n < 1 || n > 99);
  if (invalidNumbers.length > 0) {
    throw new Error(`Invalid numbers detected (must be 1-99): ${invalidNumbers.join(", ")}`);
  }

  // Debug log
  console.log("Loaded game data:", results);

  const totalCount = allNumbers.length;
  const sum = allNumbers.reduce((a, b) => a + b, 0);
  const average = sum / totalCount;

  const frequency = {};
  for (let n of allNumbers) {
    frequency[n] = (frequency[n] || 0) + 1;
  }

  const sorted = Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .map(([num, freq]) => ({ num: Number(num), freq }));

  const hot = sorted.slice(0, 5);
  const warm = sorted.slice(5, 10);
  const cool = sorted.slice(-5);

  const confidence =
    hot.length > 0 && hot[0].freq > 1
      ? Math.min(98, 60 + hot[0].freq * 5)
      : 40;

  const prediction = hot.map((h) => h.num);

  return {
    totalCount,
    sum,
    average,
    hot,
    warm,
    cool,
    confidence,
    prediction,
  };
};

// --- Route: /api/predict/:gameName ---
app.get("/api/predict/:gameName", (req, res) => {
  const { gameName } = req.params;

  // Convert "Premier Lucky" → "premier_lucky"
  const normalizedName = gameName.toLowerCase().replace(/\s+/g, "_");
  const filePath = path.join(process.cwd(), "game_data", `${normalizedName}.json`);

  console.log("Looking for:", filePath);

  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: `Game data not found for ${gameName}`,
      });
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const results = JSON.parse(raw);

    const analysis = analyzeResults(results);

    res.json({
      success: true,
      game: gameName,
      predictionDate: new Date().toISOString().split("T")[0],
      ...analysis,
    });
  } catch (err) {
    console.error("Prediction error:", err);
    res.status(500).json({
      success: false,
      error: "Prediction failed",
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});