import React from 'react';

const UserCard = ({ user, prices, onPriceChange, onSave, isSaving, saveStatus, isDisabled, isActionRestricted }) => {
    const [localLocked, setLocalLocked] = React.useState(false);

    // Automatically lock when save succeeds
    React.useEffect(() => {
        if (saveStatus === 'success') {
            setLocalLocked(true);
        }
    }, [saveStatus]);

    const getInitials = (name) => {
        const parts = name.trim().split(' ');
        if (parts.length === 1) return parts[0][0].toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    const cardDisabled = isDisabled || isSaving || (localLocked && !isActionRestricted);

    return (
        <div className={`card ${localLocked ? 'locked' : ''}`}>
            <div className="card-header">
                <div className="avatar">{getInitials(user.name)}</div>
                <div className="name-wrap">
                    <div className="name-row">
                        <h3>{user.name}</h3>
                        {localLocked && <span className="lock-icon">🔒</span>}
                    </div>
                    <p>PSX Watchlist</p>
                </div>
            </div>

            <div className="stock-list">
                {prices.map((stock) => {
                    const diff = stock.current_price - stock.prev_price;
                    const pct = stock.prev_price > 0 ? ((diff / stock.prev_price) * 100).toFixed(1) : 0;
                    const isPositive = diff >= 0;

                    return (
                        <div key={stock.ticker} className="stock-row" style={{ opacity: localLocked ? 0.6 : 1 }}>
                            <span className="ticker-label">{stock.ticker}</span>

                            <div className="input-group">
                                <label>Today</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={stock.current_price === 0 ? "" : stock.current_price}
                                    onChange={(e) => onPriceChange(user.id, stock.ticker, 'current_price', e.target.value === "" ? 0 : parseFloat(e.target.value))}
                                    disabled={cardDisabled}
                                />
                            </div>

                            <div className="input-group">
                                <label>Yesterday</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={stock.prev_price === 0 ? "" : stock.prev_price}
                                    onChange={(e) => onPriceChange(user.id, stock.ticker, 'prev_price', e.target.value === "" ? 0 : parseFloat(e.target.value))}
                                    disabled={cardDisabled}
                                />
                            </div>

                            <div className={`change-display ${isPositive ? 'positive' : 'negative'}`}>
                                {stock.current_price > 0 && stock.prev_price > 0 ? (
                                    <>{isPositive ? '+' : ''}{diff.toFixed(2)} ({isPositive ? '+' : ''}{pct}%)</>
                                ) : (
                                    "—"
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="card-actions">
                {localLocked ? (
                    <button className="secondary-btn" onClick={() => setLocalLocked(false)}>
                        Unlock for edits
                    </button>
                ) : (
                    <button
                        className="save-btn"
                        onClick={() => onSave(user.id)}
                        disabled={isActionRestricted || isSaving}
                    >
                        {isSaving ? 'Saving...' : 'Save Prices'}
                    </button>
                )}
            </div>

            {saveStatus === 'success' && localLocked && <p className="status-msg positive">✓ Prices Locked & Synced</p>}
            {saveStatus === 'error' && <p className="status-msg negative">✗ Save failed. Please try again.</p>}
        </div>
    );
};

export default UserCard;
