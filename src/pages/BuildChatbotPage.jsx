// src/pages/BuildChatbotPage.jsx
import React from 'react';
import { FiCalendar, FiMail } from 'react-icons/fi';

const BOOKING_URL = 'https://calendly.com/munkiverse/lets-talk';
const CONTACT_EMAIL = 'bitsavvysolves@protonmail.com';

const BuildChatbotPage = () => {
    return (
        <div className="bg-aida-light">
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 text-center">

                <h1 className="text-4xl md:text-5xl font-bold text-aida-dark leading-tight tracking-tight">
                    Let's build your chatbot{' '}
                    <span className="text-aida-pink">together.</span>
                </h1>

                <p className="mt-6 text-lg text-aida-text-muted leading-relaxed max-w-2xl mx-auto">
                    We are the team behind AIDA. We build custom chatbots for businesses,
                    and we'd love to hear what you're working on.
                </p>

                <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto text-left">

                    {/* Book a call */}
                    <div className="p-8 rounded-2xl border border-aida-border bg-aida-card flex flex-col">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center border mb-5 bg-aida-pink/10 border-aida-pink/20">
                            <FiCalendar className="w-6 h-6 text-aida-pink" />
                        </div>
                        <h3 className="text-xl font-bold text-aida-dark mb-1">Book a call</h3>
                        <p className="text-sm text-aida-text-muted mb-6 flex-grow">
                            A 20-minute call with our team.
                        </p>
                        <a
                            href={BOOKING_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center w-full py-3 bg-aida-pink text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
                        >
                            <FiCalendar className="w-4 h-4 mr-2" />
                            Pick a time
                        </a>
                    </div>

                    {/* Send us an email */}
                    <div className="p-8 rounded-2xl border border-aida-border bg-aida-card flex flex-col">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center border mb-5 bg-blue-400/10 border-blue-400/20">
                            <FiMail className="w-6 h-6 text-blue-400" />
                        </div>
                        <h3 className="text-xl font-bold text-aida-dark mb-1">Send us an email</h3>
                        <p className="text-sm text-aida-text-muted mb-6 flex-grow">
                            We read every message and usually reply within 24 hours.
                        </p>
                        <a
                            href={`mailto:${CONTACT_EMAIL}`}
                            className="inline-flex items-center justify-center w-full py-3 border border-aida-border text-aida-dark font-semibold rounded-xl hover:bg-aida-light transition-colors break-all"
                        >
                            <FiMail className="w-4 h-4 mr-2 flex-shrink-0" />
                            {CONTACT_EMAIL}
                        </a>
                    </div>
                </div>

                <p className="mt-16 text-sm font-medium text-aida-text-muted">
                    — BitSavvy Solutions
                </p>
            </section>
        </div>
    );
};

export default BuildChatbotPage;
