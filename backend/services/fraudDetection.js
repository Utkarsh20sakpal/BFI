/**
 * BFI Fraud Detection Engine
 * Layer 1: Rule-based detection
 * Combines with ML anomaly score for final risk scoring
 */

const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const Alert = require('../models/Alert');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const THRESHOLDS = {
    LARGE_TRANSACTION: 200000,     // ₹2 Lakh
    RAPID_TRANSFER_WINDOW: 10,     // minutes
    RAPID_TRANSFER_COUNT: 3,       // transfers in window
    STRUCTURING_LOWER: 90000,      // Just below ₹1 Lakh (reporting threshold)
    STRUCTURING_UPPER: 99999,
    DORMANT_DAYS: 90,              // 90 days of inactivity
    CIRCULAR_DEPTH: 4,             // hop depth for circular detection
    RISK_THRESHOLD_ALERT: 60,      // Score above which alert is created
    ROUND_AMOUNT_THRESHOLD: 50000,
};

const RISK_SCORES = {
    LARGE_TRANSACTION: 55,
    RAPID_TRANSFERS: 60,
    STRUCTURING: 55,
    DORMANT_ACCOUNT: 40,
    CIRCULAR_FLOW: 65,
    LAYERING: 65,
    ML_ANOMALY: 50,
    ROUND_AMOUNT: 20,
    DEVICE_RISK: 35,
    GEO_RISK: 45,
    BEHAVIOR_RISK: 40,
};

/**
 * Main fraud detection pipeline
 */
async function analyzeTransaction(transaction) {
    const flags = [];
    let ruleScore = 0;

    // Run all rule checks in parallel
    const [
        largeCheck,
        rapidCheck,
        structuringCheck,
        dormantCheck,
        circularCheck,
        layeringCheck,
        roundCheck,
        deviceCheck,
        geoCheck,
        behaviorCheck,
    ] = await Promise.all([
        checkLargeTransaction(transaction),
        checkRapidTransfers(transaction),
        checkStructuring(transaction),
        checkDormantAccount(transaction),
        checkCircularFlow(transaction),
        checkLayering(transaction),
        checkRoundAmount(transaction),
        checkDeviceRisk(transaction),
        checkGeoRisk(transaction),
        checkBehaviorRisk(transaction),
    ]);

    if (largeCheck) { flags.push('large_transaction'); ruleScore += RISK_SCORES.LARGE_TRANSACTION; }
    if (rapidCheck) { flags.push('rapid_transfer'); ruleScore += RISK_SCORES.RAPID_TRANSFERS; }
    if (structuringCheck) { flags.push('structuring'); ruleScore += RISK_SCORES.STRUCTURING; }
    if (dormantCheck) { flags.push('dormant_account'); ruleScore += RISK_SCORES.DORMANT_ACCOUNT; }
    if (circularCheck) { flags.push('circular_flow'); ruleScore += RISK_SCORES.CIRCULAR_FLOW; }
    if (layeringCheck) { flags.push('layering'); ruleScore += RISK_SCORES.LAYERING; }
    if (roundCheck) { flags.push('round_amount'); ruleScore += RISK_SCORES.ROUND_AMOUNT; }
    if (deviceCheck) { flags.push('device_risk'); ruleScore += RISK_SCORES.DEVICE_RISK; }
    if (geoCheck) { flags.push('geo_risk'); ruleScore += RISK_SCORES.GEO_RISK; }
    if (behaviorCheck) { flags.push('behavior_anomaly'); ruleScore += RISK_SCORES.BEHAVIOR_RISK; }

    // Cap rule score at 100
    ruleScore = Math.min(ruleScore, 100);

    // Get ML anomaly score
    let mlScore = 0;
    try {
        mlScore = await getMLAnomalyScore(transaction);
        if (mlScore > 50) flags.push('ml_anomaly');
    } catch (err) {
        // ML service unavailable - continue with rule score only
        mlScore = 0;
    }

    // Final combined risk score: Balance ML and Rules correctly so normals pass and frauds flag
    let finalRiskScore = Math.round((0.6 * ruleScore) + (0.4 * mlScore));

    // If strong analytical structural rules trigger, strictly enforce the alert threshold over 60
    if (ruleScore >= 40) {
        finalRiskScore = Math.max(finalRiskScore, ruleScore + 15);
    }

    finalRiskScore = Math.min(100, finalRiskScore);

    // Determine fraud type
    let fraudType = determineFraudType(flags);

    // Determine if fraud
    const isFraud = finalRiskScore >= RISK_THRESHOLD_ALERT_BOUNDARY();

    return {
        ruleScore,
        mlScore,
        riskScore: finalRiskScore,
        flags,
        fraudType,
        isFraud,
    };
}

function RISK_THRESHOLD_ALERT_BOUNDARY() {
    return THRESHOLDS.RISK_THRESHOLD_ALERT;
}

