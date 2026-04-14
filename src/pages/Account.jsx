import React, { useState, useEffect } from 'react';
import { FiList, FiCreditCard } from 'react-icons/fi';
import config from '../config/apiConfig';
import DateRangePicker from '../components/DateRangePicker';
import BuyCreditsModal from '../components/BuyCreditsModal';
import { useAuth } from '../contexts/AuthContext';

export default function Account() {
    // Get user from auth context for the Stripe modal
    const { user } = useAuth();

    // Helper to get today's date for initial state
    const getTodayString = () => {
        const date = new Date();
        const offset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() - offset).toISOString().split('T')[0];
    };

    // State for UI tabs
    const [activeTab, setActiveTab] = useState('credits'); 
    const [isModalOpen, setIsModalOpen] = useState(false);

    // State for your API data
    const [profile, setProfile] = useState(null);
    const [creditHistory, setCreditHistory] = useState([]);
    const [usageLogs, setUsageLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    // Pagination & Filtering State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Default to Today
    const [startDate, setStartDate] = useState(getTodayString());
    const [endDate, setEndDate] = useState(getTodayString());

    const API_BASE_URL = `${config.FASTAPI_URL}/user`;

    useEffect(() => {
        const fetchAccountData = async () => {
            // 1. Grab the token from localStorage
            const token = localStorage.getItem("aidaToken");

            if (!token) {
                console.warn("No aidaToken found in local storage. User might not be logged in.");
                setLoading(false);
                return; // Stop execution if there's no token
            }

            try {
                setLoading(true);
                
                // 2. Set up the headers with the API key
                const fetchOptions = {
                    method: 'GET',
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}` 
                    }
                };

                // 3. Fetch data WITHOUT the ?email= parameter
                const profileRes = await fetch(`${API_BASE_URL}/profile`, fetchOptions);
                const profileData = await profileRes.json();
                setProfile(profileData);

                // Credit History & Usage Logs
                const [creditsRes, usageRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/credits/history`, fetchOptions),
                    fetch(`${API_BASE_URL}/usage/logs`, fetchOptions)
                ]);

                const creditsData = await creditsRes.json();
                const usageData = await usageRes.json();

                // 3. Sort them separately (newest first)
                setCreditHistory((creditsData || []).sort((a, b) => new Date(b.date) - new Date(a.date)));
                setUsageLogs((usageData || []).sort((a, b) => new Date(b.date) - new Date(a.date)));
            
            } catch (error) {
                console.error("Error fetching account data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAccountData();
    }, []);

    // Reset page to 1 when switching tabs or changing dates
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, startDate, endDate]);

    // Helper to format dates nicely
    const formatDate = (dateString) => {
        const options = { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        };
        return new Date(dateString).toLocaleDateString('en-US', options);
    };

    // Fix 1: Format balance to exactly 2 decimals and handle -$ format
    const formatBalance = (amount) => {
        if (!amount) return "$0.00";
        const absAmount = Math.abs(amount).toFixed(2);
        return amount < 0 ? `-$${absAmount}` : `${absAmount}`;
    };

    // Format for table amounts (up to 8 decimals for tiny AI costs)
    const formatTableAmount = (amount) => {
        if (!amount) return "0.00";
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 8
        }).format(amount);
    };

    // Filtering Logic (Fix 3)
    const getFilteredData = () => {
        let data = activeTab === 'credits' ? creditHistory : usageLogs;
        
        if (activeTab === 'usage' && (startDate || endDate)) {
            data = data.filter(item => {
                const itemDate = new Date(item.date);
                const start = startDate ? new Date(startDate) : new Date(0);
                const end = endDate ? new Date(endDate) : new Date('2100-01-01');
                
                // Make sure the end date includes the whole day
                if (endDate) end.setHours(23, 59, 59, 999);
                
                return itemDate >= start && itemDate <= end;
            });
        }
        return data;
    };

    const filteredData = getFilteredData();
    
    // Pagination Logic (Fix 4)
    const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
    const currentData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Total Cost Calculation (Fix 5)
    const totalUsageCost = activeTab === 'usage' 
        ? filteredData.reduce((sum, log) => sum + Math.abs(log.amount || 0), 0) 
        : 0;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row pt-16">
            
            {/* Sidebar Navigation */}
            <aside className="w-full md:w-64 bg-white border-r border-gray-200 p-4 flex flex-col gap-2">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-4 px-3">
                    Account
                </div>
                
                <button 
                    onClick={() => setActiveTab('usage')}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md w-full text-left font-medium transition-colors ${
                        activeTab === 'usage' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                >
                    <FiList /> Usage Logs
                </button>
                
                <button 
                    onClick={() => setActiveTab('credits')}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md w-full text-left font-medium transition-colors ${
                        activeTab === 'credits' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                >
                    <FiCreditCard /> Credits
                </button>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 p-6 md:p-10 max-w-5xl">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">
                    {activeTab === 'credits' ? 'Credits' : 'Usage Logs'}
                </h1>

                {/* Only show Balance Card on the Credits tab */}
                {activeTab === 'credits' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <h2 className="text-sm font-medium text-gray-500 mb-2">Current Balance</h2>
                            <div className={`text-4xl font-bold mb-6 ${profile?.balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                {loading ? "..." : formatBalance(profile?.balance || 0)}
                            </div>
                            <button 
                                onClick={() => setIsModalOpen(true)}
                                className="w-full bg-pink-600 hover:bg-pink-700 text-white font-medium py-2.5 rounded-lg transition-colors"
                            >
                                Add Credits
                            </button>
                        </div>
                    </div>
                )}

                {/* Usage Filters & Summary */}
                {activeTab === 'usage' && (
                    <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        
                        <DateRangePicker 
                            startDate={startDate} 
                            endDate={endDate} 
                            onDateChange={(start, end) => {
                                setStartDate(start);
                                setEndDate(end);
                            }} 
                        />

                        <div className="text-right mt-4 md:mt-0">
                            <div className="text-xs font-medium text-gray-500 mb-1">Total Cost (Selected Period)</div>
                            <div className="text-xl font-bold text-gray-900">
                                ${totalUsageCost.toFixed(2)}
                            </div>
                        </div>
                    </div>
                )}

                {/* History Table Section */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-gray-200 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">
                            {activeTab === 'credits' ? 'Credit History' : 'Usage History'}
                        </h3>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3">Date</th>
                                    <th className="px-6 py-3">{activeTab === 'credits' ? 'Description' : 'Model'}</th> {/* Fix 2: Dynamic Column Name */}
                                    <th className="px-6 py-3 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="3" className="px-6 py-4 text-center">Loading data...</td></tr>
                                ) : currentData.length === 0 ? (
                                    <tr><td colSpan="3" className="px-6 py-4 text-center">No transactions found.</td></tr>
                                ) : (
                                    currentData.map((tx) => (
                                        <tr key={tx.transactionId || Math.random()} className="bg-white border-b hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">{formatDate(tx.date)}</td>
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                {activeTab === 'credits' 
                                                    ? (tx.description?.includes("Purchased") ? "Account Top-up" : tx.description)
                                                    : (tx.model || tx.description)}
                                            </td>
                                            <td className={`px-6 py-4 text-right font-medium ${
                                                tx.amount > 0 ? 'text-green-600' : 'text-gray-900'
                                            }`}>
                                                {tx.amount > 0 ? '+$' : tx.amount < 0 ? '-$' : '$'}
                                                {formatTableAmount(Math.abs(tx.amount))}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Fix 4: Pagination Controls */}
                    {!loading && filteredData.length > 0 && (
                        <div className="p-4 border-t border-gray-200 flex justify-center items-center gap-4 bg-gray-50">
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 rounded border border-gray-300 bg-white text-gray-600 disabled:opacity-50 hover:bg-gray-100"
                            >
                                &lt;
                            </button>
                            <span className="text-sm font-medium text-gray-700">
                                {currentPage} of {totalPages}
                            </span>
                            <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 rounded border border-gray-300 bg-white text-gray-600 disabled:opacity-50 hover:bg-gray-100"
                            >
                                &gt;
                            </button>
                        </div>
                    )}

                </div>
            </main>

            {/* Buy Credits Modal */}
            <BuyCreditsModal 
                userId={user?.id} 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                currentBalance={profile?.balance || 0}
            />
        </div>
    );
}