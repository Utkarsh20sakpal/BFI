"""
BFI Anomaly Detection — Pure NumPy Implementation
No scikit-learn needed. Works on Python 3.11–3.14+.

Implements a Statistical Ensemble Anomaly Detector combining:
  - Z-score deviation scoring per feature
  - Moving average behavioral baseline
  - Rule-based amplification for known fraud patterns
"""

import os
import json
import logging
import numpy as np

logger = logging.getLogger(__name__)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "bfi_model_params.json")

# Global model state — loaded once at startup
_params: dict | None = None


# ─── Training Data Generator ───────────────────────────────────────────────────
def _generate_training_data(n_samples: int = 5000) -> np.ndarray:
    """Generate synthetic normal + fraud transaction feature vectors."""
    import random
    rows = []

    normal_count = int(n_samples * 0.80)
    for _ in range(normal_count):
        amount     = float(np.clip(np.random.lognormal(9.0, 1.5), 100, 1_000_000))
        freq       = int(np.random.randint(1, 10))
        age        = int(np.random.randint(30, 3650))
        avg_tx     = float(amount * np.random.uniform(0.7, 1.3))
        hour       = int(np.random.randint(8, 22))
        cross      = 0
        is_round   = 0
        rows.append([amount, freq, age, avg_tx, hour, cross, is_round])

    fraud_count = n_samples - normal_count
    patterns = ["large", "structuring", "rapid", "dormant"]
    for _ in range(fraud_count):
        p = random.choice(patterns)
        if p == "large":
            amount, freq, age, avg_tx = np.random.uniform(500_000, 2_000_000), np.random.randint(1, 3), np.random.randint(30, 3650), np.random.uniform(5_000, 20_000)
        elif p == "structuring":
            amount, freq, age, avg_tx = np.random.uniform(90_000, 99_999), np.random.randint(5, 20), np.random.randint(30, 1000), np.random.uniform(10_000, 50_000)
        elif p == "rapid":
            amount, freq, age, avg_tx = np.random.uniform(10_000, 100_000), np.random.randint(15, 50), np.random.randint(10, 500), np.random.uniform(5_000, 50_000)
        else:
            amount, freq, age, avg_tx = np.random.uniform(50_000, 500_000), np.random.randint(1, 3), np.random.randint(365, 3650), np.random.uniform(1_000, 10_000)
        hour     = random.choice([0, 1, 2, 3, 23])
        cross    = random.randint(0, 1)
        is_round = 1 if float(amount) % 10_000 == 0 else 0
        rows.append([float(amount), int(freq), int(age), float(avg_tx), hour, cross, is_round])

    return np.array(rows, dtype=np.float64)


# ─── Model: Statistical Ensemble Anomaly Detector ────────────────────────────
def _fit(X: np.ndarray) -> dict:
    """Compute per-feature mean, std and percentile thresholds from training data."""
    mean = X.mean(axis=0).tolist()
    std  = X.std(axis=0).tolist()
    # Avoid zero-division for constant features
    std  = [max(s, 1e-6) for s in std]
    p95  = np.percentile(X, 95, axis=0).tolist()
    p05  = np.percentile(X, 5,  axis=0).tolist()
    return {"mean": mean, "std": std, "p95": p95, "p05": p05, "n_samples": len(X)}


def _anomaly_score(features: list[float], params: dict) -> float:
    """
    Compute an anomaly score in [0, 1] for a feature vector.
    Higher = more anomalous.
    """
    mean = np.array(params["mean"])
    std  = np.array(params["std"])
    p95  = np.array(params["p95"])
    p05  = np.array(params["p05"])
    x    = np.array(features, dtype=np.float64)

    # Feature weights: amount > frequency > hour > others
    weights = np.array([0.35, 0.20, 0.05, 0.15, 0.10, 0.05, 0.10])

    # Z-score deviation (capped at 4 sigma)
    z_scores = np.abs((x - mean) / std)
    z_scores = np.clip(z_scores, 0, 4) / 4.0          # normalize to [0, 1]

    # Extreme-value penalty: flag if beyond p95 or below p05
    extreme = ((x > p95) | (x < p05)).astype(float)

    # Combined score
    base_score = float(np.dot(z_scores * 0.6 + extreme * 0.4, weights))

    # Rule amplifiers for known fraud patterns
    amount, freq, average, hour = features[0], features[1], features[3], features[4]

    # Structuring: amount in 90k-99.9k range
    if 90_000 <= amount <= 99_999:
        base_score += 0.25

    # Large transaction
    if amount >= 500_000:
        base_score += 0.20
    elif amount >= 200_000:
        base_score += 0.10

    # Rapid transfers
    if freq >= 10:
        base_score += 0.15
    elif freq >= 5:
        base_score += 0.08

    # Abnormal hours (midnight–4am)
    if hour <= 3 or hour == 23:
        base_score += 0.10

    # Behavioral deviation: amount >> average
    if average > 0 and amount > average * 4:
        base_score += 0.15

    return float(min(1.0, base_score))


# ─── Public API ───────────────────────────────────────────────────────────────

def load_model() -> None:
    """Load params from disk or train fresh. Called once at startup."""
    global _params
    if os.path.exists(MODEL_PATH):
        try:
            with open(MODEL_PATH, "r") as f:
                _params = json.load(f)
            logger.info("✅ Model params loaded from %s", MODEL_PATH)
            return
        except Exception as exc:
            logger.warning("Failed to load model params (%s). Retraining...", exc)

    logger.info("🔄 Training anomaly detector on %d synthetic samples...", 5000)
    X = _generate_training_data(5000)
    _params = _fit(X)
    try:
        with open(MODEL_PATH, "w") as f:
            json.dump(_params, f)
        logger.info("✅ Model params saved to %s", MODEL_PATH)
    except Exception as exc:
        logger.warning("Could not save model params: %s", exc)


def predict(
    transaction_amount: float,
    transaction_frequency: int,
    account_age: int,
    average_transaction_value: float,
    hour_of_day: int = 12,
    cross_border: int = 0,
    is_round_amount: int = 0,
) -> dict:
    """Run inference. Returns anomaly_score (0–1 float) and risk_level string."""
    if _params is None:
        raise RuntimeError("Model not loaded. Call load_model() first.")

    features = [
        min(float(transaction_amount),  2_000_000),
        min(int(transaction_frequency), 50),
        int(account_age),
        float(average_transaction_value),
        int(hour_of_day),
        int(cross_border),
        int(is_round_amount),
    ]

    score = round(_anomaly_score(features, _params), 4)

    if score >= 0.75:
        risk_level = "Critical"
    elif score >= 0.55:
        risk_level = "High"
    elif score >= 0.35:
        risk_level = "Medium"
    else:
        risk_level = "Low"

    return {"anomaly_score": score, "risk_level": risk_level}


def retrain(n_samples: int = 5000) -> None:
    """Force retrain from scratch."""
    global _params
    logger.info("🔄 Retraining model with %d samples...", n_samples)
    X = _generate_training_data(n_samples)
    _params = _fit(X)
    try:
        with open(MODEL_PATH, "w") as f:
            json.dump(_params, f)
    except Exception:
        pass
    logger.info("✅ Model retrained.")


def is_loaded() -> bool:
    return _params is not None
