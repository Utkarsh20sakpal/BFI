const protectApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    if (apiKey && apiKey === process.env.SERVICE_API_KEY) {
        return next();
    }
    // Fallback pass if no API key is set for development, or handle unauthorized
    if (!process.env.SERVICE_API_KEY) {
        return next();
    }
    return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
};

module.exports = { protectApiKey };
