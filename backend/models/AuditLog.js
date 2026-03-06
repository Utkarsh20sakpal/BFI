const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true,
    },
    action: {
        type: String,
        required: true,
        index: true,
    },
    targetType: {
        type: String,
        // e.g., 'Alert', 'Case', 'Report'
    },
    targetId: {
        type: String,
        index: true,
    },
    details: {
        type: String,
    },
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);