function determineFraudType(flags) {
    if (flags.includes('layering')) return 'Layering';
    if (flags.includes('circular_flow')) return 'Circular Flow';
    if (flags.includes('structuring')) return 'Structuring';
    if (flags.includes('dormant_account')) return 'Dormant Account';
    if (flags.includes('geo_risk') && flags.includes('device_risk')) return 'Account Takeover';
    if (flags.includes('large_transaction') && flags.includes('rapid_transfer')) return 'Rapid Transfer';
    if (flags.includes('behavior_anomaly')) return 'Behavioral Anomaly';
    if (flags.includes('large_transaction')) return 'Large Transaction';
    if (flags.length > 1) return 'Multiple Flags';
    return null;
}

/**
 * Rule 1: Large transaction detection
 */
async function checkLargeTransaction(transaction) {
    return transaction.amount >= THRESHOLDS.LARGE_TRANSACTION;
}

/**
 * Rule 2: Rapid transfers - many transfers in short window
 */
async function checkRapidTransfers(transaction) {
    const windowStart = new Date(transaction.timestamp);
    windowStart.setMinutes(windowStart.getMinutes() - THRESHOLDS.RAPID_TRANSFER_WINDOW);

    const count = await Transaction.countDocuments({
        sender: transaction.sender,
        timestamp: { $gte: windowStart, $lte: new Date(transaction.timestamp) },
        transactionId: { $ne: transaction.transactionId },
    });

    return count >= THRESHOLDS.RAPID_TRANSFER_COUNT;
}

/**
 * Rule 3: Structuring (smurfing) - multiple transactions just below reporting threshold
 */
async function checkStructuring(transaction) {
    if (transaction.amount < THRESHOLDS.STRUCTURING_LOWER || transaction.amount > THRESHOLDS.STRUCTURING_UPPER) {
        return false;
    }

    const windowStart = new Date(transaction.timestamp);
    windowStart.setHours(windowStart.getHours() - 24);

    const count = await Transaction.countDocuments({
        sender: transaction.sender,
        amount: { $gte: THRESHOLDS.STRUCTURING_LOWER, $lte: THRESHOLDS.STRUCTURING_UPPER },
        timestamp: { $gte: windowStart, $lte: new Date(transaction.timestamp) },
        transactionId: { $ne: transaction.transactionId },
    });

    return count >= 2;
}

/**
 * Rule 4: Dormant account reactivation
 */
async function checkDormantAccount(transaction) {
    const dormantDate = new Date(transaction.timestamp);
    dormantDate.setDate(dormantDate.getDate() - THRESHOLDS.DORMANT_DAYS);

    const account = await Account.findOne({ accountId: transaction.sender });
    if (!account) return false;

    return account.lastActivity && account.lastActivity < dormantDate && transaction.amount > 10000;
}

/**
 * Rule 5: Circular flow detection
 */
async function checkCircularFlow(transaction) {
    // Simplified: check if receiver has sent to sender recently
    const windowStart = new Date(transaction.timestamp);
    windowStart.setHours(windowStart.getHours() - 24);

    const reverseFlow = await Transaction.findOne({
        sender: transaction.receiver,
        receiver: transaction.sender,
        timestamp: { $gte: windowStart },
    });

    return !!reverseFlow;
}

/**
 * Rule 6: Layering detection - A→B→C chain
 */
async function checkLayering(transaction) {
    // Check if sender received money from someone else recently and is now sending
    const windowStart = new Date(transaction.timestamp);
    windowStart.setMinutes(windowStart.getMinutes() - 30);

    const previousIncoming = await Transaction.findOne({
        receiver: transaction.sender,
        timestamp: { $gte: windowStart, $lte: new Date(transaction.timestamp) },
    });

    if (!previousIncoming) return false;

    // Check if amount is roughly similar (layering passes similar amounts)
    const amountRatio = transaction.amount / previousIncoming.amount;
    return amountRatio >= 0.7 && amountRatio <= 1.0;
}

/**
 * Rule 7: Round amount detection
 */
async function checkRoundAmount(transaction) {
    return transaction.amount >= THRESHOLDS.ROUND_AMOUNT_THRESHOLD && (transaction.amount % 10000 === 0);
}

/**
 * Rule 8: Device Risk Detection
 */
async function checkDeviceRisk(transaction) {
    const account = await Account.findOne({ accountId: transaction.sender });
    if (!account) return false;

    // Flag if new untrusted device or IP
    let isRisk = false;
    if (transaction.deviceId && account.trustedDevices && account.trustedDevices.length > 0 && !account.trustedDevices.includes(transaction.deviceId)) {
        isRisk = true;
    }
    if (transaction.ipAddress && account.trustedIps && account.trustedIps.length > 0 && !account.trustedIps.includes(transaction.ipAddress)) {
        isRisk = true;
    }
    return isRisk;
}

/**
 * Rule 9: Geo Location Risk (Impossible Travel)
 */
