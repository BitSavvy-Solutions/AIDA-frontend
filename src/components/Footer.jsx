import React from 'react';
import { FiGithub } from 'react-icons/fi';

const Footer = () => {
    return (
        <footer className="bg-aida-card border-t border-aida-border mt-auto">
            <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center text-sm text-aida-text-muted space-y-2 sm:space-y-0">
                <p>&copy; {new Date().getFullYear()} AIDA. All Rights Reserved.</p>
                <a 
                    href="https://github.com/aitutor-project"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:text-aida-pink transition-colors"
                >
                </a>
            </div>
        </footer>
    );
};

export default Footer;