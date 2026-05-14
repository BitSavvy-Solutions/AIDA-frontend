import React, { useState } from 'react';

export default function DateRangePicker({ startDate, endDate, onDateChange }) {
    const [datePreset, setDatePreset] = useState('today');

    // Helper to get local date string in YYYY-MM-DD format for inputs
    const getLocalDateString = (date) => {
        const offset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() - offset).toISOString().split('T')[0];
    };

    const handlePresetChange = (preset) => {
        setDatePreset(preset);
        if (preset === 'custom') return;

        const today = new Date();
        let start = new Date();
        let end = new Date();

        switch (preset) {
            case 'today':
                break; // already set to today
            case 'yesterday':
                start.setDate(today.getDate() - 1);
                end.setDate(today.getDate() - 1);
                break;
            case 'last7':
                start.setDate(today.getDate() - 6);
                break;
            case 'last30':
                start.setDate(today.getDate() - 29);
                break;
            case 'thisMonth':
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                break;
            case 'lastMonth':
                start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                end = new Date(today.getFullYear(), today.getMonth(), 0);
                break;
            case 'allTime':
                onDateChange('', '');
                return;
            default:
                break;
        }

        onDateChange(getLocalDateString(start), getLocalDateString(end));
    };

    const handleManualDateChange = (type, value) => {
        setDatePreset('custom');
        if (type === 'start') onDateChange(value, endDate);
        if (type === 'end') onDateChange(startDate, value);
    };

    return (
        <div className="flex flex-col md:flex-row gap-3 items-end">
            {/* Preset Dropdown */}
            <div>
                <label className="block text-xs font-medium text-aida-text-muted mb-1 transition-colors">Date Range</label>
                <select 
                    value={datePreset}
                    onChange={(e) => handlePresetChange(e.target.value)}
                    className="border border-aida-border rounded-md px-3 py-1.5 text-sm text-aida-dark focus:ring-aida-pink focus:border-aida-pink bg-transparent cursor-pointer transition-colors"
                >
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="last7">Last 7 days</option>
                    <option value="last30">Last 30 days</option>
                    <option value="thisMonth">This month</option>
                    <option value="lastMonth">Last month</option>
                    <option value="allTime">All time</option>
                    <option value="custom">Custom...</option>
                </select>
            </div>

            {/* Custom Date Inputs */}
            <div className="flex items-center gap-2">
                <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => handleManualDateChange('start', e.target.value)}
                    className="border border-aida-border rounded-md px-3 py-1.5 text-sm text-aida-dark focus:ring-aida-pink focus:border-aida-pink bg-transparent transition-colors dark:[color-scheme:dark]"
                />
                <span className="text-aida-text-muted">-</span>
                <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => handleManualDateChange('end', e.target.value)}
                    className="border border-aida-border rounded-md px-3 py-1.5 text-sm text-aida-dark focus:ring-aida-pink focus:border-aida-pink bg-transparent transition-colors dark:[color-scheme:dark]"
                />
            </div>
        </div>
    );
}