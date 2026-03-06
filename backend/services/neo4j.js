/**
 * Neo4j Graph Database Service
 * Manages fund flow graph for money trail analysis
 */

let driver = null;

function getDriver() {
    if (!driver) {
        try {
            const neo4j = require('neo4j-driver');
            driver = neo4j.driver(
                process.env.NEO4J_URI || 'bolt://localhost:7687',
                neo4j.auth.basic(
                    process.env.NEO4J_USER || 'neo4j',
                    process.env.NEO4J_PASSWORD || 'password'
                )
            );
        } catch (err) {
            console.error('Neo4j driver error:', err.message);
        }
    }
    return driver;
}

async function isConnected() {
    try {
        const d = getDriver();
        if (!d) return false;
        const session = d.session();
        await session.run('RETURN 1');
        await session.close();
        return true;
    } catch {
        return false;
    }
}

/**
 * Add transaction to Neo4j graph
 */
async function addTransactionToGraph(transaction) {
    let session;
    try {
        const d = getDriver();
        if (!d) return false;

        session = d.session();
        await session.run(
            `MERGE (sender:Account {accountId: $sender})
       ON CREATE SET sender.createdAt = datetime(), sender.riskScore = 0
       MERGE (receiver:Account {accountId: $receiver})
       ON CREATE SET receiver.createdAt = datetime(), receiver.riskScore = 0
       MERGE (sender)-[t:TRANSFER {transactionId: $transactionId}]->(receiver)
       ON CREATE SET 
         t.amount = $amount,
         t.timestamp = $timestamp,
         t.riskScore = $riskScore,
         t.fraudType = $fraudType`,
            {
                sender: transaction.sender,
                receiver: transaction.receiver,
                transactionId: transaction.transactionId,
                amount: transaction.amount,
                timestamp: transaction.timestamp?.toString() || new Date().toString(),
                riskScore: transaction.riskScore || 0,
                fraudType: transaction.fraudType || '',
            }
        );
        return true;
    } catch (err) {
        console.error('Neo4j write error:', err.message);
        return false;
    } finally {
        if (session) await session.close();
    }
}

/**
 * Get fund flow graph for an account (n hops)
 */
async function getAccountGraph(accountId, depth = 3) {
    let session;
    try {
        const d = getDriver();
        if (!d) return null;

        session = d.session();
        const result = await session.run(
            `MATCH path = (start:Account {accountId: $accountId})-[:TRANSFER*1..${depth}]->(end:Account)
       WHERE start <> end
       RETURN path
       LIMIT 100`,
            { accountId }
        );

        const nodes = new Map();
        const edges = [];

        result.records.forEach(record => {
            const path = record.get('path');
            path.segments.forEach(segment => {
                const { start, end, relationship } = segment;

                if (!nodes.has(start.properties.accountId)) {
                    nodes.set(start.properties.accountId, {
                        id: start.properties.accountId,
                        label: start.properties.accountId,
                        riskScore: start.properties.riskScore?.toNumber() || 0,
                    });
                }
                if (!nodes.has(end.properties.accountId)) {
                    nodes.set(end.properties.accountId, {
                        id: end.properties.accountId,
                        label: end.properties.accountId,
                        riskScore: end.properties.riskScore?.toNumber() || 0,
                    });
                }

                edges.push({
                    id: relationship.properties.transactionId,
                    source: start.properties.accountId,
                    target: end.properties.accountId,
                    amount: relationship.properties.amount?.toNumber() || 0,
                    riskScore: relationship.properties.riskScore?.toNumber() || 0,
                    fraudType: relationship.properties.fraudType,
                });
            });
        });

        return {
            nodes: Array.from(nodes.values()),
            edges,
        };
    } catch (err) {
        console.error('Neo4j query error:', err.message);
        return null;
    } finally {
        if (session) await session.close();
    }
}

/**
 * Update node risk score in graph
 */
async function updateNodeRisk(accountId, riskScore) {
    let session;
    try {
        const d = getDriver();
        if (!d) return;
        session = d.session();
        await session.run(
            `MATCH (a:Account {accountId: $accountId})
       SET a.riskScore = $riskScore`,
            { accountId, riskScore }
        );
    } catch (err) {
        console.error('Neo4j update error:', err.message);
    } finally {
        if (session) await session.close();
    }
}

/**
 * Close driver
 */
async function close() {
    if (driver) {
        await driver.close();
        driver = null;
    }
}

module.exports = {
    addTransactionToGraph,
    getAccountGraph,
    updateNodeRisk,
    isConnected,
    close,
};
