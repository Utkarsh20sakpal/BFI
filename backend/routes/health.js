const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const { isConnected: neo4jConnected } = require('../services/neo4j');

let txnCount = 0;
let lastTxnTime = Date.now();

// Track throughput
setInterval(() => {
    txnCount = 0;
    lastTxnTime = Date.now();
}, 60000);

router.get('/', async (req, res) => {
    try {
        // MongoDB status
        const mongoStatus = mongoose.connection.readyState === 1;

        // Neo4j status
        const neo4jStatus = await neo4jConnected().catch(() => false);

        // ML Service status
        let mlStatus = false;
        try {
            const mlRes = await axios.get(`${process.env.ML_SERVICE_URL || 'http://localhost:8001'}/health`, { timeout: 2000 });
            mlStatus = mlRes.data?.status === 'ok';
        } catch { }

        // Transaction throughput (per minute estimate)
        const Transaction = require('../models/Transaction');
        const lastMinute = new Date(Date.now() - 60 * 1000);
        const recentCount = await Transaction.countDocuments({ createdAt: { $gte: lastMinute } });

        // System metrics
        const totalTx = await Transaction.countDocuments();
        const totalAccounts = await require('../models/Account').countDocuments();
        const totalAlerts = await require('../models/Alert').countDocuments();

        res.json({
            status: 'operational',
            timestamp: new Date().toISOString(),
            services: {
                api: { status: 'running', uptime: process.uptime() },
                mongodb: { status: mongoStatus ? 'connected' : 'disconnected' },
                neo4j: { status: neo4jStatus ? 'connected' : 'unavailable' },
                mlService: { status: mlStatus ? 'running' : 'unavailable', url: process.env.ML_SERVICE_URL || 'http://localhost:8001' },
                genai: {
                    status: (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') ||
                        (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here')
                        ? 'active' : 'demo_mode',
                },
            },
            metrics: {
                totalTransactions: totalTx,
                totalAccounts,
                totalAlerts,
                throughput: recentCount,
                nodeEnv: process.env.NODE_ENV || 'development',
                nodeVersion: process.version,
                memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            },
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
