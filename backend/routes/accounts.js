const express = require('express');
const router = express.Router();
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const Alert = require('../models/Alert');

router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 20, riskLevel, status, sort = '-riskScore' } = req.query;
        const filter = {};
        if (riskLevel) filter.riskLevel = riskLevel;
        if (status) filter.status = status;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [accounts, total] = await Promise.all([
            Account.find(filter).sort(sort).skip(skip).limit(parseInt(limit)).lean(),
            Account.countDocuments(filter),
        ]);

        res.json({ accounts, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/stats', async (req, res) => {
    try {
        const [total, highRisk, suspicious, blocked] = await Promise.all([
            Account.countDocuments(),
            Account.countDocuments({ riskLevel: { $in: ['high', 'critical'] } }),
            Account.countDocuments({ status: 'suspicious' }),
            Account.countDocuments({ status: 'blocked' }),
        ]);
        res.json({ total, highRisk, suspicious, blocked });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const account = await Account.findOne({ accountId: req.params.id }).lean();
        if (!account) return res.status(404).json({ error: 'Account not found' });

        const [transactions, alerts] = await Promise.all([
            Transaction.find({ $or: [{ sender: req.params.id }, { receiver: req.params.id }] })
                .sort('-timestamp').limit(50).lean(),
            Alert.find({ accountId: req.params.id }).sort('-createdAt').limit(10).lean(),
        ]);

        res.json({ account, transactions, alerts });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { status, riskScore, riskLevel } = req.body;
        const updates = {};
        if (status) updates.status = status;
        if (riskScore !== undefined) updates.riskScore = riskScore;
        if (riskLevel) updates.riskLevel = riskLevel;

        const account = await Account.findOneAndUpdate(
            { accountId: req.params.id },
            updates,
            { new: true }
        );
        if (!account) return res.status(404).json({ error: 'Account not found' });
        res.json({ success: true, account });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
