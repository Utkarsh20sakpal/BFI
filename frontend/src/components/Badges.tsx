import React from 'react';
import { getRiskBgColor, getRiskLabel } from '../utils/format';

interface RiskBadgeProps {
    score: number;
    showLabel?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

export function RiskBadge({ score, showLabel = true, size = 'md' }: RiskBadgeProps) {
    const colorClass = getRiskBgColor(score);
    const label = getRiskLabel(score);

    const sizeClass = {
        sm: 'text-[10px] px-1.5 py-0.5',
        md: 'text-xs px-2 py-0.5',
        lg: 'text-sm px-3 py-1',
    }[size];

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${colorClass} ${sizeClass}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
            {score}
            {showLabel && <span className="opacity-70">{label}</span>}
        </span>
    );
}

interface StatusBadgeProps {
    status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
    const colors: Record<string, string> = {
        'Open': 'bg-red-500/20 text-red-400 border-red-500/30',
        'Investigating': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        'Closed': 'bg-green-500/20 text-green-400 border-green-500/30',
        'False Positive': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
        'active': 'bg-green-500/20 text-green-400 border-green-500/30',
        'dormant': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
        'blocked': 'bg-red-500/20 text-red-400 border-red-500/30',
        'suspicious': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        'flagged': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        'completed': 'bg-green-500/20 text-green-400 border-green-500/30',
    };

    return (
        <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium ${colors[status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
            {status}
        </span>
    );
}

interface FraudTypeBadgeProps {
    type: string | null;
}

export function FraudTypeBadge({ type }: FraudTypeBadgeProps) {
    if (!type || type === 'Normal') return null;

    const colors: Record<string, string> = {
        'Layering': 'bg-red-500/20 text-red-400 border-red-500/30',
        'Structuring': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        'Circular Flow': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        'Dormant Account': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        'Large Transaction': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        'Rapid Transfer': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
        'ML Anomaly': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
        'Multiple Flags': 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    };

    return (
        <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium ${colors[type] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
            {type}
        </span>
    );
}
