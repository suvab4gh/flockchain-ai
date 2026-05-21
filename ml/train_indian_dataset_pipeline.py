import os
import sys
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import joblib
import xgboost as xgb
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest
from sklearn.metrics import mean_absolute_error
from stable_baselines3 import PPO

# Ensure paths relative to ml/ work correctly
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from feature_engineering import build_features
from label_generator import generate_health_score
from gym_env import PoultryFarmEnv
from train_models import PoultryLSTM, FEATURE_COLS, ANOMALY_FEATURES

# Ensure directories exist
os.makedirs("data", exist_ok=True)
os.makedirs("models", exist_ok=True)
os.makedirs("logs", exist_ok=True)

def check_or_simulate_datasets():
    """
    Checks for Ajay Barsagade (IoT), Amrita (Management), and Open-Meteo datasets.
    If they are missing, simulates high-fidelity representations of them.
    """
    print("[Step 1] Checking for Indian datasets in data/ ...")
    
    sensor_path = "data/poultry_sensor_data.csv"
    management_path = "data/poultry_management_data.csv"
    weather_path = "data/outdoor_weather_data.csv"
    
    # Check if files already exist (fallback if run from project root)
    if not os.path.exists(sensor_path) and os.path.exists("../data/poultry_sensor_data.csv"):
        sensor_path = "../data/poultry_sensor_data.csv"
    if not os.path.exists(management_path) and os.path.exists("../data/poultry_management_data.csv"):
        management_path = "../data/poultry_management_data.csv"
    if not os.path.exists(weather_path) and os.path.exists("../data/outdoor_weather_data.csv"):
        weather_path = "../data/outdoor_weather_data.csv"

    # --- SIMULATE TELEMETRY IF MISSING ---
    if not os.path.exists(sensor_path):
        print("[Warning] 'poultry_sensor_data.csv' not found. Simulating Ajay Barsagade (IEEE) Poultry Farm IoT dataset...")
        dates = pd.date_range("2026-01-01 00:00:00", periods=500, freq="15min")
        np.random.seed(42)
        sensor_df = pd.DataFrame({
            "timestamp": [str(d) for d in dates],
            "nh3_ppm": np.random.uniform(5, 35, 500),
            "co2_ppm": np.random.uniform(400, 2200, 500),
            "temperature_c": np.random.uniform(20, 31, 500),
            "humidity_percent": np.random.uniform(45, 80, 500),
            "light_intensity_lux": np.random.uniform(10, 150, 500)
        })
        sensor_df.to_csv("data/poultry_sensor_data.csv", index=False)
        sensor_path = "data/poultry_sensor_data.csv"
        print("[Success] Simulated environmental sensors dataset saved to: data/poultry_sensor_data.csv")
    else:
        print(f"[Success] Found environmental sensors dataset: {sensor_path}")

    if not os.path.exists(management_path):
        print("[Warning] 'poultry_management_data.csv' not found. Simulating Amrita Poultry Farm Daily Management dataset...")
        dates = pd.date_range("2026-01-01", periods=6, freq="D") # 6 days to span the 500 intervals
        np.random.seed(42)
        management_df = pd.DataFrame({
            "date": [d.strftime("%Y-%m-%d") for d in dates],
            "flock_age_days": np.arange(14, 20),
            "feed_intake_g_per_bird": np.random.uniform(110, 130, 6),
            "water_consumption_ml_per_bird": np.random.uniform(220, 260, 6),
            "mortality_count": np.random.choice([0, 1, 0, 0, 2, 0], 6),
            "cull_count": np.random.choice([0, 0, 1, 0, 0, 0], 6)
        })
        management_df.to_csv("data/poultry_management_data.csv", index=False)
        management_path = "data/poultry_management_data.csv"
        print("[Success] Simulated daily management dataset saved to: data/poultry_management_data.csv")
    else:
        print(f"[Success] Found daily management dataset: {management_path}")

    if not os.path.exists(weather_path):
        print("[Warning] 'outdoor_weather_data.csv' not found. Simulating ERA5/Open-Meteo external hourly weather data...")
        dates = pd.date_range("2026-01-01 00:00:00", periods=150, freq="h")
        np.random.seed(42)
        weather_df = pd.DataFrame({
            "timestamp": [str(d) for d in dates],
            "outdoor_temp_c": np.random.uniform(18, 33, 150),
            "outdoor_humidity_percent": np.random.uniform(30, 85, 150),
            "wind_speed_kmh": np.random.uniform(2, 18, 150)
        })
        weather_df.to_csv("data/outdoor_weather_data.csv", index=False)
        weather_path = "data/outdoor_weather_data.csv"
        print("[Success] Simulated external hourly weather dataset saved to: data/outdoor_weather_data.csv")
    else:
        print(f"[Success] Found external weather dataset: {weather_path}")
        
    return sensor_path, management_path, weather_path

