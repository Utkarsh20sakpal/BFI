"""
BFI ML Model Module
Loads and manages the Isolation Forest model — loaded ONCE at startup.
"""

import os
import logging
import numpy as np
import joblib
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "bfi_model.pkl")
SCALER_PATH = os.path.join(os.path.dirname(__file__), "bfi_scaler.pkl")

# Loaded once when module is imported
_model: IsolationForest | None = None
_scaler: StandardScaler | None = None


def _generate_training_data(n_samples: int = 5000) -> np.ndarray:
    """Generate synthetic banking transaction data for training."""
    import random
    data = []

    normal_count = int(n_samples * 0.80)
    for _ in range(normal_count):
        amount = np.random.lognormal(mean=9, sigma=1.5)
        hour = np.random.randint(8, 22)
        freq = np.random.randint(1, 10)
        account_age = np.random.randint(30, 3650)
        avg_tx = amount * np.random.uniform(0.7, 1.3)
        data.append([min(amount, 1_000_000), freq, account_age, avg_tx, hour, 0, 0])

    fraud_count = n_samples - normal_count
    for _ in range(fraud_count):
        pattern = random.choice(["large", "structuring", "rapid", "dormant"])
        if pattern == "large":
            amount = np.random.uniform(500_000, 2_000_000)
            freq = np.random.randint(1, 3)
            account_age = np.random.randint(30, 3650)
            avg_tx = np.random.uniform(5_000, 20_000)
        elif pattern == "structuring":
            amount = np.random.uniform(90_000, 99_999)
            freq = np.random.randint(5, 20)
            account_age = np.random.randint(30, 1000)
            avg_tx = np.random.uniform(10_000, 50_000)
        elif pattern == "rapid":
            amount = np.random.uniform(10_000, 100_000)
            freq = np.random.randint(15, 50)
            account_age = np.random.randint(10, 500)
            avg_tx = np.random.uniform(5_000, 50_000)
        else:
            amount = np.random.uniform(50_000, 500_000)
            freq = np.random.randint(1, 3)
            account_age = np.random.randint(365, 3650)
            avg_tx = np.random.uniform(1_000, 10_000)

        hour = random.choice([0, 1, 2, 3, 23])
        data.append([min(amount, 2_000_000), freq, account_age, avg_tx, hour, random.randint(0, 1),
                     1 if amount % 10_000 == 0 else 0])

    return np.array(data)


def _train_and_save() -> tuple[IsolationForest, StandardScaler]:
    """Train a fresh Isolation Forest, save artifacts, return model + scaler."""
    logger.info("Training new Isolation Forest model on synthetic data...")
    X = _generate_training_data(5000)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    model = IsolationForest(n_estimators=200, contamination=0.15, random_state=42, max_features=7, bootstrap=False)
    model.fit(X_scaled)
    joblib.dump(model, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    logger.info("Model trained and saved to disk.")
    return model, scaler


def load_model() -> None:
    """Load model from disk (or train if absent). Must be called once at startup."""
    global _model, _scaler
    if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
        try:
            _model = joblib.load(MODEL_PATH)
            _scaler = joblib.load(SCALER_PATH)
            logger.info("Model loaded from disk successfully.")
            return
        except Exception as exc:
            logger.warning("Failed to load saved model (%s). Retraining...", exc)

    _model, _scaler = _train_and_save()


def predict(
    transaction_amount: float,
    transaction_frequency: int,
    account_age: int,
    average_transaction_value: float,
    hour_of_day: int = 12,
    cross_border: int = 0,
    is_round_amount: int = 0,
) -> dict:
    """
    Run inference with the loaded model.
    Returns anomaly_score (0-100) and risk_level string.
    Raises RuntimeError if model not loaded.
    """
    if _model is None or _scaler is None:
        raise RuntimeError("Model not loaded. Call load_model() first.")

    feature_vector = np.array([[
        min(float(transaction_amount), 2_000_000),
        min(int(transaction_frequency), 50),
        int(account_age),
        float(average_transaction_value),
        int(hour_of_day),
        int(cross_border),
        int(is_round_amount),
    ]])

    X_scaled = _scaler.transform(feature_vector)
    raw_score = float(_model.score_samples(X_scaled)[0])

    # Convert: raw_score is typically in [-0.6, 0.1]; more negative = more anomalous
    anomaly_score = round(max(0.0, min(1.0, (-raw_score - 0.1) * 2.0)), 4)

    if anomaly_score >= 0.75:
        risk_level = "Critical"
    elif anomaly_score >= 0.55:
        risk_level = "High"
    elif anomaly_score >= 0.35:
        risk_level = "Medium"
    else:
        risk_level = "Low"

    return {"anomaly_score": anomaly_score, "risk_level": risk_level}


def is_loaded() -> bool:
    return _model is not None and _scaler is not None
