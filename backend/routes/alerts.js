const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const AuditLog = require('../models/AuditLog');
const { generateFraudReport } = require('../services/genai');

/**
 * GET /api/alerts
 */
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            status,
            fraudType,
            minRisk,
            maxRisk,
            riskLevel,
            sort = '-createdAt',
        } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (fraudType) filter.fraudType = fraudType;
        if (riskLevel) filter.riskLevel = riskLevel;
        if (minRisk || maxRisk) {
            filter.riskScore = {};
            if (minRisk) filter.riskScore.$gte = parseInt(minRisk);
            if (maxRisk) filter.riskScore.$lte = parseInt(maxRisk);
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [alerts, total] = await Promise.all([
            Alert.find(filter).sort(sort).skip(skip).limit(parseInt(limit)).lean(),
            Alert.countDocuments(filter),
        ]);

        res.json({ alerts, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/alerts/stats
 */
router.get('/stats', async (req, res) => {
    try {
        const [
            total,
            open,
            investigating,
            closed,
            byType,
            byRiskLevel,
            recentAlerts,
        ] = await Promise.all([
            Alert.countDocuments(),
            Alert.countDocuments({ status: 'Open' }),
            Alert.countDocuments({ status: 'Investigating' }),
            Alert.countDocuments({ status: 'Closed' }),
            Alert.aggregate([
                { $group: { _id: '$fraudType', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),
            Alert.aggregate([
                { $group: { _id: '$riskLevel', count: { $sum: 1 } } },
            ]),
            Alert.aggregate([
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
                { $limit: 30 },
            ]),
        ]);

        res.json({ total, open, investigating, closed, byType, byRiskLevel, recentAlerts });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/alerts/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const alert = await Alert.findOne({ alertId: req.params.id });
        if (!alert) return res.status(404).json({ error: 'Alert not found' });

        // Fetch related transactions
        const transactions = await Transaction.find({
            $or: [
                { sender: alert.accountId },
                { receiver: alert.accountId },
                { transactionId: { $in: alert.transactionIds } },
            ],
        }).sort('-timestamp').limit(20).lean();

        // Fetch account
        const account = await Account.findOne({ accountId: alert.accountId }).lean();

        // Audit Log
        const userId = req.user ? req.user.userId : 'System';
        await AuditLog.create({
            userId,
            action: 'Alert Opened',
            targetType: 'Alert',
            targetId: alert.alertId,
            details: `Viewed alert ${alert.alertId}`
        });

        res.json({ alert, transactions, account });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/alerts/:id/status
 */
router.put('/:id/status', async (req, res) => {
    try {
        const { status, assignedTo } = req.body;
        const validStatuses = ['Open', 'Investigating', 'Closed', 'False Positive'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const update = { status };
        if (assignedTo) update.assignedTo = assignedTo;
        if (status === 'Closed') update.resolvedAt = new Date();

        const alert = await Alert.findOneAndUpdate(
            { alertId: req.params.id },
            update,
            { new: true }
        );

        if (!alert) return res.status(404).json({ error: 'Alert not found' });

        // Audit log
        const userId = req.user ? req.user.userId : 'System';
        await AuditLog.create({
            userId,
            action: 'Status Updated',
            targetType: 'Alert',
            targetId: alert.alertId,
            details: `Status changed to ${status}${assignedTo ? ` and assigned to ${assignedTo}` : ''}`
        });

        res.json({ success: true, alert });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/alerts/:id/notes
 */
router.post('/:id/notes', async (req, res) => {
    try {
        const { note, author } = req.body;
        if (!note) return res.status(400).json({ error: 'Note content required' });

        const alert = await Alert.findOneAndUpdate(
            { alertId: req.params.id },
            {
                $push: {
                    investigatorNotes: {
                        note,
                        author: author || 'Analyst',
                        timestamp: new Date(),
                    },
                },
            },
            { new: true }
        );

        if (!alert) return res.status(404).json({ error: 'Alert not found' });

        // Audit log
        const userId = req.user ? req.user.userId : 'System';
        await AuditLog.create({
            userId,
            action: 'Note Added',
            targetType: 'Alert',
            targetId: alert.alertId,
            details: `Added note: ${note.substring(0, 50)}...`
        });

        res.json({ success: true, notes: alert.investigatorNotes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/alerts/:id/generate-report
 */
router.post('/:id/generate-report', async (req, res) => {
    try {
        const alert = await Alert.findOne({ alertId: req.params.id });
        if (!alert) return res.status(404).json({ error: 'Alert not found' });

        const [transactions, account] = await Promise.all([
            Transaction.find({
                $or: [
                    { sender: alert.accountId },
                    { transactionId: { $in: alert.transactionIds } },
                ],
            }).sort('timestamp').limit(20).lean(),
            Account.findOne({ accountId: alert.accountId }).lean(),
        ]);

        const report = await generateFraudReport(alert.toObject(), transactions, account);

        // Save report to alert
        alert.aiReport = report;
        alert.aiReportGeneratedAt = new Date();
        await alert.save();

        // Audit log
        const userId = req.user ? req.user.userId : 'System';
        await AuditLog.create({
            userId,
            action: 'Report Generated',
            targetType: 'Alert',
            targetId: alert.alertId,
            details: `Generated AI analysis report`
        });

        res.json({ success: true, report });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
