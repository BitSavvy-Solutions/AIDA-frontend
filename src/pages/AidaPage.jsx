/* src/pages/AidaPage.jsx */
import React from 'react';
import { 
    FaGithub, 
    FaBolt,
    FaCogs,
    FaCode,
    FaUsers
} from 'react-icons/fa';
import ChatInterface from '../components/aida/ChatInterface';
import AidaHeader from '../components/aida/AidaHeader';
import Footer from '../components/Footer';

// A new page specifically for AIDA, independent of App.jsx's layout
const AidaPage = () => {
    
    const features = [
       {
            icon: FaBolt,
            title: "Real-time Responses",
            description: "Get lightning-fast answers from state-of-the-art AI models without the wait."
       },
       {
            icon: FaCogs,
            title: "Multi-Model Support",
            description: "Seamlessly switch between different LLMs like GPT, Claude, and Llama to find the best tool for your task."
       },
       {
           icon: FaCode,
           title: "Truly Open Source",
           description: "AIDA is built for the community. The entire codebase is on GitHub for you to inspect, modify, and contribute."
       },
       {
           icon: FaUsers,
           title: "Community Driven",
           description: "Join a growing community of developers and AI enthusiasts shaping the future of open AI interfaces."
       }
    ];

    return (
        <div className="bg-aida-light min-h-screen">
            <AidaHeader />
            <main className="py-12 sm:py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        {/* Left Side: AIDA Info */}
                        <div className="text-center lg:text-left">
                            <h1 className="text-4xl md:text-5xl font-bold text-aida-dark">
                                AIDA: The Open AI Interface
                            </h1>
                            <p className="mt-4 text-lg text-aida-text-muted max-w-xl lg:mx-0 mx-auto">
                                An open-source, powerful, and free-to-use chat interface designed for developers, researchers, and AI enthusiasts.
                                Experiment with multiple large language models in one clean interface.
                            </p>
                            <div className="mt-8 flex justify-center lg:justify-start">
                                <a
                                  href="https://github.com/aitutor-project"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center px-6 py-3 bg-gray-800 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors"
                                >
                                    <FaGithub className="w-5 h-5 mr-2" />
                                    View on GitHub
                                </a>
                            </div>

                             {/* Features */}
                            <div className="mt-12 space-y-8">
                                {features.map((feature, index) => (
                                    <div key={index} className="flex items-start space-x-4">
                                        <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-[#FF5F90]/20 to-red-500/20 text-aida-pink rounded-lg flex items-center justify-center">
                                            <feature.icon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-aida-dark">{feature.title}</h3>
                                            <p className="mt-1 text-aida-text-muted">{feature.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right Side: Chat Interface */}
                        <div className="w-full">
                            <ChatInterface />
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default AidaPage;