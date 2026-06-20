import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';

interface ActivityLog {
    id: string;
    terminal_id: string;
    staff_id: string;
    action_taken: string;
    timestamp: number;
    ip_address: string;
    device_hardware_profile: string;
    location: string;
    is_flagged: boolean;
}

export default function StaffActivityLog({ 
    onUnauthorized, 
    isSuspiciousLocked, 
    deviceFingerprint, 
    approxRegion,
    currentUserRole = 'owner',
    isAuthenticated = false
}: { 
    onUnauthorized: () => void; 
    isSuspiciousLocked: boolean; 
    deviceFingerprint?: string; 
    approxRegion?: string;
    currentUserRole?: 'owner' | 'cashier';
    isAuthenticated?: boolean;
}) {
    const [logs, setLogs] = useState<ActivityLog[]>([]);

    const sesId = localStorage.getItem('session_id');

    useEffect(() => {
        if (!isAuthenticated) return;
        if (isSuspiciousLocked) return;
        if ((currentUserRole as string) === 'cashier') return;
        
        let active = true;

        // Fetch logs with x-session-id header
        const sesId = localStorage.getItem('session_id');
        if (!sesId) return;

        const simFp = deviceFingerprint || localStorage.getItem('simulated_device_fp') || 'unknown';
        const simLoc = approxRegion || localStorage.getItem('simulated_location') || 'NG-Lagos';
        apiFetch('/api/staff/log', {
            headers: {
                'x-session-id': sesId,
                'x-device-fingerprint': simFp,
                'x-approx-region': simLoc
            }
        })
        .then(res => {
            if (res.status === 401) {
                onUnauthorized();
                throw new Error('Unauthorized session');
            }
            if (res.status === 403) {
                 console.warn('Suspicious activity locked');
                 return null;
            }
            if (!res.ok) throw new Error('Network error');
            return res.json();
        })
        .then(data => {
            if (active && data) {
                if (Array.isArray(data)) {
                    setLogs(data);
                } else {
                    setLogs([]);
                }
            }
        })
        .catch(err => {
            if (active) {
                // If the error is not 'Unauthorized session', log it
                if (err.message !== 'Unauthorized session') {
                    console.error('Error fetching staff logs:', err);
                }
                setLogs([]);
            }
        });

        return () => { active = false; };
    }, [onUnauthorized, isSuspiciousLocked, deviceFingerprint, approxRegion, currentUserRole, isAuthenticated]);

    // If not authenticated, return null immediately
    if (!isAuthenticated) {
        return null;
    }

    if (isSuspiciousLocked) {
        return (
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mt-4 text-center">
                <p className="font-bold text-red-500 mb-2">Suspicious session detected</p>
                <p className="text-xs text-gray-500">Please verify your account to unlock.</p>
            </div>
        );
    }

    if (currentUserRole === 'cashier') {
        return null;
    }
    
    if (!sesId) {
        return (
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mt-4 text-center">
                <p className="font-bold text-gray-500 mb-2">Unauthorized</p>
                <p className="text-xs text-gray-500">Please log in to access staff activity logs.</p>
            </div>
        );
    }

    const safeLogs = Array.isArray(logs) ? logs : [];

    return (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mt-4">
            <h2 className="text-lg font-bold mb-4">Staff Activity Logs</h2>
            {safeLogs.length === 0 ? (
                <p className="text-xs text-gray-400 font-mono italic">No staff activity logs recorded or unauthorized session.</p>
            ) : (
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b">
                            <th className="p-2 text-left">Action</th>
                            <th className="p-2 text-left">Time</th>
                            <th className="p-2 text-left">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {safeLogs.map(log => (
                            <tr key={log.id} className={`${log.is_flagged ? 'bg-red-50' : ''} border-b`}>
                                <td className="p-2 font-mono text-xs">{log.action_taken}</td>
                                <td className="p-2 text-xs">{new Date(log.timestamp).toLocaleString()}</td>
                                <td className="p-2 text-xs">
                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${log.is_flagged ? 'bg-rose-100 text-[#DF1414]' : 'bg-emerald-100 text-emerald-800'}`}>
                                        {log.is_flagged ? 'Flagged' : 'Normal'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
