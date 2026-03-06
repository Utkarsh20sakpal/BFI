import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard, AlertTriangle, Search, GitBranch,
    List, FileText, Play, Activity, LogOut,
    Shield, ChevronLeft, ChevronRight, Bell,
    Users, Settings, Heart, Network
} from 'lucide-react';

const investigatorNavItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/alerts', label: 'Fraud Alerts', icon: AlertTriangle },
    { path: '/investigation', label: 'Investigation Workspace', icon: Search },
    { path: '/fund-flow', label: 'Fund Flow Graph', icon: GitBranch },
    { path: '/fraud-networks', label: 'Fraud Networks', icon: Network },
    { path: '/transactions', label: 'Transactions', icon: List },
    { path: '/reports', label: 'Reports', icon: FileText },
];

const adminNavItems = [
    { path: '/', label: 'System Overview', icon: LayoutDashboard },
    { path: '/users', label: 'User Management', icon: Users },
    { path: '/rules', label: 'Fraud Rule Config', icon: Settings },
    { path: '/ml-monitor', label: 'ML Model Monitoring', icon: Activity },
    { path: '/simulation', label: 'Simulation Controls', icon: Play },
    { path: '/system-health', label: 'System Health', icon: Heart },
    { path: '/audit-logs', label: 'Audit Logs', icon: FileText },
    { path: '/api-security', label: 'API Security', icon: Shield },
];

interface LayoutProps {
    children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const [collapsed, setCollapsed] = useState(false);
    const { user, logout, isAdmin, isAnalyst } = useAuth();
    const location = useLocation();

    const currentNavItems = isAdmin ? adminNavItems : investigatorNavItems;

    return (
        <div className="flex h-screen bg-navy-950 overflow-hidden">
            {/* Sidebar */}
            <aside className={`flex flex-col bg-navy-900 border-r border-white/5 transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}>
                {/* Logo */}
                <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
                    <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-teal-500 to-teal-700 rounded-lg flex items-center justify-center">
                        <Shield size={16} className="text-white" />
                    </div>
                    {!collapsed && (
                        <div>
                            <div className="text-white font-bold text-base leading-tight">BFI</div>
                            <div className="text-teal-400 text-[10px] font-medium tracking-widest leading-tight">BANK FRAUD INVESTIGATOR</div>
                        </div>
                    )}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="ml-auto text-slate-500 hover:text-teal-400 transition-colors"
                    >
                        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
                    {currentNavItems.map(({ path, label, icon: Icon }) => (
                        <NavLink
                            key={path}
                            to={path}
                            end={path === '/'}
                            className={({ isActive }) =>
                                `sidebar-link ${isActive ? 'active' : ''}`
                            }
                            title={collapsed ? label : undefined}
                        >
                            <Icon size={18} />
                            {!collapsed && <span>{label}</span>}
                            {!collapsed && path === '/alerts' && !isAdmin && (
                                <span className="ml-auto bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                    Live
                                </span>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* User Info */}
                <div className="border-t border-white/5 p-3">
                    {!collapsed ? (
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 text-xs font-bold flex-shrink-0">
                                {user?.firstName?.[0] || user?.username?.[0]?.toUpperCase() || 'U'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-white truncate">
                                    {user?.firstName ? `${user.firstName} ${user.lastName || ''}` : user?.username}
                                </div>
                                <div className="text-[10px] text-slate-400 capitalize truncate">{user?.role?.replace('_', ' ')}</div>
                            </div>
                            <button
                                onClick={logout}
                                className="text-slate-500 hover:text-red-400 transition-colors"
                                title="Logout"
                            >
                                <LogOut size={14} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={logout}
                            className="w-full flex justify-center text-slate-500 hover:text-red-400 transition-colors py-1"
                            title="Logout"
                        >
                            <LogOut size={16} />
                        </button>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top bar */}
                <header className="flex items-center justify-between px-6 py-3 bg-navy-900/50 border-b border-white/5 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Activity size={14} className="text-teal-400" />
                        <span>Real-time monitoring active</span>
                        <span className="w-2 h-2 rounded-full bg-teal-400 status-dot-pulse inline-block" />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-xs text-slate-500">
                            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                        <NavLink to="/alerts" className="relative text-slate-400 hover:text-teal-400 transition-colors">
                            <Bell size={18} />
                            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
                        </NavLink>
                        <div className="flex items-center gap-2 text-sm">
                            <div className="w-7 h-7 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 text-xs font-bold">
                                {user?.firstName?.[0] || user?.username?.[0]?.toUpperCase() || 'U'}
                            </div>
                            <span className="text-slate-300 text-xs">{user?.username}</span>
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto bg-grid-pattern p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
