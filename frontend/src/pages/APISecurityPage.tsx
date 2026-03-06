import React, { useState } from 'react';
import { Shield, Key, Eye, EyeOff, RefreshCcw, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function APISecurityPage() {
    const [keys, setKeys] = useState([
        { id: '1', name: 'Frontend Application', prefix: 'pk_live_8f92', created: '2025-01-15T10:00:00Z', status: 'active', lastUsed: '2026-03-05T14:30:00Z' },
        { id: '2', name: 'Payment Gateway Webhook', prefix: 'sk_live_2a4b', created: '2025-06-20T08:15:00Z', status: 'active', lastUsed: '2026-03-06T12:45:00Z' },
        { id: '3', name: 'Legacy Data Ingestion', prefix: 'sk_test_9c1d', created: '2024-11-10T09:20:00Z', status: 'revoked', lastUsed: '2025-12-01T10:10:00Z' },
    ]);

    const [showKeyModal, setShowKeyModal] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');

    const handleCreateKey = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newKeyName.trim()) return;

        const newKey = {
            id: String(Date.now()),
            name: newKeyName,
            prefix: `sk_live_${Math.random().toString(16).substr(2, 4)}`,
            created: new Date().toISOString(),
            status: 'active',
            lastUsed: 'Never'
        };

        setKeys([newKey, ...keys]);
        setNewKeyName('');
        setShowKeyModal(false);
        toast.success(`New API key "${newKeyName}" generated successfully.`);
    };

    const handleRevoke = (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to revoke the API key for "${name}"? This action cannot be undone and any services using this key will immediately lose access.`)) return;

        setKeys(keys.map(k => k.id === id ? { ...k, status: 'revoked' } : k));
        toast.error(`API key "${name}" revoked.`);
    };

    return (
        <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="page-title mb-2">API Security & Keys</h1>
                    <p className="page-subtitle">Manage service authentication tokens and cryptographic limits.</p>
                </div>
                <button onClick={() => setShowKeyModal(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold">
                    <Key size={14} /> Generate New Key
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="glass-card p-5 border border-teal-500/30">
                    <div className="flex items-center justify-between mb-2">
                        <Shield className="text-teal-400" size={24} />
                        <span className="text-xs font-bold text-teal-400 bg-teal-500/20 px-2 py-1 rounded">Secured</span>
                    </div>
                    <h3 className="text-white font-semibold">JWT Enforcement</h3>
                    <p className="text-slate-400 text-xs mt-1">All Analyst routes strictly require cryptographically signed Bearer tokens.</p>
                </div>

                <div className="glass-card p-5 border border-teal-500/30">
                    <div className="flex items-center justify-between mb-2">
                        <Lock className="text-teal-400" size={24} />
                        <span className="text-xs font-bold text-teal-400 bg-teal-500/20 px-2 py-1 rounded">Active</span>
                    </div>
                    <h3 className="text-white font-semibold">Field-Level Encryption</h3>
                    <p className="text-slate-400 text-xs mt-1">PII data (email, phone, address) is AES-256 encrypted at rest in MongoDB.</p>
                </div>

                <div className="glass-card p-5 border border-amber-500/30">
                    <div className="flex items-center justify-between mb-2">
                        <RefreshCcw className="text-amber-400" size={24} />
                        <span className="text-xs font-bold text-amber-400 bg-amber-500/20 px-2 py-1 rounded">Throttled</span>
                    </div>
                    <h3 className="text-white font-semibold">Rate Limiting</h3>
                    <p className="text-slate-400 text-xs mt-1">Global limits applied: 100 requests per IP / Authorized User per minute.</p>
                </div>
            </div>

            <div className="glass-card p-0 overflow-hidden">
                <div className="p-5 border-b border-white/5">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Key size={16} className="text-teal-400" /> Active API Keys
                    </h3>
                </div>
                <table className="w-full text-xs text-left">
                    <thead className="bg-navy-900 border-b border-white/5 text-slate-500">
                        <tr>
                            <th className="py-3 px-5">Name / Purpose</th>
                            <th className="py-3 px-5">Token Prefix</th>
                            <th className="py-3 px-5">Created On</th>
                            <th className="py-3 px-5">Last Used</th>
                            <th className="py-3 px-5">Status</th>
                            <th className="py-3 px-5 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.02]">
                        {keys.map(k => (
                            <tr key={k.id} className="hover:bg-white/[0.02] transition-colors">
                                <td className="py-4 px-5 text-white font-medium">{k.name}</td>
                                <td className="py-4 px-5 font-mono text-teal-400">{k.prefix}•••••••••••</td>
                                <td className="py-4 px-5 text-slate-400">{new Date(k.created).toLocaleDateString()}</td>
                                <td className="py-4 px-5 text-slate-400">{k.lastUsed !== 'Never' ? new Date(k.lastUsed).toLocaleDateString() : 'Never'}</td>
                                <td className="py-4 px-5">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${k.status === 'active' ? 'bg-teal-500/20 text-teal-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {k.status.toUpperCase()}
                                    </span>
                                </td>
                                <td className="py-4 px-5 text-right">
                                    {k.status === 'active' && (
                                        <button onClick={() => handleRevoke(k.id, k.name)} className="text-red-400 hover:text-red-300 transition-colors font-medium">Revoke</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showKeyModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="glass-card p-6 w-full max-w-md animate-scale-in">
                        <h2 className="text-lg font-bold text-white mb-4">Generate API Key</h2>
                        <form onSubmit={handleCreateKey}>
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-slate-400 mb-1">Key Name / Description</label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    placeholder="e.g. Mobile App Production"
                                    value={newKeyName}
                                    onChange={e => setNewKeyName(e.target.value)}
                                    className="w-full bg-navy-800 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-teal-500"
                                />
                            </div>
                            <div className="flex gap-3 justify-end mt-6">
                                <button type="button" onClick={() => setShowKeyModal(false)} className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-lg transition-colors">Generate</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
