import React, { useState, useEffect } from 'react';
import UserCard from './components/UserCard';
import CountdownTimer from './components/CountdownTimer';
import './index.css';

const USERS = [
    {
        id: 'haroon',
        name: 'Haroon Mirza',
        psx_stocks: [
            { ticker: 'SYS', current_price: 500.00, prev_price: 495.00 },
            { ticker: 'NETSOL', current_price: 120.00, prev_price: 118.50 },
            { ticker: 'ICI', current_price: 950.00, prev_price: 945.00 },
            { ticker: 'LUCK', current_price: 890.00, prev_price: 885.00 },
            { ticker: 'OGDC', current_price: 145.00, prev_price: 143.50 }
        ]
    },
    {
        id: 'zaid',
        name: 'Zaid Bin Asim',
        psx_stocks: [
            { ticker: 'SYS', current_price: 500.00, prev_price: 495.00 },
            { ticker: 'SHSML', current_price: 210.00, prev_price: 208.00 },
            { ticker: 'NETSOL', current_price: 120.00, prev_price: 118.50 },
            { ticker: 'OGDC', current_price: 145.00, prev_price: 143.50 },
            { ticker: 'PSO', current_price: 410.00, prev_price: 408.00 }
        ]
    },
    {
        id: 'hassan',
        name: 'M. Hassan',
        psx_stocks: [
            { ticker: 'SYS', current_price: 500.00, prev_price: 495.00 },
            { ticker: 'PTC', current_price: 18.50, prev_price: 18.20 },
            { ticker: 'OCTOPUS', current_price: 55.00, prev_price: 54.00 },
            { ticker: 'TRG', current_price: 95.00, prev_price: 93.50 },
            { ticker: 'AVN', current_price: 68.00, prev_price: 67.00 }
        ]
    },
    {
        id: 'ibrahim',
        name: 'Ibrahim Malik',
        psx_stocks: [
            { ticker: 'SYS', current_price: 500.00, prev_price: 495.00 },
            { ticker: 'PTC', current_price: 18.50, prev_price: 18.20 },
            { ticker: 'OCTOPUS', current_price: 55.00, prev_price: 54.00 },
            { ticker: 'TRG', current_price: 95.00, prev_price: 93.50 },
            { ticker: 'AVN', current_price: 68.00, prev_price: 67.00 }
        ]
    }
];

function App() {
    const [psxPrices, setPsxPrices] = useState(
        Object.fromEntries(USERS.map(u => [u.id, u.psx_stocks.map(s => ({ ...s }))]))
    );
    const [windowState, setWindowState] = useState('closed');
    const [countdown, setCountdown] = useState('');
    const [isUrgent, setIsUrgent] = useState(false);
    const [isSaving, setIsSaving] = useState({});
    const [saveStatus, setSaveStatus] = useState({});

    useEffect(() => {
        const tick = () => {
            const now = new Date();
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const pkt = new Date(utc + (3600000 * 5));

            const day = pkt.getDay();
            const hours = pkt.getHours();
            const mins = pkt.getMinutes();
            const totalMins = (hours * 60) + mins;

            if (day === 0) {
                setWindowState('sunday');
                return;
            }

            const openTime = 8 * 60;
            const closeTime = 10 * 60;

            if (totalMins < openTime) {
                setWindowState('before');
            } else if (totalMins >= closeTime) {
                setWindowState('closed');
            } else {
                setWindowState('open');
                const remaining = closeTime - totalMins;
                const h = Math.floor(remaining / 60);
                const m = remaining % 60;
                const s = 59 - pkt.getSeconds();
                setCountdown(`${h}h ${m}m ${s}s`);
                setIsUrgent(remaining < 15);
            }
        };

        const timer = setInterval(tick, 1000);
        tick();
        return () => clearInterval(timer);
    }, []);

    const handlePriceChange = (userId, ticker, field, value) => {
        setPsxPrices(prev => ({
            ...prev,
            [userId]: prev[userId].map(s => s.ticker === ticker ? { ...s, [field]: value } : s)
        }));
    };

    const handleSave = async (userId) => {
        setIsSaving(prev => ({ ...prev, [userId]: true }));
        setSaveStatus(prev => ({ ...prev, [userId]: null }));

        try {
            const REPO = import.meta.env.VITE_GITHUB_REPO;
            const BRANCH = import.meta.env.VITE_GITHUB_BRANCH || 'main';
            const TOKEN = import.meta.env.VITE_GITHUB_TOKEN;
            const URL = `https://api.github.com/repos/${REPO}/contents/config.json?ref=${BRANCH}`;

            const res = await fetch(URL, {
                headers: { Authorization: `Bearer ${TOKEN}` }
            });
            const data = await res.json();
            const currentConfig = JSON.parse(atob(data.content));

            const updatedUsers = currentConfig.users.map(u => {
                if (u.id === userId) {
                    return { ...u, psx_stocks: psxPrices[userId] };
                }
                return u;
            });

            const updatedConfig = {
                ...currentConfig,
                lastUpdated: new Date().toISOString(),
                users: updatedUsers
            };

            const putRes = await fetch(URL, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Update PSX prices for ${userId} via frontend`,
                    content: btoa(unescape(encodeURIComponent(JSON.stringify(updatedConfig, null, 2)))),
                    sha: data.sha,
                    branch: BRANCH
                })
            });

            if (putRes.ok) {
                setSaveStatus(prev => ({ ...prev, [userId]: 'success' }));
            } else {
                throw new Error('Failed to update config');
            }

        } catch (err) {
            console.error(err);
            setSaveStatus(prev => ({ ...prev, [userId]: 'error' }));
        } finally {
            setIsSaving(prev => ({ ...prev, [userId]: false }));
        }
    };

    const getStatusText = () => {
        switch (windowState) {
            case 'open': return 'Entry open — closes at 10:00 AM PKT';
            case 'before': return 'Entry opens at 8:00 AM PKT';
            case 'closed': return "Today's digest sent. Opens tomorrow at 8:00 AM.";
            case 'sunday': return 'No digest on Sundays. Opens Monday at 8:00 AM.';
            default: return '';
        }
    };

    return (
        <div className="app-container">
            <header className="header">
                <h1>⚡ Newsflash</h1>
                <p>PSX Stock Price Update &middot; {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </header>

            <div className={`status-banner status-open`}>
                Dashboard and price entry always enabled.
            </div>

            <div className="user-grid">
                {USERS.map(user => (
                    <UserCard
                        key={user.id}
                        user={user}
                        prices={psxPrices[user.id]}
                        onPriceChange={handlePriceChange}
                        onSave={handleSave}
                        isSaving={isSaving[user.id]}
                        saveStatus={saveStatus[user.id]}
                        isDisabled={false}
                        isActionRestricted={false}
                    />
                ))}
            </div>

            <div style={{ marginTop: '50px', borderTop: '1px solid #2D2D34', paddingTop: '30px', textAlign: 'center' }}>
                <button
                    className="save-btn"
                    style={{ maxWidth: '300px', background: '#22C55E' }}
                    onClick={() => alert('All prices ready for digest run.')}
                >
                    Submit All & Finalize
                </button>
            </div>
        </div>
    );
}

export default App;
