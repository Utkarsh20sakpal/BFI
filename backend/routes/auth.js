const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/auth');
const AuditLog = require('../models/AuditLog');

/**
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, role, firstName, lastName } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'username, email, and password required' });
        }

        const existing = await User.findOne({ $or: [{ username }, { email }] });
        if (existing) return res.status(409).json({ error: 'Username or email already exists' });

        const user = new User({
            userId: `USR-${uuidv4().slice(0, 8).toUpperCase()}`,
            username,
            email,
            password,
            role: role || 'fraud_analyst',
            firstName,
            lastName,
        });

        await user.save();
        const token = jwt.sign(
            { userId: user.userId, role: user.role },
            process.env.JWT_SECRET || 'bfi_secret',
            { expiresIn: '8h' }
        );

        res.status(201).json({ success: true, token, user: user.toJSON() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'username and password required' });
        }

        const user = await User.findOne({ $or: [{ username }, { email: username }] });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const valid = await user.comparePassword(password);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        user.lastLogin = new Date();
        await user.save();

        const token = jwt.sign(
            { userId: user.userId, role: user.role },
            process.env.JWT_SECRET || 'bfi_secret',
            { expiresIn: '8h' }
        );

        res.json({ success: true, token, user: user.toJSON() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/auth/seed
 * Create default admin and analyst accounts for demo
 */
router.post('/seed', async (req, res) => {
    try {
        const defaults = [
            { username: 'admin', email: 'admin@bfi.bank', password: 'Admin@123', role: 'admin', firstName: 'System', lastName: 'Admin' },
            { username: 'analyst', email: 'analyst@bfi.bank', password: 'Analyst@123', role: 'fraud_analyst', firstName: 'Fraud', lastName: 'Analyst' },
            { username: 'viewer', email: 'viewer@bfi.bank', password: 'Viewer@123', role: 'viewer', firstName: 'Report', lastName: 'Viewer' },
        ];

        const created = [];
        for (const u of defaults) {
            const exists = await User.findOne({ username: u.username });
            if (!exists) {
                const user = new User({ userId: `USR-${uuidv4().slice(0, 8).toUpperCase()}`, ...u });
                await user.save();
                created.push(u.username);
            }
        }

        res.json({ success: true, created, message: 'Default users seeded' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/auth/me
 */
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'No token' });

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'bfi_secret');
        const user = await User.findOne({ userId: decoded.userId });
        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json({ user: user.toJSON() });
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

/**
 * GET /api/auth/users
 */
router.get('/users', protect, restrictTo('admin'), async (req, res) => {
    try {
        const users = await User.find().select('-password').sort('-createdAt');
        res.json({ users });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/auth/users
 */
router.post('/users', protect, restrictTo('admin'), async (req, res) => {
    try {
        const { username, email, password, role, firstName, lastName } = req.body;
        const existing = await User.findOne({ $or: [{ username }, { email }] });
        if (existing) return res.status(409).json({ error: 'Username or email already exists' });

        const user = new User({
            userId: `USR-${uuidv4().slice(0, 8).toUpperCase()}`,
            username, email, password, role, firstName, lastName
        });
        await user.save();

        await AuditLog.create({
            userId: req.user.userId,
            action: 'User Created',
            targetType: 'User',
            targetId: user.userId,
            details: `Created user ${username} with role ${role}`
        });

        res.status(201).json({ success: true, user: user.toJSON() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/auth/users/:id
 */
router.delete('/users/:id', protect, restrictTo('admin'), async (req, res) => {
    try {
        const user = await User.findOneAndDelete({ userId: req.params.id });
        if (!user) return res.status(404).json({ error: 'User not found' });

        await AuditLog.create({
            userId: req.user.userId,
            action: 'User Deleted',
            targetType: 'User',
            targetId: req.params.id,
            details: `Deleted user ${user.username}`
        });

        res.json({ success: true, message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/auth/users/:id
 */
router.put('/users/:id', protect, restrictTo('admin'), async (req, res) => {
    try {
        const { role, isActive, firstName, lastName } = req.body;
        const user = await User.findOneAndUpdate(
            { userId: req.params.id },
            { role, isActive, firstName, lastName },
            { new: true }
        );
        if (!user) return res.status(404).json({ error: 'User not found' });

        await AuditLog.create({
            userId: req.user.userId,
            action: 'User Updated',
            targetType: 'User',
            targetId: req.params.id,
            details: `Updated user ${user.username} role/status`
        });

        res.json({ success: true, user: user.toJSON() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
