// src/pages/SourcePage.jsx
import React from 'react';
import { FiGithub, FiExternalLink, FiGitPullRequest, FiPackage } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi2';

// ── Data ──────────────────────────────────────────────────────────────────────

const REPOS = [
    {
        name: 'AIDA Widget — Frontend',
        description:
            'The chat widget, portal homepage, and all user-facing components. ' +
            'Built with React, Vite, and Tailwind CSS. Embeds into any website with a single script tag.',
        url: 'https://github.com/BitSavvy-Solutions/AIDA-widget',
        tags: ['React', 'Vite', 'Tailwind CSS', 'Voice Input', 'Streaming UI'],
    },
    {
        name: 'AIDA Agent Backend',
        description:
            'The AI orchestration layer. Handles model routing, streaming responses, ' +
            'transcription, web search, and URL scraping. Built with Python on Azure Functions.',
        url: 'https://github.com/BitSavvy-Solutions/aida-agentbackend',
        tags: ['Python', 'Azure Functions', 'LangChain', 'OpenRouter', 'Whisper'],
    },
];

const LOCAL_STEPS = [
    {
        label: 'Clone the frontend repository',
        command: 'git clone https://github.com/BitSavvy-Solutions/AIDA-widget.git',
    },
    {
        label: 'Move into the directory and install dependencies',
        command: 'cd AIDA-widget && npm install',
    },
    {
        label: 'Copy the example environment file and add your API keys',
        command: 'cp .env.example .env',
    },
    {
        label: 'Start the local development server',
        command: 'npm run dev',
    },
];

// ── Sub-components ────────────────────────────────────────────────────────────

const RepoCard = ({ name, description, url, tags }) => (
    <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="group p-6 rounded-2xl border border-aida-border bg-aida-card hover:border-aida-pink/50 transition-all hover:shadow-lg flex flex-col"
    >
        <div className="flex items-start justify-between mb-4">
            <FiGithub className="w-8 h-8 text-aida-dark" />
            <FiExternalLink className="w-4 h-4 text-aida-text-muted group-hover:text-aida-pink transition-colors" />
        </div>
        <h3 className="text-lg font-bold text-aida-dark mb-2">{name}</h3>
        <p className="text-aida-text-muted text-sm leading-relaxed flex-grow mb-5">
            {description}
        </p>
        <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
                <span
                    key={tag}
                    className="px-2 py-0.5 text-xs rounded-full bg-aida-light border border-aida-border text-aida-text-muted"
                >
                    {tag}
                </span>
            ))}
        </div>
    </a>
);

const CommandStep = ({ number, label, command }) => (
    <div className="flex items-start gap-4 p-4 rounded-xl bg-aida-card border border-aida-border">
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-aida-pink/10 border border-aida-pink/20 flex items-center justify-center mt-0.5">
            <span className="text-xs font-bold text-aida-pink">{number}</span>
        </div>
        <div className="min-w-0 w-full">
            <p className="text-sm text-aida-text-muted mb-2">{label}</p>
            <code className="block w-full text-sm font-mono bg-aida-light border border-aida-border rounded-lg px-4 py-2.5 text-aida-dark overflow-x-auto whitespace-pre">
                {command}
            </code>
        </div>
    </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const SourcePage = () => (
    <div className="bg-aida-light min-h-screen">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="bg-aida-card border-b border-aida-border">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-aida-pink/10 border border-aida-pink/20 text-aida-pink text-sm font-medium mb-6">
                    <HiSparkles className="w-4 h-4" />
                    <span>100% Open Source</span>
                </div>
                <h1 className="text-4xl font-bold text-aida-dark">AIDA Source Code</h1>
                <p className="mt-4 text-lg text-aida-text-muted max-w-2xl mx-auto leading-relaxed">
                    Every line of AIDA is public. Read it, run it locally, fork it, or contribute
                    to it. This tool belongs to the community.
                </p>
            </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-20">

            {/* ── Repositories ────────────────────────────────────────────── */}
            <section>
                <h2 className="text-2xl font-bold text-aida-dark mb-2">Repositories</h2>
                <p className="text-aida-text-muted mb-8">
                    AIDA is split into two independent repositories — one for the frontend
                    interface, one for the AI backend.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {REPOS.map((repo) => (
                        <RepoCard key={repo.name} {...repo} />
                    ))}
                </div>
            </section>

            {/* ── Run Locally ─────────────────────────────────────────────── */}
            <section>
                <h2 className="text-2xl font-bold text-aida-dark mb-2">
                    Run the Frontend Locally
                </h2>
                <p className="text-aida-text-muted mb-8">
                    Get the AIDA portal and chat widget running on your own machine in under
                    five minutes. You'll need Node.js 18+ installed.
                </p>
                <div className="space-y-3">
                    {LOCAL_STEPS.map((step, i) => (
                        <CommandStep
                            key={i}
                            number={i + 1}
                            label={step.label}
                            command={step.command}
                        />
                    ))}
                </div>
                <div className="mt-6 p-4 rounded-xl bg-blue-400/10 border border-blue-400/20">
                    <div className="flex items-start gap-3 text-sm text-blue-300">
                        <FiPackage className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <p>
                            The <code className="font-mono px-1 bg-blue-400/10 rounded">.env</code> file
                            needs an OpenRouter API key for model access. Check the repository README
                            for a full list of required variables.
                        </p>
                    </div>
                </div>
            </section>

            {/* ── Contribute ──────────────────────────────────────────────── */}
            <section className="p-8 rounded-2xl border border-aida-border bg-aida-card text-center">
                <FiGitPullRequest className="w-10 h-10 text-aida-pink mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-aida-dark mb-3">How to Contribute</h2>
                <p className="text-aida-text-muted max-w-xl mx-auto mb-8 leading-relaxed">
                    Found a bug? Have a feature idea? We'd love your help. Open an issue to start
                    a discussion, or submit a pull request directly. All contributions are
                    welcome — code, documentation, design, and feedback.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <a
                        href="https://github.com/BitSavvy-Solutions/AIDA-widget/issues"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-6 py-3 bg-aida-pink text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
                    >
                        <FiGithub className="w-4 h-4 mr-2" />
                        Open an Issue — Frontend
                    </a>
                    <a
                        href="https://github.com/BitSavvy-Solutions/aida-agentbackend/issues"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-6 py-3 border border-aida-border text-aida-dark font-semibold rounded-xl hover:bg-aida-light transition-colors"
                    >
                        <FiGithub className="w-4 h-4 mr-2" />
                        Open an Issue — Backend
                    </a>
                </div>
            </section>

        </div>
    </div>
);

export default SourcePage;