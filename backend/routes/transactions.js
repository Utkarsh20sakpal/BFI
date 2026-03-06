const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const { analyzeTransaction, createAlertIfNeeded, updateAccountStats } = require('../services/fraudDetection');
const { addTransactionToGraph } = require('../services/neo4j');
const { protect } = require('../middleware/auth');
const { protectApiKey } = require('../middleware/apiKey');
const { analyzeForFraudNetworks } = require('../services/fraudNetwork');

/**
 * POST /api/transactions
 * Ingest new transaction and run fraud detection
 */
router.post('/', protectApiKey, async (req, res) => {
    try {
        const { sender, receiver, amount, timestamp, type, channel, description, device_id, ip_address } = req.body;

        if (!sender || !receiver || !amount) {
            return res.status(400).json({ error: 'sender, receiver, and amount are required' });
        }

        if (typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ error: 'amount must be a positive number' });
        }

        // Ensure accounts exist
        await Account.findOneAndUpdate(
            { accountId: sender },
            {
                $setOnInsert: {
                    accountId: sender,
                    name: `Account ${sender}`,
                    status: 'active',
                    createdAt: new Date(),
                    lastActivity: new Date(),
                },
            },
            { upsert: true, new: true }
        );

        await Account.findOneAndUpdate(
            { accountId: receiver },
            {
                $setOnInsert: {
                    accountId: receiver,
                    name: `Account ${receiver}`,
                    status: 'active',
                    createdAt: new Date(),
                    lastActivity: new Date(),
                },
            },
            { upsert: true, new: true }
        );

        const transactionId = `TXN-${Date.now().toString(36).toUpperCase()}-${uuidv4().slice(0, 6).toUpperCase()}`;

        const transaction = new Transaction({
            transactionId,
            sender,
            receiver,
            amount,
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            type: type || 'transfer',
            channel: channel || 'NEFT',
            description: description || '',
            status: 'completed',
            deviceId: device_id || null,
            ipAddress: ip_address || null,
        });

        // Run fraud detection BEFORE saving
        const analysisResult = await analyzeTransaction(transaction);

        transaction.ruleScore = analysisResult.ruleScore;
        transaction.mlScore = analysisResult.mlScore;
        transaction.riskScore = analysisResult.riskScore;
        transaction.flags = analysisResult.flags;
        transaction.fraudType = analysisResult.fraudType;
        transaction.isFraud = analysisResult.isFraud;
        transaction.status = analysisResult.isFraud ? 'flagged' : 'completed';

        await transaction.save();

        // Update account stats
        await updateAccountStats(transaction);

        // Add to Neo4j graph (non-blocking)
        addTransactionToGraph(transaction).catch(err => {
            console.error('Neo4j graph update failed:', err.message);
        });

        // Create alert if fraud
        let alert = null;
        if (analysisResult.isFraud) {
            alert = await createAlertIfNeeded(transaction, analysisResult, req.io);

            if (alert) {
                transaction.alertId = alert.alertId;
                await transaction.save();
            }
        }

        // Non-blocking: scan for fraud networks after ingestion
        analyzeForFraudNetworks(transaction).then(detectedNetworks => {
            if (detectedNetworks.length > 0 && req.io) {
                detectedNetworks.forEach(network => {
                    req.io.emit('new_fraud_network', {
                        networkId: network.networkId,
                        pattern: network.detectedPattern,
                        accounts: network.accountCount,
                        riskScore: network.networkRiskScore,
                        riskLevel: network.riskLevel,
                        timestamp: new Date().toISOString(),
                    });
                });
            }
        }).catch(() => { });

        // Emit real-time transaction event
        if (req.io) {
            req.io.emit('new_transaction', {
                transactionId,
                sender,
                receiver,
                amount,
                riskScore: analysisResult.riskScore,
                isFraud: analysisResult.isFraud,
                flags: analysisResult.flags,
                timestamp: transaction.timestamp,
            });
        }

        res.status(201).json({
            success: true,
            transaction: {
                transactionId: transaction.transactionId,
                sender,
                receiver,
                amount,
                timestamp: transaction.timestamp,
                riskScore: analysisResult.riskScore,
                ruleScore: analysisResult.ruleScore,
                mlScore: analysisResult.mlScore,
                flags: analysisResult.flags,
                fraudType: analysisResult.fraudType,
                isFraud: analysisResult.isFraud,
                status: transaction.status,
            },
            alert: alert ? { alertId: alert.alertId, riskLevel: alert.riskLevel } : null,
        });

    } catch (err) {
        console.error('Transaction ingestion error:', err);
        res.status(500).json({ error: 'Transaction processing failed', message: err.message });
    }
});

/**
 * GET /api/transactions
 * Get transactions with filters and pagination
 */
router.get('/', protect, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            sender,
            receiver,
            isFraud,
            minRisk,
            fraudType,
            startDate,
            endDate,
            sort = '-timestamp',
        } = req.query;

        const filter = {};
        if (sender) filter.sender = sender;
        if (receiver) filter.receiver = receiver;
        if (isFraud !== undefined) filter.isFraud = isFraud === 'true';
        if (minRisk) filter.riskScore = { $gte: parseInt(minRisk) };
        if (fraudType) filter.fraudType = fraudType;
        if (startDate || endDate) {
            filter.timestamp = {};
            if (startDate) filter.timestamp.$gte = new Date(startDate);
            if (endDate) filter.timestamp.$lte = new Date(endDate);
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [transactions, total] = await Promise.all([
            Transaction.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Transaction.countDocuments(filter),
        ]);

        res.json({
            transactions,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/transactions/stats
 * Dashboard statistics
 */
router.get('/stats', protect, async (req, res) => {
    try {
        const [
            totalTransactions,
            totalFraud,
            totalFlaggedAmount,
            recentFraud,
            volumeByDay,
        ] = await Promise.all([
            Transaction.countDocuments(),
            Transaction.countDocuments({ isFraud: true }),
            Transaction.aggregate([
                { $match: { isFraud: true } },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
            Transaction.countDocuments({
                isFraud: true,
                timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            }),
            Transaction.aggregate([
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                        count: { $sum: 1 },
                        fraudCount: { $sum: { $cond: ['$isFraud', 1, 0] } },
                        volume: { $sum: '$amount' },
                    },
                },
                { $sort: { _id: 1 } },
                { $limit: 30 },
            ]),
        ]);

        res.json({
            totalTransactions,
            totalFraud,
            totalFlaggedAmount: totalFlaggedAmount[0]?.total || 0,
            recentFraud,
            volumeByDay,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/transactions/:id
 */
router.get('/:id', protect, async (req, res) => {
    try {
        const tx = await Transaction.findOne({ transactionId: req.params.id });
        if (!tx) return res.status(404).json({ error: 'Transaction not found' });
        res.json(tx);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
