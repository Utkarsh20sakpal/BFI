const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
    largeTransactionThreshold: {
        type: Number,
        default: 100000
    },
    rapidTransferThreshold: {
        type: Number,
        default: 3
    },
    velocityDetectionLimits: {
        type: Number,
        default: 500000
    },
    // other settings can be added here
}, { timestamps: true });

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
