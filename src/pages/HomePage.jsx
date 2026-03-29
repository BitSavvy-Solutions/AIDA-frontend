// src/pages/HomePage.jsx
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    FiMessageSquare,
    FiCode,
    FiDollarSign,
    FiLock,
    FiLogIn,
    FiGithub,
    FiHardDrive,
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';

// ── Small reusable components ─────────────────────────────────────────────────

const Pillar = ({ icon: Icon, title, description, colorClass, bgClass, borderClass }) => (
    <div className={`p-8 rounded-2xl border ${bgClass} ${borderClass} flex flex-col`}>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border mb-5 ${bgClass} ${borderClass}`}>
            <Icon className={`w-6 h-6 ${colorClass}`} />
        </div>
        <h3 className={`text-xl font-bold mb-3 ${colorClass}`}>{title}</h3>
        <p className="text-aida-text-muted leading-relaxed">{description}</p>
    </div>
);

const Step = ({ number, title, description }) => (
    <div className="text-center px-4">
        <div className="text-6xl font-black text-aida-pink/20 mb-4 leading-none">{number}</div>
        <h3 className="text-lg font-semibold text-aida-dark mb-2">{title}</h3>
        <p className="text-aida-text-muted text-sm leading-relaxed">{description}</p>
    </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const HomePage = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    const handleStartChatting = useCallback(() => {
        const launcherBtn = document.querySelector('.aida-widget-launcher button');
        if (launcherBtn) {
            launcherBtn.click();
        }
    }, []);

    // ── Data ──────────────────────────────────────────────────────────────────

    const pillars = [
        {
            icon: FiDollarSign,
            title: 'No Subscriptions, Ever',
            description:
                'Bring your own API key and pay only for what you actually use. ' +
                'No monthly fees, no auto-renewals, no daily limits, no wasted credits.',
            colorClass:  'text-green-400',
            bgClass:     'bg-green-400/10',
            borderClass: 'border-green-400/20',
        },
        {
            icon: FiCode,
            title: 'Fully Open Source',
            description:
                'Every line of frontend and backend code is public on GitHub. ' +
                'Inspect it, fork it, contribute to it. This tool belongs to the community.',
            colorClass:  'text-blue-400',
            bgClass:     'bg-blue-400/10',
            borderClass: 'border-blue-400/20',
        },
        {
            icon: FiLock,
            title: 'Your Privacy Comes First',
            description:
                "Conversations are never sent to our servers or sold to anyone. " +
                'Your chat history is saved privately in your own browser. ' +
                'Note: the AI providers you choose have their own data policies.',
            colorClass:  'text-aida-pink',
            bgClass:     'bg-aida-pink/10',
            borderClass: 'border-aida-pink/20',
        },
    ];

    const steps = [
        {
            number: '01',
            title: 'Click Start Chatting',
            description:
                'No account needed. The chat widget opens in the bottom-right corner instantly.',
        },
        {
            number: '02',
            title: 'Pick Your AI',
            description:
                'Choose from DeepSeek, Gemini Flash, Claude, Gemini Pro, and more from the model selector.',
        },
        {
            number: '03',
            title: 'Start Talking',
            description:
                'Ask anything. Switch models anytime. Your conversation is saved privately in your browser — no account required.',
        },
    ];

    // ── Guest feature list ────────────────────────────────────────────────────

    const guestFeatures = [
        'DeepSeek — fast, capable, and free to try',
        'Gemini Flash — Google\'s speedy lightweight model',
        'No registration, no forms, no waiting',
        'Chat history saved privately in your browser',
    ];

    const authFeatures = [
        'Everything in the free tier',
        'Claude — Anthropic\'s powerful reasoning model',
        'Gemini Pro — Google\'s full-power model',
        'Image generation',
        'Chat history saved privately in your browser',
    ];

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="bg-aida-light">

            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 text-center">

                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-aida-pink/10 border border-aida-pink/20 text-aida-pink text-sm font-medium mb-8">
                    <HiSparkles className="w-4 h-4" />
                    <span>
                        <span className="font-black">A</span>rtificially{' '}
                        <span className="font-black">I</span>ntelligent{' '}
                        <span className="font-black">D</span>igital{' '}
                        <span className="font-black">A</span>ssistant
                    </span>
                </div>

                {/* Headline */}
                <h1 className="text-5xl md:text-6xl font-bold text-aida-dark leading-tight tracking-tight">
                    Multiple AI Models.{' '}
                    <span className="text-aida-pink">One Interface.</span>{' '}
                    No Daily Limits.
                </h1>

                {/* Sub-headline */}
                <p className="mt-6 text-xl text-aida-text-muted max-w-2xl mx-auto leading-relaxed">
                    Use AIDA to access leading AI models — DeepSeek, Gemini Flash, Claude,
                    Gemini Pro, and more — all from one clean interface. No subscriptions.
                    No daily limits. Your conversations stay private in your browser.
                </p>

                {/* CTAs */}
                <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button
                        onClick={handleStartChatting}
                        className="inline-flex items-center px-8 py-4 bg-aida-pink text-white font-semibold rounded-xl hover:opacity-90 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 transform text-lg"
                    >
                        <FiMessageSquare className="w-5 h-5 mr-2" />
                        Start Chatting — It's Free
                    </button>

                    <button
                        onClick={() => navigate('/source')}
                        className="inline-flex items-center px-8 py-4 border border-aida-border text-aida-dark font-semibold rounded-xl hover:bg-aida-card transition-colors text-lg"
                    >
                        <FiCode className="w-5 h-5 mr-2" />
                        View Source Code
                    </button>
                </div>

                {/* Reassurance */}
                <p className="mt-5 text-sm text-aida-text-muted">
                    No account needed to get started.{' '}
                    {isAuthenticated ? (
                        <span className="text-green-400 font-medium">
                            You're logged in — advanced models and image generation are available.
                        </span>
                    ) : (
                        <>
                            <button
                                onClick={() => navigate('/login')}
                                className="text-aida-pink hover:underline font-medium"
                            >
                                Log in
                            </button>
                            {' '}to unlock Claude, Gemini Pro, and image generation.
                        </>
                    )}
                </p>

                {/* Widget pointer hint */}
                <p className="mt-2 text-xs text-aida-text-muted">
                    The chat button will appear in the{' '}
                    <span className="font-medium text-aida-dark">bottom-right corner</span>{' '}
                    of your screen ↘
                </p>
            </section>

            {/* ── Three Value Pillars ───────────────────────────────────────── */}
            <section className="bg-aida-card border-t border-b border-aida-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl font-bold text-aida-dark">
                            Why AIDA is Different
                        </h2>
                        <p className="mt-3 text-aida-text-muted max-w-xl mx-auto">
                            Built on three principles that most AI tools ignore.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {pillars.map((p) => (
                            <Pillar key={p.title} {...p} />
                        ))}
                    </div>
                </div>
            </section>

            {/* ── How It Works ─────────────────────────────────────────────── */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
                <div className="text-center mb-14">
                    <h2 className="text-3xl font-bold text-aida-dark">How It Works</h2>
                    <p className="mt-3 text-aida-text-muted">Three steps. No friction.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                    {steps.map((s) => (
                        <Step key={s.number} {...s} />
                    ))}
                </div>

                {/* Quick action after steps */}
                <div className="text-center mt-12">
                    <button
                        onClick={handleStartChatting}
                        className="inline-flex items-center px-6 py-3 bg-aida-pink/10 border border-aida-pink/30 text-aida-pink font-semibold rounded-xl hover:bg-aida-pink/20 transition-colors"
                    >
                        <FiMessageSquare className="w-4 h-4 mr-2" />
                        Try It Right Now
                    </button>
                </div>
            </section>

            {/* ── Guest vs Logged In ────────────────────────────────────────── */}
            <section className="bg-aida-card border-t border-aida-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl font-bold text-aida-dark">
                            Choose How You Start
                        </h2>
                        <p className="mt-3 text-aida-text-muted">
                            Jump straight in, or unlock smarter models with a free account.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">

                        {/* ── Guest card ── */}
                        <div className="p-8 rounded-2xl border border-aida-border bg-aida-light flex flex-col">
                            <div className="text-3xl mb-4">👤</div>
                            <h3 className="text-xl font-bold text-aida-dark mb-1">
                                Without an Account
                            </h3>
                            <p className="text-sm text-aida-text-muted mb-5">
                                Start chatting in seconds, no sign-up required.
                            </p>
                            <ul className="space-y-3 text-aida-text-muted flex-grow">
                                {guestFeatures.map((item) => (
                                    <li key={item} className="flex items-start gap-2">
                                        <span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                            <button
                                onClick={handleStartChatting}
                                className="mt-8 w-full py-3 border border-aida-border rounded-xl text-aida-dark font-semibold hover:bg-aida-card transition-colors"
                            >
                                Try It Now
                            </button>
                        </div>

                        {/* ── Logged-in card ── */}
                        <div className="p-8 rounded-2xl border border-aida-pink/30 bg-aida-pink/5 flex flex-col relative overflow-hidden">
                            <span className="absolute top-4 right-4 px-2 py-0.5 bg-aida-pink text-white text-xs font-bold rounded-full">
                                Recommended
                            </span>
                            <div className="text-3xl mb-4">⚡</div>
                            <h3 className="text-xl font-bold text-aida-dark mb-1">
                                With a Free Account
                            </h3>
                            <p className="text-sm text-aida-text-muted mb-5">
                                Unlock smarter models and image generation — still free.
                            </p>
                            <ul className="space-y-3 text-aida-text-muted flex-grow">
                                {authFeatures.map((item) => (
                                    <li key={item} className="flex items-start gap-2">
                                        <span className="text-aida-pink mt-0.5 flex-shrink-0">✓</span>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                            {isAuthenticated ? (
                                <button
                                    onClick={handleStartChatting}
                                    className="mt-8 w-full py-3 bg-aida-pink text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
                                >
                                    Start Chatting
                                </button>
                            ) : (
                                <button
                                    onClick={() => navigate('/login')}
                                    className="mt-8 w-full py-3 bg-aida-pink text-white rounded-xl font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                                >
                                    <FiLogIn className="w-4 h-4" />
                                    Sign in with Google
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ── Browser memory note ── */}
                    <div className="mt-10 max-w-3xl mx-auto flex items-start gap-3 px-5 py-4 rounded-xl bg-aida-light border border-aida-border">
                        <FiHardDrive className="w-5 h-5 text-aida-text-muted flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-aida-text-muted leading-relaxed">
                            <span className="font-semibold text-aida-dark">Your chat history is yours.</span>{' '}
                            Conversations are saved privately in your browser's local storage. They stay on your device and are never shared with us.
                        </p>
                    </div>
                </div>
            </section>

            {/* ── Open Source & Community ───────────────────────────────────── */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-3xl font-bold text-aida-dark mb-6">
                        Built by the Community, for Everyone
                    </h2>
                    <p className="text-lg text-aida-text-muted leading-relaxed">
                        AIDA is built by developers who believe AI tools should be open, honest, and
                        accessible — not locked behind corporate paywalls. The full source code for
                        the frontend and backend is available on GitHub. We're excited to have you
                        here, and we'd love for you to be part of what we're building.
                    </p>
                    <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                        <a
                            href="https://github.com/BitSavvy-Solutions/AIDA-widget"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-6 py-3 bg-aida-card border border-aida-border text-aida-dark font-semibold rounded-xl hover:border-aida-pink/40 transition-colors"
                        >
                            <FiGithub className="w-5 h-5 mr-2" />
                            Frontend Code
                        </a>
                        <a
                            href="https://github.com/BitSavvy-Solutions/aida-agentbackend"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-6 py-3 bg-aida-card border border-aida-border text-aida-dark font-semibold rounded-xl hover:border-aida-pink/40 transition-colors"
                        >
                            <FiGithub className="w-5 h-5 mr-2" />
                            Backend Code
                        </a>
                    </div>
                </div>
            </section>

            {/* ── Final CTA Strip ───────────────────────────────────────────── */}
            <section className="bg-aida-card border-t border-aida-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
                    <h2 className="text-3xl font-bold text-aida-dark">
                        Ready? It takes 5 seconds.
                    </h2>
                    <p className="mt-3 text-aida-text-muted">
                        No forms. No credit cards. No catch.
                    </p>
                    <button
                        onClick={handleStartChatting}
                        className="mt-8 inline-flex items-center px-10 py-4 bg-aida-pink text-white font-semibold rounded-xl hover:opacity-90 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 transform text-lg"
                    >
                        <FiMessageSquare className="w-5 h-5 mr-2" />
                        Start Chatting
                    </button>
                </div>
            </section>

        </div>
    );
};

export default HomePage;