import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Zap, Search, GitBranch, Lock, ChevronRight, Globe, Server, Cpu, Activity, FileText } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function LandingPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const heroRef = useRef<HTMLDivElement>(null);
    const featuresRef = useRef<HTMLDivElement>(null);
    const pipelineRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            // Hero Animation
            const tl = gsap.timeline();
            tl.from('.hero-title', { y: 60, opacity: 0, duration: 0.8, ease: 'power3.out' })
                .from('.hero-subtitle', { y: 30, opacity: 0, duration: 1, ease: 'power2.out' }, '-=0.4')
                .from('.hero-cta', { y: 20, opacity: 0, duration: 0.6, ease: 'power2.out' }, '-=0.3')
                .from('.hero-visual', { scale: 0.95, opacity: 0, duration: 1.2, ease: 'power2.out' }, '-=0.8');

            // Floating elements animation
            gsap.to('.floating-blob', {
                y: 'random(-40, 40)',
                x: 'random(-20, 20)',
                duration: 'random(4, 7)',
                repeat: -1,
                yoyo: true,
                ease: 'sine.inOut'
            });

            // Feature cards animation - ensuring they ARE NOT hidden if JS fails or scroll trigger is finicky
            gsap.from('.feature-card', {
                scrollTrigger: {
                    trigger: featuresRef.current,
                    start: 'top 85%',
                    toggleActions: 'play none none none'
                },
                y: 40,
                opacity: 0,
                stagger: 0.15,
                duration: 0.8,
                clearProps: 'all',
                ease: 'power2.out'
            });

            // Pipeline animation
            gsap.from('.pipeline-step', {
                scrollTrigger: {
                    trigger: pipelineRef.current,
                    start: 'top 90%',
                },
                x: -30,
                opacity: 0,
                stagger: 0.2,
                duration: 0.8,
                ease: 'power2.out'
            });
        });

        return () => ctx.revert();
    }, []);

    const handleAction = () => {
        if (user) {
            navigate('/dashboard');
        } else {
            navigate('/login');
        }
    };

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 overflow-x-hidden selection:bg-teal-500/30">
            {/* Background Decorations */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal-500/10 rounded-full blur-[120px] floating-blob" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[150px] floating-blob" />
                <div className="absolute top-[30%] right-[10%] w-[20%] h-[20%] bg-purple-600/5 rounded-full blur-[100px] floating-blob" />
                <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
            </div>

            {/* Navbar */}
            <nav className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-6 backdrop-blur-md border-b border-white/5 sticky top-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-700 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/20">
                        <Shield className="text-white" size={20} />
                    </div>
                    <div>
                        <span className="text-xl font-bold tracking-tight text-white">BFI</span>
                        <span className="block text-[8px] tracking-[0.2em] text-teal-400 font-bold uppercase leading-none mt-0.5">Bank Fraud Investigator</span>
                    </div>
                </div>

                <div className="hidden md:flex items-center gap-8 text-sm font-medium">
                    <a href="#features" className="hover:text-teal-400 transition-colors">Intelligence</a>
                    <a href="#solutions" className="hover:text-teal-400 transition-colors">Solutions</a>
                    <a href="#security" className="hover:text-teal-400 transition-colors">Security</a>
                </div>

                <button
                    onClick={handleAction}
                    className="px-6 py-2.5 rounded-full bg-white text-navy-950 font-bold text-sm hover:bg-teal-400 hover:text-white transition-all shadow-lg hover:shadow-teal-500/30 active:scale-95"
                >
                    {user ? 'Go to Dashboard' : 'Enterprise Login'}
                </button>
            </nav>

            {/* Hero Section */}
            <section ref={heroRef} className="relative z-10 px-6 lg:px-12 pt-20 pb-32 flex flex-col lg:flex-row items-center gap-16 max-w-7xl mx-auto">
                <div className="flex-1 text-center lg:text-left">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-bold mb-6 hero-title opacity-100">
                        <Zap size={12} />
                        <span>NEXT-GEN FRAUD INTELLIGENCE ENGINE</span>
                    </div>
                    <h1 className="text-5xl lg:text-7xl font-extrabold text-white leading-tight mb-6 hero-title">
                        Secure the Future of <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500">Digital Finance</span>
                    </h1>
                    <p className="text-lg lg:text-xl text-slate-400 mb-10 max-w-2xl hero-subtitle leading-relaxed">
                        Detect complex money laundering patterns, identify synthetic identities, and visualize hidden fraud networks with our unified enterprise-grade investigation platform.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 hero-cta">
                        <button
                            onClick={handleAction}
                            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-teal-600 to-blue-600 text-white font-bold text-lg hover:shadow-[0_0_30px_-5px_rgb(45,212,191)] transition-all group active:scale-[0.98]"
                        >
                            Launch Investigation Workspace
                            <ChevronRight className="inline-block ml-2 group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-lg hover:bg-white/10 transition-all active:scale-[0.98]">
                            View Documentation
                        </button>
                    </div>
                </div>

                <div className="flex-1 relative hero-visual">
                    <div className="relative z-10 glass-card p-4 rounded-3xl border border-white/10 shadow-2xl bg-[#0f172a]/80 group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-teal-500 to-blue-600 rounded-[28px] opacity-20 blur group-hover:opacity-40 transition-opacity" />
                        <video
                            className="w-full h-auto rounded-2xl shadow-inner relative z-10"
                            autoPlay
                            muted
                            loop
                            playsInline
                            poster="/dashboard-preview.png"
                        >
                            <source src="https://assets.mixkit.co/videos/preview/mixkit-cyber-security-digital-map-of-the-world-23136-large.mp4" type="video/mp4" />
                        </video>

                        {/* Interactive floating badges */}
                        <div className="absolute top-[-20px] right-[-20px] glass-card px-4 py-3 rounded-2xl border border-teal-500/30 flex items-center gap-3 animate-bounce shadow-xl z-20">
                            <div className="w-8 h-8 rounded-full bg-teal-400/20 flex items-center justify-center">
                                <Activity className="text-teal-400" size={16} />
                            </div>
                            <div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Detection Accuracy</div>
                                <div className="text-lg font-bold text-white">99.8%</div>
                            </div>
                        </div>

                        <div className="absolute bottom-10 left-[-40px] glass-card px-4 py-3 rounded-2xl border border-blue-500/30 flex items-center gap-3 shadow-xl z-20">
                            <div className="w-8 h-8 rounded-full bg-blue-400/20 flex items-center justify-center">
                                <Server className="text-blue-400" size={16} />
                            </div>
                            <div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Processing Latency</div>
                                <div className="text-lg font-bold text-white">&lt;10ms</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pipeline Strip */}
            <div ref={pipelineRef} className="relative z-10 border-y border-white/5 bg-navy-900/30 backdrop-blur-xl py-12 px-6">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
                    {[
                        { step: '01', title: 'Data Simulation', desc: 'Synthetic financial ingestion', icon: Server },
                        { step: '02', title: 'Neural Analysis', desc: 'Anomaly detection scans', icon: Cpu },
                        { step: '03', title: 'Graph Mapping', desc: 'Network linkage discovery', icon: GitBranch },
                        { step: '04', title: 'Case Resolution', desc: 'Evidence-based reporting', icon: Shield },
                    ].map((item, idx) => (
                        <div key={idx} className="flex items-center gap-6 pipeline-step">
                            <div className="text-4xl font-black text-white/10 tracking-tighter">{item.step}</div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <item.icon size={14} className="text-teal-400" />
                                    <span className="text-sm font-bold text-white uppercase tracking-wider">{item.title}</span>
                                </div>
                                <div className="text-xs text-slate-500 font-medium">{item.desc}</div>
                            </div>
                            {idx < 3 && <div className="hidden lg:block w-12 h-[1px] bg-white/5 ml-4" />}
                        </div>
                    ))}
                </div>
            </div>

            {/* Features Section */}
            <section id="features" ref={featuresRef} className="relative z-10 px-6 lg:px-12 py-32 max-w-7xl mx-auto">
                <div className="text-center mb-20">
                    <h2 className="text-sm font-bold text-teal-400 uppercase tracking-[0.3em] mb-4">Enterprise Capabilities</h2>
                    <h3 className="text-4xl lg:text-5xl font-bold text-white">Advanced Forensic Intelligence</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        {
                            title: 'Network Intelligence',
                            desc: 'Identify circular fund flows and layering chains across thousands of accounts in real-time.',
                            icon: GitBranch,
                            color: 'from-blue-500 to-cyan-500'
                        },
                        {
                            title: 'AI Anomaly Detection',
                            desc: 'Statistical Isolation Forest model discovers behavioral drifts and synthetic identity patterns.',
                            icon: Cpu,
                            color: 'from-teal-500 to-emerald-500'
                        },
                        {
                            title: 'Graph Visualization',
                            desc: 'Interactive Neo4j graph engine to map the exact money trail of complex financial crimes.',
                            icon: Globe,
                            color: 'from-purple-500 to-indigo-500'
                        },
                        {
                            title: 'Rapid Forensics',
                            desc: 'One-click deep dive into account history, device fingerprinting, and IP velocity checks.',
                            icon: Search,
                            color: 'from-orange-500 to-pink-500'
                        },
                        {
                            title: 'GenAI Reporting',
                            desc: 'Automated investigative reports generated by Gemini, summarizing complex evidence for legal teams.',
                            icon: FileText,
                            color: 'from-yellow-500 to-orange-500'
                        },
                        {
                            title: 'Audit Sovereignty',
                            desc: 'Immutable logs of every investigation step, ensuring compliance with global banking standards.',
                            icon: Lock,
                            color: 'from-red-500 to-rose-500'
                        }
                    ].map((f, i) => (
                        <div key={i} className="glass-card p-8 group hover:border-teal-500/50 transition-all duration-500 feature-card relative overflow-hidden">
                            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${f.color} opacity-0 group-hover:opacity-5 blur-[60px] transition-opacity`} />
                            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform`}>
                                <f.icon size={28} />
                            </div>
                            <h4 className="text-xl font-bold text-white mb-4">{f.title}</h4>
                            <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA Section */}
            <section className="relative z-10 px-6 lg:px-12 py-32 max-w-5xl mx-auto text-center">
                <div className="glass-card p-12 lg:p-20 rounded-[3rem] border border-white/10 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-blue-600/10" />
                    <h2 className="text-4xl lg:text-5xl font-bold text-white mb-8 relative z-10">Ready to stop financial crime?</h2>
                    <p className="text-slate-400 text-lg mb-10 max-w-2xl mx-auto relative z-10">
                        Join top tier financial institutions using BFI to monitor billions in volume and protect millions of customers.
                    </p>
                    <button
                        onClick={handleAction}
                        className="px-12 py-5 rounded-2xl bg-white text-navy-950 font-extrabold text-xl hover:bg-teal-400 hover:text-white transition-all shadow-2xl relative z-10 active:scale-95"
                    >
                        Secure Access Portal
                    </button>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 px-6 lg:px-12 py-12 border-t border-white/5 bg-navy-950/50">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-3 opacity-50">
                        <Shield className="text-teal-400" size={24} />
                        <span className="font-bold text-white">BFI SECURITY PLATFORM</span>
                    </div>
                    <div className="flex gap-8 text-xs text-slate-500 font-medium">
                        <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                        <a href="#" className="hover:text-white transition-colors">EULA</a>
                        <a href="#" className="hover:text-white transition-colors">Vulnerability Disclosure</a>
                        <span>&copy; 2026 BFI Inc.</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
