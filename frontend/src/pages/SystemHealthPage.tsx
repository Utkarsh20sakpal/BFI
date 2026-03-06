import React, { useState, useEffect } from 'react';
import { healthApi } from '../api';
import axios from 'axios';
import { Activity, CheckCircle, XCircle, AlertTriangle, RefreshCw, Server, Database, Cpu, Zap } from 'lucide-react';

export default function SystemHealthPage() {
    const [health, setHealth] = useState<any>(null);
    const [mlMetrics, setMlMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const loadHealth = async () => {
        setLoading(true);
        try {
            const res = await healthApi.get();
            setHealth(res.data);
            setLastUpdated(new Date());

            // Try to load ML metrics through proxy
            try {
                const mlRes = await healthApi.getMlMetrics();
                setMlMetrics(mlRes.data);
            } catch (err) {
                console.warn('ML metrics failed through proxy:', err);
                // Fallback to direct if proxy fails (unlikely)
                try {
                    const directRes = await axios.get('http://localhost:8001/evaluate', { timeout: 2000 });
                    setMlMetrics(directRes.data);
                } catch { }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadHealth();
        const t = setInterval(loadHealth, 30000);
        return () => clearInterval(t);
    }, []);

    const ServiceStatus = ({ name, status, sub }: { name: string; status: string; sub?: string }) => {
        const isOk = ['running', 'connected', 'active'].includes(status?.toLowerCase());

        return (
            <div className={`flex items-center justify-between p-4 rounded-xl border ${isOk ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'
                }`}>
                <div className="flex items-center gap-3">
                    {isOk
                        ? <CheckCircle size={18} className="text-green-400" />
                        : <XCircle size={18} className="text-red-400" />
                    }
                    <div>
                        <div className="text-sm font-semibold text-white">{name}</div>
                        {sub && <div className="text-xs text-slate-500">{sub}</div>}
                    </div>
                </div>
                <div className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full ${isOk ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                    <span className={`w-1.5 h-1.5 rounded-full bg-current ${isOk ? 'status-dot-pulse' : ''}`} />
                    {status?.toUpperCase() || 'UNKNOWN'}
                </div>
            </div>
        );
    };

    const MetricBar = ({ label, value, max = 100, color = 'teal' }: any) => {
        const pct = Math.min(100, Math.round((value / max) * 100));
        const colorMap: Record<string, string> = {
            teal: 'bg-teal-500',
            red: 'bg-red-500',
            green: 'bg-green-500',
            orange: 'bg-orange-500',
        };

        return (
            <div>
                <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-400">{label}</span>
                    <span className="text-white font-semibold">{(value * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-navy-800 rounded-full overflow-hidden">
                    <div className={`h-full ${colorMap[color]} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                </div>
            </div>
        );
    };

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="page-title">System Health</h1>
                    <p className="page-subtitle">Infrastructure monitoring and ML model performance metrics</p>
                </div>
                <button
                    onClick={loadHealth}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:text-teal-400 glass-card border border-white/10 rounded-lg"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            <div className="info-panel">
                <p>
                    The <strong className="text-teal-400">System Health</strong> dashboard monitors all BFI infrastructure
                    components in real-time. Green indicators confirm operational status; red indicates degraded service.
                    The ML metrics section shows Isolation Forest model performance using synthetic test data.
                </p>
            </div>

            {/* System Metrics */}
            {health && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {[
                        { label: 'Total Transactions', value: health.metrics?.totalTransactions?.toLocaleString(), icon: <Activity size={18} />, color: 'teal' },
                        { label: 'Total Accounts', value: health.metrics?.totalAccounts?.toLocaleString(), icon: <Server size={18} />, color: 'teal' },
                        { label: 'Total Alerts', value: health.metrics?.totalAlerts?.toLocaleString(), icon: <AlertTriangle size={18} />, color: 'orange' },
                        { label: 'Memory Usage', value: `${health.metrics?.memoryUsage} MB`, icon: <Cpu size={18} />, color: 'purple' },
                    ].map(m => (
                        <div key={m.label} className="glass-card p-4 border border-white/10">
                            <div className={`text-2xl font-bold text-${m.color}-400`}>{m.value}</div>
                            <div className="text-xs text-slate-400 mt-1">{m.label}</div>
                        </div>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                {/* Service Status */}
                <div className="glass-card p-5">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                        <Server size={14} className="text-teal-400" /> Service Status
                    </h3>
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="spinner w-8 h-8" />
                        </div>
                    ) : health ? (
                        <div className="space-y-3">
                            <ServiceStatus name="BFI Backend API" status={health.services?.api?.status}
                                sub={`Uptime: ${Math.round((health.services?.api?.uptime || 0) / 60)}m · Node ${health.metrics?.nodeVersion}`} />
                            <ServiceStatus name="MongoDB Database" status={health.services?.mongodb?.status} />
                            <ServiceStatus name="Neo4j Graph DB" status={health.services?.neo4j?.status}
                                sub="Fund flow graph database" />
                            <ServiceStatus name="ML Anomaly Service" status={health.services?.mlService?.status}
                                sub={health.services?.mlService?.url} />
                            <ServiceStatus name="GenAI Investigation" status={health.services?.genai?.status}
                                sub={health.services?.genai?.status === 'demo_mode' ? 'Using mock reports (API key not set)' : 'Gemini/OpenAI connected'} />
                        </div>
                    ) : (
                        <div className="text-center py-8 text-red-400">
                            <XCircle size={32} className="mx-auto mb-2" />
                            <p className="text-sm">Cannot reach backend API</p>
                            <p className="text-xs text-slate-500 mt-1">Is the backend running on port 5000?</p>
                        </div>
                    )}
                </div>

                {/* ML Model Performance */}
                <div className="glass-card p-5">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                        <Cpu size={14} className="text-teal-400" /> ML Model Performance
                    </h3>
                    {mlMetrics ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                {[
                                    { label: 'Accuracy', value: mlMetrics.accuracy, color: 'teal' },
                                    { label: 'Precision', value: mlMetrics.precision, color: 'green' },
                                    { label: 'Recall', value: mlMetrics.recall, color: 'orange' },
                                    { label: 'F1 Score', value: mlMetrics.f1_score, color: 'teal' },
                                ].map(m => (
                                    <div key={m.label} className={`p-3 rounded-lg bg-${m.color === 'teal' ? 'teal' : m.color === 'green' ? 'green' : m.color === 'orange' ? 'orange' : 'teal'}-500/10 border border-${m.color === 'teal' ? 'teal' : m.color === 'green' ? 'green' : m.color === 'orange' ? 'orange' : 'teal'}-500/20`}>
                                        <div className="text-lg font-bold text-white">{(m.value * 100).toFixed(1)}%</div>
                                        <div className="text-xs text-slate-400">{m.label}</div>
                                    </div>
                                ))}
                            </div>
                            <MetricBar label="Accuracy" value={mlMetrics.accuracy} color="teal" />
                            <MetricBar label="Precision" value={mlMetrics.precision} color="green" />
                            <MetricBar label="Recall" value={mlMetrics.recall} color="orange" />
                            <MetricBar label="F1 Score" value={mlMetrics.f1_score} color="teal" />

                            <div className="text-xs text-slate-500 pt-2 border-t border-white/5">
                                Model: {mlMetrics.model} · Test samples: {mlMetrics.test_samples}
                                <br />
                                TP: {mlMetrics.confusion_matrix?.tp} · FP: {mlMetrics.confusion_matrix?.fp} ·
                                TN: {mlMetrics.confusion_matrix?.tn} · FN: {mlMetrics.confusion_matrix?.fn}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                            <AlertTriangle size={32} className="mb-3 opacity-40" />
                            <p className="text-sm">ML Service not running</p>
                            <p className="text-xs mt-1">Start the Python ML service to view metrics</p>
                            <code className="mt-3 text-xs bg-navy-950 px-3 py-1.5 rounded font-mono text-slate-400">
                                cd ml-service && python app.py
                            </code>
                        </div>
                    )}
                </div>
            </div>

            {/* Runtime Info */}
            {health && (
                <div className="glass-card p-5">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                        <Zap size={14} className="text-teal-400" /> Runtime Information
                    </h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: 'API Status', value: health.status },
                            { label: 'Environment', value: health.metrics?.nodeEnv },
                            { label: 'Node.js', value: health.metrics?.nodeVersion },
                            { label: 'Last Refresh', value: lastUpdated?.toLocaleTimeString() },
                        ].map(r => (
                            <div key={r.label}>
                                <div className="text-xs text-slate-500">{r.label}</div>
                                <div className="text-sm font-semibold text-white mt-0.5 capitalize">{r.value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
