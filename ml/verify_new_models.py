import os
import sys
import pandas as pd
import numpy as np

# Ensure paths relative to ml/ work correctly
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from inference import PoultryAI

def test_inference_pipeline():
    print("[Verification] Loading trained models...")
    models_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
    ai_engine = PoultryAI(models_dir=models_dir)
    
    print("[Verification] Creating 50-step mock time-series data...")
    dates = pd.date_range("2026-05-21 12:00:00", periods=50, freq="10min")
    data = {
        "timestamp": [str(d) for d in dates],
        "nh3": np.random.uniform(10, 30, 50),
        "co2": np.random.uniform(800, 1500, 50),
        "temperature": np.random.uniform(22, 28, 50),
        "humidity": np.random.uniform(50, 70, 50),
        "outdoor_temp": np.random.uniform(25, 32, 50),
        "outdoor_humidity": np.random.uniform(40, 60, 50),
        "h2s": np.random.uniform(0.1, 1.0, 50),
        "feed_intake": np.random.uniform(115, 125, 50),
        "weight_gain": np.random.uniform(45, 55, 50),
        "mortality_count": np.zeros(50)
    }
    df = pd.DataFrame(data)
    
    print("[Verification] Running prediction...")
    result = ai_engine.predict(df)
    
    print("\n=========================================================")
    print("[Success] Inference test passed!")
    print("=========================================================")
    print(f"Health Score: {result['health_score']}")
    print(f"Risk Class: {result['risk_class']}")
    print(f"Forecast (+6h): {result['forecast_6h']}")
    print(f"Forecast (+12h): {result['forecast_12h']}")
    print(f"Forecast (+24h): {result['forecast_24h']}")
    print(f"Recommended Action: {result['recommended_action']}")
    print(f"Anomaly metrics: {result['anomaly']}")
    print("=========================================================\n")

if __name__ == "__main__":
    test_inference_pipeline()
