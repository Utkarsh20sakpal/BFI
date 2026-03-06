"""
BFI Transaction Simulation Engine
Generates realistic banking transactions with embedded fraud patterns
"""

import requests
import random
import time
import json
import argparse
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor

API_URL = "http://localhost:5000/api/transactions"
HEADERS = {"Content-Type": "application/json"}

# Account pools
NORMAL_ACCOUNTS = [f"ACC-{str(i).zfill(4)}" for i in range(1, 901)]
FRAUD_ACCOUNTS = [f"FRD-{str(i).zfill(4)}" for i in range(1, 101)]
ALL_ACCOUNTS = NORMAL_ACCOUNTS + FRAUD_ACCOUNTS

stats = {"sent": 0, "fraud": 0, "errors": 0}


def send_transaction(tx_data):
    """Send transaction to BFI API"""
    try:
        response = requests.post(API_URL, json=tx_data, headers=HEADERS, timeout=10)
        response.raise_for_status()
        data = response.json()
        stats["sent"] += 1
        if data.get("transaction", {}).get("isFraud"):
            stats["fraud"] += 1
        return data
    except Exception as e:
        stats["errors"] += 1
        return None


def generate_normal_transaction(base_time=None):
    """Generate realistic normal transaction"""
    sender = random.choice(NORMAL_ACCOUNTS)
    receiver = random.choice([a for a in ALL_ACCOUNTS if a != sender])

    # Realistic amount distribution (log-normal)
    amount = round(random.lognormvariate(9.0, 1.2), 2)
    amount = min(max(amount, 100), 500000)

    channels = ["UPI", "NEFT", "RTGS", "Mobile Banking", "Internet Banking"]
    channel_weights = [0.5, 0.2, 0.1, 0.15, 0.05]

    ts = base_time or datetime.now()
    # Randomize within business hours
    ts = ts.replace(hour=random.randint(8, 21), minute=random.randint(0, 59))

    return {
        "sender": sender,
        "receiver": receiver,
        "amount": amount,
        "timestamp": ts.isoformat(),
        "type": "transfer",
        "channel": random.choices(channels, channel_weights)[0],
        "description": random.choice([
            "Bill payment", "Online shopping", "Fund transfer",
            "Rent payment", "Salary advance", "Investment"
        ])
    }


def generate_layering_chain(base_time=None):
    """Generate layering fraud: A→B→C→D→E"""
    chain_length = random.randint(3, 6)
    chain = random.sample(FRAUD_ACCOUNTS, chain_length)
    amount = random.uniform(150000, 500000)
    ts = base_time or datetime.now()
    transactions = []

    for i in range(len(chain) - 1):
        tx_time = ts + timedelta(minutes=i * random.uniform(1, 5))
        transactions.append({
            "sender": chain[i],
            "receiver": chain[i + 1],
            "amount": round(amount * random.uniform(0.9, 1.0), 2),
            "timestamp": tx_time.isoformat(),
            "type": "transfer",
            "channel": "RTGS",
            "description": "Business transfer"
        })

    return transactions


def generate_structuring_batch(base_time=None):
    """Generate structuring: multiple transactions just below ₹1 Lakh"""
    sender = random.choice(FRAUD_ACCOUNTS)
    ts = base_time or datetime.now()
    transactions = []
    count = random.randint(3, 8)

    for i in range(count):
        tx_time = ts + timedelta(hours=i * random.uniform(1, 4))
        transactions.append({
            "sender": sender,
            "receiver": random.choice(NORMAL_ACCOUNTS),
            "amount": round(random.uniform(90000, 99990), 2),
            "timestamp": tx_time.isoformat(),
            "type": "transfer",
            "channel": "NEFT",
            "description": "Payment"
        })

    return transactions


def generate_circular_flow(base_time=None):
    """Generate circular transactions: A→B→C→A"""
    accounts = random.sample(FRAUD_ACCOUNTS, 3)
    amount = random.uniform(50000, 300000)
    ts = base_time or datetime.now()

    return [
        {"sender": accounts[0], "receiver": accounts[1], "amount": round(amount, 2),
         "timestamp": ts.isoformat(), "type": "transfer", "channel": "NEFT"},
        {"sender": accounts[1], "receiver": accounts[2], "amount": round(amount * 0.98, 2),
         "timestamp": (ts + timedelta(minutes=5)).isoformat(), "type": "transfer", "channel": "NEFT"},
        {"sender": accounts[2], "receiver": accounts[0], "amount": round(amount * 0.96, 2),
         "timestamp": (ts + timedelta(minutes=10)).isoformat(), "type": "transfer", "channel": "NEFT"},
    ]


