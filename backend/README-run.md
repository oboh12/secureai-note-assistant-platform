# How to run the JS ML stack (no external deps)

From backend/ run:

1. Train models from available datasets:
   node cli.js train

2. Backtest a game:
   node cli.js backtest premier_fairchance

3. Predict next draw:
   node cli.js predict premier_fairchance

Models are saved into backend/models/
Prediction logs into backend/results/prediction_log.csv
Backtest results into backend/results/<game>_backtest.json