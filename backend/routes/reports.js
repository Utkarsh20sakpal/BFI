const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const AuditLog = require('../models/AuditLog');
const { restrictTo } = require('../middleware/auth');

router.get('/audit', restrictTo('admin'), async (req, res) => {
    try {
        const { page = 1, limit = 50, action, targetId } = req.query;
        const filter = {};
        if (action) filter.action = action;
        if (targetId) filter.targetId = targetId;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [logs, total] = await Promise.all([
            AuditLog.find(filter).sort('-createdAt').skip(skip).limit(parseInt(limit)).lean(),
            AuditLog.countDocuments(filter)
        ]);

        res.json({ logs, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const filter = {};
        if (status) filter.status = status;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [alerts, total] = await Promise.all([
            Alert.find({ ...filter, aiReport: { $ne: null } })
                .sort('-aiReportGeneratedAt').skip(skip).limit(parseInt(limit)).lean(),
            Alert.countDocuments({ ...filter, aiReport: { $ne: null } }),
        ]);

        res.json({ reports: alerts, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/summary', async (req, res) => {
    try {
        const [fraudByType, riskByScore, monthlyTrends, topAccounts] = await Promise.all([
            Alert.aggregate([
                { $group: { _id: '$fraudType', count: { $sum: 1 }, totalAmount: { $sum: '$totalAmount' } } },
                { $sort: { count: -1 } },
            ]),
            Alert.aggregate([
                {
                    $bucket: {
                        groupBy: '$riskScore',
                        boundaries: [0, 30, 60, 80, 100],
                        default: 'Other',
                        output: { count: { $sum: 1 } },
                    },
                },
            ]),
            Transaction.aggregate([
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m', date: '$timestamp' } },
                        total: { $sum: 1 },
                        fraud: { $sum: { $cond: ['$isFraud', 1, 0] } },
                        amount: { $sum: '$amount' },
                    },
                },
                { $sort: { _id: 1 } },
                { $limit: 12 },
            ]),
            Account.find({ riskLevel: { $in: ['high', 'critical'] } })
                .sort('-riskScore').limit(10).lean(),
        ]);

        res.json({ fraudByType, riskByScore, monthlyTrends, topAccounts });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/sar/:alertId', async (req, res) => {
    try {
        const PDFDocument = require('pdfkit');
        const alert = await Alert.findOne({ alertId: req.params.alertId });
        if (!alert) return res.status(404).json({ error: 'Alert not found' });

        const account = await Account.findOne({ accountId: alert.accountId });
        const transactions = await Transaction.find({ transactionId: { $in: alert.transactionIds } });

        const doc = new PDFDocument({ margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=SAR-${alert.alertId}.pdf`);

        doc.pipe(res);

        // Header
        doc.fontSize(20).font('Helvetica-Bold').text('SUSPICIOUS ACTIVITY REPORT (SAR)', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).font('Helvetica-Oblique').text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown(2);

        // Case Summary
        doc.fontSize(16).font('Helvetica-Bold').text('1. Case Summary');
        doc.fontSize(12).font('Helvetica').text(`Alert ID: ${alert.alertId}`);
        doc.text(`Account ID: ${alert.accountId}`);
        doc.text(`Account Name: ${account ? account.name : 'Unknown'}`);
        doc.text(`Fraud Type: ${alert.fraudType}`);
        doc.text(`Risk Score: ${alert.riskScore}/100 (${alert.riskLevel.toUpperCase()})`);
        doc.text(`Total Amount Flagged: ₹${alert.totalAmount?.toLocaleString('en-IN')}`);
        doc.text(`Status: ${alert.status}`);
        doc.moveDown(2);

        // Investigation Notes
        doc.fontSize(16).font('Helvetica-Bold').text('2. Investigator Notes');
        doc.fontSize(12).font('Helvetica');
        if (alert.investigatorNotes && alert.investigatorNotes.length > 0) {
            alert.investigatorNotes.forEach(n => {
                doc.text(`[${new Date(n.timestamp).toLocaleString()}] ${n.author}: ${n.note}`);
            });
        } else {
            doc.text('No notes added.');
        }
        doc.moveDown(2);

        // GenAI Analysis
        if (alert.aiReport) {
            doc.fontSize(16).font('Helvetica-Bold').text('3. AI Investigation Report');
            doc.fontSize(10).font('Helvetica').text(alert.aiReport);
            doc.moveDown(2);
        }

        // Transactions
        doc.fontSize(16).font('Helvetica-Bold').text('4. Transaction History');
        doc.fontSize(10).font('Helvetica');
        transactions.forEach((tx, i) => {
            doc.text(`${i + 1}. ${tx.transactionId} | ${new Date(tx.timestamp).toLocaleString()} | ${tx.sender} -> ${tx.receiver} | ₹${tx.amount.toLocaleString('en-IN')}`);
        });

        doc.end();

    } catch (err) {
        console.error('PDF generation error:', err);
        res.status(500).json({ error: 'Failed to generate PDF report' });
    }
});

module.exports = router;
