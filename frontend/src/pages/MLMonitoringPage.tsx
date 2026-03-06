import React from 'react';
import { Activity, Zap, ShieldAlert, Cpu } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const mockMetrics = [
    { time: '10:00', precision: 92, recall: 88, f1: 90, anomalies: 12 },
    { time: '10:15', precision: 93, recall: 87, f1: 90, anomalies: 8 },
    { time: '10:30', precision: 94, recall: 89, f1: 91, anomalies: 15 },
    { time: '10:45', precision: 91, recall: 86, f1: 88, anomalies: 22 },
    { time: '11:00', precision: 94, recall: 90, f1: 92, anomalies: 5 },
    { time: '11:15', precision: 95, recall: 92, f1: 93, anomalies: 7 },
    { time: '11:30', precision: 96, recall: 91, f1: 94, anomalies: 3 },
];

export default function MLMonitoringPage() {
    return (
        <div className="animate-fade-in">
            <h1 className="page-title mb-2">ML Model Monitoring</h1>
            <p className="page-subtitle mb-6">Live neural diagnostics and anomaly detection accuracy tracing.</p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Model Precision', val: '96.2%', icon: ShieldAlert, color: 'text-teal-400' },
                    { label: 'Recall Rate', val: '91.8%', icon: Zap, color: 'text-blue-400' },
                    { label: 'F1 Harmonic Score', val: '93.9%', icon: Activity, color: 'text-purple-400' },
                    { label: 'Anomaly Density', val: '2.4%', icon: Cpu, color: 'text-red-400' },
                ].map(s => (
                    <div key={s.label} className="glass-card p-4 flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-xs mb-1">{s.label}</p>
                            <h3 className={`text-xl font-bold ${s.color}`}>{s.val}</h3>
                        </div>
                        <s.icon size={24} className="text-white/10" />
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-card p-5">
                    <h3 className="text-sm font-semibold text-white mb-4">Precision / Recall Drift</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={mockMetrics}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                <XAxis dataKey="time" stroke="#ffffff50" fontSize={10} axisLine={false} tickLine={false} />
                                <YAxis stroke="#ffffff50" fontSize={10} axisLine={false} tickLine={false} domain={[80, 100]} />
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} />
                                <Line type="monotone" dataKey="precision" stroke="#2dd4bf" strokeWidth={2} dot={{ r: 3 }} />
                                <Line type="monotone" dataKey="recall" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-card p-5">
                    <h3 className="text-sm font-semibold text-white mb-4">Anomaly Spike Detection</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={mockMetrics}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                <XAxis dataKey="time" stroke="#ffffff50" fontSize={10} axisLine={false} tickLine={false} />
                                <YAxis stroke="#ffffff50" fontSize={10} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} />
                                <Area type="monotone" dataKey="anomalies" stroke="#f43f5e" fill="#f43f5e20" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
