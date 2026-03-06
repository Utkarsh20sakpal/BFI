const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
    alertId: {
        type: String,
        unique: true,
        required: true,
    },
    accountId: {
        type: String,
        required: true,
        index: true,
    },
    transactionIds: [{
        type: String,
    }],
    fraudType: {
        type: String,
        enum: ['Layering', 'Structuring', 'Circular Flow', 'Dormant Account', 'Large Transaction',
            'Rapid Transfer', 'ML Anomaly', 'Multiple Flags', 'Behavioral Anomaly',
            'Fraud Network', 'Account Takeover'],
        required: true,
    },
    riskScore: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
    },
    riskLevel: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium',
    },
    status: {
        type: String,
        enum: ['Open', 'Investigating', 'Closed', 'False Positive'],
        default: 'Open',
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium',
    },
    flags: [{
        type: String,
    }],
    totalAmount: {
        type: Number,
        default: 0,
    },
    transactionCount: {
        type: Number,
        default: 0,
    },
    timeSpan: {
        type: Number, // in minutes
        default: 0,
    },
    description: {
        type: String,
        default: '',
    },
    assignedTo: {
        type: String,
        default: null,
    },
    investigatorNotes: [{
        note: String,
        author: String,
        timestamp: { type: Date, default: Date.now },
    }],
    aiReport: {
        type: String,
        default: null,
    },
    aiReportGeneratedAt: {
        type: Date,
        default: null,
    },
    resolvedAt: {
        type: Date,
        default: null,
    },
    evidenceExported: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});

alertSchema.index({ riskScore: -1 });
alertSchema.index({ status: 1, riskScore: -1 });
alertSchema.index({ fraudType: 1 });
alertSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Alert', alertSchema);
