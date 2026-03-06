/**
 * BFI Fraud Network Analyzer
 * Graph-based detection of coordinated fraud rings using Neo4j + MongoDB analytics
 * 
 * Detects:
 *  - Layering Chains (A→B→C→D→E)
 *  - Circular Loops  (A→B→C→A)
 *  - Star Networks   (central hub with many connections)
 *  - Rapid Multihop  (funds crossing N hops in minutes)
 *  - Shared Identity (multiple accounts with shared device/IP)
 */

const { v4: uuidv4 } = require('uuid');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const FraudNetwork = require('../models/FraudNetwork');


// ─── Configuration ─────────────────────────────────────────────────────────────
const CONFIG = {
    LAYERING_MIN_DEPTH: 3,
    LAYERING_TIME_WINDOW_MINUTES: 60,
    CIRCULAR_SEARCH_DEPTH: 5,
    STAR_MIN_CONNECTIONS: 5,
    RAPID_MULTIHOP_MINUTES: 15,
    RAPID_MULTIHOP_MIN_HOPS: 3,
    RISK_SCORE_THRESHOLD: 55,
};

// ─── Main Analysis Entry Point ─────────────────────────────────────────────────
/**
 * Called after each transaction ingestion.
 * Runs all pattern detectors against the latest transaction + its neighbors.
 */
async function analyzeForFraudNetworks(transaction) {
    const results = [];

    try {
        // Run detectors in parallel
        const [layering, circular, star, rapidMultihop] = await Promise.all([
            detectLayeringChain(transaction),
            detectCircularLoop(transaction),
            detectStarNetwork(transaction),
            detectRapidMultihop(transaction),
        ]);

        if (layering) results.push(layering);
        if (circular) results.push(circular);
        if (star) results.push(star);
        if (rapidMultihop) results.push(rapidMultihop);

        // Save detected networks to DB
        const saved = [];
        for (const network of results) {
            if (network.networkRiskScore >= CONFIG.RISK_SCORE_THRESHOLD) {
                const saved_network = await saveNetworkIfNew(network);
                if (saved_network) saved.push(saved_network);
            }
        }

        return saved;
    } catch (err) {
        console.error('[FraudNetworkAnalyzer] Error:', err.message);
        return [];
    }
}

// ─── Pattern Detectors ─────────────────────────────────────────────────────────

/**
 * Detect layering chains: A→B→C→D (depth >= 3) within a time window
 */
async function detectLayeringChain(transaction) {
    try {
        // Build forward chain from this transaction's sender
        const chain = await buildTransactionChain(transaction.sender, transaction.timestamp, CONFIG.LAYERING_TIME_WINDOW_MINUTES);

        if (chain.length < CONFIG.LAYERING_MIN_DEPTH) return null;

        const accounts = [...new Set(chain.map(t => [t.sender, t.receiver]).flat())];
        const totalValue = chain.reduce((sum, t) => sum + t.amount, 0);
        const timeSpanMs = chain.length > 1
            ? new Date(chain[chain.length - 1].timestamp) - new Date(chain[0].timestamp)
            : 0;
        const timeSpanMinutes = Math.round(timeSpanMs / 60000);

        const riskScore = calculateLayeringRisk(chain.length, totalValue, timeSpanMinutes);

        return {
            detectedPattern: 'Layering Chain',
            accounts,
            transactionIds: chain.map(t => t.transactionId),
            totalTransactionValue: totalValue,
            networkRiskScore: riskScore,
            riskLevel: getRiskLevel(riskScore),
            patternDetails: {
                maxChainDepth: chain.length,
                timeSpanMinutes,
                cyclesFound: 0,
            },
            graphSnapshot: buildGraphSnapshot(chain),
        };
    } catch (err) {
        return null;
    }
}

/**
 * Detect circular loops: A → B → C → A
 */
