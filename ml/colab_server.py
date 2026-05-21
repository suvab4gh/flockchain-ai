"""
╔══════════════════════════════════════════════════════════════════════════════╗
║           FlockChain AI — Google Colab ML Server                           ║
║           XGBoost + LSTM + PPO RL via ngrok → Vercel                       ║
╚══════════════════════════════════════════════════════════════════════════════╝

HOW TO USE:
  1. Upload your ml/models/ folder to Google Drive
  2. Open this file in Colab (File → Upload notebook... or paste as cells)
  3. Run all cells top-to-bottom
  4. Copy the ngrok HTTPS URL printed in the last cell
  5. Paste it in Vercel: Settings → Environment Variables → ML_SERVER_URL

CELL GUIDE:
  Cell 1  — Install deps
  Cell 2  — Mount Google Drive (to load your trained model files)
  Cell 3  — Copy models from Drive into Colab runtime
  Cell 4  — Run model sanity check
  Cell 5  — Start FastAPI server + ngrok tunnel
  Cell 6  — Print your public API URL + test curl command
"""

# ─────────────────────────────────────────────────────────────────────────────
# CELL 1: Install dependencies
# Paste this as the first cell and run it once.
# ─────────────────────────────────────────────────────────────────────────────
CELL_1 = """
!pip install -q fastapi uvicorn pyngrok nest-asyncio pydantic
!pip install -q xgboost scikit-learn joblib pandas numpy
!pip install -q torch --index-url https://download.pytorch.org/whl/cpu
!pip install -q stable-baselines3 gymnasium shimmy

# Confirm GPU/CPU
import torch
print(f"\\n✅ PyTorch {torch.__version__} | CUDA available: {torch.cuda.is_available()}")
print("✅ Dependencies installed.")
"""

# ─────────────────────────────────────────────────────────────────────────────
# CELL 2: Mount Google Drive (where your trained models live)
# Skip this if you upload models directly to Colab filesystem.
# ─────────────────────────────────────────────────────────────────────────────
CELL_2 = """
from google.colab import drive
drive.mount('/content/drive')

# Verify your models folder path.
# Adjust DRIVE_MODEL_PATH to wherever you uploaded the ml/models/ folder.
import os
DRIVE_MODEL_PATH = "/content/drive/MyDrive/flockchain_ai/models"
print(f"Drive path exists: {os.path.exists(DRIVE_MODEL_PATH)}")
print("Files found:", os.listdir(DRIVE_MODEL_PATH) if os.path.exists(DRIVE_MODEL_PATH) else "NOT FOUND")
"""

# ─────────────────────────────────────────────────────────────────────────────
# CELL 3: Copy model files into Colab /content/models/
# ─────────────────────────────────────────────────────────────────────────────
CELL_3 = """
import os, shutil

DRIVE_MODEL_PATH = "/content/drive/MyDrive/flockchain_ai/models"  # ← adjust if needed
COLAB_MODEL_PATH = "/content/models"

os.makedirs(COLAB_MODEL_PATH, exist_ok=True)

required = [
    "health_xgb.pkl",
    "health_lstm.pt",
    "poultry_rl_agent.zip",
    "anomaly_detector.pkl",
    "anomaly_scaler.pkl",
]

for f in required:
    src = os.path.join(DRIVE_MODEL_PATH, f)
    dst = os.path.join(COLAB_MODEL_PATH, f)
    if os.path.exists(src):
        shutil.copy2(src, dst)
        size_kb = os.path.getsize(dst) / 1024
        print(f"  ✅ {f} → {size_kb:.1f} KB")
    else:
        print(f"  ❌ MISSING: {f}  (check DRIVE_MODEL_PATH)")

print(f"\\nAll required models present: {all(os.path.exists(os.path.join(COLAB_MODEL_PATH, f)) for f in required)}")
"""

