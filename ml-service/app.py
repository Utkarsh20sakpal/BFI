"""
BFI ML Anomaly Detection Microservice — Production Build
Uses Isolation Forest (loaded once at startup) for fraud anomaly scoring.
"""

import logging
import os
import random
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

import model as ml_model

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("bfi-ml")


# ─── Lifespan: load model ONCE at startup ─────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 BFI ML Service starting — loading model...")
    ml_model.load_model()
    logger.info("✅ Model ready. Service is live.")
    yield
    logger.info("🛑 BFI ML Service shutting down.")


# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="BFI ML Anomaly Detection Service",
    description="Isolation Forest-based fraud anomaly detection for BFI platform",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Open to allow dashboard to hit /evaluate directly
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    """Health check endpoint for Render/Backend."""
    return {
        "status": "ok",
        "model_loaded": ml_model.is_loaded(),
        "timestamp": datetime.now().isoformat()
    }


# ─── Schemas ──────────────────────────────────────────────────────────────────
class PredictRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Transaction amount in INR")
    frequency: int = Field(1, ge=1, le=200, description="Recent transaction frequency")
    account_age: int = Field(365, ge=0, description="Account age in days")
    avg_txn: float = Field(0, ge=0, description="Average transaction value")
    hour: Optional[int] = Field(None, ge=0, le=23, description="Hour of transaction (0-23)")
    cross_border: Optional[int] = Field(0, ge=0, le=1)
    is_round_amount: Optional[int] = Field(None, description="Auto-detected if not provided")

    @field_validator("amount")
    @classmethod
    def amount_must_be_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Transaction amount must be positive")
        return v


class PredictResponse(BaseModel):
    anomaly_score: float
    risk_level: str


class TransactionRequest(BaseModel):
    """Legacy schema maintained for backward-compat with BFI backend."""
    transaction_amount: float
    transaction_id: Optional[str] = None
    sender: Optional[str] = None
    receiver: Optional[str] = None
    timestamp: Optional[str] = None


class PredictionResponse(BaseModel):
    transaction_id: str
    anomaly_score: float
    is_anomaly: bool
    confidence: float
    features_used: dict


class TrainRequest(BaseModel):
    n_samples: Optional[int] = 5000


# Feature accumulator for online context (in-memory, per process)
_feature_history: list = []


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    """Health check — used by Render and the BFI System Health dashboard."""
    loaded = ml_model.is_loaded()
    return {
        "status": "ML service running",
        "model_loaded": loaded,
        "service": "BFI ML Anomaly Detection",
        "version": "2.0.0",
    }


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    """
    New clean prediction endpoint.
    Called from the BFI fraud detection engine via ML_SERVICE_URL.
    """
    if not ml_model.is_loaded():
        raise HTTPException(status_code=503, detail="Model not loaded yet. Retry shortly.")

    # Auto-detect round amount if not provided
    is_round = req.is_round_amount if req.is_round_amount is not None else (
        1 if req.amount >= 50_000 and req.amount % 10_000 == 0 else 0
    )
    hour = req.hour if req.hour is not None else datetime.now().hour

    logger.info(
        "Prediction request | amount=%.2f freq=%d age=%d",
        req.amount, req.frequency, req.account_age,
    )

    try:
        result = ml_model.predict(
            transaction_amount=req.amount,
            transaction_frequency=req.frequency,
            account_age=req.account_age,
            average_transaction_value=req.avg_txn or req.amount,
            hour_of_day=hour,
            cross_border=req.cross_border or 0,
            is_round_amount=is_round,
        )
    except Exception as exc:
        logger.error("Model inference error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Inference error: {exc}")

    logger.info(
        "Prediction result | score=%.4f risk=%s",
        result["anomaly_score"], result["risk_level"]
    )
    return PredictResponse(**result)


@app.post("/predict/legacy", response_model=PredictionResponse)
def predict_legacy(request: TransactionRequest):
    """
    Legacy prediction endpoint — backward-compatible with existing BFI backend calls.
    The backend currently sends `transaction_amount`, `sender`, `timestamp` etc.
    """
    global _feature_history

    if not ml_model.is_loaded():
        raise HTTPException(status_code=503, detail="Model not loaded")

    amount = request.transaction_amount
    hour = 12
    if request.timestamp:
        try:
            dt = datetime.fromisoformat(request.timestamp.replace("Z", "+00:00"))
            hour = dt.hour
        except Exception:
            pass

    avg_tx = float(sum(f[0] for f in _feature_history[-100:]) / max(1, len(_feature_history[-100:]))) if _feature_history else amount
    freq = len([f for f in _feature_history[-50:] if f[1] == request.sender]) if request.sender else 1
    is_round = 1 if amount >= 50_000 and amount % 10_000 == 0 else 0

    try:
        result = ml_model.predict(
            transaction_amount=amount,
            transaction_frequency=freq + 1,
            account_age=365,
            average_transaction_value=avg_tx,
            hour_of_day=hour,
            cross_border=0,
            is_round_amount=is_round,
        )
    except Exception as exc:
        logger.error("Legacy inference error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Inference error: {exc}")

    # Update feature history
    _feature_history.append([amount, request.sender])
    if len(_feature_history) > 1000:
        _feature_history.pop(0)

    anomaly_score_0_100 = round(result["anomaly_score"] * 100)
    is_anomaly = result["risk_level"] in ("High", "Critical")
    confidence = round(min(0.99, result["anomaly_score"] * 1.2), 3)

    return PredictionResponse(
        transaction_id=request.transaction_id or "unknown",
        anomaly_score=anomaly_score_0_100,
        is_anomaly=is_anomaly,
        confidence=confidence,
        features_used={
            "transaction_amount": min(amount, 2_000_000),
            "transaction_frequency": min(freq + 1, 50),
            "account_age": 365,
            "average_transaction_value": avg_tx,
            "hour_of_day": hour,
            "cross_border": 0,
            "is_round_amount": is_round,
        },
    )


@app.post("/train")
def train(request: TrainRequest):
    """Force retrain model with fresh synthetic data."""
    try:
        ml_model.retrain(request.n_samples or 5000)
        return {
            "success": True,
            "message": f"Model retrained with {request.n_samples} samples",
            "model_params": {"algorithm": "Statistical Ensemble Anomaly Detector", "features": 7},
        }
    except Exception as exc:
        logger.error("Retraining failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/evaluate")
def evaluate():
    """Return model evaluation metrics using synthetic test data."""
    if not ml_model.is_loaded():
        raise HTTPException(status_code=503, detail="Model not loaded")

    from model import _generate_training_data, _anomaly_score, _params

    X_test = _generate_training_data(1000)
    y_true = [0] * 800 + [1] * 200  # last 200 are fraud patterns

    tp, fp, tn, fn = 0, 0, 0, 0
    for i, row in enumerate(X_test):
        score = _anomaly_score(row.tolist(), _params)
        predicted_fraud = score >= 0.55
        actual_fraud = i >= 800
        if predicted_fraud and actual_fraud: tp += 1
        elif predicted_fraud and not actual_fraud: fp += 1
        elif not predicted_fraud and not actual_fraud: tn += 1
        else: fn += 1

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall    = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1        = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
    accuracy  = (tp + tn) / len(y_true)

    return {
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1, 4),
        "confusion_matrix": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
        "test_samples": len(y_true),
        "model": "Statistical Ensemble Anomaly Detector",
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
