/**
 * GenAI Investigation Report Service
 * Uses Google Gemini API (with OpenAI fallback) to generate fraud analysis reports
 */

const axios = require('axios');

/**
 * Generate AI-powered fraud investigation report
 */
async function generateFraudReport(alertData, transactions, account) {
    const prompt = buildInvestigationPrompt(alertData, transactions, account);

    // Try Gemini first
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
        try {
            return await callGemini(prompt);
        } catch (err) {
            console.error('Gemini API error:', err.message);
        }
    }

    // Try OpenAI fallback
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
        try {
            return await callOpenAI(prompt);
        } catch (err) {
            console.error('OpenAI API error:', err.message);
        }
    }

    // Generate mock AI report for demo
    return generateMockReport(alertData, transactions, account);
}

function buildInvestigationPrompt(alertData, transactions, account) {
    const txSummary = transactions.slice(0, 15).map(tx =>
        `${tx.sender} → ${tx.receiver}`
    ).join(' | ');

    return `Role:
You are a senior financial fraud investigator working for a major bank.

Objective:
Analyze suspicious transaction patterns and generate a concise professional investigation report.

Data Provided:
Transaction path: ${txSummary}
Total amount: ${alertData.totalAmount?.toLocaleString('en-IN') || 'Unknown'}
Time span: ${alertData.timeSpan || 'Unknown'} minutes
Detected fraud indicators: ${alertData.flags?.join(', ') || 'Unknown'}
Risk score: ${alertData.riskScore || 'Unknown'}/100

Instructions:
Explain the suspicious pattern clearly and professionally.
Avoid unnecessary wording.
Provide actionable insights.

The AI must generate reports in the following structured format.

Investigation Summary
[Provide a short explanation of why the transaction pattern is suspicious]

Transaction Pattern
[Describe the movement of funds across accounts, e.g., A -> B -> C -> D]

Fraud Indicators Detected
[List the triggers]

Risk Assessment
[Risk Level: Low / Medium / High / Critical]
[Explain reasoning briefly]

Recommended Investigation Actions
[List suggested next steps]`;
}

async function callGemini(prompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1500,
            },
        },
        { timeout: 30000 }
    );

    return response.data.candidates?.[0]?.content?.parts?.[0]?.text || generateMockReport({}, [], {});
}

async function callOpenAI(prompt) {
    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: 'You are a senior bank fraud analyst generating professional investigation reports.' },
                { role: 'user', content: prompt },
            ],
            max_tokens: 1500,
            temperature: 0.7,
        },
        {
            headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
            timeout: 30000,
        }
    );

    return response.data.choices?.[0]?.message?.content || generateMockReport({}, [], {});
}

function generateMockReport(alertData, transactions, account) {
    const fraudType = alertData.fraudType || 'Suspicious Activity';
    const riskScore = alertData.riskScore || 75;

    let path = 'Unknown';
    if (transactions && transactions.length > 0) {
        path = transactions.slice(0, 5).map(tx => `${tx.sender} -> ${tx.receiver}`).join(' | ');
    }

    const riskLevel = riskScore >= 85 ? 'Critical' : riskScore >= 70 ? 'High' : riskScore >= 40 ? 'Medium' : 'Low';

    return `Investigation Summary
The transaction pattern indicates artificial movement of funds consistent with ${fraudType}. This behavior deviates significantly from typical account baselines and suggests deliberate evasion techniques or unauthorized access.

Transaction Pattern
${path}

Fraud Indicators Detected
${alertData.flags?.map(f => f.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())).join('\n') || 'Multiple indicators detected'}

Risk Assessment
Risk Level: ${riskLevel}
Given the high velocity of transfers, the absence of prior relationship between these entities, and the ${fraudType} pattern detected, there is a strong probability of financial crime. Rule-based checks and behavioral baselines both confirm high anomalous activity.

Recommended Investigation Actions
1. Freeze associated accounts immediately to prevent further fund dissipation.
2. Request enhanced KYC re-verification for the account originators.
3. Trace final beneficiaries in the fund flow graph.
4. Prepare standard Suspicious Activity Report (SAR) for regulatory filing.`;
}

module.exports = { generateFraudReport };
