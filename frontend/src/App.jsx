import React, { useState, useEffect } from 'react';
import UserCard from './components/UserCard';
import './index.css';

const USERS = [
    {
        id: 'haroon',
        name: 'Haroon Mirza',
        psx_stocks: [
            { ticker: 'SYS', current_price: 151.18, prev_price: 155.16 },
            { ticker: 'NETSOL', current_price: 133.10, prev_price: 136.50 },
            { ticker: 'ICI', current_price: 591.53, prev_price: 594.90 },
            { ticker: 'LUCK', current_price: 462.98, prev_price: 471.00 },
            { ticker: 'OGDC', current_price: 331.28, prev_price: 339.00 }
        ]
    },
    {
        id: 'zaid',
        name: 'Zaid Bin Asim',
        psx_stocks: [
            { ticker: 'SYS', current_price: 151.18, prev_price: 155.16 },
            { ticker: 'SHSML', current_price: 394.24, prev_price: 376.10 },
            { ticker: 'NETSOL', current_price: 133.10, prev_price: 136.50 },
            { ticker: 'OGDC', current_price: 331.28, prev_price: 339.00 },
            { ticker: 'PSO', current_price: 357.14, prev_price: 360.00 }
        ]
    },
    {
        id: 'hassan',
        name: 'M. Hassan',
        psx_stocks: [
            { ticker: 'SYS', current_price: 151.18, prev_price: 155.16 },
            { ticker: 'PTC', current_price: 65.58, prev_price: 66.88 },
            { ticker: 'OCTOPUS', current_price: 38.26, prev_price: 34.89 },
            { ticker: 'TRG', current_price: 66.68, prev_price: 70.20 },
            { ticker: 'AVN', current_price: 38.39, prev_price: 35.00 }
        ]
    },
    {
        id: 'ibrahim',
        name: 'Ibrahim Malik',
        psx_stocks: [
            { ticker: 'SYS', current_price: 151.18, prev_price: 155.16 },
            { ticker: 'PTC', current_price: 65.58, prev_price: 66.88 },
            { ticker: 'OCTOPUS', current_price: 38.26, prev_price: 34.89 },
            { ticker: 'TRG', current_price: 66.68, prev_price: 70.20 },
            { ticker: 'AVN', current_price: 38.39, prev_price: 35.00 }
        ]
    }
];

function App() {
    const [psxPrices, setPsxPrices] = useState(
        Object.fromEntries(USERS.map(u => [u.id, u.psx_stocks.map(s => ({ ...s }))]))
    );
    const [isSaving, setIsSaving] = useState({});
    const [saveStatus, setSaveStatus] = useState({});

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

    return (
        <div className="app-container">

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
