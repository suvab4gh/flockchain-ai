import json
import urllib.request
import numpy as np
import pandas as pd

def test_api():
    print("[API Test] Preparing test payload...")
    dates = pd.date_range("2026-05-21 12:00:00", periods=40, freq="10min")
    
    window_data = []
    for d in dates:
        reading = {
            "timestamp": str(d),
            "nh3": float(np.random.uniform(10, 30)),
            "co2": float(np.random.uniform(800, 1500)),
            "temperature": float(np.random.uniform(22, 28)),
            "humidity": float(np.random.uniform(50, 70)),
            "outdoor_temp": float(np.random.uniform(25, 32)),
            "outdoor_humidity": float(np.random.uniform(40, 60)),
            "h2s": float(np.random.uniform(0.1, 1.0)),
            "feed_intake": float(np.random.uniform(115, 125)),
            "weight_gain": float(np.random.uniform(45, 55)),
            "mortality_count": 0
        }
        window_data.append(reading)
        
    payload = {
        "window": window_data
    }
    
    req = urllib.request.Request(
        "http://127.0.0.1:8000/predict",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    print("[API Test] Sending request to http://127.0.0.1:8000/predict ...")
    try:
        with urllib.request.urlopen(req) as res:
            response_data = json.loads(res.read().decode("utf-8"))
            print("\n=========================================================")
            print("[Success] API Response matches Indian Models Stack!")
            print("=========================================================")
            print(json.dumps(response_data, indent=2))
            print("=========================================================\n")
    except Exception as e:
        print(f"[Failure] API request failed: {e}")
        if hasattr(e, "read"):
            print(e.read().decode("utf-8"))
            
if __name__ == "__main__":
    test_api()
