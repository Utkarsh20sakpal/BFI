import React, { useState, useEffect } from 'react';
import { settingsApi } from '../api';
import toast from 'react-hot-toast';
import { Settings, Save } from 'lucide-react';

export default function RuleConfigurationPage() {
    const [rules, setRules] = useState<any>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        settingsApi.getRules().then(res => setRules(res.data.settings)).catch(console.error);
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await settingsApi.updateRules(rules);
            toast.success('Fraud rules successfully updated system-wide');
        } catch (e) {
            toast.error('Failed to update rule configuration');
        } finally {
            setSaving(false);
        }
    };

    if (!rules) return <div className="p-8 text-center text-slate-500">Loading Configuration Engine...</div>;

    return (
        <div className="animate-fade-in">
            <h1 className="page-title mb-2">Fraud Rule Configuration</h1>
            <p className="page-subtitle mb-6">Modify global detection thresholds and risk tolerances.</p>

            <div className="glass-card p-6 max-w-3xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Settings size={18} className="text-teal-400" /> Logic Engine Parameters
                    </h3>
                    <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold">
                        <Save size={14} /> {saving ? 'Applying...' : 'Apply Config to Engine'}
                    </button>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Large Transaction Threshold (₹)</label>
                        <p className="text-xs text-slate-500 mb-2">Transactions exceeding this amount will automatically flag as High Risk.</p>
                        <input type="number" value={rules.largeTransactionThreshold} onChange={e => setRules({ ...rules, largeTransactionThreshold: parseInt(e.target.value) })} className="w-full md:w-1/2 bg-navy-800 border border-white/10 rounded px-3 py-2 text-white text-sm" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Rapid Transfer Threshold (Minutes)</label>
                        <p className="text-xs text-slate-500 mb-2">Time window to evaluate structuring behavior across multiple hops.</p>
                        <input type="number" value={rules.rapidTransferThreshold} onChange={e => setRules({ ...rules, rapidTransferThreshold: parseInt(e.target.value) })} className="w-full md:w-1/2 bg-navy-800 border border-white/10 rounded px-3 py-2 text-white text-sm" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Velocity Detection Limits (₹)</label>
                        <p className="text-xs text-slate-500 mb-2">Maximum gross processing value limit per account per day before flagging.</p>
                        <input type="number" value={rules.velocityDetectionLimits} onChange={e => setRules({ ...rules, velocityDetectionLimits: parseInt(e.target.value) })} className="w-full md:w-1/2 bg-navy-800 border border-white/10 rounded px-3 py-2 text-white text-sm" />
                    </div>
                </div>
            </div>
        </div>
    );
}
