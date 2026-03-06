"""
BFI ML Anomaly Detection Microservice
Uses Isolation Forest for unsupervised fraud detection
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import joblib
import os
import json
import random
from datetime import datetime
import uvicorn

app = FastAPI(
    title="BFI ML Anomaly Detection Service",
    description="Isolation Forest-based fraud anomaly detection",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for production flexibility (can be restricted via firewall/env)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Model storage
model = None
scaler = None
MODEL_PATH = "bfi_model.pkl"
SCALER_PATH = "bfi_scaler.pkl"

# Feature history for online learning
feature_history = []


class TransactionRequest(BaseModel):
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


def load_or_create_model():
    """Load existing model or create and train a new one"""
    global model, scaler

    if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
        try:
            model = joblib.load(MODEL_PATH)
            scaler = joblib.load(SCALER_PATH)
            print("✅ Model loaded from disk")
            return
        except Exception as e:
            print(f"⚠️ Failed to load model: {e}")

    # Generate synthetic training data
    print("🔄 Training new Isolation Forest model...")
    train_model_with_synthetic_data()


def generate_training_data(n_samples=5000):
    """Generate synthetic banking transaction data for training"""
    data = []

    # Normal transactions (80%)
    normal_count = int(n_samples * 0.80)
    for _ in range(normal_count):
        amount = np.random.lognormal(mean=9, sigma=1.5)  # ~₹8k normal
        hour = np.random.choice(range(8, 22), p=None)  # business hours
        freq = np.random.randint(1, 10)
        account_age = np.random.randint(30, 3650)  # 1 month to 10 years
        avg_tx = amount * np.random.uniform(0.7, 1.3)

        data.append([
            min(amount, 1000000),
            freq,
            account_age,
            avg_tx,
            hour,
            0,  # cross_border
            0,  # is_round_amount
        ])

    # Fraudulent transactions (20%)
    fraud_count = n_samples - normal_count
    for _ in range(fraud_count):
        pattern = random.choice(['large', 'structuring', 'rapid', 'dormant'])

        if pattern == 'large':
            amount = np.random.uniform(500000, 2000000)
            freq = np.random.randint(1, 3)
            account_age = np.random.randint(30, 3650)
            avg_tx = np.random.uniform(5000, 20000)
        elif pattern == 'structuring':
            amount = np.random.uniform(90000, 99999)
            freq = np.random.randint(5, 20)
            account_age = np.random.randint(30, 1000)
            avg_tx = np.random.uniform(10000, 50000)
        elif pattern == 'rapid':
            amount = np.random.uniform(10000, 100000)
            freq = np.random.randint(15, 50)
            account_age = np.random.randint(10, 500)
            avg_tx = np.random.uniform(5000, 50000)
        else:  # dormant
            amount = np.random.uniform(50000, 500000)
            freq = np.random.randint(1, 3)
            account_age = np.random.randint(365, 3650)
            avg_tx = np.random.uniform(1000, 10000)

        hour = np.random.choice([0, 1, 2, 3, 23])  # odd hours
        data.append([
            min(amount, 2000000),
            freq,
            account_age,
            avg_tx,
            hour,
            random.randint(0, 1),
            1 if amount % 10000 == 0 else 0,
        ])

    return np.array(data)


def train_model_with_synthetic_data(n_samples=5000):
    """Train Isolation Forest on synthetic data"""
    global model, scaler

    X = generate_training_data(n_samples)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = IsolationForest(
        n_estimators=200,
        contamination=0.15,
        random_state=42,
        max_features=7,
        bootstrap=False,
    )
    model.fit(X_scaled)

    # Save model
    joblib.dump(model, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    print(f"✅ Model trained on {n_samples} samples and saved")


def extract_features(transaction: TransactionRequest) -> dict:
    """Extract ML features from transaction"""
    amount = transaction.transaction_amount
    hour = 12  # default
    if transaction.timestamp:
        try:
            dt = datetime.fromisoformat(transaction.timestamp.replace('Z', '+00:00'))
            hour = dt.hour
        except:
            pass

    # Use historical context if available
    avg_tx = np.mean([f[0] for f in feature_history[-100:]]) if feature_history else amount
    freq = len([f for f in feature_history[-50:] if f[1] == transaction.sender]) if transaction.sender else 1
    account_age = 365  # default

    is_round = 1 if amount >= 50000 and amount % 10000 == 0 else 0

    return {
        "transaction_amount": min(amount, 2000000),
        "transaction_frequency": min(freq + 1, 50),
        "account_age": account_age,
        "average_transaction_value": avg_tx,
        "hour_of_day": hour,
        "cross_border": 0,
        "is_round_amount": is_round,
    }


@app.on_event("startup")
async def startup():
    load_or_create_model()
    print("🚀 BFI ML Service started on port 8001")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "training_samples": len(feature_history),
        "service": "BFI ML Anomaly Detection",
    }


@app.post("/predict", response_model=PredictionResponse)
def predict(request: TransactionRequest):
    """Predict anomaly score for a transaction"""
    if model is None or scaler is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    features = extract_features(request)
    feature_vector = np.array([[
        features["transaction_amount"],
        features["transaction_frequency"],
        features["account_age"],
        features["average_transaction_value"],
        features["hour_of_day"],
        features["cross_border"],
        features["is_round_amount"],
    ]])

    # Store for online context
    feature_history.append([features["transaction_amount"], request.sender])
    if len(feature_history) > 1000:
        feature_history.pop(0)

    X_scaled = scaler.transform(feature_vector)

    # Isolation Forest score: -1=anomaly, 1=normal
    raw_score = model.score_samples(X_scaled)[0]
    prediction = model.predict(X_scaled)[0]

    # Convert to 0-100 anomaly score (higher = more anomalous)
    # Raw scores typically in range [-0.6, 0.1]
    anomaly_score = max(0, min(100, int((-raw_score - 0.1) * 200)))
    is_anomaly = prediction == -1

    # Confidence: how far from decision boundary
    confidence = min(0.99, abs(raw_score) * 3)

    return PredictionResponse(
        transaction_id=request.transaction_id or "unknown",
        anomaly_score=anomaly_score,
        is_anomaly=is_anomaly,
        confidence=round(confidence, 3),
        features_used=features,
    )


@app.post("/train")
def train(request: TrainRequest):
    """Retrain model with fresh synthetic data"""
    train_model_with_synthetic_data(request.n_samples)
    return {
        "success": True,
        "message": f"Model retrained with {request.n_samples} samples",
        "model_params": {
            "algorithm": "Isolation Forest",
            "n_estimators": 200,
            "contamination": 0.15,
        }
    }


@app.get("/evaluate")
def evaluate():
    """Return model evaluation metrics (using known test patterns)"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    # Generate test set
    X_test = generate_training_data(1000)
    # Last 200 are fraud patterns
    y_true = [0] * 800 + [1] * 200

    X_scaled = scaler.transform(X_test)
    predictions = model.predict(X_scaled)
    y_pred = [1 if p == -1 else 0 for p in predictions]

    # Calculate metrics
    tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
    fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
    tn = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 0)
    fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
    accuracy = (tp + tn) / len(y_true)

    return {
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1, 4),
        "confusion_matrix": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
        "test_samples": len(y_true),
        "model": "Isolation Forest",
    }


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
