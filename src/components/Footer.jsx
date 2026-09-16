import React from 'react';
import { Link } from 'react-router-dom';
import { FiGithub } from 'react-icons/fi';

const Footer = () => {
    return (
        <footer className="bg-aida-card border-t border-aida-border mt-auto">
            <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center text-sm text-aida-text-muted space-y-2 sm:space-y-0">
                <p>&copy; {new Date().getFullYear()} AIDA. All Rights Reserved.</p>
                <Link
                    to="/build-a-chatbot"
                    className="font-medium hover:text-aida-pink transition-colors"
                >
                    Build a chatbot for your company
                </Link>
            </div>
        </footer>
    );
};

export default Footer;