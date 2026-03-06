import React, { useEffect, useState, useCallback } from 'react';
import { networkApi } from '../api';
import toast from 'react-hot-toast';
import {
    Network, AlertTriangle, TrendingUp, Users, ArrowRight,
    RefreshCw, Filter, Eye, Brain, ChevronDown, ChevronRight,
    Shield, Zap, GitBranch, RotateCcw, Star, Activity, Search
} from 'lucide-react';
import ReactFlow, {
    Node, Edge, Background, Controls, MiniMap,
    BackgroundVariant, MarkerType, useNodesState, useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface FraudNetwork {
    networkId: string;
    name: string;
    detectedPattern: string;
    accounts: string[];
    accountCount: number;
    transactionCount: number;
    totalTransactionValue: number;
    networkRiskScore: number;
    riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
    status: string;
    patternDetails: {
        maxChainDepth?: number;
        cyclesFound?: number;
        timeSpanMinutes?: number;
        centralAccount?: string;
    };
    aiAnalysis?: string;
    graphSnapshot?: { nodes: any[]; edges: any[] };
    createdAt: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
const RISK_COLORS: Record<string, string> = {
    Critical: '#ef4444',
    High: '#f97316',
    Medium: '#eab308',
    Low: '#22c55e',
};

const PATTERN_ICONS: Record<string, React.ElementType> = {
    'Layering Chain': ArrowRight,
    'Circular Loop': RotateCcw,
    'Star Network': Star,
    'Rapid Multihop': Zap,
    'Shared Identity': Users,
    Mixed: Network,
};

function RiskBadge({ level }: { level: string }) {
    const colors: Record<string, string> = {
        Critical: 'bg-red-500/20 text-red-400 border border-red-500/30',
        High: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
        Medium: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
        Low: 'bg-green-500/20 text-green-400 border border-green-500/30',
    };
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colors[level] || colors.Low}`}>
            {level}
        </span>
    );
}

function formatCurrency(v: number) {
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
    return `₹${v.toFixed(0)}`;
}

// ─── Network Graph Visualizer ──────────────────────────────────────────────────
function NetworkGraphView({ network }: { network: FraudNetwork }) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        if (!network.graphSnapshot) return;
        const { nodes: rawNodes, edges: rawEdges } = network.graphSnapshot;

        // BFS layout
        const levels = new Map<string, number>();
        const adj = new Map<string, string[]>();
        rawNodes.forEach((n: any) => { adj.set(n.id, []); levels.set(n.id, -1); });
        rawEdges.forEach((e: any) => { adj.get(e.source)?.push(e.target); });

        const central = network.patternDetails?.centralAccount;
        const start = central && levels.has(central) ? central : rawNodes[0]?.id;
        if (!start) return;

        const queue = [start];
        levels.set(start, 0);
        while (queue.length) {
            const curr = queue.shift()!;
            for (const n of (adj.get(curr) || [])) {
                if (levels.get(n) === -1) { levels.set(n, (levels.get(curr) || 0) + 1); queue.push(n); }
            }
        }
        rawNodes.forEach((n: any) => { if (levels.get(n.id) === -1) levels.set(n.id, 0); });

        const levelCounts = new Map<number, number>();
        const flowNodes: Node[] = rawNodes.map((n: any) => {
            const level = levels.get(n.id) || 0;
            const count = levelCounts.get(level) || 0;
            levelCounts.set(level, count + 1);
            const isCentral = n.id === central;
            const riskColor = n.riskScore >= 70 ? '#ef4444' : n.riskScore >= 40 ? '#f97316' : '#06b6d4';
            return {
                id: n.id,
                position: { x: level * 200, y: count * 100 },
                data: { label: n.id },
                style: {
                    background: isCentral ? 'rgba(239,68,68,0.2)' : 'rgba(6,182,212,0.1)',
                    border: `2px solid ${isCentral ? '#ef4444' : riskColor}`,
                    borderRadius: isCentral ? '50%' : '8px',
                    color: '#e2e8f0',
                    fontSize: '10px',
                    padding: '6px 10px',
                    minWidth: '80px',
                    textAlign: 'center',
                },
            };
        });

        const flowEdges: Edge[] = rawEdges.map((e: any, i: number) => {
            const color = e.isFraud ? '#ef4444' : e.riskScore > 50 ? '#f97316' : '#06b6d4';
            return {
                id: `e-${i}`,
                source: e.source,
                target: e.target,
                type: 'smoothstep',
                animated: e.isFraud,
                style: { stroke: color, strokeWidth: 1.5 },
                markerEnd: { type: MarkerType.ArrowClosed, color },
                label: e.amount ? formatCurrency(e.amount) : undefined,
                labelStyle: { fill: '#94a3b8', fontSize: 9 },
                labelBgStyle: { fill: '#0f172a', fillOpacity: 0.8 },
            };
        });

        setNodes(flowNodes);
        setEdges(flowEdges);
    }, [network]);

    return (
        <div className="h-80 bg-navy-950 rounded-xl border border-white/5 overflow-hidden">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
                fitViewOptions={{ padding: 0.25 }}
                minZoom={0.1}
                maxZoom={2}
            >
                <Background variant={BackgroundVariant.Dots} color="rgba(255,255,255,0.04)" gap={20} />
                <Controls />
                <MiniMap
                    nodeColor={() => '#0891b2'}
                    maskColor="rgba(0,0,0,0.5)"
                    style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.05)' }}
                />
            </ReactFlow>
        </div>
    );
}

// ─── Network Detail Panel ──────────────────────────────────────────────────────
function NetworkDetailPanel({ network, onClose, onAnalyze }: {
    network: FraudNetwork;
    onClose: () => void;
    onAnalyze: (id: string) => Promise<void>;
}) {
    const [analyzing, setAnalyzing] = useState(false);
    const [activeTab, setActiveTab] = useState<'graph' | 'ai' | 'accounts'>('graph');

    const handleAnalyze = async () => {
        setAnalyzing(true);
        await onAnalyze(network.networkId);
        setAnalyzing(false);
        setActiveTab('ai');
    };

    const PatternIcon = PATTERN_ICONS[network.detectedPattern] || Network;
    const riskColor = RISK_COLORS[network.riskLevel] || '#22c55e';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-navy-900 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: `${riskColor}22`, border: `1px solid ${riskColor}44` }}>
                            <PatternIcon size={20} style={{ color: riskColor }} />
                        </div>
                        <div>
                            <h2 className="text-white font-bold text-lg">{network.detectedPattern}</h2>
                            <p className="text-xs text-slate-400 font-mono">{network.networkId}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <RiskBadge level={network.riskLevel} />
                        <div className="text-2xl font-black" style={{ color: riskColor }}>
                            {network.networkRiskScore}
                        </div>
                        <span className="text-xs text-slate-500">/100</span>
                        <button onClick={onClose}
                            className="ml-4 text-slate-500 hover:text-white transition-colors text-xl px-2">✕</button>
                    </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-0 border-b border-white/5">
                    {[
                        { label: 'Accounts', value: network.accountCount, icon: Users },
                        { label: 'Transactions', value: network.transactionCount, icon: Activity },
                        { label: 'Total Value', value: formatCurrency(network.totalTransactionValue), icon: TrendingUp },
                        { label: 'Chain Depth', value: `${network.patternDetails?.maxChainDepth || '–'} hops`, icon: GitBranch },
                    ].map(({ label, value, icon: Icon }) => (
                        <div key={label} className="flex items-center gap-3 px-5 py-4 border-r border-white/5 last:border-r-0">
                            <Icon size={16} className="text-teal-400 flex-shrink-0" />
                            <div>
                                <div className="text-lg font-bold text-white">{value}</div>
                                <div className="text-xs text-slate-400">{label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/5">
                    {[
                        { key: 'graph', label: 'Network Graph', icon: GitBranch },
                        { key: 'ai', label: 'AI Analysis', icon: Brain },
                        { key: 'accounts', label: 'Accounts', icon: Users },
                    ].map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            onClick={() => setActiveTab(key as any)}
                            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === key
                                    ? 'border-teal-400 text-teal-400'
                                    : 'border-transparent text-slate-400 hover:text-white'
                                }`}
                        >
                            <Icon size={14} />
                            {label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-5">
                    {activeTab === 'graph' && (
                        <div className="space-y-4">
                            {network.graphSnapshot?.nodes?.length ? (
                                <NetworkGraphView network={network} />
                            ) : (
                                <div className="h-60 flex items-center justify-center text-slate-500 border border-white/5 rounded-xl">
                                    No graph data available for this network
                                </div>
                            )}
                            <div className="grid grid-cols-3 gap-3 text-sm">
                                <div className="bg-white/5 rounded-lg p-3">
                                    <div className="text-slate-400 text-xs mb-1">Circular Flows</div>
                                    <div className="text-white font-bold">{network.patternDetails?.cyclesFound || 0}</div>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3">
                                    <div className="text-slate-400 text-xs mb-1">Time Span</div>
                                    <div className="text-white font-bold">{network.patternDetails?.timeSpanMinutes || 0} min</div>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3">
                                    <div className="text-slate-400 text-xs mb-1">Central Account</div>
                                    <div className="text-white font-bold font-mono text-xs">
                                        {network.patternDetails?.centralAccount || 'N/A'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'ai' && (
                        <div className="space-y-4">
                            {!network.aiAnalysis ? (
                                <div className="text-center py-12">
                                    <Brain size={40} className="text-slate-600 mx-auto mb-3" />
                                    <p className="text-slate-400 mb-4">No AI analysis generated yet</p>
                                    <button
                                        onClick={handleAnalyze}
                                        disabled={analyzing}
                                        className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-medium flex items-center gap-2 mx-auto transition-colors disabled:opacity-50"
                                    >
                                        {analyzing ? <RefreshCw size={16} className="animate-spin" /> : <Brain size={16} />}
                                        {analyzing ? 'Generating Analysis...' : 'Generate AI Analysis'}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-white font-semibold flex items-center gap-2">
                                            <Brain size={16} className="text-teal-400" />
                                            AI Intelligence Report
                                        </h3>
                                        <button
                                            onClick={handleAnalyze}
                                            disabled={analyzing}
                                            className="text-xs text-slate-400 hover:text-teal-400 flex items-center gap-1"
                                        >
                                            <RefreshCw size={12} className={analyzing ? 'animate-spin' : ''} />
                                            Regenerate
                                        </button>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-4 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed border border-white/5 font-mono text-xs">
                                        {network.aiAnalysis}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'accounts' && (
                        <div className="space-y-2">
                            <p className="text-xs text-slate-400 mb-3">
                                {network.accountCount} accounts involved in this fraud network
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {network.accounts.map((acc, i) => (
                                    <div key={i}
                                        className={`flex items-center gap-2 p-2 rounded-lg border ${acc === network.patternDetails?.centralAccount
                                                ? 'bg-red-500/10 border-red-500/30'
                                                : 'bg-white/5 border-white/5'
                                            }`}
                                    >
                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${acc === network.patternDetails?.centralAccount ? 'bg-red-400' : 'bg-teal-400'
                                            }`} />
                                        <span className="font-mono text-xs text-slate-300">{acc}</span>
                                        {acc === network.patternDetails?.centralAccount && (
                                            <span className="ml-auto text-xs text-red-400 font-medium">Hub</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function FraudNetworksPage() {
    const [networks, setNetworks] = useState<FraudNetwork[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [selectedNetwork, setSelectedNetwork] = useState<FraudNetwork | null>(null);
    const [filterRisk, setFilterRisk] = useState('');
    const [filterPattern, setFilterPattern] = useState('');

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const params: any = {};
            if (filterRisk) params.riskLevel = filterRisk;
            if (filterPattern) params.pattern = filterPattern;
            const [netRes, statsRes] = await Promise.all([
                networkApi.list(params),
                networkApi.stats(),
            ]);
            setNetworks(netRes.data.networks || []);
            setStats(statsRes.data);
        } catch (err) {
            toast.error('Failed to load fraud networks');
        } finally {
            setLoading(false);
        }
    }, [filterRisk, filterPattern]);

    useEffect(() => { load(); }, [load]);

    const handleScan = async () => {
        setScanning(true);
        try {
            const res = await networkApi.scan();
            toast.success(`Network scan complete — ${res.data.networksDetected} new network(s) detected`);
            load();
        } catch {
            toast.error('Scan failed');
        } finally {
            setScanning(false);
        }
    };

    const handleAnalyze = async (id: string) => {
        try {
            const res = await networkApi.analyze(id);
            // Refresh selected network with new AI analysis
            if (selectedNetwork && selectedNetwork.networkId === id) {
                setSelectedNetwork({ ...selectedNetwork, aiAnalysis: res.data.analysis });
            }
            toast.success('AI analysis generated');
        } catch {
            toast.error('Analysis failed');
        }
    };

    const openNetwork = async (network: FraudNetwork) => {
        try {
            const res = await networkApi.get(network.networkId);
            setSelectedNetwork(res.data.network);
        } catch {
            setSelectedNetwork(network);
        }
    };

    const statCards = [
        { label: 'Total Networks', value: stats?.total || 0, icon: Network, color: 'teal' },
        { label: 'Active (24h)', value: stats?.recentCount || 0, icon: AlertTriangle, color: 'red' },
        { label: 'Critical Risk', value: stats?.byRisk?.find((r: any) => r._id === 'Critical')?.count || 0, icon: Shield, color: 'red' },
        { label: 'High Risk', value: stats?.byRisk?.find((r: any) => r._id === 'High')?.count || 0, icon: TrendingUp, color: 'orange' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                            <Network size={20} className="text-purple-400" />
                        </div>
                        Fraud Network Intelligence
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Coordinated fraud ring detection powered by graph analytics &amp; AI
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={load}
                        className="p-2 text-slate-400 hover:text-white border border-white/10 rounded-lg transition-colors"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={handleScan}
                        disabled={scanning}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {scanning ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
                        {scanning ? 'Scanning...' : 'Run Network Scan'}
                    </button>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-4 gap-4">
                {statCards.map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-navy-900 border border-white/5 rounded-xl p-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`w-8 h-8 rounded-lg bg-${color}-500/20 flex items-center justify-center`}>
                                <Icon size={16} className={`text-${color}-400`} />
                            </div>
                            <span className="text-slate-400 text-xs">{label}</span>
                        </div>
                        <div className="text-2xl font-black text-white">{value}</div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
                <Filter size={14} className="text-slate-400" />
                <select
                    value={filterRisk}
                    onChange={e => setFilterRisk(e.target.value)}
                    className="bg-navy-900 border border-white/10 text-slate-300 text-sm rounded-lg px-3 py-2"
                >
                    <option value="">All Risk Levels</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                </select>
                <select
                    value={filterPattern}
                    onChange={e => setFilterPattern(e.target.value)}
                    className="bg-navy-900 border border-white/10 text-slate-300 text-sm rounded-lg px-3 py-2"
                >
                    <option value="">All Patterns</option>
                    <option value="Layering Chain">Layering Chain</option>
                    <option value="Circular Loop">Circular Loop</option>
                    <option value="Star Network">Star Network</option>
                    <option value="Rapid Multihop">Rapid Multihop</option>
                </select>
            </div>

            {/* Network List */}
            {loading ? (
                <div className="text-center py-20">
                    <RefreshCw size={32} className="animate-spin text-teal-400 mx-auto mb-3" />
                    <p className="text-slate-400">Scanning for fraud networks...</p>
                </div>
            ) : networks.length === 0 ? (
                <div className="text-center py-20 bg-navy-900 rounded-xl border border-white/5">
                    <Network size={48} className="text-slate-700 mx-auto mb-4" />
                    <h3 className="text-slate-400 text-lg font-medium mb-2">No Fraud Networks Detected</h3>
                    <p className="text-slate-500 text-sm max-w-sm mx-auto mb-5">
                        Run a network scan or simulate transactions to detect coordinated fraud rings.
                    </p>
                    <button onClick={handleScan} disabled={scanning}
                        className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 mx-auto">
                        <Search size={14} />
                        Run Network Scan
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {networks.map(network => {
                        const PatternIcon = PATTERN_ICONS[network.detectedPattern] || Network;
                        const riskColor = RISK_COLORS[network.riskLevel];
                        return (
                            <div
                                key={network.networkId}
                                onClick={() => openNetwork(network)}
                                className="bg-navy-900 border border-white/5 rounded-xl p-4 hover:border-white/10 transition-all cursor-pointer group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                        style={{ background: `${riskColor}22`, border: `1px solid ${riskColor}44` }}>
                                        <PatternIcon size={18} style={{ color: riskColor }} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="font-semibold text-white">{network.detectedPattern}</span>
                                            <RiskBadge level={network.riskLevel} />
                                            <span className="text-xs text-slate-500 font-mono">{network.networkId}</span>
                                        </div>
                                        <div className="flex items-center gap-5 text-xs text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <Users size={11} /> {network.accountCount} accounts
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Activity size={11} /> {network.transactionCount} txns
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <TrendingUp size={11} /> {formatCurrency(network.totalTransactionValue)}
                                            </span>
                                            {network.patternDetails?.timeSpanMinutes != null && (
                                                <span>{network.patternDetails.timeSpanMinutes} min span</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {/* Risk Score Ring */}
                                        <div className="text-right">
                                            <div className="text-2xl font-black" style={{ color: riskColor }}>
                                                {network.networkRiskScore}
                                            </div>
                                            <div className="text-xs text-slate-500">risk score</div>
                                        </div>
                                        <Eye size={16} className="text-slate-500 group-hover:text-teal-400 transition-colors" />
                                    </div>
                                </div>

                                {/* Mini account tags */}
                                <div className="mt-3 flex items-center gap-2 flex-wrap">
                                    {network.accounts.slice(0, 6).map((acc, i) => (
                                        <span key={i} className="px-2 py-0.5 bg-white/5 rounded text-xs font-mono text-slate-400">
                                            {acc}
                                        </span>
                                    ))}
                                    {network.accountCount > 6 && (
                                        <span className="text-xs text-slate-500">+{network.accountCount - 6} more</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Detail Modal */}
            {selectedNetwork && (
                <NetworkDetailPanel
                    network={selectedNetwork}
                    onClose={() => setSelectedNetwork(null)}
                    onAnalyze={handleAnalyze}
                />
            )}
        </div>
    );
}
