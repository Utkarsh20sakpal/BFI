const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const { analyzeTransaction, createAlertIfNeeded, updateAccountStats } = require('../services/fraudDetection');
const { addTransactionToGraph } = require('../services/neo4j');
const { analyzeForFraudNetworks } = require('../services/fraudNetwork');

let simulationRunning = false;
let simulationInterval = null;
let simulationStats = {
    sent: 0,
    fraudDetected: 0,
    errors: 0,
    startTime: null,
};

/**
 * Shared logic to process a simulated transaction internally
 */
async function processSimulatedTransaction(txData, io) {
    // 1. Upsert accounts
    await Promise.all([
        Account.findOneAndUpdate(
            { accountId: txData.sender },
            { $setOnInsert: { accountId: txData.sender, name: `SIM Account ${txData.sender}`, status: 'active', createdAt: new Date(), lastActivity: new Date() } },
            { upsert: true }
        ),
        Account.findOneAndUpdate(
            { accountId: txData.receiver },
            { $setOnInsert: { accountId: txData.receiver, name: `SIM Account ${txData.receiver}`, status: 'active', createdAt: new Date(), lastActivity: new Date() } },
            { upsert: true }
        )
    ]);

    // 2. Create Transaction object
    const transactionId = `SIM-${Date.now().toString(36).toUpperCase()}-${uuidv4().slice(0, 4).toUpperCase()}`;
    const transaction = new Transaction({
        transactionId,
        ...txData,
        timestamp: txData.timestamp ? new Date(txData.timestamp) : new Date(),
        status: 'completed'
    });

    // 3. Run Analysis
    const analysisResult = await analyzeTransaction(transaction);
    transaction.ruleScore = analysisResult.ruleScore;
    transaction.mlScore = analysisResult.mlScore;
    transaction.riskScore = analysisResult.riskScore;
    transaction.flags = analysisResult.flags;
    transaction.fraudType = analysisResult.fraudType;
    transaction.isFraud = analysisResult.isFraud;
    transaction.status = analysisResult.isFraud ? 'flagged' : 'completed';

    // 4. Save & Update
    await transaction.save();
    await updateAccountStats(transaction);

    // 5. Async tasks
    addTransactionToGraph(transaction).catch(() => { });
    if (analysisResult.isFraud) {
        await createAlertIfNeeded(transaction, analysisResult, io);
    }
    analyzeForFraudNetworks(transaction).catch(() => { });

    // 6. Emit real-time event
    if (io) {
        io.emit('new_transaction', {
            transactionId,
            sender: transaction.sender,
            receiver: transaction.receiver,
            amount: transaction.amount,
            riskScore: transaction.riskScore,
            isFraud: transaction.isFraud,
            timestamp: transaction.timestamp
        });
    }

    return transaction;
}

/**
 * POST /api/simulation/start
 */
router.post('/start', async (req, res) => {
    if (simulationRunning) {
        return res.json({ success: false, message: 'Simulation already running', stats: simulationStats });
    }

    const {
        transactionCount = 100,
        accountCount = 50,
        fraudRate = 0.15,
        interval = 500, // ms between transactions
        patterns = ['layering', 'structuring', 'circular'],
    } = req.body;

    simulationRunning = true;
    simulationStats = { sent: 0, fraudDetected: 0, errors: 0, startTime: Date.now() };

    const accounts = Array.from({ length: accountCount }, (_, i) =>
        `SIM-ACC-${String(i + 1).padStart(4, '0')}`
    );

    let count = 0;
    simulationInterval = setInterval(async () => {
        if (count >= transactionCount || !simulationRunning) {
            clearInterval(simulationInterval);
            simulationRunning = false;
            if (req.io) {
                req.io.emit('simulation_complete', simulationStats);
            }
            return;
        }

        try {
            const isFraud = Math.random() < fraudRate;
            const txData = isFraud
                ? generateFraudTransaction(accounts, patterns)
                : generateNormalTransaction(accounts);

            const transaction = await processSimulatedTransaction(txData, req.io);

            simulationStats.sent++;
            if (transaction.isFraud) simulationStats.fraudDetected++;

            if (req.io) {
                req.io.emit('simulation_progress', {
                    ...simulationStats,
                    lastTransaction: transaction,
                });
            }
        } catch (err) {
            console.error('Simulation step error:', err);
            simulationStats.errors++;
        }

        count++;
    }, interval);

    res.json({ success: true, message: 'Simulation started', config: { transactionCount, accountCount, fraudRate, interval } });
});

