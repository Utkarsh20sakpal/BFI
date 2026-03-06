import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_BASE,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('bfi_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Handle 401
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem('bfi_token');
            localStorage.removeItem('bfi_user');
            window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);

// ─── AUTH ──────────────────────────────────────
export const authApi = {
    login: (username: string, password: string) =>
        api.post('/auth/login', { username, password }),
    register: (data: any) => api.post('/auth/register', data),
    seed: () => api.post('/auth/seed'),
    me: () => api.get('/auth/me'),
    getUsers: () => api.get('/auth/users'),
    createUser: (data: any) => api.post('/auth/users', data),
    updateUser: (id: string, data: any) => api.put(`/auth/users/${id}`, data),
    deleteUser: (id: string) => api.delete(`/auth/users/${id}`),
};

// ─── TRANSACTIONS ──────────────────────────────
export const transactionApi = {
    list: (params?: any) => api.get('/transactions', { params }),
    get: (id: string) => api.get(`/transactions/${id}`),
    stats: () => api.get('/transactions/stats'),
    create: (data: any) => api.post('/transactions', data),
};

// ─── ALERTS ────────────────────────────────────
export const alertApi = {
    list: (params?: any) => api.get('/alerts', { params }),
    stats: () => api.get('/alerts/stats'),
    get: (id: string) => api.get(`/alerts/${id}`),
    updateStatus: (id: string, status: string, assignedTo?: string) =>
        api.put(`/alerts/${id}/status`, { status, assignedTo }),
    addNote: (id: string, note: string, author?: string) =>
        api.post(`/alerts/${id}/notes`, { note, author }),
    generateReport: (id: string) =>
        api.post(`/alerts/${id}/generate-report`),
};

// ─── ACCOUNTS ──────────────────────────────────
export const accountApi = {
    list: (params?: any) => api.get('/accounts', { params }),
    stats: () => api.get('/accounts/stats'),
    get: (id: string) => api.get(`/accounts/${id}`),
    update: (id: string, data: any) => api.put(`/accounts/${id}`, data),
};

// ─── GRAPH ─────────────────────────────────────
export const graphApi = {
    getAccountGraph: (accountId: string, depth?: number) =>
        api.get(`/graph/${accountId}`, { params: { depth } }),
    getOverview: () => api.get('/graph/overview/summary'),
};

// ─── REPORTS & AUDIT ───────────────────────────
export const reportApi = {
    list: (params?: any) => api.get('/reports', { params }),
    summary: () => api.get('/reports/summary'),
    getAuditLogs: (params?: any) => api.get('/reports/audit', { params }),
};

// ─── SETTINGS ──────────────────────────────────
export const settingsApi = {
    getRules: () => api.get('/settings/rules'),
    updateRules: (data: any) => api.put('/settings/rules', data),
};

// ─── HEALTH ────────────────────────────────────
export const healthApi = {
    get: () => api.get('/health'),
};

// ─── SIMULATION ────────────────────────────────
export const simulationApi = {
    start: (config: any) => api.post('/simulation/start', config),
    stop: () => api.post('/simulation/stop'),
    status: () => api.get('/simulation/status'),
    demo: () => api.post('/simulation/demo'),
};

// ─── FRAUD NETWORKS ────────────────────────────────────────────────────────
export const networkApi = {
    list: (params?: any) => api.get('/networks', { params }),
    stats: () => api.get('/networks/stats'),
    get: (id: string) => api.get(`/networks/${id}`),
    analyze: (id: string) => api.post(`/networks/${id}/analyze`),
    updateStatus: (id: string, status: string) => api.put(`/networks/${id}/status`, { status }),
    addNote: (id: string, note: string) => api.post(`/networks/${id}/notes`, { note }),
    scan: (data?: any) => api.post('/networks/scan', data),
};

export default api;
