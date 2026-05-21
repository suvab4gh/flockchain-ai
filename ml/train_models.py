import os
import joblib
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
import xgboost as xgb
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_absolute_error
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from feature_engineering import build_features
from label_generator import generate_health_score

# Ensure models directory exists
os.makedirs(os.path.join(os.path.dirname(os.path.abspath(__file__)), "models"), exist_ok=True)

FEATURE_COLS = [
    "nh3", "co2", "temperature", "humidity",
    "nh3_roll1h", "nh3_roll6h", "co2_roll6h",
    "thi", "temp_delta", "humidity_delta",
    "nh3_zscore", "co2_zscore",
    "nh3_lag1", "nh3_lag6", "co2_lag1",
    "nh3_danger", "co2_danger", "heat_stress",
    "temp_roc", "nh3_roc"
]

ANOMALY_FEATURES = ["nh3", "co2", "nh3_zscore", "co2_zscore",
                    "nh3_roc", "co2_roc", "thi"]

def load_and_preprocess_data(csv_path: str) -> pd.DataFrame:
    print(f"Loading raw telemetry from: {csv_path}")
    df = pd.read_csv(csv_path)
    
    # Map raw synthetic columns to feature engineering expected names
    column_mapping = {
        "nh3_ppm": "nh3",
        "co2_ppm": "co2",
        "temperature_c": "temperature",
        "humidity_percent": "humidity",
        "outdoor_temp_c": "outdoor_temp",
        "outdoor_humidity_percent": "outdoor_humidity",
        "mortality_count": "mortality_count"
    }
    df = df.rename(columns=column_mapping)
    
    # Mock missing features required by build_features signature but not in synthetic CSV
    np.random.seed(42)
    if "h2s" not in df.columns:
        df["h2s"] = np.random.uniform(0.1, 1.8, size=len(df))
    if "feed_intake" not in df.columns:
        df["feed_intake"] = 120.0 + np.random.normal(0, 4.0, size=len(df))
    if "weight_gain" not in df.columns:
        df["weight_gain"] = 50.0 + np.random.normal(0, 1.5, size=len(df))
        
    return df

# --- XGBOOST TRAINING ---
def train_xgboost(df: pd.DataFrame):
    print("Training XGBoost Regressor...")
    X = df[FEATURE_COLS]
    y = df["health_score"]

    tscv = TimeSeriesSplit(n_splits=5)

    model = xgb.XGBRegressor(
        n_estimators=100, # Faster training for hackathon
        learning_rate=0.05,
        max_depth=6,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="reg:squarederror",
        early_stopping_rounds=15,
        eval_metric="mae",
        random_state=42
    )

    for train_idx, val_idx in tscv.split(X):
        X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
        y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]

    model.fit(X_train, y_train,
              eval_set=[(X_val, y_val)],
              verbose=False)

    model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "health_xgb.pkl")
    joblib.dump(model, model_path)
    mae = mean_absolute_error(y_val, model.predict(X_val))
    print(f"XGBoost model saved. MAE: {mae:.4f}")
    return model

# --- LSTM DATASET & MODEL ---
class FarmDataset(Dataset):
    def __init__(self, df, seq_len=24):
        self.X, self.y = [], []
        features = df[FEATURE_COLS].values
        labels   = df["health_score"].values

        # Ensure index-safety for multi-step predictions ahead (+0, +6, +12 steps)
        # i + seq_len + 12 < len(df) -> max i is len(df) - seq_len - 13
        for i in range(len(df) - seq_len - 12):
            self.X.append(features[i : i + seq_len])
            self.y.append([
                labels[i + seq_len],
                labels[i + seq_len + 6],
                labels[i + seq_len + 12]
            ])

        self.X = torch.FloatTensor(np.array(self.X))
        self.y = torch.FloatTensor(np.array(self.y))

    def __len__(self): return len(self.X)
    def __getitem__(self, i): return self.X[i], self.y[i]

