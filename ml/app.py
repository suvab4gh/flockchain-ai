import os
import sys
import pandas as pd
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager

from inference import PoultryAI

# Global inference engine -- None means models not yet loaded
ai_engine: Optional[PoultryAI] = None
_startup_error: Optional[str] = None


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


@asynccontextmanager
async def lifespan(app: FastAPI):
    global ai_engine, _startup_error
    models_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
    required_files = [
        "health_xgb.pkl",
        "health_lstm.pt",
        "poultry_rl_agent.zip",
        "anomaly_scaler.pkl",
        "anomaly_detector.pkl",
    ]
    missing = [f for f in required_files if not os.path.exists(os.path.join(models_dir, f))]
    if missing:
        _startup_error = (
            f"Missing model checkpoints: {missing}. "
            "Run: python ml/train_indian_dataset_pipeline.py"
        )
        print(f"\n[FlockChain ML] WARNING: {_startup_error}")
        print("[FlockChain ML] Server starting WITHOUT models -- /predict will return 503.\n")
    else:
        try:
            ai_engine = PoultryAI(models_dir=models_dir)
            print("[FlockChain ML] All models loaded successfully.")
        except Exception as e:
            _startup_error = f"Model load error: {e}"
            print(f"[FlockChain ML] ERROR loading models: {e}")
    yield
    # shutdown: nothing to clean up


app = FastAPI(
    title="FlockChain AI -- Local ML Service",
    version="2.0.0",
    lifespan=lifespan,
)

# Allow Next.js dev server, Vercel deployments, and ngrok tunnels to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?|https://.*\.vercel\.app|https://.*\.ngrok-free\.app|https://.*\.ngrok\.io",
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {
        "status": "healthy" if ai_engine is not None else "degraded",
        "models_loaded": ai_engine is not None,
        "startup_error": _startup_error,
    }


@app.post("/predict")
def run_prediction(request: PredictRequest):
    if ai_engine is None:
        raise HTTPException(
            status_code=503,
            detail=_startup_error or "Inference engine not loaded. Run train_indian_dataset_pipeline.py first.",
        )
    if len(request.window) < 36:
        raise HTTPException(
            status_code=400,
            detail=f"Requires at least 36 historical readings. Received {len(request.window)}.",
        )
    try:
        df = pd.DataFrame([item.dict() for item in request.window])
        return ai_engine.predict(df)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=False)