/**
 * POST /api/simulation/stop
 */
router.post('/stop', (req, res) => {
    if (simulationInterval) clearInterval(simulationInterval);
    simulationRunning = false;
    res.json({ success: true, message: 'Simulation stopped', stats: simulationStats });
});

/**
 * GET /api/simulation/status
 */
router.get('/status', (req, res) => {
    res.json({ running: simulationRunning, stats: simulationStats });
});

/**
 * POST /api/simulation/demo
 * Run the built-in layering fraud demo scenario
 */
router.post('/demo', async (req, res) => {
    try {
        // Demo: A → B → C → D → E within 5 minutes (layering)
        const chain = ['DEMO-A1001', 'DEMO-A1002', 'DEMO-A1003', 'DEMO-A1004', 'DEMO-A1005'];
        const amount = 200000;
        const results = [];
        const baseTime = new Date();

        for (let i = 0; i < chain.length - 1; i++) {
            const timestamp = new Date(baseTime.getTime() + i * 60 * 1000); // 1 min apart
            try {
                const txData = {
                    sender: chain[i],
                    receiver: chain[i + 1],
                    amount: amount - (i * 1000), // slight decrease to simulate real layering
                    timestamp: timestamp.toISOString(),
                    type: 'transfer',
                    channel: 'NEFT',
                    description: `Demo layering transaction ${i + 1}`,
                };

                const transaction = await processSimulatedTransaction(txData, req.io);
                results.push({ success: true, transactionId: transaction.transactionId });
                await new Promise(r => setTimeout(r, 200)); // small delay
            } catch (err) {
                results.push({ error: err.message });
            }
        }

        res.json({
            success: true,
            scenario: 'Layering Fraud: A→B→C→D→E',
            chain,
            results,
            message: 'Demo scenario completed. Check Alerts page for detected fraud.',
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

function generateNormalTransaction(accounts) {
    const sender = accounts[Math.floor(Math.random() * accounts.length)];
    let receiver = accounts[Math.floor(Math.random() * accounts.length)];
    while (receiver === sender) receiver = accounts[Math.floor(Math.random() * accounts.length)];

    return {
        sender,
        receiver,
        amount: Math.round((Math.random() * 50000 + 1000) * 100) / 100,
        type: 'transfer',
        channel: ['UPI', 'NEFT', 'RTGS', 'Mobile Banking'][Math.floor(Math.random() * 4)],
    };
}

function generateFraudTransaction(accounts, patterns) {
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    const sender = accounts[Math.floor(Math.random() * accounts.length)];
    let receiver = accounts[Math.floor(Math.random() * accounts.length)];
    while (receiver === sender) receiver = accounts[Math.floor(Math.random() * accounts.length)];

    switch (pattern) {
        case 'structuring':
            return {
                sender,
                receiver,
                amount: 95000 + Math.random() * 4999, // just below 1 Lakh
                type: 'transfer',
                channel: 'NEFT',
            };
        case 'layering':
            return {
                sender,
                receiver,
                amount: 200000 + Math.random() * 300000,
                type: 'transfer',
                channel: 'RTGS',
            };
        case 'circular':
            return {
                sender,
                receiver: accounts[0], // circular to first account
                amount: 50000 + Math.random() * 100000,
                type: 'transfer',
                channel: 'NEFT',
            };
        default:
            return {
                sender,
                receiver,
                amount: 300000 + Math.random() * 200000,
                type: 'transfer',
                channel: 'RTGS',
            };
    }
}

module.exports = router;
