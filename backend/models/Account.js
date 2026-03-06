const mongoose = require('mongoose');
const crypto = require('crypto');

const ENC_KEY = Buffer.from(process.env.ENCRYPTION_KEY || 'bfi_default_encryption_key_32_chr');
const IV = Buffer.alloc(16, 0); // Fixed IV for simplicity in this system

function encrypt(text) {
    if (!text || text.length === 0) return text;
    if (text.length > 50) return text; // Probably already encrypted
    try {
        const cipher = crypto.createCipheriv('aes-256-cbc', ENC_KEY, IV);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return encrypted.toString('hex');
    } catch (e) { return text; }
}

function decrypt(text) {
    if (!text || text.length === 0) return text;
    try {
        const decipher = crypto.createDecipheriv('aes-256-cbc', ENC_KEY, IV);
        let decrypted = decipher.update(Buffer.from(text, 'hex'));
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) { return text; }
}

const accountSchema = new mongoose.Schema({
    accountId: {
        type: String,
        unique: true,
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
    },
    email: { type: String, get: decrypt, set: encrypt },
    phone: { type: String, get: decrypt, set: encrypt },
    accountType: {
        type: String,
        enum: ['savings', 'current', 'business', 'corporate'],
        default: 'savings',
    },
    balance: {
        type: Number,
        default: 0,
    },
    riskScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
    },
    riskLevel: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'low',
    },
    status: {
        type: String,
        enum: ['active', 'dormant', 'blocked', 'suspicious'],
        default: 'active',
    },
    kycStatus: {
        type: String,
        enum: ['verified', 'pending', 'rejected'],
        default: 'verified',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    lastActivity: {
        type: Date,
        default: Date.now,
    },
    totalTransactions: {
        type: Number,
        default: 0,
    },
    totalSent: {
        type: Number,
        default: 0,
    },
    totalReceived: {
        type: Number,
        default: 0,
    },
    avgTransactionAmount: {
        type: Number,
        default: 0,
    },
    flaggedTransactions: {
        type: Number,
        default: 0,
    },
    detectedPatterns: [{
        type: String,
    }],
    trustedDevices: [{
        type: String,
    }],
    trustedIps: [{
        type: String,
    }],
    alerts: [{
        type: String, // alert IDs
    }],
    bankCode: {
        type: String,
        default: 'BFI001',
    },
    branch: String,
    ifsc: String,
}, {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true }
});

accountSchema.index({ riskScore: -1 });
accountSchema.index({ riskLevel: 1 });
accountSchema.index({ status: 1 });

module.exports = mongoose.model('Account', accountSchema);
