import os
import joblib
import pandas as pd
import numpy as np
import torch
from stable_baselines3 import PPO

from feature_engineering import build_features
from train_models import PoultryLSTM, FEATURE_COLS, ANOMALY_FEATURES

class PoultryAI:
    def __init__(self, models_dir=None):
        # Resolve paths dynamically to allow run from ml/ or project root
        if models_dir is None:
            models_dir = os.path.dirname(os.path.abspath(__file__))
            models_dir = os.path.join(models_dir, "models")
            if not os.path.exists(models_dir):
                models_dir = "models" # fallback to current directory models
                
        xgb_path = os.path.join(models_dir, "health_xgb.pkl")
        lstm_path = os.path.join(models_dir, "health_lstm.pt")
        rl_path = os.path.join(models_dir, "poultry_rl_agent.zip")
        scaler_path = os.path.join(models_dir, "anomaly_scaler.pkl")
        detector_path = os.path.join(models_dir, "anomaly_detector.pkl")

        print(f"Inference Engine: Loading models from {models_dir}...")
        self.xgb      = joblib.load(xgb_path)
        
        # Load PyTorch LSTM
        self.lstm     = PoultryLSTM(input_size=len(FEATURE_COLS))
        self.lstm.load_state_dict(torch.load(lstm_path, map_location=torch.device('cpu')))
        self.lstm.eval()
        
        # Load PPO agent
        self.rl_agent = PPO.load(rl_path, device="cpu")
        
        # Load Anomaly Detector
        self.scaler   = joblib.load(scaler_path)
        self.detector = joblib.load(detector_path)
        print("Inference Engine: All models loaded successfully!")

    def predict(self, recent_window: pd.DataFrame) -> dict:
        """
        Runs comprehensive multi-model inference pipeline.
        recent_window needs at least 36+ historical rows (24 for LSTM, 36 for rolling averages)
        """
        features = build_features(recent_window)
        if features.empty:
            raise ValueError("Telemetry window feature engineering resulted in an empty DataFrame.")
        latest   = features.iloc[-1]

        # 1. Anomaly check (Isolation Forest)
        x = np.array([[latest[f] for f in ANOMALY_FEATURES]])
        x_scaled = self.scaler.transform(x)
        score = self.detector.score_samples(x_scaled)[0]  # more negative = more anomalous
        
        anomaly = {
            "is_anomaly": bool(self.detector.predict(x_scaled)[0] == -1),
            "anomaly_score": round(float(score), 4),
            "severity": "critical" if score < -0.6
                        else "warning" if score < -0.4
                        else "normal"
        }

        # 2. Current health score (XGBoost)
        health_now = float(self.xgb.predict(
            latest[FEATURE_COLS].values.reshape(1, -1))[0])
        health_now = max(0.0, min(1.0, health_now))

        # 3. Forecast (LSTM) — 6h, 12h, 24h ahead
        seq = torch.FloatTensor(
            features[FEATURE_COLS].tail(24).values).unsqueeze(0)
        with torch.no_grad():
            forecast = self.lstm(seq).squeeze().tolist()

        # 4. RL recommended action (PPO)
        # State: [health_score, nh3, co2, temperature, humidity, thi, outdoor_temp, time_of_day_sin, time_of_day_cos]
        hour = pd.Timestamp.now().hour
        obs = np.array([
            health_now, 
            latest["nh3"], 
            latest["co2"],
            latest["temperature"], 
            latest["humidity"],
            latest["thi"], 
            latest["outdoor_temp"],
            np.sin(2 * np.pi * hour / 24),
            np.cos(2 * np.pi * hour / 24)
        ], dtype=np.float32)
        
        action, _ = self.rl_agent.predict(obs, deterministic=True)
        
        action_map = {
            0: "fan_low", 
            1: "fan_medium", 
            2: "fan_high",
            3: "heater_on", 
            4: "heater_off", 
            5: "alert_farmer"
        }

        return {
            "health_score":    round(health_now, 3),
            "risk_class":      "critical" if health_now < 0.4
                               else "high"   if health_now < 0.6
                               else "medium" if health_now < 0.8
                               else "low",
            "forecast_6h":     round(forecast[0], 3),
            "forecast_12h":    round(forecast[1], 3),
            "forecast_24h":    round(forecast[2], 3),
            "anomaly":         anomaly,
            "recommended_action": action_map[int(action)]
        }
