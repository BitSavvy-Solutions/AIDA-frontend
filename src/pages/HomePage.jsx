import React from 'react';
import { FiCpu, FiGithub, FiLogIn, FiMic, FiCode } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ChatWidgetLoader from '../components/ChatWidgetLoader';

const HomePage = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    const handleCtaClick = () => {
        navigate(isAuthenticated ? '/' : '/login'); // Stay on page or go to login
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
            icon: FiCode,
            title: "Developer Focused",
            description: "An open, extensible interface perfect for developers, researchers, and AI enthusiasts."
        },
        {
            icon: FiGithub,
            title: "Open Source",
            description: "AIDA is fully open source. Fork it, customize it, and contribute to its future."
        }
    ];

    return (
        <div className="bg-aida-light">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    
                    {/* Left Side: AIDA Info */}
                    <div className="text-center lg:text-left">
                        <h1 className="text-4xl md:text-5xl font-bold text-aida-dark">
                            AIDA: The Open AI Interface
                        </h1>
                        <p className="mt-4 text-lg text-gray-600 max-w-xl lg:mx-0 mx-auto">
                            A powerful, customizable, and open-source chat widget designed for developers. Experiment with and integrate next-gen AI with ease.
                        </p>
                        
                        {!isAuthenticated && (
                            <div className="mt-8 flex justify-center lg:justify-start">
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
                        <div className="mt-12 space-y-8">
                            {features.map((feature, index) => (
                                <div key={index} className="flex items-start space-x-4">
                                    <div className="flex-shrink-0 w-12 h-12 bg-white border shadow-sm text-aida-pink rounded-lg flex items-center justify-center">
                                        <feature.icon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-aida-dark">{feature.title}</h3>
                                        <p className="mt-1 text-gray-500">{feature.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Side: Chat Widget Loader */}
                    <div className="w-full">
                        <ChatWidgetLoader />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomePage;