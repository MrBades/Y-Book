import React, { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface TerminalViewProps {
    shopSlug: string;
    workerSlug: string;
    onLoginSuccess?: (session_id: string, staffObj: any, userObj: any) => void;
}

export default function TerminalView({ shopSlug, workerSlug, onLoginSuccess }: TerminalViewProps) {
    const [pin, setPin] = useState('');
    const [authenticated, setAuthenticated] = useState(false);
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => console.error("Location access denied:", err)
        );
    }, []);

    const handlePinEntry = (num: string) => {
        if (pin.length < 4) {
            const newPin = pin + num;
            setPin(newPin);
            if (newPin.length === 4) {
                // Verify PIN
                apiFetch(`/api/terminal/${shopSlug}/${workerSlug}/pin-verify`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-device-fingerprint': localStorage.getItem('device_fingerprint') || 'unknown_fp'
                    },
                    body: JSON.stringify({ pin: newPin, latitude: location?.lat, longitude: location?.lng })
                })
                .then(res => res.json())
                .then(data => {
                    if (data.authenticated && data.session_id && data.staff) {
                        setAuthenticated(true);
                        if (onLoginSuccess) {
                            onLoginSuccess(data.session_id, data.staff, data.user);
                        }
                    } else {
                        alert(data.error || 'Incorrect PIN or unauthorized location');
                        setPin('');
                    }
                });
            }
        }
    };

    if (authenticated) {
        return (
            <div className="p-6">
                <h1 className="text-2xl font-bold">Staff Terminal: {workerSlug}</h1>
                <p>Welcome to Quick Sales Mode. Access to inventory and sales only.</p>
                {/* Restricted views go here */}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0E1338] flex flex-col items-center justify-center p-6 text-white text-center">
            <h1 className="text-2xl font-bold mb-2">Staff Terminal</h1>
            <p className="text-gray-400 mb-8">{shopSlug} / {workerSlug}</p>
            <div className="flex gap-4 mb-8">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className={`w-4 h-4 rounded-full ${pin.length >= i ? 'bg-blue-500' : 'bg-gray-700'}`}></div>
                ))}
            </div>
            <div className="grid grid-cols-3 gap-4">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', ' ', '0', 'C'].map(btn => (
                    <button key={btn} onClick={() => btn === 'C' ? setPin('') : handlePinEntry(btn)} className="w-16 h-16 rounded-full bg-gray-800 text-2xl font-bold flex items-center justify-center">
                        {btn}
                    </button>
                ))}
            </div>
        </div>
    );
}
