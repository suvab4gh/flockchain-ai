import pandas as pd
import numpy as np

def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Input df columns: timestamp, nh3, co2, h2s, temperature, humidity,
                      outdoor_temp, outdoor_humidity, feed_intake,
                      weight_gain, mortality_count
    """
    df = df.sort_values("timestamp").copy()

    # --- Rolling averages (1h, 6h, 24h windows) ---
    for col in ["nh3", "co2", "temperature", "humidity"]:
        df[f"{col}_roll1h"]  = df[col].rolling(6).mean()   # 6 x 10min = 1h (or 6 steps)
        df[f"{col}_roll6h"]  = df[col].rolling(36).mean()
        df[f"{col}_roll24h"] = df[col].rolling(144).mean()

    # --- Lag features (previous readings as context) ---
    for col in ["nh3", "co2", "temperature"]:
        for lag in [1, 3, 6, 12]:
            df[f"{col}_lag{lag}"] = df[col].shift(lag)

    # --- Anomaly z-scores (deviation from rolling mean) ---
    for col in ["nh3", "co2"]:
        roll_mean = df[col].rolling(36).mean()
        roll_std  = df[col].rolling(36).std().replace(0, 1)
        df[f"{col}_zscore"] = (df[col] - roll_mean) / roll_std

    # --- Heat Stress Index (THI — Temperature Humidity Index) ---
    T = df["temperature"]
    RH = df["humidity"]
    df["thi"] = (1.8 * T + 32) - (0.55 - 0.0055 * RH) * (1.8 * T - 26.8)
    # THI > 72: mild stress, > 79: severe stress, > 84: critical

    # --- Weather delta features ---
    df["temp_delta"]     = df["temperature"] - df["outdoor_temp"]
    df["humidity_delta"] = df["humidity"]    - df["outdoor_humidity"]
    df["temp_roc"]       = df["temperature"].diff()   # rate of change
    df["nh3_roc"]        = df["nh3"].diff()
    df["co2_roc"]        = df["co2"].diff()

    # --- Binary threshold flags (useful for tree models) ---
    df["nh3_danger"]   = (df["nh3"] > 25).astype(int)
    df["co2_danger"]   = (df["co2"] > 3000).astype(int)
    df["heat_stress"]  = (df["thi"] > 72).astype(int)

    # Use backfill and forward fill to handle NaNs near boundaries,
    # ensuring we retain the full length of the input window for sequential predictions.
    df.bfill(inplace=True)
    df.ffill(inplace=True)
    df.fillna(0, inplace=True)
    return df

