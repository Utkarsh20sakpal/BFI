import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api';
import { Shield, Eye, EyeOff, Loader, AlertCircle } from 'lucide-react';

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [seeding, setSeeding] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(username, password);
            navigate('/');
        } catch (err: any) {
            setError(err?.response?.data?.error || 'Login failed. Check credentials.');
        } finally {
            setLoading(false);
        }
    };

    const seedUsers = async () => {
        setSeeding(true);
        try {
            await authApi.seed();
            setError('');
            setUsername('admin');
            setPassword('Admin@123');
        } catch (err: any) {
            setError('Could not create demo users - is the backend running?');
        } finally {
            setSeeding(false);
        }
    };

    const quickLogin = (u: string, p: string) => {
        setUsername(u);
        setPassword(p);
    };

    return (
        <div className="min-h-screen bg-navy-950 bg-grid-pattern flex items-center justify-center px-4">
            {/* Background glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-teal-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-500/20">
                        <Shield size={32} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">BFI</h1>
                    <p className="text-teal-400 text-sm font-medium tracking-widest mt-1">BANK FRAUD INVESTIGATOR</p>
                    <p className="text-slate-500 text-xs mt-2">Enterprise Financial Crime Detection Platform</p>
                </div>

                {/* Login Card */}
                <div className="glass-card p-8 glow-teal">
                    <h2 className="text-lg font-semibold text-white mb-6">Sign In to Dashboard</h2>

                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4 text-sm text-red-400">
                            <AlertCircle size={14} className="flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="text-xs text-slate-400 block mb-1.5">Username or Email</label>
                            <input
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder="admin"
                                required
                                className="w-full bg-navy-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 block mb-1.5">Password</label>
                            <div className="relative">
                                <input
                                    type={showPw ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="w-full bg-navy-800 border border-white/10 rounded-xl px-4 py-3 pr-10 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500 transition-colors"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPw(!showPw)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                >
                                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? <><Loader size={16} className="animate-spin" /> Signing in...</> : 'Sign In'}
                        </button>
                    </form>

                    {/* Demo Credentials */}
                    <div className="mt-6 pt-6 border-t border-white/5">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-slate-500">Demo Credentials</span>
                            <button
                                onClick={seedUsers}
                                disabled={seeding}
                                className="text-xs text-teal-400 hover:underline"
                            >
                                {seeding ? 'Creating...' : 'Create Demo Users'}
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { label: 'Admin', u: 'admin', p: 'Admin@123', color: 'red' },
                                { label: 'Analyst', u: 'analyst', p: 'Analyst@123', color: 'teal' },
                            ].map(d => (
                                <button
                                    key={d.u}
                                    onClick={() => quickLogin(d.u, d.p)}
                                    className="p-2.5 rounded-lg bg-navy-800/70 border border-white/10 hover:border-teal-500/30 transition-colors text-left"
                                >
                                    <div className="text-xs font-semibold text-white">{d.label}</div>
                                    <div className="text-[10px] text-slate-500">{d.u} / {d.p}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <p className="text-center text-xs text-slate-600 mt-6">
                    BFI v1.0 · Authorized Access Only · All activity is monitored
                </p>
            </div>
        </div>
    );
}
