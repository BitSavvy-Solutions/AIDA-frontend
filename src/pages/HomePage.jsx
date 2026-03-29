// src/pages/HomePage.jsx
import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    FiMessageSquare, FiCode, FiDollarSign, FiLock,
    FiLogIn, FiGithub, FiHardDrive,
    FiChevronLeft, FiChevronRight,
    FiMic, FiUploadCloud, FiSearch, FiGlobe, FiCpu,
} from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';

// ═══════════════════════════════════════════════════════════════════════════════
// CAROUSEL SLIDE GRAPHICS
// ═══════════════════════════════════════════════════════════════════════════════

const ModelsGraphic = () => (
    <div className="flex items-center justify-center gap-4 py-2">
        <div className="relative w-14 h-14 flex-shrink-0 rounded-2xl bg-violet-500/20 border border-violet-400/30 flex items-center justify-center">
            <FiCpu className="w-7 h-7 text-violet-400" />
            <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-violet-400 border-2 border-aida-card" />
        </div>
        <div className="flex flex-wrap gap-1.5 max-w-[210px]">
            {[
                ['DeepSeek',     'bg-blue-500/20  border-blue-400/30  text-blue-300' ],
                ['Claude',       'bg-amber-500/20 border-amber-400/30 text-amber-300'],
                ['Gemini Flash', 'bg-teal-500/20  border-teal-400/30  text-teal-300' ],
                ['Gemini Pro',   'bg-cyan-500/20  border-cyan-400/30  text-cyan-300' ],
                ['+ more',       'bg-violet-500/20 border-violet-400/30 text-violet-300'],
            ].map(([name, cls]) => (
                <span key={name} className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}`}>
                    {name}
                </span>
            ))}
        </div>
    </div>
);

const PricingGraphic = () => (
    <div className="flex justify-center gap-2 py-2">
        {[
            { top: '$0', bot: 'Monthly Fee'  },
            { top: '∞',  bot: 'Daily Limits' },
            { top: '✓',  bot: 'Pay Per Use'  },
        ].map(({ top, bot }) => (
            <div
                key={bot}
                className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl bg-green-500/10 border border-green-400/20"
            >
                <span className="text-2xl font-black text-green-400 leading-none">{top}</span>
                <span className="text-[10px] uppercase tracking-wide text-green-300/70 text-center leading-tight">
                    {bot}
                </span>
            </div>
        ))}
    </div>
);

const VoiceGraphic = () => (
    <div className="flex items-center justify-center gap-5 py-2">
        {/* Pulsing mic */}
        <div className="relative flex items-center justify-center w-16 h-16 flex-shrink-0">
            <div
                className="absolute inset-0 rounded-full border border-aida-pink/20 animate-ping"
                style={{ animationDuration: '2s' }}
            />
            <div
                className="absolute w-11 h-11 rounded-full border border-aida-pink/30 animate-ping"
                style={{ animationDuration: '2s', animationDelay: '0.4s' }}
            />
            <div className="relative w-10 h-10 rounded-full bg-aida-pink/20 border border-aida-pink/50 flex items-center justify-center">
                <FiMic className="w-5 h-5 text-aida-pink" />
            </div>
        </div>
        {/* Staggered equalizer bars */}
        <div className="flex items-center gap-[3px]">
            {[6, 11, 18, 13, 8, 15, 10, 6, 14, 9].map((h, i) => (
                <div
                    key={i}
                    className="w-[5px] bg-aida-pink/70 rounded-full animate-pulse"
                    style={{ height: `${h * 2.2}px`, animationDelay: `${i * 90}ms` }}
                />
            ))}
        </div>
    </div>
);

const FilesGraphic = () => (
    <div className="flex items-center justify-center gap-3 py-2">
        {[
            { emoji: '🖼️', label: 'Images',  deg: '-7deg' },
            { emoji: '📄', label: 'Docs',    deg: '0deg'  },
            { emoji: '📁', label: 'Folders', deg: '7deg'  },
            { emoji: '💻', label: 'Code',    deg: '-3deg' },
        ].map(({ emoji, label, deg }) => (
            <div
                key={label}
                className="flex flex-col items-center gap-1"
                style={{ transform: `rotate(${deg})` }}
            >
                <div className="w-14 h-14 rounded-xl bg-orange-500/15 border border-orange-400/25 flex items-center justify-center text-2xl shadow-sm">
                    {emoji}
                </div>
                <span className="text-[10px] text-orange-300/70 font-medium">{label}</span>
            </div>
        ))}
        <div className="ml-2 flex flex-col items-center gap-1">
            <FiUploadCloud className="w-6 h-6 text-orange-400 animate-bounce" />
            <span className="text-[10px] text-orange-300/70">drop it</span>
        </div>
    </div>
);

const WebSearchGraphic = () => (
    <div className="flex items-center justify-center gap-6 py-2">
        <div className="relative flex-shrink-0">
            <FiGlobe className="w-14 h-14 text-blue-400/50" />
            <div className="absolute -bottom-1 -right-2 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/20 border border-blue-400/30">
                <FiSearch className="w-3 h-3 text-blue-300" />
                <span className="text-[10px] font-mono text-blue-300">live</span>
            </div>
        </div>
        {/* Simulated result rows */}
        <div className="flex flex-col gap-2.5">
            {[100, 80, 62].map((w, i) => (
                <div key={i} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400/70 flex-shrink-0" />
                    <div
                        className="h-2 bg-blue-400/20 border border-blue-400/10 rounded-sm"
                        style={{ width: `${w}px` }}
                    />
                </div>
            ))}
        </div>
    </div>
);

const YouTubeGraphic = () => (
    <div className="flex items-center justify-center gap-4 py-2">
        {/* YouTube play card */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className="w-20 h-12 rounded-lg bg-red-500/20 border border-red-400/30 flex items-center justify-center">
                <div
                    className="w-0 h-0"
                    style={{
                        borderTop: '9px solid transparent',
                        borderBottom: '9px solid transparent',
                        borderLeft: '15px solid rgba(248,113,113,0.85)',
                    }}
                />
            </div>
            <span className="text-[10px] text-red-300/70 font-medium">YouTube video</span>
        </div>

        <span className="text-red-400/50 font-bold text-lg">+</span>

        {/* Webpage card */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className="w-20 h-12 rounded-lg bg-red-500/10 border border-red-400/20 flex items-center justify-center">
                <FiGlobe className="w-5 h-5 text-red-300/60" />
            </div>
            <span className="text-[10px] text-red-300/70 font-medium">Any webpage</span>
        </div>

        {/* Action list */}
        <div className="flex flex-col gap-1.5 ml-1">
            {['Summarize', 'Query', 'Analyze'].map((action) => (
                <div key={action} className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400/60 flex-shrink-0" />
                    <span className="text-xs text-red-300/70">{action}</span>
                </div>
            ))}
        </div>
    </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

const SLIDES = [
    {
        id: 'models',
        title: 'Access Leading AI Models',
        description:
            'DeepSeek, Gemini Flash, Claude, Gemini Pro and more, all from one clean interface. Switch any time, no configuration needed.',
        Graphic:  ModelsGraphic,
        accent:   'text-violet-400',
        dot:      'bg-violet-400',
        gradient: 'from-violet-500/10 to-blue-500/5',
        border:   'border-violet-400/20',
    },
    {
        id: 'pricing',
        title: 'No Monthly Subscriptions. Ever.',
        description:
            'No daily limits. No auto-renewals. No wasted credits. Pay only for what you actually use.',
        Graphic:  PricingGraphic,
        accent:   'text-green-400',
        dot:      'bg-green-400',
        gradient: 'from-green-500/10 to-emerald-500/5',
        border:   'border-green-400/20',
    },
    {
        id: 'voice',
        title: 'Voice First',
        description:
            'Voice-enabled from the ground up. Talk your heart out! AIDA transcribes and responds to you in real time.',
        Graphic:  VoiceGraphic,
        accent:   'text-aida-pink',
        dot:      'bg-aida-pink',
        gradient: 'from-pink-500/10 to-rose-500/5',
        border:   'border-aida-pink/20',
    },
    {
        id: 'files',
        title: 'Drag In Anything',
        description:
            'Drop in images, source code files, entire folders, or documents. AIDA reads and reasons over your content instantly.',
        Graphic:  FilesGraphic,
        accent:   'text-orange-400',
        dot:      'bg-orange-400',
        gradient: 'from-orange-500/10 to-yellow-500/5',
        border:   'border-orange-400/20',
    },
    {
        id: 'websearch',
        title: 'Live Web Search',
        description:
            'Get real-time, up-to-date answers with built-in web search.',
        Graphic:  WebSearchGraphic,
        accent:   'text-blue-400',
        dot:      'bg-blue-400',
        gradient: 'from-blue-500/10 to-cyan-500/5',
        border:   'border-blue-400/20',
    },
    {
        id: 'youtube',
        title: 'YouTube & Webpage Analysis',
        description:
            'Paste any YouTube link or URL. AIDA fetches the transcript or page content so you can summarize, query, and analyze it in seconds.',
        Graphic:  YouTubeGraphic,
        accent:   'text-red-400',
        dot:      'bg-red-400',
        gradient: 'from-red-500/10 to-rose-500/5',
        border:   'border-red-400/20',
    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE CAROUSEL
// ═══════════════════════════════════════════════════════════════════════════════

const FeatureCarousel = () => {
    const [current, setCurrent] = useState(0);
    const [visible, setVisible] = useState(true);
    const [hovered, setHovered] = useState(false);
    const indexRef      = useRef(0);
    const transitioning = useRef(false);
    const total         = SLIDES.length;

    /** Fade-transition to a specific slide index. */
    const goTo = useCallback((next) => {
        if (next === indexRef.current || transitioning.current) return;
        transitioning.current = true;
        setVisible(false);
        setTimeout(() => {
            setCurrent(next);
            indexRef.current    = next;
            setVisible(true);
            transitioning.current = false;
        }, 260);
    }, []);

    /** Auto-play — uses ref so interval never needs to be recreated. */
    useEffect(() => {
        if (hovered) return;
        const id = setInterval(() => {
            goTo((indexRef.current + 1) % total);
        }, 5000);
        return () => clearInterval(id);
    }, [hovered, total, goTo]);

    const slide = SLIDES[current];

    return (
        <div
            className="w-full max-w-2xl mx-auto"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* ── Nav + Card row ─────────────────────────────────────── */}
            <div className="flex items-center gap-3">

                {/* Prev */}
                <button
                    onClick={() => goTo((indexRef.current - 1 + total) % total)}
                    aria-label="Previous feature"
                    className="flex-shrink-0 w-9 h-9 rounded-full bg-aida-card border border-aida-border shadow-sm flex items-center justify-center text-aida-text-muted hover:text-aida-pink hover:border-aida-pink/30 transition-all"
                >
                    <FiChevronLeft className="w-4 h-4" />
                </button>

                {/* Card */}
                <div
                    className={`flex-1 relative overflow-hidden rounded-2xl border ${slide.border} bg-aida-card`}
                    style={{
                        opacity:    visible ? 1 : 0,
                        transform:  visible ? 'translateY(0)' : 'translateY(6px)',
                        transition: 'opacity 0.26s ease, transform 0.26s ease',
                    }}
                >
                    {/* Colour-accent gradient backdrop */}
                    <div
                        className={`absolute inset-0 bg-gradient-to-br ${slide.gradient} pointer-events-none`}
                    />

                    <div className="relative z-10 px-6 pt-5 pb-6">
                        <slide.Graphic />

                        <div className="mt-4 text-center">
                            <h3 className={`text-base sm:text-lg font-bold ${slide.accent} mb-1.5`}>
                                {slide.title}
                            </h3>
                            <p className="text-sm text-aida-text-muted leading-relaxed max-w-xs mx-auto">
                                {slide.description}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Next */}
                <button
                    onClick={() => goTo((indexRef.current + 1) % total)}
                    aria-label="Next feature"
                    className="flex-shrink-0 w-9 h-9 rounded-full bg-aida-card border border-aida-border shadow-sm flex items-center justify-center text-aida-text-muted hover:text-aida-pink hover:border-aida-pink/30 transition-all"
                >
                    <FiChevronRight className="w-4 h-4" />
                </button>
            </div>

            {/* ── Dot indicators ─────────────────────────────────────── */}
            <div className="flex items-center justify-center gap-1.5 mt-4">
                {SLIDES.map((s, i) => (
                    <button
                        key={s.id}
                        onClick={() => goTo(i)}
                        aria-label={`Go to feature ${i + 1} of ${total}`}
                        className={`rounded-full transition-all duration-300 ${
                            i === current
                                ? `w-5 h-2 ${slide.dot}`
                                : 'w-2 h-2 bg-aida-border hover:bg-aida-text-muted'
                        }`}
                    />
                ))}
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED SECTION COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// HOME PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const HomePage = () => {
    const navigate        = useNavigate();
    const { isAuthenticated } = useAuth();

    const handleStartChatting = useCallback(() => {
        const launcherBtn = document.querySelector('.aida-widget-launcher button');
        if (launcherBtn) launcherBtn.click();
    }, []);

    // ── Static data ───────────────────────────────────────────────────────────

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
                'Conversations are never sent to our servers or sold to anyone. ' +
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

    const guestFeatures = [
        'DeepSeek — fast, capable, and free to try',
        "Gemini Flash — Google's speedy lightweight model",
        'No registration, no forms, no waiting',
        'Chat history saved privately in your browser',
    ];

    const authFeatures = [
        'Everything in the free tier',
        "Claude — Anthropic's powerful reasoning model",
        "Gemini Pro — Google's full-power model",
        'Image generation',
        'Chat history saved privately in your browser',
    ];

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="bg-aida-light">

            {/* ──────────────────────────────────────────────────────────────
                HERO
            ────────────────────────────────────────────────────────────── */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 text-center">

                {/* Acronym badge */}
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
                    <span className="text-aida-pink">Open Source Interface.</span>{' '}
                    No Daily Limits.
                </h1>

                {/* ── Feature carousel (replaces static sub-headline) ── */}
                <div className="mt-8">
                    <FeatureCarousel />
                </div>

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

            {/* ──────────────────────────────────────────────────────────────
                THREE VALUE PILLARS
            ────────────────────────────────────────────────────────────── */}
            <section className="bg-aida-card border-t border-b border-aida-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl font-bold text-aida-dark">Why AIDA is Different</h2>
                        <p className="mt-3 text-aida-text-muted max-w-xl mx-auto">
                            Built on three principles that most AI tools ignore.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {pillars.map((p) => <Pillar key={p.title} {...p} />)}
                    </div>
                </div>
            </section>

            {/* ──────────────────────────────────────────────────────────────
                HOW IT WORKS
            ────────────────────────────────────────────────────────────── */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
                <div className="text-center mb-14">
                    <h2 className="text-3xl font-bold text-aida-dark">How It Works</h2>
                    <p className="mt-3 text-aida-text-muted">Three steps. No friction.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                    {steps.map((s) => <Step key={s.number} {...s} />)}
                </div>

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

            {/* ──────────────────────────────────────────────────────────────
                GUEST vs LOGGED-IN
            ────────────────────────────────────────────────────────────── */}
            <section className="bg-aida-card border-t border-aida-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl font-bold text-aida-dark">Choose How You Start</h2>
                        <p className="mt-3 text-aida-text-muted">
                            Jump straight in, or unlock smarter models with a free account.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">

                        {/* Guest card */}
                        <div className="p-8 rounded-2xl border border-aida-border bg-aida-light flex flex-col">
                            <div className="text-3xl mb-4">👤</div>
                            <h3 className="text-xl font-bold text-aida-dark mb-1">Without an Account</h3>
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

                        {/* Logged-in card */}
                        <div className="p-8 rounded-2xl border border-aida-pink/30 bg-aida-pink/5 flex flex-col relative overflow-hidden">
                            <span className="absolute top-4 right-4 px-2 py-0.5 bg-aida-pink text-white text-xs font-bold rounded-full">
                                Recommended
                            </span>
                            <div className="text-3xl mb-4">⚡</div>
                            <h3 className="text-xl font-bold text-aida-dark mb-1">With a Free Account</h3>
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

                    {/* Browser memory note */}
                    <div className="mt-10 max-w-3xl mx-auto flex items-start gap-3 px-5 py-4 rounded-xl bg-aida-light border border-aida-border">
                        <FiHardDrive className="w-5 h-5 text-aida-text-muted flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-aida-text-muted leading-relaxed">
                            <span className="font-semibold text-aida-dark">Your chat history is yours.</span>{' '}
                            Conversations are saved privately in your browser's local storage. They stay on
                            your device and are never shared with us.
                        </p>
                    </div>
                </div>
            </section>

            {/* ──────────────────────────────────────────────────────────────
                OPEN SOURCE & COMMUNITY
            ────────────────────────────────────────────────────────────── */}
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

            {/* ──────────────────────────────────────────────────────────────
                FINAL CTA STRIP
            ────────────────────────────────────────────────────────────── */}
            <section className="bg-aida-card border-t border-aida-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
                    <h2 className="text-3xl font-bold text-aida-dark">Ready? It takes 5 seconds.</h2>
                    <p className="mt-3 text-aida-text-muted">No forms. No credit cards. No catch.</p>
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