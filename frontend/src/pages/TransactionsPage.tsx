import React, { useState, useEffect, useCallback } from 'react';
import { transactionApi } from '../api';
import { RiskBadge, StatusBadge, FraudTypeBadge } from '../components/Badges';
import { formatDate, formatCurrency } from '../utils/format';
import { List, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({ isFraud: '', minRisk: '', fraudType: '' });

    const loadTxns = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = { page, limit: 25, sort: '-timestamp' };
            if (filters.isFraud !== '') params.isFraud = filters.isFraud;
            if (filters.minRisk) params.minRisk = filters.minRisk;
            if (filters.fraudType) params.fraudType = filters.fraudType;
            if (search) params.sender = search;

            const res = await transactionApi.list(params);
            setTransactions(res.data.transactions || []);
            setTotal(res.data.total || 0);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [page, filters, search]);

    useEffect(() => { loadTxns(); }, [loadTxns]);
    const totalPages = Math.ceil(total / 25);

    return (
        <div className="animate-fade-in">
            <div className="mb-6">
                <h1 className="page-title">Transaction Monitoring</h1>
                <p className="page-subtitle">Real-time view of all banking transactions</p>
            </div>

            <div className="info-panel">
                <p>
                    All banking transactions are ingested through the BFI Transaction API. Each transaction is analyzed
                    in real-time by the fraud detection engine. Flagged transactions are highlighted and linked to
                    corresponding fraud alerts. Search by sender account ID or apply filters to investigate specific patterns.
                </p>
            </div>

            {/* Search & Filters */}
            <div className="glass-card p-4 mb-4">
                <div className="flex gap-3 items-center flex-wrap">
                    <div className="relative flex-1 min-w-48">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search by sender account ID..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            className="w-full bg-navy-800 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-teal-500"
                        />
                    </div>
                    <select
                        value={filters.isFraud}
                        onChange={e => setFilters(f => ({ ...f, isFraud: e.target.value }))}
                        className="text-xs bg-navy-800 border border-white/10 rounded-lg px-3 py-2 text-slate-300 focus:outline-none focus:border-teal-500"
                    >
                        <option value="">All Transactions</option>
                        <option value="true">Fraud Only</option>
                        <option value="false">Normal Only</option>
                    </select>
                    <select
                        value={filters.minRisk}
                        onChange={e => setFilters(f => ({ ...f, minRisk: e.target.value }))}
                        className="text-xs bg-navy-800 border border-white/10 rounded-lg px-3 py-2 text-slate-300 focus:outline-none focus:border-teal-500"
                    >
                        <option value="">Any Risk</option>
                        <option value="40">Medium+ (40+)</option>
                        <option value="70">High+ (70+)</option>
                        <option value="85">Critical (85+)</option>
                    </select>
                    <span className="text-xs text-slate-500 ml-auto">{total.toLocaleString()} transactions</span>
                </div>
            </div>

            {/* Table */}
            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="border-b border-white/5">
                            <tr>
                                <th className="text-left px-4 py-3 text-slate-500 font-medium">Transaction ID</th>
                                <th className="text-left px-4 py-3 text-slate-500 font-medium">Sender</th>
                                <th className="text-left px-4 py-3 text-slate-500 font-medium">Receiver</th>
                                <th className="text-right px-4 py-3 text-slate-500 font-medium">Amount</th>
                                <th className="text-left px-4 py-3 text-slate-500 font-medium">Channel</th>
                                <th className="text-center px-4 py-3 text-slate-500 font-medium">Risk</th>
                                <th className="text-left px-4 py-3 text-slate-500 font-medium">Fraud Type</th>
                                <th className="text-left px-4 py-3 text-slate-500 font-medium">Status</th>
                                <th className="text-left px-4 py-3 text-slate-500 font-medium">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={9} className="py-12 text-center text-slate-500">
                                    <div className="spinner w-6 h-6 mx-auto mb-2" />Loading...
                                </td></tr>
                            ) : transactions.length === 0 ? (
                                <tr><td colSpan={9} className="py-12 text-center text-slate-500">
                                    No transactions found. Run a simulation to generate data.
                                </td></tr>
                            ) : transactions.map(tx => (
                                <tr key={tx.transactionId} className={`table-row-hover border-b border-white/[0.03] ${tx.isFraud ? 'bg-red-500/[0.03]' : ''}`}>
                                    <td className="px-4 py-2.5 font-mono text-teal-400 text-[11px]">{tx.transactionId?.slice(0, 18)}...</td>
                                    <td className="px-4 py-2.5 text-slate-300 font-medium">{tx.sender}</td>
                                    <td className="px-4 py-2.5 text-slate-300">{tx.receiver}</td>
                                    <td className="px-4 py-2.5 text-right text-white font-semibold">{formatCurrency(tx.amount)}</td>
                                    <td className="px-4 py-2.5 text-slate-400">{tx.channel}</td>
                                    <td className="px-4 py-2.5 text-center"><RiskBadge score={tx.riskScore} showLabel={false} size="sm" /></td>
                                    <td className="px-4 py-2.5"><FraudTypeBadge type={tx.fraudType} /></td>
                                    <td className="px-4 py-2.5"><StatusBadge status={tx.status} /></td>
                                    <td className="px-4 py-2.5 text-slate-500">{formatDate(tx.timestamp)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                        <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
                        <div className="flex gap-2">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                className="p-1.5 rounded glass-card border border-white/10 text-slate-400 hover:text-teal-400 disabled:opacity-30">
                                <ChevronLeft size={14} />
                            </button>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                className="p-1.5 rounded glass-card border border-white/10 text-slate-400 hover:text-teal-400 disabled:opacity-30">
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