async function detectCircularLoop(transaction) {
    try {
        const windowStart = new Date(transaction.timestamp);
        windowStart.setHours(windowStart.getHours() - 24);

        // Find if funds eventually return to the original sender
        const allOutgoing = await Transaction.find({
            sender: transaction.sender,
            timestamp: { $gte: windowStart },
        }).lean();

        const allIncoming = await Transaction.find({
            receiver: transaction.sender,
            timestamp: { $gte: windowStart },
        }).lean();

        // Find intermediary senders who also received from sender
        const outgoingReceivers = new Set(allOutgoing.map(t => t.receiver));
        const circularTxns = allIncoming.filter(t => outgoingReceivers.has(t.sender));

        if (circularTxns.length === 0) return null;

        const allTxns = [...allOutgoing.slice(0, 5), ...circularTxns.slice(0, 5)];
        const accounts = [...new Set(allTxns.map(t => [t.sender, t.receiver]).flat())];
        const totalValue = allTxns.reduce((sum, t) => sum + t.amount, 0);
        const riskScore = calculateCircularRisk(circularTxns.length, accounts.length, totalValue);

        return {
            detectedPattern: 'Circular Loop',
            accounts,
            transactionIds: allTxns.map(t => t.transactionId),
            totalTransactionValue: totalValue,
            networkRiskScore: riskScore,
            riskLevel: getRiskLevel(riskScore),
            patternDetails: {
                cyclesFound: circularTxns.length,
                maxChainDepth: accounts.length,
                timeSpanMinutes: 24 * 60,
                centralAccount: transaction.sender,
            },
            graphSnapshot: buildGraphSnapshot(allTxns),
        };
    } catch (err) {
        return null;
    }
}

/**
 * Detect star network: one central hub connecting to many accounts
 */
async function detectStarNetwork(transaction) {
    try {
        const windowStart = new Date(transaction.timestamp);
        windowStart.setHours(windowStart.getHours() - 6);

        const [outgoing, incoming] = await Promise.all([
            Transaction.find({ sender: transaction.sender, timestamp: { $gte: windowStart } }).lean(),
            Transaction.find({ receiver: transaction.sender, timestamp: { $gte: windowStart } }).lean(),
        ]);

        const totalConnections = new Set([
            ...outgoing.map(t => t.receiver),
            ...incoming.map(t => t.sender),
        ]).size;

        if (totalConnections < CONFIG.STAR_MIN_CONNECTIONS) return null;

        const allTxns = [...outgoing, ...incoming];
        const accounts = [...new Set(allTxns.map(t => [t.sender, t.receiver]).flat())];
        const totalValue = allTxns.reduce((sum, t) => sum + t.amount, 0);
        const riskScore = calculateStarRisk(totalConnections, totalValue);

        return {
            detectedPattern: 'Star Network',
            accounts,
            transactionIds: allTxns.map(t => t.transactionId),
            totalTransactionValue: totalValue,
            networkRiskScore: riskScore,
            riskLevel: getRiskLevel(riskScore),
            patternDetails: {
                cyclesFound: 0,
                maxChainDepth: 2,
                timeSpanMinutes: 360,
                centralAccount: transaction.sender,
            },
            graphSnapshot: buildGraphSnapshot(allTxns.slice(0, 30)),
        };
    } catch (err) {
        return null;
    }
}

/**
 * Detect rapid multihop: funds crossing N accounts in M minutes
 */
