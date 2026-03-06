require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');

const transactionRoutes = require('./routes/transactions');
const alertRoutes = require('./routes/alerts');
const accountRoutes = require('./routes/accounts');
const authRoutes = require('./routes/auth');
const reportRoutes = require('./routes/reports');
const graphRoutes = require('./routes/graph');
const healthRoutes = require('./routes/health');
const simulationRoutes = require('./routes/simulation');
const settingsRoutes = require('./routes/settings');
const networkRoutes = require('./routes/networks');

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.FRONTEND_URL
].filter(Boolean);

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
});

// Middleware
app.use(cors({
    origin: allowedOrigins,
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Attach io to req
app.use((req, res, next) => {
    req.io = io;
    next();
});

const { apiLimiter } = require('./middleware/rateLimiter');
app.use('/api', apiLimiter);

// Routes
const { protect, restrictTo } = require('./middleware/auth');

app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/alerts', protect, alertRoutes);
app.use('/api/accounts', protect, accountRoutes);
app.use('/api/reports', protect, reportRoutes);
app.use('/api/graph', protect, graphRoutes);
app.use('/api/health', protect, healthRoutes);
app.use('/api/simulation', protect, restrictTo('admin', 'fraud_analyst'), simulationRoutes);
app.use('/api/settings', protect, restrictTo('admin'), settingsRoutes);
app.use('/api/networks', protect, networkRoutes);

// Legacy route compatibility
app.post('/transaction', async (req, res) => {
    req.url = '/api/transactions';
    transactionRoutes(req, res);
});

// Health check
app.get('/', (req, res) => {
    res.json({
        name: 'BFI - Bank Fraud Investigator API',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/bfi')
    .then(() => console.log('✅ MongoDB connected'))
    .catch((err) => console.error('❌ MongoDB error:', err.message));

// Socket.io events
io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);
    socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
    });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 BFI Backend running on http://localhost:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = { app, io };
