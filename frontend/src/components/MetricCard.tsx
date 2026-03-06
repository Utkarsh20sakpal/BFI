import React from 'react';

interface MetricCardProps {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    trend?: { value: number; label: string };
    accent?: 'teal' | 'red' | 'orange' | 'yellow' | 'green' | 'purple';
    subtitle?: string;
}

const accentMap = {
    teal: { bg: 'bg-teal-500/10', border: 'border-teal-500/20', icon: 'bg-teal-500/20 text-teal-400', text: 'text-teal-400' },
    red: { bg: 'bg-red-500/10', border: 'border-red-500/20', icon: 'bg-red-500/20 text-red-400', text: 'text-red-400' },
    orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: 'bg-orange-500/20 text-orange-400', text: 'text-orange-400' },
    yellow: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', icon: 'bg-yellow-500/20 text-yellow-400', text: 'text-yellow-400' },
    green: { bg: 'bg-green-500/10', border: 'border-green-500/20', icon: 'bg-green-500/20 text-green-400', text: 'text-green-400' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: 'bg-purple-500/20 text-purple-400', text: 'text-purple-400' },
};

export default function MetricCard({ label, value, icon, trend, accent = 'teal', subtitle }: MetricCardProps) {
    const colors = accentMap[accent];

    return (
        <div className={`metric-card glass-card p-5 border ${colors.border}`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">{label}</p>
                    <p className={`text-3xl font-bold tracking-tight ${colors.text}`}>{value}</p>
                    {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colors.icon}`}>
                    {icon}
                </div>
            </div>
            {trend && (
                <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-1">
                    <span className={`text-xs font-semibold ${trend.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
                    </span>
                    <span className="text-xs text-slate-500">{trend.label}</span>
                </div>
            )}
        </div>
    );
}