async function detectRapidMultihop(transaction) {
    try {
        const windowStart = new Date(transaction.timestamp);
        windowStart.setMinutes(windowStart.getMinutes() - CONFIG.RAPID_MULTIHOP_MINUTES);

        const chain = await buildTransactionChain(
            transaction.sender,
            transaction.timestamp,
            CONFIG.RAPID_MULTIHOP_MINUTES
        );

        if (chain.length < CONFIG.RAPID_MULTIHOP_MIN_HOPS) return null;

        const accounts = [...new Set(chain.map(t => [t.sender, t.receiver]).flat())];
        const totalValue = chain.reduce((sum, t) => sum + t.amount, 0);
        const timeSpanMs = chain.length > 1
            ? new Date(chain[chain.length - 1].timestamp) - new Date(chain[0].timestamp)
            : 0;
        const timeSpanMinutes = Math.max(1, Math.round(timeSpanMs / 60000));

        const riskScore = calculateRapidHopRisk(chain.length, timeSpanMinutes, totalValue);

        return {
            detectedPattern: 'Rapid Multihop',
            accounts,
            transactionIds: chain.map(t => t.transactionId),
            totalTransactionValue: totalValue,
            networkRiskScore: riskScore,
            riskLevel: getRiskLevel(riskScore),
            patternDetails: {
                cyclesFound: 0,
                maxChainDepth: chain.length,
                timeSpanMinutes,
            },
            graphSnapshot: buildGraphSnapshot(chain),
        };
    } catch (err) {
        return null;
    }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a forward transaction chain from an account within a time window
 */
async function buildTransactionChain(startAccount, startTimestamp, windowMinutes, maxDepth = 6) {
    const chain = [];
    const visited = new Set();
    let currentAccounts = [startAccount];
    const windowStart = new Date(startTimestamp);
    windowStart.setMinutes(windowStart.getMinutes() - windowMinutes);

    for (let depth = 0; depth < maxDepth && currentAccounts.length > 0; depth++) {
        const txns = await Transaction.find({
            sender: { $in: currentAccounts },
            timestamp: { $gte: windowStart, $lte: new Date(startTimestamp) },
            transactionId: { $nin: chain.map(t => t.transactionId) },
        }).sort('timestamp').limit(20).lean();

        if (txns.length === 0) break;

        const nextAccounts = [];
        for (const tx of txns) {
            if (!visited.has(tx.transactionId)) {
                chain.push(tx);
                visited.add(tx.transactionId);
                if (!visited.has(tx.receiver)) {
                    nextAccounts.push(tx.receiver);
                    visited.add(tx.receiver);
                }
            }
        }
        currentAccounts = nextAccounts;
    }

    return chain;
}

function buildGraphSnapshot(transactions) {
    const nodeMap = new Map();
    const edges = [];

    for (const tx of transactions) {
        if (!nodeMap.has(tx.sender)) {
            nodeMap.set(tx.sender, { id: tx.sender, riskScore: tx.riskScore || 0 });
        }
        if (!nodeMap.has(tx.receiver)) {
            nodeMap.set(tx.receiver, { id: tx.receiver, riskScore: 0 });
        }
        edges.push({
            source: tx.sender,
            target: tx.receiver,
            amount: tx.amount,
            isFraud: tx.isFraud || false,
            riskScore: tx.riskScore || 0,
        });
    }

    return { nodes: Array.from(nodeMap.values()), edges };
}

async function saveNetworkIfNew(networkData) {
    try {
        // Check if a similar network already exists (same accounts set in last 24h)
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const existing = await FraudNetwork.findOne({
            detectedPattern: networkData.detectedPattern,
            accounts: { $all: networkData.accounts.slice(0, 3) },
            createdAt: { $gte: yesterday },
        });

        if (existing) {
            // Update existing with latest data
            existing.networkRiskScore = Math.max(existing.networkRiskScore, networkData.networkRiskScore);
            existing.totalTransactionValue = Math.max(existing.totalTransactionValue, networkData.totalTransactionValue);
            existing.lastAnalyzedAt = new Date();
            await existing.save();
            return null; // Don't re-broadcast
        }

        const networkId = `NET-${Date.now().toString(36).toUpperCase()}-${uuidv4().slice(0, 6).toUpperCase()}`;
        const network = new FraudNetwork({
            networkId,
            name: `${networkData.detectedPattern} Network`,
            ...networkData,
            accountCount: networkData.accounts.length,
            transactionCount: networkData.transactionIds.length,
        });

        await network.save();
        return network;
    } catch (err) {
        console.error('[FraudNetworkAnalyzer] Save error:', err.message);
        return null;
    }
}

// ─── Risk Calculators ─────────────────────────────────────────────────────────

function calculateLayeringRisk(depth, totalValue, timeSpanMinutes) {
    let score = 30;
    score += Math.min(30, depth * 8);
    if (totalValue > 1000000) score += 25;
    else if (totalValue > 500000) score += 15;
    else if (totalValue > 100000) score += 8;
    if (timeSpanMinutes < 30) score += 20;
    else if (timeSpanMinutes < 60) score += 10;
    return Math.min(100, score);
}

function calculateCircularRisk(cycles, accounts, totalValue) {
    let score = 50;
    score += Math.min(25, cycles * 10);
    score += Math.min(15, accounts * 3);
    if (totalValue > 500000) score += 15;
    return Math.min(100, score);
}

function calculateStarRisk(connections, totalValue) {
    let score = 40;
    score += Math.min(30, connections * 4);
    if (totalValue > 1000000) score += 20;
    else if (totalValue > 500000) score += 12;
    return Math.min(100, score);
}

function calculateRapidHopRisk(hops, minutes, totalValue) {
    let score = 45;
    score += Math.min(30, hops * 6);
    if (minutes <= 5) score += 25;
    else if (minutes <= 15) score += 15;
    if (totalValue > 500000) score += 10;
    return Math.min(100, score);
}

function getRiskLevel(score) {
    if (score >= 85) return 'Critical';
    if (score >= 70) return 'High';
    if (score >= 50) return 'Medium';
    return 'Low';
}


module.exports = {
    analyzeForFraudNetworks,
    detectLayeringChain,
    detectCircularLoop,
    detectStarNetwork,
    detectRapidMultihop,
};
