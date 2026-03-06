import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { alertApi } from '../api';
import { RiskBadge, StatusBadge, FraudTypeBadge } from '../components/Badges';
import toast from 'react-hot-toast';
import { formatDate, formatCurrency } from '../utils/format';
import {
    Search, FileText, MessageSquare, CheckCircle, AlertTriangle,
    Clock, ChevronDown, Loader, Download, Shield, ArrowRight
} from 'lucide-react';

const STATUSES = ['Open', 'Investigating', 'Closed', 'False Positive'];

export default function InvestigationPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const alertId = searchParams.get('alert');

    const [alertId_input, setAlertIdInput] = useState(alertId || '');
    const [alertData, setAlertData] = useState<any>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [account, setAccount] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [reportLoading, setReportLoading] = useState(false);
    const [report, setReport] = useState<string | null>(null);
    const [newNote, setNewNote] = useState('');
    const [newStatus, setNewStatus] = useState('');
    const [saving, setSaving] = useState(false);
    const [noteSuccess, setNoteSuccess] = useState(false);

    useEffect(() => {
        if (alertId) {
            setAlertIdInput(alertId);
            loadAlert(alertId);
        }
    }, [alertId]);

    const loadAlert = async (id: string) => {
        setLoading(true);
        try {
            const res = await alertApi.get(id);
            setAlertData(res.data.alert);
            setTransactions(res.data.transactions || []);
            setAccount(res.data.account || null);
            setNewStatus(res.data.alert?.status || '');
            if (res.data.alert?.aiReport) setReport(res.data.alert.aiReport);
        } catch (e) {
            console.error(e);
            toast.error('Alert not found or access denied');
            setAlertData(null);
        } finally {
            setLoading(false);
        }
    };

    const generateReport = async () => {
        if (!alertData) return;
        setReportLoading(true);
        try {
            const res = await alertApi.generateReport(alertData.alertId);
            setReport(res.data.report);
        } catch (e) {
            console.error(e);
        } finally {
            setReportLoading(false);
        }
    };

    const saveNote = async () => {
        if (!alertData || !newNote.trim()) return;
        setSaving(true);
        try {
            await alertApi.addNote(alertData.alertId, newNote.trim(), 'Analyst');
            setNewNote('');
            setNoteSuccess(true);
            await loadAlert(alertData.alertId);
            setTimeout(() => setNoteSuccess(false), 2000);
        } finally {
            setSaving(false);
        }
    };

    const updateStatus = async () => {
        if (!alertData || !newStatus) return;
        setSaving(true);
        try {
            await alertApi.updateStatus(alertData.alertId, newStatus);
            await loadAlert(alertData.alertId);
        } finally {
            setSaving(false);
        }
    };

    const downloadReport = async () => {
        if (!alertData) return;
        try {
            const token = localStorage.getItem('bfi_token');
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
            const res = await fetch(`${apiUrl}/reports/sar/${alertData.alertId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!res.ok) throw new Error('Failed to download report');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `SAR-${alertData.alertId}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (e) {
            console.error('Download error:', e);
            alert('Failed to export SAR report.');
        }
    };

    return (
        <div className="animate-fade-in">
            <div className="mb-6">
                <h1 className="page-title">Investigation Workspace</h1>
                <p className="page-subtitle">Deep-dive into fraud alerts with AI-powered investigation tools</p>
            </div>

            <div className="info-panel">
                <p>
                    The <strong className="text-teal-400">Investigation Workspace</strong> is the primary tool for fraud analysts.
                    Enter an Alert ID or click an alert from the Alerts page to begin. Use the AI Report Generator to produce
                    a detailed forensic analysis, add investigation notes, and update case status.
                </p>
            </div>

            {/* Alert ID search */}
            <div className="glass-card p-4 mb-6 flex gap-3">
                <div className="flex-1 relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Enter Alert ID (e.g. ALT-ABC123-XYZ)"
                        value={alertId_input}
                        onChange={e => setAlertIdInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && loadAlert(alertId_input)}
                        className="w-full bg-navy-800 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-teal-500"
                    />
                </div>
                <button
                    onClick={() => loadAlert(alertId_input)}
                    disabled={!alertId_input || loading}
                    className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
                >
                    {loading ? <Loader size={14} className="animate-spin" /> : 'Load Alert'}
                </button>
            </div>

            {!alertData && !loading && (
                <div className="text-center py-20 text-slate-500">
                    <Shield size={48} className="mx-auto mb-4 opacity-30" />
                    <p>Enter an alert ID above or navigate from the <button onClick={() => navigate('/alerts')} className="text-teal-400 underline">Alerts page</button></p>
                </div>
            )}

            {alertData && (
                <div className="space-y-4">
                    {/* Alert Summary */}
                    <div className="glass-card p-5">
                        <div className="flex items-start justify-between flex-wrap gap-4">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <AlertTriangle size={20} className="text-red-400" />
                                    <h2 className="text-lg font-bold text-white">{alertData.alertId}</h2>
                                    <FraudTypeBadge type={alertData.fraudType} />
                                    <StatusBadge status={alertData.status} />
                                </div>
                                <p className="text-sm text-slate-400">{alertData.description}</p>
                            </div>
                            <RiskBadge score={alertData.riskScore} size="lg" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Account Profile */}
                        <div className="glass-card p-5">
                            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                                <Shield size={14} className="text-teal-400" />
                                Account Risk Profile
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <span className="text-xs text-slate-500">Account ID</span>
                                    <p className="text-sm font-mono text-teal-400 font-semibold">{alertData.accountId}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-slate-500">Risk Score</span>
                                    <div className="mt-1"><RiskBadge score={alertData.riskScore} /></div>
                                </div>
                                {account && (
                                    <>
                                        <div>
                                            <span className="text-xs text-slate-500">Account Status</span>
                                            <StatusBadge status={account.status} />
                                        </div>
                                        <div>
                                            <span className="text-xs text-slate-500">Total Transactions</span>
                                            <p className="text-sm text-white font-medium">{account.totalTransactions || 0}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-slate-500">Total Sent</span>
                                            <p className="text-sm text-white font-medium">{formatCurrency(account.totalSent || 0)}</p>
                                        </div>
                                    </>
                                )}
                                <div>
                                    <span className="text-xs text-slate-500 block mb-1.5">Detected Patterns</span>
                                    <div className="flex flex-wrap gap-1">
                                        {alertData.flags?.map((flag: string) => (
                                            <span key={flag} className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">
                                                {flag.replace(/_/g, ' ')}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Transaction Timeline */}
                        <div className="lg:col-span-2 glass-card p-5">
                            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                                <Clock size={14} className="text-teal-400" />
                                Transaction Timeline
                            </h3>
                            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                {transactions.slice(0, 20).map((tx: any, i: number) => (
                                    <div key={tx.transactionId} className="flex items-center gap-3 p-2.5 rounded-lg bg-navy-800/50 border border-white/5">
                                        <div className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                            {i + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className="text-slate-300 font-medium truncate">{tx.sender}</span>
                                                <ArrowRight size={10} className="text-slate-500 flex-shrink-0" />
                                                <span className="text-slate-300 font-medium truncate">{tx.receiver}</span>
                                            </div>
                                            <div className="text-[10px] text-slate-500 mt-0.5">{formatDate(tx.timestamp)}</div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <div className="text-xs font-semibold text-white">{formatCurrency(tx.amount)}</div>
                                            <RiskBadge score={tx.riskScore} showLabel={false} size="sm" />
                                        </div>
                                    </div>
                                ))}
                                {transactions.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No transactions found</p>}
                            </div>
                        </div>
                    </div>

                    {/* AI Report */}
                    <div className="glass-card p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                <FileText size={14} className="text-teal-400" />
                                AI Investigation Report
                            </h3>
                            <div className="flex gap-2">
                                {report && (
                                    <button
                                        onClick={downloadReport}
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:text-teal-400 glass-card border border-white/10 rounded-lg transition-colors"
                                    >
                                        <Download size={12} />
                                        Export
                                    </button>
                                )}
                                <button
                                    onClick={generateReport}
                                    disabled={reportLoading}
                                    className="flex items-center gap-2 px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {reportLoading ? <Loader size={12} className="animate-spin" /> : <FileText size={12} />}
                                    {reportLoading ? 'Generating...' : report ? 'Regenerate Report' : 'Generate AI Report'}
                                </button>
                            </div>
                        </div>

                        {report ? (
                            <div className="bg-navy-950/70 rounded-lg p-4 border border-white/5 max-h-96 overflow-y-auto">
                                <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{report}</pre>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 text-slate-500">
                                <FileText size={32} className="opacity-30 mb-3" />
                                <p className="text-sm">Click "Generate AI Report" to create an automated forensic analysis</p>
                            </div>
                        )}
                    </div>

                    {/* Case Management */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Status Update */}
                        <div className="glass-card p-5">
                            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                                <CheckCircle size={14} className="text-teal-400" />
                                Case Status
                            </h3>
                            <select
                                value={newStatus}
                                onChange={e => setNewStatus(e.target.value)}
                                className="w-full bg-navy-800 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-teal-500 mb-3"
                            >
                                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <button
                                onClick={updateStatus}
                                disabled={saving || newStatus === alertData.status}
                                className="w-full px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
                            >
                                {saving ? 'Saving...' : 'Update Status'}
                            </button>
                        </div>

                        {/* Investigator Notes */}
                        <div className="glass-card p-5">
                            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                                <MessageSquare size={14} className="text-teal-400" />
                                Investigation Notes
                            </h3>
                            <div className="space-y-2 mb-3 max-h-28 overflow-y-auto">
                                {alertData.investigatorNotes?.map((n: any, i: number) => (
                                    <div key={i} className="p-2 bg-navy-800/50 rounded text-xs border border-white/5">
                                        <p className="text-slate-300">{n.note}</p>
                                        <p className="text-slate-500 mt-1">{n.author} · {formatDate(n.timestamp)}</p>
                                    </div>
                                ))}
                                {(!alertData.investigatorNotes || alertData.investigatorNotes.length === 0) && (
                                    <p className="text-xs text-slate-500">No notes yet</p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Add investigation note..."
                                    value={newNote}
                                    onChange={e => setNewNote(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && saveNote()}
                                    className="flex-1 bg-navy-800 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-teal-500"
                                />
                                <button
                                    onClick={saveNote}
                                    disabled={saving || !newNote.trim()}
                                    className="px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs rounded-lg transition-colors disabled:opacity-40"
                                >
                                    {noteSuccess ? '✓' : 'Add'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
