import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, {
    Node, Edge, Background, Controls, MiniMap,
    useNodesState, useEdgesState, BackgroundVariant, MarkerType,
    Handle, Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import { graphApi } from '../api';
import { formatCurrency, getRiskColor } from '../utils/format';
import { GitBranch, Search, RefreshCw, Loader, Info } from 'lucide-react';

// Custom Account Node
function AccountNode({ data }: { data: any }) {
    const riskColor = data.riskScore >= 85 ? '#ef4444'
        : data.riskScore >= 70 ? '#f97316'
            : data.riskScore >= 40 ? '#eab308'
                : '#22c55e';

    const bgColor = data.riskScore >= 70 ? 'rgba(239,68,68,0.1)' : 'rgba(13,34,68,0.9)';

    return (
        <div className={`relative px-4 py-3 rounded-xl border-2 min-w-[130px] text-center ${data.isOrigin ? 'border-teal-400' : ''}`}
            style={{
                background: bgColor,
                borderColor: data.isOrigin ? '#2dd4bf' : riskColor,
                boxShadow: `0 0 ${data.riskScore >= 70 ? '15' : '8'}px ${riskColor}40`,
            }}>
            <Handle type="target" position={Position.Left} style={{ background: riskColor }} />
            <Handle type="source" position={Position.Right} style={{ background: riskColor }} />
            <div className="text-[10px] text-slate-500 font-medium mb-0.5">
                {data.isOrigin ? '⭐ ORIGIN' : 'ACCOUNT'}
            </div>
            <div className="text-xs font-mono font-bold text-white truncate max-w-[110px] mx-auto">{data.label}</div>
            <div className="mt-1.5 flex items-center justify-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: riskColor }} />
                <span className="text-[10px] font-semibold" style={{ color: riskColor }}>
                    Risk {data.riskScore}
                </span>
            </div>
            {data.riskScore >= 70 && (
                <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-[8px] text-white font-bold">!</span>
                </div>
            )}
        </div>
    );
}

const nodeTypes = { accountNode: AccountNode };

export default function FundFlowPage() {
    const [searchId, setSearchId] = useState('');
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [loading, setLoading] = useState(false);
    const [graphInfo, setGraphInfo] = useState<any>(null);
    const [selectedNode, setSelectedNode] = useState<any>(null);

    const loadOverview = async () => {
        setLoading(true);
        try {
            const res = await graphApi.getOverview();
            buildGraph(res.data, '');
            setGraphInfo({ source: res.data.source, nodeCount: res.data.nodes?.length, edgeCount: res.data.edges?.length });
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadAccountGraph = async (id: string) => {
        setLoading(true);
        try {
            const res = await graphApi.getAccountGraph(id, 3);
            buildGraph(res.data, id);
            setGraphInfo({ source: res.data.source, nodeCount: res.data.nodes?.length, edgeCount: res.data.edges?.length, accountId: id });
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const buildGraph = (data: any, originId: string) => {
        const { nodes: rawNodes, edges: rawEdges } = data;

        if (!rawNodes?.length) return;

        // Group nodes logically left-to-right based on money flow (BFS)
        const levels = new Map();
        const adj = new Map();
        const inDegree = new Map();

        rawNodes.forEach((n: any) => {
            adj.set(n.id, []);
            levels.set(n.id, -1);
            inDegree.set(n.id, 0);
        });

        rawEdges.forEach((e: any) => {
            if (adj.has(e.source)) {
                adj.get(e.source).push(e.target);
            }
            if (inDegree.has(e.target)) {
                inDegree.set(e.target, inDegree.get(e.target) + 1);
            }
        });

        // Determine starting points
        let queue: string[] = [];
        if (originId && levels.has(originId)) {
            queue.push(originId);
            levels.set(originId, 0);
        } else {
            rawNodes.forEach((n: any) => {
                if (inDegree.get(n.id) === 0) {
                    queue.push(n.id);
                    levels.set(n.id, 0);
                }
            });
            // Fallback if all cyclic
            if (queue.length === 0 && rawNodes.length > 0) {
                queue.push(rawNodes[0].id);
                levels.set(rawNodes[0].id, 0);
            }
        }

        // BFS traversal
        while (queue.length > 0) {
            const curr = queue.shift()!;
            const currLevel = levels.get(curr);
            const neighbors = adj.get(curr) || [];

            neighbors.forEach((n: string) => {
                if (levels.has(n) && levels.get(n) === -1) {
                    // Compress long chains slightly to keep it readable
                    levels.set(n, currLevel + 1);
                    queue.push(n);
                }
            });
        }

        // Ensure all disconnected nodes are grouped at the beginning
        rawNodes.forEach((n: any) => {
            if (levels.get(n.id) === -1) levels.set(n.id, 0);
        });

        // Track how many nodes are assigned to each level to stack them vertically
        const levelCounts = new Map();

        const positionedNodes: Node[] = rawNodes.map((n: any) => {
            const level = levels.get(n.id) || 0;
            const count = levelCounts.get(level) || 0;
            levelCounts.set(level, count + 1);

            // Compress layout: 320px horizontal spread, 140px vertical spread
            return {
                id: n.id,
                type: 'accountNode',
                position: { x: level * 320, y: count * 140 },
                data: {
                    label: n.id,
                    riskScore: n.riskScore || 0,
                    riskLevel: n.riskLevel || 'low',
                    isOrigin: n.id === originId || n.isOrigin,
                    totalTransactions: n.totalTransactions || 0,
                },
            };
        });

        const positionedEdges: Edge[] = rawEdges.map((e: any, i: number) => {
            const riskColor = (e.riskScore >= 70) ? '#ef4444'
                : (e.riskScore >= 40) ? '#f97316' : '#14b8a6';

            return {
                id: e.id || `edge-${i}`,
                source: e.source,
                target: e.target,
                label: formatCurrency(e.totalAmount || e.amount),
                style: { stroke: riskColor, strokeWidth: e.isFraud ? 2 : 1.5 },
                markerEnd: { type: MarkerType.ArrowClosed, color: riskColor },
                type: 'smoothstep',
                labelStyle: { fill: '#94a3b8', fontSize: 10 },
                labelBgStyle: { fill: '#071428', fillOpacity: 0.8 },
                animated: e.isFraud,
            };
        });

        setNodes(positionedNodes);
        setEdges(positionedEdges);
    };

    useEffect(() => { loadOverview(); }, []);

    return (
        <div className="animate-fade-in">
            <div className="mb-6">
                <h1 className="page-title">Fund Flow Investigation</h1>
                <p className="page-subtitle">Visualize the path of money across accounts to trace fraud networks</p>
            </div>

            <div className="info-panel mb-4">
                <p>
                    The <strong className="text-teal-400">Fund Flow Graph</strong> maps transaction relationships between accounts.
                    Red/orange nodes and edges indicate high-risk transfers. Animated edges represent detected fraud.
                    Enter an Account ID to trace its specific money path, or view the full fraud network overview.
                </p>
            </div>

            {/* Search */}
            <div className="flex gap-3 mb-4">
                <div className="flex-1 relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Enter Account ID to trace (e.g. DEMO-A1001)"
                        value={searchId}
                        onChange={e => setSearchId(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && searchId && loadAccountGraph(searchId)}
                        className="w-full bg-navy-800/70 glasss-card border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-teal-500"
                    />
                </div>
                <button
                    onClick={() => searchId && loadAccountGraph(searchId)}
                    disabled={!searchId || loading}
                    className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
                >
                    {loading ? <Loader size={14} className="animate-spin" /> : 'Trace'}
                </button>
                <button
                    onClick={loadOverview}
                    className="px-4 py-2.5 glass-card border border-white/10 text-slate-300 hover:text-teal-400 text-sm rounded-lg transition-colors"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Graph info */}
            {graphInfo && (
                <div className="flex gap-4 mb-4">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Info size={12} />
                        {graphInfo.nodeCount} nodes · {graphInfo.edgeCount} edges · Source: {graphInfo.source}
                    </span>
                    <div className="flex items-center gap-3 ml-auto">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <div className="w-3 h-3 rounded-full bg-teal-400" /> Origin
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <div className="w-3 h-3 rounded-full bg-red-400" /> High Risk
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <div className="w-3 h-1 bg-teal-400 rounded" /> Normal Flow
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <div className="w-3 h-1 bg-red-400 rounded" /> Fraudulent
                        </div>
                    </div>
                </div>
            )}

            {/* Graph Canvas */}
            <div className="glass-card overflow-hidden border border-white/10" style={{ height: '560px' }}>
                {loading && !nodes.length ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="flex flex-col items-center gap-3">
                            <div className="spinner w-10 h-10" />
                            <p className="text-slate-400 text-sm">Loading graph data...</p>
                        </div>
                    </div>
                ) : nodes.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-slate-500">
                        <div className="text-center">
                            <GitBranch size={48} className="mx-auto mb-3 opacity-30" />
                            <p>No graph data. Run a simulation first to generate transactions.</p>
                        </div>
                    </div>
                ) : (
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        nodeTypes={nodeTypes}
                        onNodeClick={(_, node) => setSelectedNode(node.data)}
                        fitView
                        fitViewOptions={{ padding: 0.2 }}
                        minZoom={0.2}
                        maxZoom={1.5}
                    >
                        <Background variant={BackgroundVariant.Dots} color="rgba(255,255,255,0.05)" gap={20} />
                        <Controls />
                        <MiniMap
                            nodeColor={(n) => {
                                const risk = n.data?.riskScore || 0;
                                return risk >= 70 ? '#ef4444' : risk >= 40 ? '#f97316' : '#14b8a6';
                            }}
                            maskColor="rgba(4,13,26,0.7)"
                        />
                    </ReactFlow>
                )}
            </div>

            {/* Selected node info */}
            {selectedNode && (
                <div className="mt-4 glass-card p-4 border border-teal-500/20 animate-fade-in">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white">Selected: {selectedNode.label}</h3>
                        <button onClick={() => setSelectedNode(null)} className="text-slate-500 hover:text-white text-xs">✕</button>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-3">
                        <div><span className="text-xs text-slate-500">Risk Score</span><p className={`text-sm font-bold ${getRiskColor(selectedNode.riskScore)}`}>{selectedNode.riskScore}/100</p></div>
                        <div><span className="text-xs text-slate-500">Risk Level</span><p className="text-sm text-white capitalize">{selectedNode.riskLevel}</p></div>
                        <div>
                            <button
                                onClick={() => { setSearchId(selectedNode.label); loadAccountGraph(selectedNode.label); }}
                                className="mt-1 text-xs text-teal-400 hover:underline"
                            >
                                Trace this account →
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