async function checkGeoRisk(transaction) {
    const lastTx = await Transaction.findOne({ sender: transaction.sender, transactionId: { $ne: transaction.transactionId } }).sort({ timestamp: -1 });
    if (!lastTx || !lastTx.ipAddress || !transaction.ipAddress) return false;
    if (lastTx.ipAddress === transaction.ipAddress) return false;

    // Simulate impossible travel: if IP changed and time difference is small (< 120 minutes)
    const timeDiffMinutes = (new Date(transaction.timestamp) - new Date(lastTx.timestamp)) / (1000 * 60);
    if (timeDiffMinutes < 120 && timeDiffMinutes >= 0) {
        return true;
    }
    return false;
}

/**
 * Rule 10: Behavior Profiling Anomaly
 */
async function checkBehaviorRisk(transaction) {
    const account = await Account.findOne({ accountId: transaction.sender });
    if (!account || account.totalTransactions < 3) return false; // Need history

    // Deviation from normal behavior: amount is 3x the average and more than ₹10,000
    if (transaction.amount > 10000 && account.avgTransactionAmount > 0) {
        if (transaction.amount > account.avgTransactionAmount * 3) {
            return true;
        }
    }
    return false;
}

/**
 * Get ML anomaly score from Python microservice
 */
async function getMLAnomalyScore(transaction) {
    const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';

    const response = await axios.post(`${ML_URL}/predict`, {
        transaction_amount: transaction.amount,
        transaction_id: transaction.transactionId,
        sender: transaction.sender,
        receiver: transaction.receiver,
        timestamp: transaction.timestamp,
    }, { timeout: 3000 });

    return response.data.anomaly_score || 0;
}

/**
 * Create fraud alert if risk score exceeds threshold
 */
async function createAlertIfNeeded(transaction, analysisResult, io) {
    if (!analysisResult.isFraud || !analysisResult.fraudType) return null;

    const { v4: makeId } = require('uuid');
    const alertId = `ALT-${Date.now().toString(36).toUpperCase()}-${makeId().slice(0, 6).toUpperCase()}`;

    const riskLevel = analysisResult.riskScore >= 85 ? 'critical'
        : analysisResult.riskScore >= 70 ? 'high'
            : analysisResult.riskScore >= 40 ? 'medium' : 'low';

    const alert = new Alert({
        alertId,
        accountId: transaction.sender,
        transactionIds: [transaction.transactionId],
        fraudType: analysisResult.fraudType,
        riskScore: analysisResult.riskScore,
        riskLevel,
        flags: analysisResult.flags,
        totalAmount: transaction.amount,
        transactionCount: 1,
        priority: riskLevel,
        description: `${analysisResult.fraudType} pattern detected. Risk Score: ${analysisResult.riskScore}/100. Flags: ${analysisResult.flags.join(', ')}.`,
    });

    await alert.save();

    // Update account risk score
    await Account.findOneAndUpdate(
        { accountId: transaction.sender },
        {
            $set: { riskScore: Math.max(analysisResult.riskScore, 0) },
            $addToSet: {
                alerts: alertId,
                detectedPatterns: analysisResult.fraudType,
            },
            $inc: { flaggedTransactions: 1 },
            $set: {
                riskLevel,
                status: riskLevel === 'critical' ? 'suspicious' : undefined,
            },
        }
    );

    // Emit real-time alert
    if (io) {
        io.emit('new_alert', {
            alertId,
            accountId: transaction.sender,
            fraudType: analysisResult.fraudType,
            riskScore: analysisResult.riskScore,
            riskLevel,
            timestamp: new Date().toISOString(),
        });
    }

    return alert;
}

/**
 * Update account statistics after transaction
 */
async function updateAccountStats(transaction) {
    const account = await Account.findOne({ accountId: transaction.sender });
    let newAvg = transaction.amount;
    let newTotalTx = 1;

    if (account) {
        newTotalTx = account.totalTransactions + 1;
        newAvg = ((account.avgTransactionAmount * account.totalTransactions) + transaction.amount) / newTotalTx;
    }

    const updateOpts = {
        $inc: {
            totalTransactions: 1,
            totalSent: transaction.amount,
        },
        $set: {
            lastActivity: transaction.timestamp,
            avgTransactionAmount: newAvg,
        },
    };

    if (transaction.deviceId || transaction.ipAddress) {
        updateOpts.$addToSet = {};
        if (transaction.deviceId) updateOpts.$addToSet.trustedDevices = transaction.deviceId;
        if (transaction.ipAddress) updateOpts.$addToSet.trustedIps = transaction.ipAddress;
    }

    await Account.findOneAndUpdate(
        { accountId: transaction.sender },
        updateOpts,
        { upsert: true, new: true }
    );

    await Account.findOneAndUpdate(
        { accountId: transaction.receiver },
        {
            $inc: { totalTransactions: 1, totalReceived: transaction.amount },
            $set: { lastActivity: transaction.timestamp },
        },
        { upsert: true, new: true }
    );
}

module.exports = {
    analyzeTransaction,
    createAlertIfNeeded,
    updateAccountStats,
    THRESHOLDS,
    RISK_SCORES,
};