class PoultryLSTM(nn.Module):
    def __init__(self, input_size, hidden_size=64, num_layers=2, output_steps=3):
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size,
                            num_layers=num_layers,
                            batch_first=True,
                            dropout=0.2)
        self.attention = nn.Linear(hidden_size, 1)
        self.fc = nn.Sequential(
            nn.Linear(hidden_size, 32),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(32, output_steps),
            nn.Sigmoid()
        )

    def forward(self, x):
        lstm_out, _ = self.lstm(x)
        attn_w = torch.softmax(self.attention(lstm_out), dim=1)
        context = (attn_w * lstm_out).sum(1)
        return self.fc(context)

def train_lstm(df: pd.DataFrame):
    print("Training PyTorch LSTM Forecaster...")
    dataset = FarmDataset(df)
    n_train = int(0.8 * len(dataset))
    train_ds, val_ds = torch.utils.data.random_split(
        dataset, [n_train, len(dataset) - n_train])

    train_dl = DataLoader(train_ds, batch_size=32, shuffle=False)
    val_dl   = DataLoader(val_ds,   batch_size=32, shuffle=False)

    model = PoultryLSTM(input_size=len(FEATURE_COLS))
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    criterion = nn.MSELoss()

    # Train for 15 epochs (efficient for local Windows running)
    for epoch in range(15):
        model.train()
        for X_batch, y_batch in train_dl:
            optimizer.zero_grad()
            loss = criterion(model(X_batch), y_batch)
            loss.backward()
            optimizer.step()

        model.eval()
        val_losses = []
        with torch.no_grad():
            for X_b, y_b in val_dl:
                val_losses.append(criterion(model(X_b), y_b).item())
        if epoch % 5 == 0 or epoch == 14:
            print(f"LSTM Epoch {epoch} | Val Loss: {np.mean(val_losses):.5f}")

    torch.save(model.state_dict(), os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "health_lstm.pt"))
    print("LSTM model saved at models/health_lstm.pt")
    return model

# --- ANOMALY DETECTOR ---
def train_anomaly_detector(df_normal: pd.DataFrame):
    print("Training Isolation Forest Anomaly Detector...")
    # Train on ONLY normal/healthy data so anomalies are highly detectable
    normal = df_normal[df_normal["health_score"] > 0.75]
    if len(normal) < 100:
        # Fallback to general data if not enough clean data
        normal = df_normal
        
    X = normal[ANOMALY_FEATURES].values

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    detector = IsolationForest(
        n_estimators=100,
        contamination=0.05,
        random_state=42
    )
    detector.fit(X_scaled)

    joblib.dump(scaler,   os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "anomaly_scaler.pkl"))
    joblib.dump(detector, os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "anomaly_detector.pkl"))
    print("Anomaly detector models saved at models/anomaly_scaler.pkl & anomaly_detector.pkl")
    return detector, scaler

if __name__ == "__main__":
    csv_path = "../data/poultry_telemetry_historical.csv"
    if not os.path.exists(csv_path):
        # Handle call from main project root
        csv_path = "data/poultry_telemetry_historical.csv"
        
    raw_df = load_and_preprocess_data(csv_path)
    
    # 1. Feature Engineering
    engineered_df = build_features(raw_df)
    
    # 2. Label Generation
    engineered_df["health_score"] = engineered_df.apply(generate_health_score, axis=1)
    
    print(f"Engineered dataset shape: {engineered_df.shape}")
    print(f"Health score distribution: mean={engineered_df['health_score'].mean():.3f}, std={engineered_df['health_score'].std():.3f}")
    
    # 3. Model Training
    train_xgboost(engineered_df)
    train_anomaly_detector(engineered_df)
    train_lstm(engineered_df)
    print("\n*** ALL STEP 3 & STEP 4 MODELS TRAINED SUCCESSFULLY! ***\n")
