import React, { useState, useEffect } from 'react';
import { reportApi } from '../api';
import { FileText, Search } from 'lucide-react';
import { formatDate } from '../utils/format';

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const loadLogs = async (p: number) => {
        setLoading(true);
        try {
            const res = await reportApi.getAuditLogs({ page: p, limit: 20 });
            setLogs(res.data.logs);
            setTotalPages(res.data.pages);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadLogs(page); }, [page]);

    return (
        <div className="animate-fade-in">
            <h1 className="page-title mb-2">Platform Audit Logs</h1>
            <p className="page-subtitle mb-6">Irrefutable administrative and investigation event tracing.</p>

            <div className="glass-card mb-6">
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <FileText size={16} className="text-teal-400" /> Event Ledger
                    </h3>
                    <div className="flex bg-navy-950 border border-white/10 rounded-lg px-3 py-1.5 items-center">
                        <Search size={14} className="text-slate-500 mr-2" />
                        <input type="text" placeholder="Search traces..." className="bg-transparent border-none text-xs text-white outline-none w-48" />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-navy-900 border-b border-white/5 text-slate-500">
                            <tr>
                                <th className="py-3 px-4">Timestamp</th>
                                <th className="py-3 px-4">Admin/Investigator ID</th>
                                <th className="py-3 px-4">Action</th>
                                <th className="py-3 px-4">Target Resource</th>
                                <th className="py-3 px-4">Trace Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.02]">
                            {loading ? <tr><td colSpan={5} className="py-6 text-center text-slate-500">Retrieving secure logs...</td></tr> :
                                logs.map(l => (
                                    <tr key={l._id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="py-3 px-4 text-slate-400 font-mono">{formatDate(l.createdAt)}</td>
                                        <td className="py-3 px-4 text-teal-400 font-mono">{l.userId}</td>
                                        <td className="py-3 px-4 text-white font-semibold tracking-wide">{l.action}</td>
                                        <td className="py-3 px-4 text-slate-300">
                                            {l.targetType} <span className="text-slate-500">({l.targetId || 'Global'})</span>
                                        </td>
                                        <td className="py-3 px-4 text-slate-400 truncate max-w-sm">{l.details}</td>
                                    </tr>
                                ))
                            }
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="p-4 border-t border-white/5 flex gap-2 justify-end">
                        <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1 bg-navy-800 text-slate-400 rounded-lg border border-white/5 disabled:opacity-50 text-xs">Previous</button>
                        <span className="px-3 py-1 text-xs text-slate-300">Page {page} of {totalPages}</span>
                        <button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 bg-navy-800 text-slate-400 rounded-lg border border-white/5 disabled:opacity-50 text-xs">Next</button>
                    </div>
                )}
            </div>
        </div>
    );
}
