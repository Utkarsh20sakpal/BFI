import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { alertApi } from '../api';
import { RiskBadge, StatusBadge, FraudTypeBadge } from '../components/Badges';
import { formatDate } from '../utils/format';
import { AlertTriangle, Filter, Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

const FRAUD_TYPES = ['Layering', 'Structuring', 'Circular Flow', 'Dormant Account', 'Large Transaction', 'Rapid Transfer', 'ML Anomaly', 'Multiple Flags'];
const STATUSES = ['Open', 'Investigating', 'Closed', 'False Positive'];
const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];

export default function AlertsPage() {
    const navigate = useNavigate();
    const [alerts, setAlerts] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({ status: '', fraudType: '', riskLevel: '' });

    const loadAlerts = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = { page, limit: 20, sort: '-createdAt' };
            if (filters.status) params.status = filters.status;
            if (filters.fraudType) params.fraudType = filters.fraudType;
            if (filters.riskLevel) params.riskLevel = filters.riskLevel;

            const res = await alertApi.list(params);
            setAlerts(res.data.alerts || []);
            setTotal(res.data.total || 0);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [page, filters]);

    useEffect(() => { loadAlerts(); }, [loadAlerts]);

    const totalPages = Math.ceil(total / 20);

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="page-title">Fraud Alerts</h1>
                    <p className="page-subtitle">Suspicious activities detected by the fraud detection engine</p>
                </div>
                <button
                    onClick={loadAlerts}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:text-teal-400 glass-card border border-white/10 rounded-lg transition-colors"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            <div className="info-panel">
                <p>
                    The <strong className="text-teal-400">Alerts Queue</strong> shows all suspicious transactions flagged
                    by the BFI fraud detection engine. Each alert includes a risk score (0–100), fraud type classification,
                    and investigation status. Click any alert to open the full investigation workspace.
                </p>
            </div>

            {/* Stats pills */}
            <div className="flex gap-3 mb-5 flex-wrap">
                {STATUSES.map(s => {
                    const colors: Record<string, string> = {
                        'Open': 'border-red-500/30 bg-red-500/10 text-red-400',
                        'Investigating': 'border-orange-500/30 bg-orange-500/10 text-orange-400',
                        'Closed': 'border-green-500/30 bg-green-500/10 text-green-400',
                        'False Positive': 'border-slate-500/30 bg-slate-500/10 text-slate-400',
                    };
                    return (
                        <button
                            key={s}
                            onClick={() => setFilters(f => ({ ...f, status: f.status === s ? '' : s }))}
                            className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${filters.status === s ? colors[s] : 'border-white/10 text-slate-400 hover:border-white/20'
                                }`}
                        >
                            {s}
                        </button>
                    );
                })}
            </div>

            {/* Filters */}
            <div className="glass-card p-4 mb-4">
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2 text-slate-400">
                        <Filter size={14} />
                        <span className="text-xs font-medium">Filters</span>
                    </div>
                    <select
                        value={filters.fraudType}
                        onChange={e => setFilters(f => ({ ...f, fraudType: e.target.value }))}
                        className="text-xs bg-navy-800 border border-white/10 rounded-lg px-3 py-1.5 text-slate-300 focus:outline-none focus:border-teal-500"
                    >
                        <option value="">All Fraud Types</option>
                        {FRAUD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select
                        value={filters.riskLevel}
                        onChange={e => setFilters(f => ({ ...f, riskLevel: e.target.value }))}
                        className="text-xs bg-navy-800 border border-white/10 rounded-lg px-3 py-1.5 text-slate-300 focus:outline-none focus:border-teal-500"
                    >
                        <option value="">All Risk Levels</option>
                        {RISK_LEVELS.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
                    </select>
                    {(filters.status || filters.fraudType || filters.riskLevel) && (
                        <button
                            onClick={() => setFilters({ status: '', fraudType: '', riskLevel: '' })}
                            className="text-xs text-teal-400 hover:underline"
                        >
                            Clear filters
                        </button>
                    )}
                    <span className="ml-auto text-xs text-slate-500">{total} alerts found</span>
                </div>
            </div>

            {/* Table */}
            <div className="glass-card overflow-hidden">
                <table className="w-full text-xs">
                    <thead className="border-b border-white/5">
                        <tr>
                            <th className="text-left px-4 py-3 text-slate-500 font-medium">Alert ID</th>
                            <th className="text-left px-4 py-3 text-slate-500 font-medium">Account</th>
                            <th className="text-center px-4 py-3 text-slate-500 font-medium">Risk Score</th>
                            <th className="text-left px-4 py-3 text-slate-500 font-medium">Fraud Type</th>
                            <th className="text-left px-4 py-3 text-slate-500 font-medium">Status</th>
                            <th className="text-left px-4 py-3 text-slate-500 font-medium">Timestamp</th>
                            <th className="text-left px-4 py-3 text-slate-500 font-medium">Flags</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} className="py-12 text-center text-slate-500">
                                <div className="spinner w-6 h-6 mx-auto mb-2" />Loading alerts...
                            </td></tr>
                        ) : alerts.length === 0 ? (
                            <tr><td colSpan={7} className="py-12 text-center text-slate-500">
                                No alerts found. Run the simulation to generate fraud activity.
                            </td></tr>
                        ) : alerts.map(alert => (
                            <tr
                                key={alert.alertId}
                                onClick={() => navigate(`/investigation?alert=${alert.alertId}`)}
                                className="table-row-hover border-b border-white/[0.03] cursor-pointer"
                            >
                                <td className="px-4 py-3 font-mono text-teal-400 font-semibold text-[11px]">{alert.alertId}</td>
                                <td className="px-4 py-3 text-slate-300 font-medium">{alert.accountId}</td>
                                <td className="px-4 py-3 text-center">
                                    <RiskBadge score={alert.riskScore} />
                                </td>
                                <td className="px-4 py-3"><FraudTypeBadge type={alert.fraudType} /></td>
                                <td className="px-4 py-3"><StatusBadge status={alert.status} /></td>
                                <td className="px-4 py-3 text-slate-500">{formatDate(alert.createdAt)}</td>
                                <td className="px-4 py-3">
                                    <div className="flex gap-1 flex-wrap max-w-[200px]">
                                        {alert.flags?.slice(0, 3).map((flag: string) => (
                                            <span key={flag} className="text-[10px] bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded">
                                                {flag.replace('_', ' ')}
                                            </span>
                                        ))}
                                        {(alert.flags?.length || 0) > 3 && (
                                            <span className="text-[10px] text-slate-500">+{alert.flags.length - 3}</span>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                        <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-1.5 rounded glass-card border border-white/10 text-slate-400 hover:text-teal-400 disabled:opacity-30"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="p-1.5 rounded glass-card border border-white/10 text-slate-400 hover:text-teal-400 disabled:opacity-30"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