def generate_rapid_transfers(base_time=None):
    """Generate rapid transfer pattern"""
    sender = random.choice(FRAUD_ACCOUNTS)
    ts = base_time or datetime.now()
    transactions = []
    count = random.randint(5, 12)

    for i in range(count):
        tx_time = ts + timedelta(minutes=i * random.uniform(0.5, 2))
        transactions.append({
            "sender": sender,
            "receiver": random.choice(NORMAL_ACCOUNTS),
            "amount": round(random.uniform(10000, 80000), 2),
            "timestamp": tx_time.isoformat(),
            "type": "transfer",
            "channel": random.choice(["UPI", "NEFT"]),
        })

    return transactions


def run_simulation(
    total_transactions=1000,
    fraud_rate=0.15,
    delay_ms=100,
    verbose=True,
    workers=3
):
    """Run full simulation"""
    print(f"\n{'='*60}")
    print(f"  BFI Transaction Simulation Engine v1.0")
    print(f"{'='*60}")
    print(f"  Total Transactions : {total_transactions}")
    print(f"  Fraud Rate         : {fraud_rate*100:.0f}%")
    print(f"  Delay (ms)         : {delay_ms}")
    print(f"  API Endpoint       : {API_URL}")
    print(f"{'='*60}\n")

    transactions_to_send = []
    fraud_count = int(total_transactions * fraud_rate)
    normal_count = total_transactions - fraud_count

    base_time = datetime.now() - timedelta(days=30)

    # Generate normal transactions
    for i in range(normal_count):
        ts = base_time + timedelta(minutes=i * 10)
        transactions_to_send.append(('normal', generate_normal_transaction(ts)))

    # Generate fraud transactions
    fraud_patterns = ['layering', 'structuring', 'circular', 'rapid']
    j = 0
    while j < fraud_count:
        pattern = random.choice(fraud_patterns)
        ts = base_time + timedelta(hours=random.randint(0, 700))

        if pattern == 'layering':
            txns = generate_layering_chain(ts)
        elif pattern == 'structuring':
            txns = generate_structuring_batch(ts)
        elif pattern == 'circular':
            txns = generate_circular_flow(ts)
        else:
            txns = generate_rapid_transfers(ts)

        for tx in txns:
            if j < fraud_count:
                transactions_to_send.append(('fraud', tx))
                j += 1

    # Shuffle to mix fraud and normal
    random.shuffle(transactions_to_send)

    print(f"📤 Sending {len(transactions_to_send)} transactions...\n")

    start_time = time.time()
    for i, (tx_type, tx_data) in enumerate(transactions_to_send):
        result = send_transaction(tx_data)

        if verbose and (i + 1) % 50 == 0:
            elapsed = time.time() - start_time
            rate = (i + 1) / elapsed
            print(f"  [{i+1:5d}/{len(transactions_to_send)}] "
                  f"Sent: {stats['sent']:4d} | "
                  f"Fraud: {stats['fraud']:3d} | "
                  f"Errors: {stats['errors']:2d} | "
                  f"Rate: {rate:.1f} tx/s")

        time.sleep(delay_ms / 1000)

    elapsed = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"  SIMULATION COMPLETE")
    print(f"{'='*60}")
    print(f"  Total Sent    : {stats['sent']}")
    print(f"  Fraud Detected: {stats['fraud']}")
    print(f"  Errors        : {stats['errors']}")
    print(f"  Time Elapsed  : {elapsed:.1f}s")
    print(f"  Throughput    : {stats['sent']/elapsed:.1f} tx/s")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="BFI Transaction Simulator")
    parser.add_argument("--transactions", type=int, default=500, help="Total transactions to send")
    parser.add_argument("--fraud-rate", type=float, default=0.15, help="Fraud rate (0-1)")
    parser.add_argument("--delay", type=int, default=50, help="Delay between transactions (ms)")
    parser.add_argument("--verbose", action="store_true", default=True)
    args = parser.parse_args()

    run_simulation(
        total_transactions=args.transactions,
        fraud_rate=args.fraud_rate,
        delay_ms=args.delay,
        verbose=args.verbose,
    )
