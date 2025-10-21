import React from 'react';
import { FiCpu, FiLogIn, FiMic, FiUsers } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// The ChatWidgetLoader component is no longer needed here.

const HomePage = () => {
    const navigate = useNavigate();
    // Get isAuthenticated to control the login button visibility
    const { isAuthenticated } = useAuth();

    const handleCtaClick = () => {
        navigate(isAuthenticated ? '/' : '/login');
    };

    const features = [
        {
            icon: FiCpu,
            title: "Multi-Model Support",
            description: "Seamlessly switch between leading AI models to find the best fit for your task."
        },
        {
            icon: FiMic,
            title: "Voice-Enabled",
            description: "Engage in natural, spoken conversations with state-of-the-art voice recognition and synthesis."
        },
        {
            icon: FiUsers,
            title: "For Everyone",
            description: "Designed to be intuitive and accessible for people from all walks of life, not just tech experts."
        }
    ];

    return (
        <div className="bg-aida-light">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="flex justify-center">
                    <div className="w-full max-w-3xl text-center">
                        <h1 className="text-4xl md:text-5xl font-bold text-aida-dark">
                            AIDA: The Open AI Interface
                        </h1>
                        <p className="mt-4 text-lg text-aida-text-muted mx-auto">
                            We are building an awesome artificially intelligent digital assistant that is portable, private, and built by the people, for the people. Our mission is to democratize access to knowledge, information, and AI for everyone.
                        </p>
                        
                        {!isAuthenticated && (
                            <div className="mt-8">
                                <button
                                    onClick={handleCtaClick}
                                    className="inline-flex items-center px-6 py-3 bg-aida-pink text-white font-semibold rounded-lg hover:opacity-90 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                                >
                                    <FiLogIn className="w-5 h-5 mr-2" />
                                    Login to Get Started
                                </button>
                            </div>
                        )}

                        {/* Features */}
                        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-12">
                            {features.map((feature, index) => (
                                <div key={index} className="flex items-start space-x-4 text-left">
                                    <div className="flex-shrink-0 w-12 h-12 bg-aida-card border border-aida-border shadow-lg text-aida-pink rounded-lg flex items-center justify-center">
                                        <feature.icon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-aida-dark">{feature.title}</h3>
                                        <p className="mt-1 text-aida-text-muted">{feature.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {/* The chat widget section has been removed from here. */}
                        {/* It is now rendered globally and persistently by App.jsx. */}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomePage;