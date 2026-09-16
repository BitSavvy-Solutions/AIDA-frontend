import React, { useState, useEffect } from 'react';
import { FiList, FiCreditCard } from 'react-icons/fi';
import config from '../config/apiConfig';
import DateRangePicker from '../components/DateRangePicker';
import BuyCreditsModal from '../components/BuyCreditsModal';
import { useAuth } from '../contexts/AuthContext';
import StorageMeter from '../components/StorageMeter';

export default function Account() {
    const { user } = useAuth();
    const API_BASE_URL = `${config.FASTAPI_URL}/user`;

    const getTodayString = () => {
        const date = new Date();
        const offset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() - offset).toISOString().split('T')[0];
    };

    // Persist tab on refresh
    const [activeTab, setActiveTab] = useState(() => {
        return localStorage.getItem('accountActiveTab') || 'credits';
    }); 
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [profile, setProfile] = useState(null);
    
    // New Cursor Pagination State
    const [tableData, setTableData] = useState([]);
    const [totalUsageCost, setTotalUsageCost] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const [startDate, setStartDate] = useState(getTodayString());
    const [endDate, setEndDate] = useState(getTodayString());

    // 1. Fetch Profile (Runs once)
    useEffect(() => {
        const fetchProfile = async () => {
            const token = localStorage.getItem("aidaToken");
            if (!token) return;
            try {
                const res = await fetch(`${API_BASE_URL}/profile`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                const data = await res.json();
                setProfile(data);
            } catch (error) {
                console.error("Error fetching profile:", error);
            }
        };
        fetchProfile();
    }, []);

    // 2. Fetch Table Data (Handles both initial load and "Load More")
    const fetchTableData = async (isLoadMore = false) => {
        const token = localStorage.getItem("aidaToken");
        if (!token) return;

        if (isLoadMore) {
            setIsLoadingMore(true);
        } else {
            setLoading(true);
        }

        localStorage.setItem('accountActiveTab', activeTab);

        try {
            let url = '';
            if (activeTab === 'credits') {
                url = `${API_BASE_URL}/credits/history?limit=50`;
            } else {
                url = `${API_BASE_URL}/usage/logs?limit=50`;
                if (startDate) url += `&start_date=${startDate}`;
                if (endDate) url += `&end_date=${endDate}`;
            }

            // Apply Cursor if loading more
            if (isLoadMore && tableData.length > 0) {
                const lastItemDate = tableData[tableData.length - 1].date;
                url += `&cursor=${encodeURIComponent(lastItemDate)}`;
            }

            const res = await fetch(url, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();

            if (isLoadMore) {
                setTableData(prev => [...prev, ...(data.data || [])]);
            } else {
                setTableData(data.data || []);
            }
            
            setHasMore(data.has_more || false);
            if (activeTab === 'usage') {
                setTotalUsageCost(data.total_cost || 0);
            }

        } catch (error) {
            console.error("Error fetching table data:", error);
        } finally {
            setLoading(false);
            setIsLoadingMore(false);
        }
    };

    // Trigger fetch when tab or dates change
    useEffect(() => {
        fetchTableData(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, startDate, endDate]);

    // Formatters
    const formatDate = (dateString) => {
        const options = { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(dateString).toLocaleDateString('en-US', options);
    };

    const formatBalance = (amount) => {
        if (!amount) return "$0.00";
        const absAmount = Math.abs(amount).toFixed(2);
        return amount < 0 ? `-$${absAmount}` : `$${absAmount}`;
    };

    const formatTableAmount = (amount) => {
        if (!amount) return "0.00";
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 8
        }).format(amount);
    };

    return (
        <div className="min-h-screen bg-aida-light flex flex-col md:flex-row transition-colors duration-200">
            
            <aside className="w-full md:w-64 bg-transparent border-r border-aida-border p-4 flex flex-col gap-2 transition-colors duration-200">
                <div className="text-xs font-semibold text-aida-text-muted uppercase tracking-wider mb-2 px-3">
                    Account
                </div>
                <button 
                    onClick={() => setActiveTab('usage')}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md w-full text-left font-medium transition-colors ${
                        activeTab === 'usage' ? 'bg-gray-200 dark:bg-gray-700 text-aida-dark shadow-sm' : 'text-aida-text-muted hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                >
                    <FiList /> Usage Logs
                </button>
                <button 
                    onClick={() => setActiveTab('credits')}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md w-full text-left font-medium transition-colors ${
                        activeTab === 'credits' ? 'bg-gray-200 dark:bg-gray-700 text-aida-dark shadow-sm' : 'text-aida-text-muted hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                >
                    <FiCreditCard /> Credits
                </button>
            </aside>

            {/* Expanded width to max-w-7xl */}
            <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto">
                <h1 className="text-2xl font-bold text-aida-dark mb-6 transition-colors">
                    {activeTab === 'credits' ? 'Credits' : 'Usage Logs'}
                </h1>

                {activeTab === 'credits' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="bg-aida-card p-6 rounded-xl border border-aida-border shadow-sm transition-colors">
                            <h2 className="text-sm font-medium text-aida-text-muted mb-2">Current Balance</h2>
                            <div className={`text-4xl font-bold mb-6 ${profile?.balance < 0 ? 'text-red-500' : 'text-aida-dark'}`}>
                                {!profile ? "..." : formatBalance(profile.balance)}
                            </div>
                            <button 
                                onClick={() => setIsModalOpen(true)}
                                className="w-full bg-pink-600 hover:bg-pink-700 text-white font-medium py-2.5 rounded-lg transition-colors"
                            >
                                Add Credits
                            </button>
                        </div>
                        <StorageMeter />
                    </div>
                )}

                {activeTab === 'usage' && (
                    <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4 bg-transparent p-4 rounded-xl border border-aida-border transition-colors">
                        <DateRangePicker 
                            startDate={startDate} 
                            endDate={endDate} 
                            onDateChange={(start, end) => {
                                setStartDate(start);
                                setEndDate(end);
                            }} 
                        />
                        <div className="text-right mt-4 md:mt-0">
                            <div className="text-xs font-medium text-aida-text-muted mb-1">Total Cost (Selected Period)</div>
                            <div className="text-xl font-bold text-aida-dark">
                                ${totalUsageCost.toFixed(2)}
                            </div>
                        </div>
                    </div>
                )}

                <div className="border border-aida-border rounded-xl overflow-hidden transition-colors">

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-aida-text-muted">
                            <thead className="text-xs text-aida-dark uppercase bg-aida-card border-b border-aida-border transition-colors">
                                <tr>
                                    <th className="px-6 py-3">Date</th>
                                    <th className="px-6 py-3">{activeTab === 'credits' ? 'Description' : 'Model'}</th>
                                    <th className="px-6 py-3 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="3" className="px-6 py-4 text-center">Loading data...</td></tr>
                                ) : tableData.length === 0 ? (
                                    <tr><td colSpan="3" className="px-6 py-4 text-center">No transactions found.</td></tr>
                                ) : (
                                    tableData.map((tx) => (
                                        <tr key={tx.transactionId || Math.random()} className="border-b border-aida-border-subtle last:border-0 hover:bg-aida-card/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">{formatDate(tx.date)}</td>
                                            <td className="px-6 py-4 font-medium text-aida-dark">
                                                {activeTab === 'credits' 
                                                    ? (tx.description?.includes("Purchased") ? "Account Top-up" : tx.description)
                                                    : (tx.model || tx.description)}
                                            </td>
                                            <td className={`px-6 py-4 text-right font-medium ${
                                                tx.amount > 0 ? 'text-green-500' : 'text-aida-dark'
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

                    {/* Load More Button */}
                    {!loading && hasMore && (
                        <div className="p-4 border-t border-aida-border flex justify-center bg-transparent">
                            <button 
                                onClick={() => fetchTableData(true)}
                                disabled={isLoadingMore}
                                className="px-6 py-2 rounded-lg border border-aida-border bg-aida-card text-aida-dark font-medium hover:opacity-80 disabled:opacity-50 transition-all"
                            >
                                {isLoadingMore ? 'Loading...' : 'Load More'}
                            </button>
                        </div>
                    )}
                </div>
            </main>

            <BuyCreditsModal 
                userId={user?.id} 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                currentBalance={profile?.balance || 0}
            />
        </div>
    );
}