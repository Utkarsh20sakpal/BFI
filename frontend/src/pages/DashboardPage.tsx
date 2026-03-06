import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { alertApi, transactionApi, accountApi } from '../api';
import MetricCard from '../components/MetricCard';
import { RiskBadge, FraudTypeBadge, StatusBadge } from '../components/Badges';
import { formatCurrency, formatShortDate, numberWithCommas } from '../utils/format';
import {
    AlertTriangle, TrendingUp, Users, DollarSign,
    Activity, Eye, RefreshCw, Zap
} from 'lucide-react';

const FRAUD_TYPE_COLORS: Record<string, string> = {
    'Layering': '#ef4444',
    'Structuring': '#f97316',
    'Circular Flow': '#a855f7',
    'Dormant Account': '#eab308',
    'Large Transaction': '#3b82f6',
    'Rapid Transfer': '#ec4899',
    'ML Anomaly': '#06b6d4',
    'Multiple Flags': '#f43f5e',
};

export default function DashboardPage() {
    const navigate = useNavigate();
    const { isAdmin } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [dashData, setDashData] = useState<any>({
        txStats: null,
        alertStats: null,
        accountStats: null,
        recentAlerts: [],
        recentTxns: [],
    });

    const loadData = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const [txStatsRes, alertStatsRes, accountStatsRes, alertsRes, txnsRes] = await Promise.all([
                transactionApi.stats(),
                alertApi.stats(),
                accountApi.stats(),
                alertApi.list({ limit: 6, sort: '-createdAt' }),
                transactionApi.list({ limit: 8, sort: '-timestamp' }),
            ]);

            setDashData({
                txStats: txStatsRes.data,
                alertStats: alertStatsRes.data,
                accountStats: accountStatsRes.data,
                recentAlerts: alertsRes.data.alerts || [],
                recentTxns: txnsRes.data.transactions || [],
            });
        } catch (err) {
            console.error('Dashboard load error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
        const interval = setInterval(() => loadData(true), 30000);
        return () => clearInterval(interval);
    }, []);

    const { txStats, alertStats, accountStats, recentAlerts, recentTxns } = dashData;

    // Chart data
    const alertsByDay = alertStats?.recentAlerts?.slice(-14).map((d: any) => ({
        date: d._id?.slice(5),
        alerts: d.count,
    })) || [];

    const txVolumeByDay = txStats?.volumeByDay?.slice(-14).map((d: any) => ({
        date: d._id?.slice(5),
        total: d.count,
        fraud: d.fraudCount,
        volume: Math.round(d.volume / 100000),
    })) || [];

    const fraudByType = alertStats?.byType?.map((d: any) => ({
        name: d._id,
        value: d.count,
        color: FRAUD_TYPE_COLORS[d._id] || '#64748b',
    })) || [];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <div className="spinner w-10 h-10" />
                    <p className="text-slate-400 text-sm">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="page-title">Fraud Detection Dashboard</h1>
                    <p className="page-subtitle">Real-time monitoring of banking transactions and fraud risk</p>
                </div>
                <button
                    onClick={() => loadData(true)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:text-teal-400 glass-card border border-white/10 rounded-lg transition-colors ${refreshing ? 'opacity-50' : ''}`}
                    disabled={refreshing}
                >
                    <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                    {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            {/* Info panel */}
            <div className="info-panel mb-6">
                <p>
                    <strong className="text-teal-400">BFI Dashboard</strong> continuously monitors all banking transactions
                    in real-time. The fraud detection engine analyzes each transaction using rule-based checks and
                    ML anomaly detection to identify suspicious patterns including layering, structuring, and circular flows.
                </p>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <MetricCard
                    label="Total Transactions"
                    value={numberWithCommas(txStats?.totalTransactions || 0)}
                    icon={<Activity size={20} />}
                    accent="teal"
                    subtitle="All time"
                />
                <MetricCard
                    label="Fraud Alerts"
                    value={alertStats?.total || 0}
                    icon={<AlertTriangle size={20} />}
                    accent="red"
                    subtitle={`${alertStats?.open || 0} open`}
                />
                <MetricCard
                    label="High Risk Accounts"
                    value={accountStats?.highRisk || 0}
                    icon={<Users size={20} />}
                    accent="orange"
                    subtitle={`${accountStats?.suspicious || 0} suspicious`}
                />
                <MetricCard
                    label="Flagged Amount"
                    value={formatCurrency(txStats?.totalFlaggedAmount || 0)}
                    icon={<DollarSign size={20} />}
                    accent="yellow"
                    subtitle="Total detected"
                />
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <MetricCard
                    label="Open Alerts"
                    value={alertStats?.open || 0}
                    icon={<Zap size={18} />}
                    accent="red"
                />
                <MetricCard
                    label="Investigating"
                    value={alertStats?.investigating || 0}
                    icon={<Eye size={18} />}
                    accent="orange"
                />
                <MetricCard
                    label="Closed Cases"
                    value={alertStats?.closed || 0}
                    icon={<TrendingUp size={18} />}
                    accent="green"
                />
                <MetricCard
                    label="Total Accounts"
                    value={numberWithCommas(accountStats?.total || 0)}
                    icon={<Users size={18} />}
                    accent="teal"
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                {/* Fraud Alerts Over Time */}
                <div className="glass-card p-5">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                        <AlertTriangle size={16} className="text-red-400" />
                        Fraud Alerts Over Time
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={alertsByDay}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                            <Tooltip
                                contentStyle={{ background: '#0d2244', border: '1px solid rgba(45,212,191,0.2)', borderRadius: 8, color: '#e2e8f0' }}
                            />
                            <Line type="monotone" dataKey="alerts" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 3 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Transaction Volume */}
                <div className="glass-card p-5">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                        <Activity size={16} className="text-teal-400" />
                        Transaction Volume (Last 14 Days)
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={txVolumeByDay}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                            <Tooltip
                                contentStyle={{ background: '#0d2244', border: '1px solid rgba(45,212,191,0.2)', borderRadius: 8, color: '#e2e8f0' }}
                            />
                            <Bar dataKey="total" fill="rgba(20,184,166,0.4)" name="Total" />
                            <Bar dataKey="fraud" fill="rgba(239,68,68,0.6)" name="Fraud" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Fraud Type Distribution + Recent Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                {/* Pie Chart */}
                <div className="glass-card p-5">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                        <Zap size={16} className="text-teal-400" />
                        Fraud Type Distribution
                    </h3>
                    {fraudByType.length > 0 ? (
                        <>
                            <ResponsiveContainer width="100%" height={160}>
                                <PieChart>
                                    <Pie data={fraudByType} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={2}>
                                        {fraudByType.map((entry: any, i: number) => (
                                            <Cell key={i} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ background: '#0d2244', border: '1px solid rgba(45,212,191,0.2)', borderRadius: 8, color: '#e2e8f0' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="space-y-1.5 mt-2">
                                {fraudByType.slice(0, 4).map((entry: any) => (
                                    <div key={entry.name} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
                                            <span className="text-slate-400 truncate">{entry.name}</span>
                                        </div>
                                        <span className="font-semibold text-white">{entry.value}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
                            No fraud data yet
                        </div>
                    )}
                </div>

                {/* Recent Alerts */}
                <div className="lg:col-span-2 glass-card p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                            <AlertTriangle size={16} className="text-red-400" />
                            Recent Fraud Alerts
                        </h3>
                        {!isAdmin && (
                            <button onClick={() => navigate('/alerts')} className="text-xs text-teal-400 hover:underline">
                                View all →
                            </button>
                        )}
                    </div>
                    <div className="space-y-2">
                        {recentAlerts.length > 0 ? recentAlerts.map((alert: any) => (
                            <div
                                key={alert.alertId}
                                onClick={() => !isAdmin && navigate(`/investigation?alert=${alert.alertId}`)}
                                className={`flex items-center justify-between p-3 rounded-lg bg-navy-800/50 hover:bg-navy-800 transition-colors border border-white/5 ${isAdmin ? 'cursor-default' : 'cursor-pointer'}`}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div>
                                        <div className="text-xs font-mono text-teal-400 font-semibold">{alert.alertId}</div>
                                        <div className="text-xs text-slate-400 mt-0.5 truncate">{alert.accountId}</div>
                                    </div>
                                    <FraudTypeBadge type={alert.fraudType} />
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                    <RiskBadge score={alert.riskScore} />
                                    <StatusBadge status={alert.status} />
                                    <span className="text-[10px] text-slate-500">{formatShortDate(alert.createdAt)}</span>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-8 text-slate-500 text-sm">
                                No alerts yet. Run a simulation to generate fraud activity.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Transactions */}
            <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Activity size={16} className="text-teal-400" />
                        Recent Transactions
                    </h3>
                    {!isAdmin && (
                        <button onClick={() => navigate('/transactions')} className="text-xs text-teal-400 hover:underline">
                            View all →
                        </button>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="pb-2 text-left text-slate-500 font-medium">Transaction ID</th>
                                <th className="pb-2 text-left text-slate-500 font-medium">Sender</th>
                                <th className="pb-2 text-left text-slate-500 font-medium">Receiver</th>
                                <th className="pb-2 text-right text-slate-500 font-medium">Amount</th>
                                <th className="pb-2 text-center text-slate-500 font-medium">Risk</th>
                                <th className="pb-2 text-left text-slate-500 font-medium">Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentTxns.map((tx: any) => (
                                <tr key={tx.transactionId} className="table-row-hover border-b border-white/[0.03]">
                                    <td className="py-2 font-mono text-teal-400">{tx.transactionId?.slice(0, 16)}...</td>
                                    <td className="py-2 text-slate-300">{tx.sender}</td>
                                    <td className="py-2 text-slate-300">{tx.receiver}</td>
                                    <td className="py-2 text-right text-white font-medium">{formatCurrency(tx.amount)}</td>
                                    <td className="py-2 text-center"><RiskBadge score={tx.riskScore} showLabel={false} size="sm" /></td>
                                    <td className="py-2 text-slate-500">{formatShortDate(tx.timestamp)}</td>
                                </tr>
                            ))}
                            {recentTxns.length === 0 && (
                                <tr><td colSpan={6} className="py-8 text-center text-slate-500">No transactions yet</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