# ─────────────────────────────────────────────────────────────────────────────
# CELL 4: Quick model sanity check (loads models, prints health_score)
# ─────────────────────────────────────────────────────────────────────────────
CELL_4 = """
import os, sys, joblib, numpy as np, pandas as pd, torch
from stable_baselines3 import PPO

COLAB_MODEL_PATH = "/content/models"

# Load XGBoost
xgb = joblib.load(os.path.join(COLAB_MODEL_PATH, "health_xgb.pkl"))
print(f"✅ XGBoost loaded | n_estimators: {xgb.n_estimators}")

# Load LSTM (architecture must match training)
class PoultryLSTM(torch.nn.Module):
    def __init__(self, input_size=22, hidden_size=128, num_layers=2, output_size=3):
        super().__init__()
        self.lstm = torch.nn.LSTM(input_size, hidden_size, num_layers, batch_first=True, dropout=0.2)
        self.fc   = torch.nn.Linear(hidden_size, output_size)
    def forward(self, x):
        out, _ = self.lstm(x)
        return self.fc(out[:, -1, :])

lstm = PoultryLSTM(input_size=22)
lstm.load_state_dict(torch.load(os.path.join(COLAB_MODEL_PATH, "health_lstm.pt"), map_location="cpu"))
lstm.eval()
print("✅ LSTM loaded")

# Load PPO RL
rl = PPO.load(os.path.join(COLAB_MODEL_PATH, "poultry_rl_agent.zip"), device="cpu")
print("✅ PPO RL agent loaded")

# Load Anomaly Detector
scaler   = joblib.load(os.path.join(COLAB_MODEL_PATH, "anomaly_scaler.pkl"))
detector = joblib.load(os.path.join(COLAB_MODEL_PATH, "anomaly_detector.pkl"))
print("✅ Isolation Forest anomaly detector loaded")

print("\\n🎉 All models validated and ready for inference!")
"""

