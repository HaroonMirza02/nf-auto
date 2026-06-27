import React, { useState, useEffect } from 'react';
import UserCard from './components/UserCard';
import SettingsView from './components/SettingsView';
import AdminView from './components/AdminView';
import './index.css';

function App() {
    const [view, setView] = useState('daily'); // 'daily', 'settings', 'admin'
    const [config, setConfig] = useState(null);
    const [psxPrices, setPsxPrices] = useState({});
    const [isSaving, setIsSaving] = useState({});
    const [saveStatus, setSaveStatus] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    const fetchConfig = async () => {
        setIsLoading(true);
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
            setConfig(currentConfig);

            // Initialize local psxPrices state from config
            const prices = {};
            currentConfig.users.forEach(u => {
                prices[u.id] = u.psx_stocks.map(s => ({ ...s }));
            });
            setPsxPrices(prices);
        } catch (err) {
            console.error('Failed to fetch config:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    const handlePriceChange = (userId, ticker, field, value) => {
        setPsxPrices(prev => ({
            ...prev,
            [userId]: prev[userId].map(s => s.ticker === ticker ? { ...s, [field]: value } : s)
        }));
    };

    const handleSavePrices = async (userId) => {
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
                setConfig(updatedConfig);
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

    if (isLoading) {
        return <div className="loading-screen">Loading configuration...</div>;
    }

    return (
        <div className="app-container">
            <nav className="main-nav">
                <button
                    className={view === 'daily' ? 'active' : ''}
                    onClick={() => setView('daily')}
                >
                    Daily Input
                </button>
                <button
                    className={view === 'settings' ? 'active' : ''}
                    onClick={() => setView('settings')}
                >
                    Settings
                </button>
                <button
                    className={view === 'admin' ? 'active' : ''}
                    onClick={() => setView('admin')}
                >
                    Admin
                </button>
            </nav>

            {view === 'daily' && (
                <div className="user-grid">
                    {config.users.map(user => (
                        <UserCard
                            key={user.id}
                            user={user}
                            prices={psxPrices[user.id]}
                            onPriceChange={handlePriceChange}
                            onSave={handleSavePrices}
                            isSaving={isSaving[user.id]}
                            saveStatus={saveStatus[user.id]}
                            isDisabled={false}
                            isActionRestricted={false}
                        />
                    ))}
                </div>
            )}

            {view === 'settings' && (
                <SettingsView config={config} onUpdateConfig={fetchConfig} />
            )}

            {view === 'admin' && (
                <AdminView config={config} onUpdateConfig={fetchConfig} />
            )}

            {view === 'daily' && (
                <div style={{ marginTop: '50px', borderTop: '1px solid #2D2D34', paddingTop: '30px', textAlign: 'center' }}>
                    <button
                        className="save-btn"
                        style={{ maxWidth: '300px', background: '#22C55E' }}
                        onClick={() => alert('All prices ready for digest run.')}
                    >
                        Submit All & Finalize
                    </button>
                </div>
            )}
        </div>
    );
}

export default App;

