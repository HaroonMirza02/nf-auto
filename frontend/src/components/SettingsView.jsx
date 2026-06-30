import React, { useState, useEffect } from 'react';

const SettingsView = ({ config, onUpdateConfig }) => {
    const [selectedUserId, setSelectedUserId] = useState(config.users[0]?.id || '');
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null);

    const currentUser = config.users.find(u => u.id === selectedUserId);

    const handleUpdateUser = async (updatedUser) => {
        setIsSaving(true);
        setSaveStatus(null);
        try {
            const res = await fetch('/.netlify/functions/api-proxy/update-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: selectedUserId,
                    updatedData: updatedUser
                })
            });

            if (res.ok) {
                setSaveStatus('success');
                await onUpdateConfig(false);
            } else {
                throw new Error('Failed to update config via proxy');
            }
        } catch (err) {
            console.error(err);
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    if (!currentUser) return <div>No user selected</div>;

    return (
        <div className="settings-container">
            <div className="view-header">
                <h2>User Settings</h2>
                <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="user-select"
                >
                    {config.users.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                </select>
            </div>

            <div className="settings-grid">
                <StockManager
                    title="PSX Watchlist"
                    stocks={currentUser.psx_stocks}
                    onUpdate={(stocks) => handleUpdateUser({ psx_stocks: stocks })}
                    isComplex={true}
                />
                <StockManager
                    title="US Stocks"
                    stocks={currentUser.us_stocks}
                    onUpdate={(stocks) => handleUpdateUser({ us_stocks: stocks })}
                    isUS={true}
                />
                <SourceManager
                    sources={currentUser.sources}
                    onUpdate={(sources) => handleUpdateUser({ sources })}
                />
            </div>

            {isSaving && <div className="status-overlay">Saving...</div>}
            {saveStatus === 'success' && <div className="status-toast success">Settings updated successfully!</div>}
            {saveStatus === 'error' && <div className="status-toast error">Failed to update settings.</div>}
        </div>
    );
};

const StockManager = ({ title, stocks, onUpdate, isComplex = false, isUS = false }) => {
    const [newTicker, setNewTicker] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [feedback, setFeedback] = useState(null);
    const [replaceFrom, setReplaceFrom] = useState('');
    const [replaceTo, setReplaceTo] = useState('');

    // Handle Autocomplete for US Stocks
    useEffect(() => {
        const fetchSuggestions = async () => {
            if (!isUS || newTicker.length < 1) {
                setSuggestions([]);
                return;
            }

            try {
                const res = await fetch(`/.netlify/functions/api-proxy/search-stocks?q=${newTicker}`);
                const data = await res.json();
                if (data.result && data.result.length > 0) {
                    setSuggestions(data.result.slice(0, 5));
                    setFeedback(null);
                } else {
                    setSuggestions([]);
                    setFeedback({ type: 'error', text: 'No matching US stocks found.' });
                }
            } catch (err) {
                console.error("Autocomplete error:", err);
            }
        };

        const timeoutId = setTimeout(fetchSuggestions, 300);
        return () => clearTimeout(timeoutId);
    }, [newTicker, isUS]);

    const handleAdd = () => {
        if (!newTicker) return;
        const ticker = newTicker.toUpperCase().trim();

        // Simple duplicate check
        const currentTickers = isComplex ? stocks.map(s => s.ticker) : stocks;
        if (currentTickers.includes(ticker)) {
            setFeedback({ type: 'error', text: 'Ticker already in list.' });
            return;
        }

        if (isComplex) {
            onUpdate([...stocks, { ticker, current_price: 0, prev_price: 0 }]);
        } else {
            onUpdate([...stocks, ticker]);
        }
        setNewTicker('');
        setSuggestions([]);
        setFeedback({ type: 'success', text: `Added ${ticker}` });
        setTimeout(() => setFeedback(null), 3000);
    };

    const handleRemove = (ticker) => {
        if (isComplex) {
            onUpdate(stocks.filter(s => s.ticker !== ticker));
        } else {
            onUpdate(stocks.filter(s => s !== ticker));
        }
    };

    const handleReplace = () => {
        if (!replaceFrom || !replaceTo) return;
        const from = replaceFrom.toUpperCase();
        const to = replaceTo.toUpperCase();

        let updated;
        if (isComplex) {
            updated = stocks.map(s => s.ticker === from ? { ...s, ticker: to } : s);
        } else {
            updated = stocks.map(s => s === from ? to : s);
        }
        onUpdate(updated);
        setReplaceFrom('');
        setReplaceTo('');
        setFeedback({ type: 'success', text: `Replaced ${from} with ${to}` });
        setTimeout(() => setFeedback(null), 3000);
    };

    const tickerList = isComplex ? stocks.map(s => s.ticker) : stocks;

    return (
        <div className="settings-card">
            <h3>{title}</h3>
            <div className="manager-input-row" style={{ position: 'relative' }}>
                <div className="autocomplete-container">
                    <input
                        placeholder={isUS ? "Search US Stocks (e.g. AMZN)" : "Ticker (e.g. SYS)"}
                        value={newTicker}
                        onChange={e => setNewTicker(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
                    />
                    {suggestions.length > 0 && (
                        <div className="autocomplete-results">
                            {suggestions.map(s => (
                                <div
                                    key={s.symbol}
                                    className="autocomplete-item"
                                    onClick={() => {
                                        setNewTicker(s.symbol);
                                        setSuggestions([]);
                                    }}
                                >
                                    <strong>{s.symbol}</strong> - {s.description}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <button onClick={handleAdd}>Add</button>
            </div>
            {feedback && <div className={`input-feedback ${feedback.type}`}>{feedback.text}</div>}

            <div className="pill-list" style={{ marginTop: '15px' }}>
                {stocks.map(s => {
                    const ticker = isComplex ? s.ticker : s;
                    return (
                        <div key={ticker} className="pill">
                            {ticker}
                            <span className="pill-remove" onClick={() => handleRemove(ticker)}>×</span>
                        </div>
                    );
                })}
            </div>

            <div className="replace-section">
                <h4>Search & Replace</h4>
                <div className="manager-input-row">
                    <div className="replace-inputs">
                        <select
                            className="select-input"
                            value={replaceFrom}
                            onChange={e => setReplaceFrom(e.target.value)}
                        >
                            <option value="">From</option>
                            {tickerList.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                        <span>→</span>
                        <input
                            placeholder="To"
                            value={replaceTo}
                            onChange={e => setReplaceTo(e.target.value)}
                        />
                    </div>
                    <button onClick={handleReplace} disabled={!replaceFrom || !replaceTo}>Replace</button>
                </div>
            </div>
        </div>
    );
};

const SourceManager = ({ sources, onUpdate }) => {
    const SOURCES_BY_CATEGORY = {
        'Global News': ['reuters', 'ap', 'bbc', 'wsj', 'guardian'],
        'Pakistan News': ['dawn', 'brecorder', 'tribune', 'geo-news', 'the-news'],
        Technology: ['techcrunch', 'theverge', 'wired', 'ars-technica', 'zdnet'],
        AI: ['venturebeat', 'mitreview', 'zdnet', 'analytics-india-mag', 'synced'],
        Business: ['bloomberg', 'cnbc', 'ft', 'forbes', 'fortune']
    };

    const toggleSource = (src) => {
        if (sources.includes(src)) {
            onUpdate(sources.filter(s => s !== src));
        } else {
            onUpdate([...sources, src]);
        }
    };

    return (
        <div className="settings-card">
            <h3>News Sources</h3>
            {Object.entries(SOURCES_BY_CATEGORY).map(([category, categorySources]) => (
                <div key={category} style={{ marginBottom: '14px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', opacity: 0.9 }}>{category}</h4>
                    <div className="source-grid">
                        {categorySources.map(src => (
                            <div
                                key={src}
                                className={`source-item ${sources.includes(src) ? 'active' : ''}`}
                                onClick={() => toggleSource(src)}
                            >
                                {src}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default SettingsView;
