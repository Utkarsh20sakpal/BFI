const mongoose = require('mongoose');

const fraudNetworkSchema = new mongoose.Schema({
    networkId: { type: String, unique: true, required: true, index: true },

    // Network metadata
    name: { type: String, default: '' },
    detectedPattern: {
        type: String,
        enum: ['Layering Chain', 'Circular Loop', 'Star Network', 'Rapid Multihop', 'Shared Identity', 'Mixed'],
        required: true,
    },

    // Accounts in this network
    accounts: [{ type: String }],
    accountCount: { type: Number, default: 0 },

    // Transactions forming the network
    transactionIds: [{ type: String }],
    transactionCount: { type: Number, default: 0 },

    // Financial exposure
    totalTransactionValue: { type: Number, default: 0 },

    // Risk
    networkRiskScore: { type: Number, min: 0, max: 100, default: 0 },
    riskLevel: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        default: 'Medium',
    },

    // Pattern details
    patternDetails: {
        cyclesFound: { type: Number, default: 0 },
        maxChainDepth: { type: Number, default: 0 },
        timeSpanMinutes: { type: Number, default: 0 },
        centralAccount: { type: String, default: null },
    },

    // Status
    status: {
        type: String,
        enum: ['Active', 'Investigating', 'Resolved', 'False Positive'],
        default: 'Active',
    },

    // AI analysis
    aiAnalysis: { type: String, default: null },
    aiAnalysisGeneratedAt: { type: Date, default: null },

    // Investigator notes
    investigatorNotes: [{
        note: String,
        author: String,
        timestamp: { type: Date, default: Date.now },
    }],

    // Graph snapshot (for frontend visualization without re-querying Neo4j)
    graphSnapshot: {
        nodes: [{ type: mongoose.Schema.Types.Mixed }],
        edges: [{ type: mongoose.Schema.Types.Mixed }],
    },

    // Related alert IDs
    alertIds: [{ type: String }],

    lastAnalyzedAt: { type: Date, default: Date.now },
}, {
    timestamps: true,
});

fraudNetworkSchema.index({ networkRiskScore: -1 });
fraudNetworkSchema.index({ status: 1 });
fraudNetworkSchema.index({ detectedPattern: 1 });
fraudNetworkSchema.index({ createdAt: -1 });

module.exports = mongoose.model('FraudNetwork', fraudNetworkSchema);