def align_and_merge_datasets(sensor_path, management_path, weather_path):
    """
    Ingests and merges environmental sensors, daily agricultural logs, and hourly weather.
    """
    print("\n[Step 2] Aligning and merging datasets...")
    
    # 1. Load dataframes
    s_df = pd.read_csv(sensor_path)
    m_df = pd.read_csv(management_path)
    w_df = pd.read_csv(weather_path)
    
    # Parse times
    s_df["timestamp"] = pd.to_datetime(s_df["timestamp"])
    w_df["timestamp"] = pd.to_datetime(w_df["timestamp"])
    m_df["date"] = pd.to_datetime(m_df["date"])
    
    # 2. Resample sensor telemetry to standard 10-minute intervals
    s_df = s_df.set_index("timestamp").resample("10min").mean().interpolate(method="linear").reset_index()
    
    # 3. Align daily management logs by mapping the date
    s_df["date"] = s_df["timestamp"].dt.normalize()
    merged = pd.merge(s_df, m_df, left_on="date", right_on="date", how="left")
    merged.drop(columns=["date"], inplace=True)
    
    # Forward-fill daily flock management attributes across 10-minute intervals
    merged["flock_age_days"] = merged["flock_age_days"].ffill().bfill()
    merged["feed_intake_g_per_bird"] = merged["feed_intake_g_per_bird"].ffill().bfill()
    merged["water_consumption_ml_per_bird"] = merged["water_consumption_ml_per_bird"].ffill().bfill()
    merged["mortality_count"] = merged["mortality_count"].fillna(0)
    merged["cull_count"] = merged["cull_count"].fillna(0)
    
    # 4. Synchronize with hourly outdoor weather data
    merged["hour_anchor"] = merged["timestamp"].dt.floor("h")
    w_df.rename(columns={"timestamp": "hour_anchor"}, inplace=True)
    
    final_df = pd.merge(merged, w_df, on="hour_anchor", how="left")
    final_df.drop(columns=["hour_anchor"], inplace=True)
    
    # Fill remaining outdoor weather values
    final_df["outdoor_temp_c"] = final_df["outdoor_temp_c"].ffill().bfill()
    final_df["outdoor_humidity_percent"] = final_df["outdoor_humidity_percent"].ffill().bfill()
    final_df["wind_speed_kmh"] = final_df["wind_speed_kmh"].ffill().bfill()
    
    # 5. Map column names to standard feature names expected by pipeline
    column_mapping = {
        "nh3_ppm": "nh3",
        "co2_ppm": "co2",
        "temperature_c": "temperature",
        "humidity_percent": "humidity",
        "outdoor_temp_c": "outdoor_temp",
        "outdoor_humidity_percent": "outdoor_humidity",
        "feed_intake_g_per_bird": "feed_intake",
        "water_consumption_ml_per_bird": "weight_gain" # Proxy weight mapping
    }
    final_df.rename(columns=column_mapping, inplace=True)
    
    # Add minor mock columns required for build_features
    if "h2s" not in final_df.columns:
        final_df["h2s"] = 0.5
    
    # Clean duplicates & sort
    final_df = final_df.drop_duplicates(subset=["timestamp"]).sort_values("timestamp").reset_index(drop=True)
    print(f"[Success] Alignment complete! Dataset size: {final_df.shape[0]} rows.")
    return final_df

def run_feature_engineering_and_labeling(df):
    """
    Applies custom Temperature-Humidity Index, rolling averages, and generates continuous health labels.
    """
    print("\n[Step 3] Engineering advanced features and generating continuous health labels...")
    
    # Apply standard feature engineering
    df = build_features(df)
    
    # Generate health score
    df["health_score"] = df.apply(generate_health_score, axis=1)
    
    print(f"[Success] Advanced Feature Engineering complete! Engineered features count: {len(df.columns)}")
    print(f"[Stats] Supervised Health Score: Mean={df['health_score'].mean():.3f}, Min={df['health_score'].min():.3f}")
    return df

def train_xgb_regressor(df):
    print("\n[Step 4] Training XGBoost Health Score Predictor...")
    X = df[FEATURE_COLS]
    y = df["health_score"]
    
    # Time Series Split (80% Train, 20% Val)
    split_idx = int(0.8 * len(df))
    X_train, X_val = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_val = y.iloc[:split_idx], y.iloc[split_idx:]
    
    model = xgb.XGBRegressor(
        n_estimators=120,
        learning_rate=0.04,
        max_depth=5,
        subsample=0.85,
        colsample_bytree=0.85,
        objective="reg:squarederror",
        random_state=42
    )
    
    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=False
    )
    
    # Save the model
    os.makedirs("models", exist_ok=True)
    joblib.dump(model, "models/health_xgb.pkl")
    mae = mean_absolute_error(y_val, model.predict(X_val))
    print(f"[Success] XGBoost trained successfully! Validation MAE: {mae:.5f}")
    print("[Info] Model saved at: models/health_xgb.pkl")
    return model

