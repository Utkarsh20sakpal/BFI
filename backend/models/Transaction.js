const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    transactionId: {
        type: String,
        unique: true,
        required: true,
    },
    sender: {
        type: String,
        required: true,
        index: true,
    },
    receiver: {
        type: String,
        required: true,
        index: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true,
    },
    type: {
        type: String,
        enum: ['transfer', 'deposit', 'withdrawal', 'payment'],
        default: 'transfer',
    },
    status: {
        type: String,
        enum: ['completed', 'pending', 'blocked', 'flagged'],
        default: 'completed',
    },
    deviceId: {
        type: String,
        default: null,
    },
    ipAddress: {
        type: String,
        default: null,
    },
    riskScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
    },
    ruleScore: {
        type: Number,
        default: 0,
    },
    mlScore: {
        type: Number,
        default: 0,
    },
    flags: [{
        type: String,
        enum: [
            'large_transaction',
            'rapid_transfer',
            'structuring',
            'dormant_account',
            'circular_flow',
            'layering',
            'ml_anomaly',
            'round_amount',
            'cross_border',
            'device_risk',
            'geo_risk',
        ],
    }],
    fraudType: {
        type: String,
        enum: ['Layering', 'Structuring', 'Circular Flow', 'Dormant Account', 'Large Transaction', 'Normal', null],
        default: null,
    },
    isFraud: {
        type: Boolean,
        default: false,
    },
    channel: {
        type: String,
        enum: ['UPI', 'NEFT', 'RTGS', 'ATM', 'Mobile Banking', 'Internet Banking'],
        default: 'NEFT',
    },
    currency: {
        type: String,
        default: 'INR',
    },
    description: String,
    alertId: {
        type: String,
        default: null,
    },
}, {
    timestamps: true,
});

transactionSchema.index({ sender: 1, timestamp: -1 });
transactionSchema.index({ receiver: 1, timestamp: -1 });
transactionSchema.index({ riskScore: -1 });
transactionSchema.index({ isFraud: 1, timestamp: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