# ─────────────────────────────────────────────────────────────────────────────
# CELL 5: Start FastAPI + ngrok (THE MAIN CELL — run this last)
# ─────────────────────────────────────────────────────────────────────────────
CELL_5 = '''
import os, sys, asyncio, threading, time
import nest_asyncio
nest_asyncio.apply()

# ── CONFIGURATION ──────────────────────────────────────────────────────────
COLAB_MODEL_PATH = "/content/models"
PORT = 8000

# Set your ngrok auth token from https://dashboard.ngrok.com/get-started/your-authtoken
# Free tier gives you 1 permanent domain.
NGROK_AUTH_TOKEN = "YOUR_NGROK_AUTH_TOKEN_HERE"   # ← REPLACE THIS

# Your Vercel frontend URL — used for CORS whitelist
VERCEL_FRONTEND_URL = "https://your-app.vercel.app"  # ← REPLACE THIS
# ───────────────────────────────────────────────────────────────────────────

import joblib, numpy as np, pandas as pd, torch
from stable_baselines3 import PPO
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from pyngrok import ngrok, conf
import uvicorn

# ── Load models ─────────────────────────────────────────────────────────────
class PoultryLSTM(torch.nn.Module):
    def __init__(self, input_size=22, hidden_size=128, num_layers=2, output_size=3):
        super().__init__()
        self.lstm = torch.nn.LSTM(input_size, hidden_size, num_layers, batch_first=True, dropout=0.2)
        self.fc   = torch.nn.Linear(hidden_size, output_size)
    def forward(self, x):
        out, _ = self.lstm(x)
        return self.fc(out[:, -1, :])

print("[FlockChain ML] Loading models...")
xgb      = joblib.load(f"{COLAB_MODEL_PATH}/health_xgb.pkl")
lstm_net = PoultryLSTM(input_size=22)
lstm_net.load_state_dict(torch.load(f"{COLAB_MODEL_PATH}/health_lstm.pt", map_location="cpu"))
lstm_net.eval()
rl_agent = PPO.load(f"{COLAB_MODEL_PATH}/poultry_rl_agent.zip", device="cpu")
scaler   = joblib.load(f"{COLAB_MODEL_PATH}/anomaly_scaler.pkl")
detector = joblib.load(f"{COLAB_MODEL_PATH}/anomaly_detector.pkl")
print("[FlockChain ML] ✅ All models loaded.")

# ── Pydantic schemas ─────────────────────────────────────────────────────────
class SensorReading(BaseModel):
    timestamp: str
    nh3: float
    co2: float
    temperature: float
    humidity: float
    outdoor_temp: float
    outdoor_humidity: float
    h2s: Optional[float] = 0.5
    feed_intake: Optional[float] = 120.0
    weight_gain: Optional[float] = 50.0
    mortality_count: Optional[int] = 0

class PredictRequest(BaseModel):
    window: List[SensorReading]

# ── Feature engineering (inline, no file import needed in Colab) ─────────────
FEATURE_COLS = [
    "nh3", "co2", "temperature", "humidity", "outdoor_temp", "outdoor_humidity",
    "nh3_rolling_mean", "co2_rolling_mean", "temp_rolling_std",
    "thi", "nh3_co2_ratio", "humidity_deficit",
    "temp_rate_of_change", "nh3_rate_of_change",
    "hour_sin", "hour_cos", "nh3_lag1", "nh3_lag2",
    "temp_lag1", "co2_lag1", "outdoor_temp_lag1", "humidity_lag1"
]

ANOMALY_FEATURES = ["nh3", "co2", "temperature", "humidity", "outdoor_temp", "thi"]

def build_feature_row(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["thi"] = df["temperature"] - 0.55 * (1 - df["humidity"] / 100) * (df["temperature"] - 14.5)
    df["nh3_co2_ratio"]    = df["nh3"] / (df["co2"] + 1e-6)
    df["humidity_deficit"] = 100 - df["humidity"]
    df["nh3_rolling_mean"] = df["nh3"].rolling(6, min_periods=1).mean()
    df["co2_rolling_mean"] = df["co2"].rolling(6, min_periods=1).mean()
    df["temp_rolling_std"] = df["temperature"].rolling(6, min_periods=1).std().fillna(0)
    df["temp_rate_of_change"] = df["temperature"].diff().fillna(0)
    df["nh3_rate_of_change"]  = df["nh3"].diff().fillna(0)
    df["nh3_lag1"] = df["nh3"].shift(1).fillna(method="bfill")
    df["nh3_lag2"] = df["nh3"].shift(2).fillna(method="bfill")
    df["temp_lag1"] = df["temperature"].shift(1).fillna(method="bfill")
    df["co2_lag1"]  = df["co2"].shift(1).fillna(method="bfill")
    df["outdoor_temp_lag1"] = df["outdoor_temp"].shift(1).fillna(method="bfill")
    df["humidity_lag1"] = df["humidity"].shift(1).fillna(method="bfill")
    try:
        ts = pd.to_datetime(df["timestamp"])
        df["hour_sin"] = np.sin(2 * np.pi * ts.dt.hour / 24)
        df["hour_cos"] = np.cos(2 * np.pi * ts.dt.hour / 24)
    except Exception:
        import time as _t
        h = _t.localtime().tm_hour
        df["hour_sin"] = np.sin(2 * np.pi * h / 24)
        df["hour_cos"] = np.cos(2 * np.pi * h / 24)
    return df

# ── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="FlockChain AI — Colab ML Service",
    description="XGBoost + LSTM + PPO RL inference. Tunneled via ngrok to Vercel.",
    version="2.0.0-colab",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        VERCEL_FRONTEND_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",   # remove in production — required while ngrok URL is dynamic
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "models_loaded": True,
        "service": "FlockChain AI Colab ML",
        "models": ["XGBoost", "LSTM", "PPO RL", "IsolationForest"],
    }

@app.post("/predict")
def predict(req: PredictRequest):
    if len(req.window) < 36:
        raise HTTPException(
            status_code=400,
            detail=f"Requires at least 36 historical readings. Got {len(req.window)}."
        )
    try:
        df = pd.DataFrame([r.dict() for r in req.window])
        features = build_feature_row(df)
        latest   = features.iloc[-1]

        # 1. Anomaly check
        x        = np.array([[latest[f] for f in ANOMALY_FEATURES]])
        x_scaled = scaler.transform(x)
        score    = detector.score_samples(x_scaled)[0]
        anomaly  = {
            "is_anomaly":    bool(detector.predict(x_scaled)[0] == -1),
            "anomaly_score": round(float(score), 4),
            "severity":      "critical" if score < -0.6 else "warning" if score < -0.4 else "normal",
        }

        # 2. XGBoost health score
        health = float(xgb.predict(latest[FEATURE_COLS].values.reshape(1, -1))[0])
        health = max(0.0, min(1.0, health))

        # 3. LSTM forecast
        seq    = torch.FloatTensor(features[FEATURE_COLS].tail(24).values).unsqueeze(0)
        with torch.no_grad():
            fc = lstm_net(seq).squeeze().tolist()

        # 4. PPO RL action
        h   = pd.Timestamp.now().hour
        obs = np.array([
            health, latest["nh3"], latest["co2"], latest["temperature"],
            latest["humidity"], latest["thi"], latest["outdoor_temp"],
            np.sin(2 * np.pi * h / 24), np.cos(2 * np.pi * h / 24)
        ], dtype=np.float32)
        action, _ = rl_agent.predict(obs, deterministic=True)
        action_map = {0:"fan_low", 1:"fan_medium", 2:"fan_high",
                      3:"heater_on", 4:"heater_off", 5:"alert_farmer"}

        return {
            "health_score":       round(health, 3),
            "risk_class":         "critical" if health < 0.4 else "high" if health < 0.6
                                  else "medium" if health < 0.8 else "low",
            "forecast_6h":        round(fc[0], 3),
            "forecast_12h":       round(fc[1], 3),
            "forecast_24h":       round(fc[2], 3),
            "anomaly":            anomaly,
            "recommended_action": action_map[int(action)],
        }
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ── Start ngrok + uvicorn ────────────────────────────────────────────────────
if NGROK_AUTH_TOKEN and NGROK_AUTH_TOKEN != "YOUR_NGROK_AUTH_TOKEN_HERE":
    conf.get_default().auth_token = NGROK_AUTH_TOKEN

# Kill any existing ngrok tunnels from previous runs
ngrok.kill()
time.sleep(1)

tunnel = ngrok.connect(PORT, "http")
public_url = tunnel.public_url
print(f"""
╔══════════════════════════════════════════════════════════════╗
║  🚀  FlockChain AI ML Server is LIVE                        ║
╠══════════════════════════════════════════════════════════════╣
║  Public URL:  {public_url:<44} ║
║  Health:      {public_url}/health                           ║
║  Predict:     {public_url}/predict   (POST)                 ║
╠══════════════════════════════════════════════════════════════╣
║  ✅  Copy this to Vercel Environment Variables:             ║
║      ML_SERVER_URL = {public_url}/predict             ║
╚══════════════════════════════════════════════════════════════╝
""")

# Keep alive — uvicorn blocks here
config = uvicorn.Config(app, host="0.0.0.0", port=PORT, log_level="warning")
server = uvicorn.Server(config)
asyncio.get_event_loop().run_until_complete(server.serve())
'''

if __name__ == "__main__":
    print("This file is a Colab guide script. Paste each CELL_N block into separate Colab cells.")
    print("\nCell 1 (install):\n", CELL_1)
    print("\nCell 2 (drive mount):\n", CELL_2)
    print("\nCell 3 (copy models):\n", CELL_3)
    print("\nCell 4 (sanity check):\n", CELL_4)
    print("\nCell 5 (server + ngrok):\n", CELL_5)
