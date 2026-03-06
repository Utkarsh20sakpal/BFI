/**
 * Fraud Network API Routes
 * GET  /api/networks         — List all detected fraud networks
 * GET  /api/networks/:id     — Get single network with full graph
 * POST /api/networks/:id/analyze — Trigger AI analysis for a network
 * PUT  /api/networks/:id/status  — Update status
 * POST /api/networks/:id/notes   — Add investigator notes
 * POST /api/networks/scan        — Manual network scan trigger
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const FraudNetwork = require('../models/FraudNetwork');
const Transaction = require('../models/Transaction');
const axios = require('axios');

// ─── List all fraud networks ───────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            riskLevel,
            status,
            pattern,
            minAccounts,
            sort = '-networkRiskScore',
        } = req.query;

        const filter = {};
        if (riskLevel) filter.riskLevel = riskLevel;
        if (status) filter.status = status;
        if (pattern) filter.detectedPattern = pattern;
        if (minAccounts) filter.accountCount = { $gte: parseInt(minAccounts) };

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [networks, total] = await Promise.all([
            FraudNetwork.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            FraudNetwork.countDocuments(filter),
        ]);

        res.json({
            networks,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Network stats summary ────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
    try {
        const [total, byRisk, byPattern, topNetworks, recentCount] = await Promise.all([
            FraudNetwork.countDocuments(),
            FraudNetwork.aggregate([
                { $group: { _id: '$riskLevel', count: { $sum: 1 }, totalValue: { $sum: '$totalTransactionValue' } } },
                { $sort: { count: -1 } },
            ]),
            FraudNetwork.aggregate([
                { $group: { _id: '$detectedPattern', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),
            FraudNetwork.find({ status: 'Active' })
                .sort('-networkRiskScore')
                .limit(5)
                .lean(),
            FraudNetwork.countDocuments({
                createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            }),
        ]);

        res.json({ total, byRisk, byPattern, topNetworks, recentCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Get single fraud network ─────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const network = await FraudNetwork.findOne({ networkId: req.params.id }).lean();
        if (!network) return res.status(404).json({ error: 'Network not found' });

        // Enrich with recent transactions between these accounts
        const recentTxns = await Transaction.find({
            $or: [
                { sender: { $in: network.accounts } },
                { receiver: { $in: network.accounts } },
            ],
        }).sort('-timestamp').limit(50).lean();

        res.json({ network, recentTransactions: recentTxns });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Generate AI network analysis ─────────────────────────────────────────────
router.post('/:id/analyze', async (req, res) => {
    try {
        const network = await FraudNetwork.findOne({ networkId: req.params.id });
        if (!network) return res.status(404).json({ error: 'Network not found' });

        const report = await generateNetworkAIReport(network);
        network.aiAnalysis = report;
        network.aiAnalysisGeneratedAt = new Date();
        await network.save();

        res.json({ success: true, analysis: report });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Update network status ────────────────────────────────────────────────────
router.put('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const network = await FraudNetwork.findOneAndUpdate(
            { networkId: req.params.id },
            { status },
            { new: true }
        );
        if (!network) return res.status(404).json({ error: 'Network not found' });
        res.json({ success: true, network });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Add investigator note ────────────────────────────────────────────────────
router.post('/:id/notes', async (req, res) => {
    try {
        const { note, author } = req.body;
        const network = await FraudNetwork.findOneAndUpdate(
            { networkId: req.params.id },
            { $push: { investigatorNotes: { note, author: author || req.user?.username || 'Analyst', timestamp: new Date() } } },
            { new: true }
        );
        if (!network) return res.status(404).json({ error: 'Network not found' });
        res.json({ success: true, network });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Manual network scan ──────────────────────────────────────────────────────
router.post('/scan', async (req, res) => {
    try {
        const { accountId, lookbackHours = 24 } = req.body;

        const { analyzeForFraudNetworks } = require('../services/fraudNetwork');

        // Fetch recent flagged transactions for the account  
        const filter = { isFraud: true };
        if (accountId) filter.$or = [{ sender: accountId }, { receiver: accountId }];

        const recentFraud = await Transaction.find(filter)
            .sort('-timestamp')
            .limit(20)
            .lean();

        const detectedNetworks = [];
        for (const tx of recentFraud.slice(0, 5)) {
            const found = await analyzeForFraudNetworks(tx);
            detectedNetworks.push(...found);
        }

        res.json({
            success: true,
            networksDetected: detectedNetworks.length,
            networks: detectedNetworks.map(n => ({
                networkId: n.networkId,
                pattern: n.detectedPattern,
                accounts: n.accountCount,
                riskScore: n.networkRiskScore,
                riskLevel: n.riskLevel,
            })),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── AI Network Report Builder ────────────────────────────────────────────────
async function generateNetworkAIReport(network) {
    const prompt = `
Role:
You are a senior financial crime investigator and intelligence analyst at a central bank fraud unit.

Objective:
Analyze the following suspected fraud network and produce a structured professional intelligence report.

Network Data:
- Network ID: ${network.networkId}
- Detected Pattern: ${network.detectedPattern}
- Accounts Involved: ${network.accounts.slice(0, 15).join(', ')}${network.accounts.length > 15 ? ` ... (${network.accounts.length} total)` : ''}
- Total Suspicious Value: ₹${network.totalTransactionValue?.toLocaleString('en-IN')}
- Network Risk Score: ${network.networkRiskScore}/100 (${network.riskLevel})
- Chain Depth: ${network.patternDetails?.maxChainDepth || 'Unknown'} hops
- Circular Flows Found: ${network.patternDetails?.cyclesFound || 0}
- Time Span: ${network.patternDetails?.timeSpanMinutes || 'Unknown'} minutes
- Central Account (if any): ${network.patternDetails?.centralAccount || 'N/A'}

Instructions:
Analyze this coordinated fraud network systematically and professionally.
Use structured format. Be concise but highly analytical.
Identify the specific technique being used (e.g. smurfing, placement, layering, integration).

Required Output Format:

Investigation Summary
[2-3 sentences explaining what this network represents and why it is suspicious]

Network Structure
[Describe the arrangement of accounts and how money flows through them]

Fraud Indicators
[List specific red flags observed in this network]

Risk Assessment
Risk Level: ${network.riskLevel}
[Explain why this network poses this level of risk to the financial system]

Recommended Actions
[List 4-5 specific investigative or regulatory actions to take immediately]

AML Compliance Notes
[Note any regulatory reporting obligations (e.g. SAR filing, FATF requirements)]`;

    // Try Gemini
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
        try {
            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
                {
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.5, maxOutputTokens: 2000 },
                },
                { timeout: 30000 }
            );
            const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) return text;
        } catch (err) {
            console.error('Gemini error for network report:', err.message);
        }
    }

    // Mock fallback
    return generateMockNetworkReport(network);
}

function generateMockNetworkReport(network) {
    const patternDescriptions = {
        'Layering Chain': 'multi-hop fund movement designed to obscure the origin of illicit proceeds',
        'Circular Loop': 'circular fund movement where money returns to the originating account after passing through intermediaries',
        'Star Network': 'hub-and-spoke arrangement where a central mule account coordinates transfers with multiple satellite accounts',
        'Rapid Multihop': 'high-velocity fund movement across multiple accounts within a compressed time window',
    };
    const desc = patternDescriptions[network.detectedPattern] || 'coordinated suspicious activity';

    return `Investigation Summary
This fraud network exhibits ${desc}. A total of ${network.accountCount} accounts are implicated with ₹${network.totalTransactionValue?.toLocaleString('en-IN')} in suspected suspicious transactions, yielding a network risk score of ${network.networkRiskScore}/100. The pattern is consistent with organized financial crime requiring immediate investigation.

Network Structure
The network consists of ${network.accountCount} interconnected accounts arranged in a ${network.detectedPattern} pattern. ${network.patternDetails?.centralAccount ? `Account ${network.patternDetails.centralAccount} appears to serve as the central coordination point.` : 'No single central account dominates the network.'} The transaction chain reaches a depth of ${network.patternDetails?.maxChainDepth || 'multiple'} hops, with funds traversing the network over approximately ${network.patternDetails?.timeSpanMinutes || 'unknown'} minutes.

Fraud Indicators
• ${network.detectedPattern} pattern detected across ${network.accountCount} accounts
• Total exposure of ₹${network.totalTransactionValue?.toLocaleString('en-IN')} across ${network.transactionCount} transactions
${network.patternDetails?.cyclesFound > 0 ? `• ${network.patternDetails.cyclesFound} circular fund return(s) detected — strongly indicative of round-tripping\n` : ''}• Transaction velocity inconsistent with legitimate commercial activity
• Network complexity exceeds normal customer behavior profiles

Risk Assessment
Risk Level: ${network.riskLevel}
The ${network.riskLevel.toLowerCase()} risk designation reflects the scale of financial exposure, the structured nature of the transaction pattern, and the number of accounts involved. ${network.riskLevel === 'Critical' ? 'Immediate intervention is required to prevent further fund dissipation.' : 'The pattern warrants escalated monitoring and investigation priority.'}

Recommended Actions
1. Freeze or place restrictions on the highest-risk accounts in this network pending investigation.
2. Conduct enhanced due diligence (EDD) on all ${network.accountCount} implicated accounts.
3. Trace the ultimate source and destination of funds beyond this network.
4. Review KYC documentation for all accounts — verify beneficial ownership.
5. Prepare and file a Suspicious Activity Report (SAR) with the appropriate regulatory authority.

AML Compliance Notes
This network pattern likely triggers SAR filing obligations under applicable AML regulations. Given the coordinated nature of the transfers, FATF Recommendation 20 (Reporting of Suspicious Transactions) applies. If cross-border flows are identified, FATF Recommendations 16 and 40 (Wire Transfers and International Cooperation) may also be relevant. Retain all transaction records per statutory requirements.`;
}

module.exports = router;
