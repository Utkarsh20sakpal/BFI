export function formatCurrency(amount: number, currency = 'INR'): string {
    if (amount === null || amount === undefined) return '₹0';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
    }).format(amount);
}

export function formatDate(date: string | Date): string {
    if (!date) return '-';
    return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    }).format(new Date(date));
}

export function formatShortDate(date: string | Date): string {
    if (!date) return '-';
    return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit',
    }).format(new Date(date));
}

export function getRiskColor(score: number): string {
    if (score >= 85) return 'text-red-400';
    if (score >= 70) return 'text-orange-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-green-400';
}

export function getRiskBgColor(score: number): string {
    if (score >= 85) return 'bg-red-500/10 border-red-500/30 text-red-400';
    if (score >= 70) return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
    if (score >= 40) return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
    return 'bg-green-500/10 border-green-500/30 text-green-400';
}

export function getRiskLabel(score: number): string {
    if (score >= 85) return 'Critical';
    if (score >= 70) return 'High';
    if (score >= 40) return 'Medium';
    return 'Low';
}

export function getStatusColor(status: string): string {
    switch (status) {
        case 'Open': return 'bg-red-500/20 text-red-400 border-red-500/30';
        case 'Investigating': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
        case 'Closed': return 'bg-green-500/20 text-green-400 border-green-500/30';
        case 'False Positive': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
        default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
}

export function getFraudTypeColor(type: string): string {
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
    return colors[type] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
}

export function truncate(str: string, len = 12): string {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '...' : str;
}

export function relativeTime(date: string | Date): string {
    if (!date) return '';
    const diff = Date.now() - new Date(date).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

export function numberWithCommas(n: number): string {
    if (n === null || n === undefined) return '0';
    if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
    if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
}
