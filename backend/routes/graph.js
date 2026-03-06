const express = require('express');
const router = express.Router();
const { getAccountGraph } = require('../services/neo4j');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');

/**
 * GET /api/graph/:accountId
 * Get fund flow graph for account
 */
router.get('/:accountId', async (req, res) => {
    try {
        const { accountId } = req.params;
        const { depth = 3 } = req.query;

        // Try Neo4j first
        const neo4jGraph = await getAccountGraph(accountId, parseInt(depth));

        if (neo4jGraph && neo4jGraph.nodes.length > 0) {
            return res.json({ source: 'neo4j', ...neo4jGraph });
        }

        // Fallback: build graph from MongoDB transactions
        const transactions = await Transaction.find({
            $or: [{ sender: accountId }, { receiver: accountId }],
        }).sort('-timestamp').limit(100).lean();

        const allAccountIds = new Set([accountId]);
        transactions.forEach(tx => {
            allAccountIds.add(tx.sender);
            allAccountIds.add(tx.receiver);
        });

        // Expand one level deeper
        const secondLevel = await Transaction.find({
            $or: [
                { sender: { $in: Array.from(allAccountIds) } },
                { receiver: { $in: Array.from(allAccountIds) } },
            ],
        }).sort('-timestamp').limit(200).lean();

        secondLevel.forEach(tx => {
            allAccountIds.add(tx.sender);
            allAccountIds.add(tx.receiver);
        });

        const allTransactions = [...transactions, ...secondLevel];

        // Fetch account risk data
        const accounts = await Account.find({
            accountId: { $in: Array.from(allAccountIds) },
        }).lean();

        const accountMap = {};
        accounts.forEach(a => { accountMap[a.accountId] = a; });

        // Build nodes
        const nodeMap = new Map();
        allTransactions.forEach(tx => {
            [tx.sender, tx.receiver].forEach(id => {
                if (!nodeMap.has(id)) {
                    const acc = accountMap[id] || {};
                    nodeMap.set(id, {
                        id,
                        label: id,
                        riskScore: acc.riskScore || 0,
                        riskLevel: acc.riskLevel || 'low',
                        status: acc.status || 'active',
                        isOrigin: id === accountId,
                        totalTransactions: acc.totalTransactions || 0,
                    });
                }
            });
        });

        // Build edges
        const edgeMap = new Map();
        allTransactions.forEach(tx => {
            const edgeKey = `${tx.sender}->${tx.receiver}`;
            if (edgeMap.has(edgeKey)) {
                const e = edgeMap.get(edgeKey);
                e.totalAmount += tx.amount;
                e.count += 1;
                e.riskScore = Math.max(e.riskScore, tx.riskScore || 0);
            } else {
                edgeMap.set(edgeKey, {
                    id: tx.transactionId,
                    source: tx.sender,
                    target: tx.receiver,
                    amount: tx.amount,
                    totalAmount: tx.amount,
                    count: 1,
                    riskScore: tx.riskScore || 0,
                    fraudType: tx.fraudType,
                    isFraud: tx.isFraud,
                    timestamp: tx.timestamp,
                });
            }
        });

        res.json({
            source: 'mongodb',
            nodes: Array.from(nodeMap.values()),
            edges: Array.from(edgeMap.values()),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/graph/overview
 * Get system-wide graph overview
 */
router.get('/overview/summary', async (req, res) => {
    try {
        const fraudTxns = await Transaction.find({ isFraud: true })
            .sort('-riskScore').limit(50).lean();

        const accountIds = new Set();
        fraudTxns.forEach(tx => {
            accountIds.add(tx.sender);
            accountIds.add(tx.receiver);
        });

        const accounts = await Account.find({
            accountId: { $in: Array.from(accountIds) },
        }).lean();

        const accountMap = {};
        accounts.forEach(a => { accountMap[a.accountId] = a; });

        const nodeMap = new Map();
        fraudTxns.forEach(tx => {
            [tx.sender, tx.receiver].forEach(id => {
                if (!nodeMap.has(id)) {
                    const acc = accountMap[id] || {};
                    nodeMap.set(id, {
                        id,
                        label: id,
                        riskScore: acc.riskScore || 0,
                        riskLevel: acc.riskLevel || 'low',
                    });
                }
            });
        });

        const edges = fraudTxns.map(tx => ({
            id: tx.transactionId,
            source: tx.sender,
            target: tx.receiver,
            amount: tx.amount,
            riskScore: tx.riskScore || 0,
            fraudType: tx.fraudType,
            isFraud: tx.isFraud,
        }));

        res.json({
            nodes: Array.from(nodeMap.values()),
            edges,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