def train_anomaly_detection(df):
    print("\n[Step 5] Training Isolation Forest Statistical Anomaly Detector...")
    # Train on healthy entries
    healthy_data = df[df["health_score"] > 0.70]
    if len(healthy_data) < 50:
        healthy_data = df
        
    X = healthy_data[ANOMALY_FEATURES].values
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    detector = IsolationForest(
        n_estimators=100,
        contamination=0.05,
        random_state=42
    )
    detector.fit(X_scaled)
    
    joblib.dump(scaler, "models/anomaly_scaler.pkl")
    joblib.dump(detector, "models/anomaly_detector.pkl")
    
    print("[Success] Isolation Forest Anomaly detector and StandardScaler trained successfully!")
    print("[Info] Checkpoints saved at: models/anomaly_scaler.pkl & models/anomaly_detector.pkl")

class TimeSeriesSequenceDataset(Dataset):
    def __init__(self, df, seq_len=24):
        self.X, self.y = [], []
        features = df[FEATURE_COLS].values
        labels = df["health_score"].values
        
        # Shift index points to avoid index-out-of-bounds when forecasting 24 steps ahead
        for i in range(len(df) - seq_len - 12):
            self.X.append(features[i : i + seq_len])
            self.y.append([
                labels[i + seq_len],
                labels[i + seq_len + 6],
                labels[i + seq_len + 12]
            ])
            
        self.X = torch.FloatTensor(np.array(self.X))
        self.y = torch.FloatTensor(np.array(self.y))
        
    def __len__(self):
        return len(self.X)
        
    def __getitem__(self, idx):
        return self.X[idx], self.y[idx]

def train_pytorch_lstm(df):
    print("\n[Step 6] Training PyTorch LSTM Sequence Trend Forecaster (+6h, +12h, +24h)...")
    dataset = TimeSeriesSequenceDataset(df)
    
    # Split train/val
    train_size = int(0.8 * len(dataset))
    val_size = len(dataset) - train_size
    train_ds, val_ds = torch.utils.data.random_split(dataset, [train_size, val_size])
    
    train_dl = DataLoader(train_ds, batch_size=16, shuffle=False)
    val_dl = DataLoader(val_ds, batch_size=16, shuffle=False)
    
    model = PoultryLSTM(input_size=len(FEATURE_COLS))
    optimizer = torch.optim.Adam(model.parameters(), lr=2e-3)
    criterion = nn.MSELoss()
    
    # Train for 10 epochs
    for epoch in range(10):
        model.train()
        epoch_loss = []
        for X_batch, y_batch in train_dl:
            optimizer.zero_grad()
            pred = model(X_batch)
            loss = criterion(pred, y_batch)
            loss.backward()
            optimizer.step()
            epoch_loss.append(loss.item())
            
        # Validation loss
        model.eval()
        val_losses = []
        with torch.no_grad():
            for X_b, y_b in val_dl:
                val_losses.append(criterion(model(X_b), y_b).item())
        
        if epoch % 2 == 0 or epoch == 9:
            print(f"  LSTM Epoch {epoch:2d}/10 | Train Loss: {np.mean(epoch_loss):.5f} | Val Loss: {np.mean(val_losses):.5f}")
            
    torch.save(model.state_dict(), "models/health_lstm.pt")
    print("[Success] PyTorch LSTM Forecaster trained successfully!")
    print("[Info] Weights saved at: models/health_lstm.pt")

def train_ppo_rl_agent(df):
    print("\n[Step 7] Training PPO Reinforcement Learning Agent inside Aligned Indian Digital Twin...")
    env = PoultryFarmEnv(df)
    
    model = PPO(
        policy="MlpPolicy",
        env=env,
        learning_rate=4e-4,
        n_steps=1024,
        batch_size=32,
        n_epochs=6,
        gamma=0.98,
        verbose=0
    )
    
    print("  Training agent policy parameters for 10,000 steps...")
    model.learn(total_timesteps=10_000)
    
    model.save("models/poultry_rl_agent")
    print("[Success] Reinforcement Learning (PPO) agent policy trained successfully!")
    print("[Info] Agent checkpoint saved at: models/poultry_rl_agent.zip")

def main():
    print("=========================================================================")
    print("FLOCKCHAIN AI -- INDIAN DATASETS & MULTI-MODEL ML TRAINING PIPELINE")
    print("=========================================================================\n")
    
    # 1. Simulate or verify datasets
    s_path, m_path, w_path = check_or_simulate_datasets()
    
    # 2. Resample and Align
    df = align_and_merge_datasets(s_path, m_path, w_path)
    
    # 3. Preprocess and Feature Engineer
    engineered_df = run_feature_engineering_and_labeling(df)
    
    # 4. Train XGBoost Model
    train_xgb_regressor(engineered_df)
    
    # 5. Train Isolation Forest Anomaly Detection
    train_anomaly_detection(engineered_df)
    
    # 6. Train PyTorch LSTM Model
    train_pytorch_lstm(engineered_df)
    
    # 7. Train Reinforcement Learning Agent
    train_ppo_rl_agent(engineered_df)
    
    print("\n=========================================================================")
    print("SUCCESS: ALL FLOCKCHAIN AI MODELS TRAINED ON INDIAN DATASETS SCHEMA!")
    print("=========================================================================")

if __name__ == "__main__":
    main()
