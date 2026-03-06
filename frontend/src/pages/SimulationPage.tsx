import React, { useState, useEffect } from 'react';
import { simulationApi } from '../api';
import { Play, Square, Zap, Activity, AlertTriangle, CheckCircle, Loader } from 'lucide-react';

export default function SimulationPage() {
    const [running, setRunning] = useState(false);
    const [stats, setStats] = useState<any>({ sent: 0, fraudDetected: 0, errors: 0, startTime: null });
    const [config, setConfig] = useState({
        transactionCount: 50000,
        accountCount: 1000,
        fraudRate: 0.15,
        interval: 200,
        patterns: ['layering', 'structuring', 'circular'],
    });
    const [log, setLog] = useState<string[]>([]);
    const [demoRunning, setDemoRunning] = useState(false);

    useEffect(() => {
        // Poll status when running
        let timer: NodeJS.Timeout;
        if (running) {
            timer = setInterval(async () => {
                const res = await simulationApi.status();
                setStats(res.data.stats);
                setRunning(res.data.running);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [running]);

    const startSimulation = async () => {
        try {
            addLog('▶ Starting simulation...');
            const res = await simulationApi.start(config);
            setRunning(true);
            addLog(`✅ Simulation started: ${config.transactionCount} transactions, ${(config.fraudRate * 100).toFixed(0)}% fraud rate`);
        } catch (e: any) {
            addLog(`❌ Error: ${e.response?.data?.message || e.message}`);
            setRunning(false);
        }
    };

    const stopSimulation = async () => {
        try {
            const res = await simulationApi.stop();
            setRunning(false);
            setStats(res.data.stats);
            addLog(`⏹ Simulation stopped. Summary: ${res.data.stats?.sent} sent, ${res.data.stats?.fraudDetected} fraud detected`);
        } catch (e) {
            console.error(e);
        }
    };

    const runDemo = async () => {
        setDemoRunning(true);
        addLog('🎭 Running demo scenario: Layering fraud A→B→C→D→E...');
        try {
            const res = await simulationApi.demo();
            addLog(`✅ Demo complete! ${res.data.results?.length} transactions sent in chain.`);
            addLog(`💡 Check the Alerts page - layering pattern should be detected!`);
        } catch (e: any) {
            addLog(`❌ Demo error: ${e.message}`);
        } finally {
            setDemoRunning(false);
        }
    };

    const addLog = (msg: string) => {
        setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
    };

    const togglePattern = (p: string) => {
        setConfig(c => ({
            ...c,
            patterns: c.patterns.includes(p) ? c.patterns.filter(x => x !== p) : [...c.patterns, p],
        }));
    };

    const elapsed = stats.startTime
        ? Math.round((Date.now() - stats.startTime) / 1000) : 0;

    return (
        <div className="animate-fade-in">
            <div className="mb-6">
                <h1 className="page-title">Banking Network Simulation</h1>
                <p className="page-subtitle">Generate realistic transaction streams for testing and demonstrations</p>
            </div>

            <div className="info-panel">
                <p>
                    The <strong className="text-teal-400">Simulation Engine</strong> generates a synthetic banking environment
                    with realistic transactions and embedded fraud patterns. Use it to populate the system with test data,
                    demonstrate detection capabilities, or run performance benchmarks. The Demo Scenario runs the built-in
                    layering fraud chain (A→B→C→D→E) to showcase end-to-end detection.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                {/* Config Panel */}
                <div className="lg:col-span-2 glass-card p-5">
                    <h3 className="text-sm font-semibold text-white mb-4">⚙️ Simulation Configuration</h3>

                    <div className="grid grid-cols-2 gap-4 mb-5">
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Total Transactions</label>
                            <input
                                type="number"
                                value={config.transactionCount}
                                onChange={e => setConfig(c => ({ ...c, transactionCount: parseInt(e.target.value) || 100 }))}
                                disabled={running}
                                className="w-full bg-navy-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-teal-500 disabled:opacity-50"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 block mb-1">Account Count</label>
                            <input
                                type="number"
                                value={config.accountCount}
                                onChange={e => setConfig(c => ({ ...c, accountCount: parseInt(e.target.value) || 50 }))}
                                disabled={running}
                                className="w-full bg-navy-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-teal-500 disabled:opacity-50"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 block mb-1.5">
                                Fraud Rate: <span className="text-teal-400 font-semibold">{(config.fraudRate * 100).toFixed(0)}%</span>
                            </label>
                            <input
                                type="range"
                                min="0.05" max="0.5" step="0.05"
                                value={config.fraudRate}
                                onChange={e => setConfig(c => ({ ...c, fraudRate: parseFloat(e.target.value) }))}
                                disabled={running}
                                className="w-full accent-teal-500"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 block mb-1.5">
                                Transaction Interval: <span className="text-teal-400 font-semibold">{config.interval}ms</span>
                            </label>
                            <input
                                type="range"
                                min="50" max="2000" step="50"
                                value={config.interval}
                                onChange={e => setConfig(c => ({ ...c, interval: parseInt(e.target.value) }))}
                                disabled={running}
                                className="w-full accent-teal-500"
                            />
                        </div>
                    </div>

                    <div className="mb-5">
                        <span className="text-xs text-slate-400 block mb-2">Fraud Patterns to Include</span>
                        <div className="flex gap-2 flex-wrap">
                            {['layering', 'structuring', 'circular', 'rapid'].map(p => (
                                <button
                                    key={p}
                                    onClick={() => togglePattern(p)}
                                    disabled={running}
                                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all capitalize disabled:opacity-50 ${config.patterns.includes(p)
                                        ? 'bg-teal-500/20 text-teal-400 border-teal-500/40'
                                        : 'text-slate-400 border-white/10 hover:border-white/20'
                                        }`}
                                >
                                    {config.patterns.includes(p) ? '✓ ' : ''}{p}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        {!running ? (
                            <button
                                onClick={startSimulation}
                                className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold rounded-lg transition-colors"
                            >
                                <Play size={16} /> Start Simulation
                            </button>
                        ) : (
                            <button
                                onClick={stopSimulation}
                                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg transition-colors"
                            >
                                <Square size={16} /> Stop Simulation
                            </button>
                        )}
                        <button
                            onClick={runDemo}
                            disabled={demoRunning || running}
                            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                        >
                            {demoRunning ? <Loader size={16} className="animate-spin" /> : <Zap size={16} />}
                            {demoRunning ? 'Running Demo...' : 'Run Demo Scenario'}
                        </button>
                    </div>
                </div>

                {/* Live Stats */}
                <div className="glass-card p-5">
                    <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                        <Activity size={14} className={running ? 'text-teal-400 animate-pulse' : 'text-slate-500'} />
                        Live Statistics
                        {running && <span className="ml-auto text-xs text-teal-400">● RUNNING</span>}
                    </h3>

                    <div className="space-y-4">
                        <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-lg">
                            <div className="text-2xl font-bold text-teal-400">{stats.sent || 0}</div>
                            <div className="text-xs text-slate-400">Transactions Sent</div>
                        </div>
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <div className="text-2xl font-bold text-red-400">{stats.fraudDetected || 0}</div>
                            <div className="text-xs text-slate-400">Fraud Detected</div>
                        </div>
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                            <div className="text-2xl font-bold text-yellow-400">{stats.errors || 0}</div>
                            <div className="text-xs text-slate-400">Errors</div>
                        </div>
                        {running && (
                            <div className="p-3 bg-navy-800/50 rounded-lg border border-white/5">
                                <div className="text-lg font-bold text-white">{elapsed}s</div>
                                <div className="text-xs text-slate-400">Elapsed Time</div>
                            </div>
                        )}
                    </div>

                    {running && (
                        <div className="mt-4">
                            <div className="relative h-2 bg-navy-800 rounded-full overflow-hidden">
                                <div
                                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-teal-600 to-teal-400 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(100, (stats.sent / config.transactionCount) * 100)}%` }}
                                />
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1">
                                {stats.sent}/{config.transactionCount} ({Math.round((stats.sent / config.transactionCount) * 100)}%)
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Demo Scenario Info */}
            <div className="glass-card p-5 mb-4 border border-purple-500/20">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <Zap size={14} className="text-purple-400" /> Built-in Demo: Layering Fraud Scenario
                </h3>
                <div className="flex items-center gap-2 text-sm text-slate-400 flex-wrap">
                    {['DEMO-A1001', 'DEMO-A1002', 'DEMO-A1003', 'DEMO-A1004', 'DEMO-A1005'].map((acc, i, arr) => (
                        <React.Fragment key={acc}>
                            <span className="px-2 py-1 bg-navy-800/70 rounded font-mono text-teal-300 text-xs">{acc}</span>
                            {i < arr.length - 1 && <span className="text-slate-600">→</span>}
                        </React.Fragment>
                    ))}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                    5 transactions of ~₹2 Lakh each, sent 1 minute apart. The rule engine will detect layering pattern
                    and generate a high-risk fraud alert automatically.
                </p>
            </div>

            {/* Activity Log */}
            <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-white mb-3">📋 Activity Log</h3>
                <div className="bg-navy-950 rounded-lg p-3 font-mono text-xs space-y-1 max-h-48 overflow-y-auto">
                    {log.length === 0 ? (
                        <p className="text-slate-600">No activity yet...</p>
                    ) : log.map((entry, i) => (
                        <div key={i} className="text-slate-400">{entry}</div>
                    ))}
                </div>
            </div>
        </div>
    );
}
