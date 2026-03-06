const express = require('express');
const router = express.Router();
const SystemSettings = require('../models/SystemSettings');
const AuditLog = require('../models/AuditLog');

router.get('/rules', async (req, res) => {
    try {
        let settings = await SystemSettings.findOne();
        if (!settings) {
            settings = await SystemSettings.create({});
        }
        res.json({ settings });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/rules', async (req, res) => {
    try {
        let settings = await SystemSettings.findOne();
        if (!settings) {
            settings = await SystemSettings.create(req.body);
        } else {
            Object.assign(settings, req.body);
            await settings.save();
        }

        // Audit Log
        const userId = req.user ? req.user.userId : 'System';
        await AuditLog.create({
            userId,
            action: 'Rules Updated',
            targetType: 'SystemSettings',
            details: 'Admin updated fraud detection rules.'
        });

        res.json({ success: true, settings });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
