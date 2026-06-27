import React, { useState, useEffect } from 'react';

const AdminView = ({ config }) => {
    const [selectedUserId, setSelectedUserId] = useState(config.users[0]?.id || '');
    const [feedback, setFeedback] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState(null);
    const [reportHtml, setReportHtml] = useState(null);
    const [isLoadingReport, setIsLoadingReport] = useState(false);

    const currentUser = config.users.find(u => u.id === selectedUserId);

    const fetchReport = async () => {
        setIsLoadingReport(true);
        try {
            const REPO = import.meta.env.VITE_GITHUB_REPO;
            const TOKEN = import.meta.env.VITE_GITHUB_TOKEN;
            const BRANCH = import.meta.env.VITE_GITHUB_BRANCH || 'main';
            // Add timestamp to bypass GitHub API cache
            const URL = `https://api.github.com/repos/${REPO}/contents/data/latest_digest.html?ref=${BRANCH}&t=${Date.now()}`;

            const res = await fetch(URL, {
                headers: { Authorization: `Bearer ${TOKEN}` }
            });

            if (!res.ok) {
                if (res.status === 404) throw new Error("Report file not found on GitHub.");
                throw new Error(`GitHub API error: ${res.status}`);
            }

            const data = await res.json();
            if (data.content) {
                // Remove whitespace/newlines from base64 content before decoding
                const cleanedContent = data.content.replace(/\s/g, '');
                setReportHtml(decodeURIComponent(escape(atob(cleanedContent))));
            }
        } catch (err) {
            console.error('Failed to fetch report:', err);
            setReportHtml(`Error: ${err.message}`);
        } finally {
            setIsLoadingReport(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, []);

    const handleSendFeedback = async () => {
        if (!feedback || !currentUser) return;
        setIsSending(true);
        setSendResult(null);

        try {
            const REPO = import.meta.env.VITE_GITHUB_REPO;
            const TOKEN = import.meta.env.VITE_GITHUB_TOKEN;
            const URL = `https://api.github.com/repos/${REPO}/actions/workflows/send-feedback.yml/dispatches`;

            const res = await fetch(URL, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ref: 'main',
                    inputs: {
                        user_email: currentUser.email,
                        user_name: currentUser.name,
                        feedback: feedback
                    }
                })
            });

            if (res.ok) {
                setSendResult('success');
                setFeedback('');
            } else {
                throw new Error('Failed to trigger workflow');
            }
        } catch (err) {
            console.error(err);
            setSendResult('error');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="admin-container">
            <div className="view-header">
                <h2>Admin Dashboard</h2>
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

            <div className="admin-grid">
                <div className="admin-sidebar">
                    <div className="settings-card">
                        <h3>User Info</h3>
                        <p><strong>Name:</strong> {currentUser?.name}</p>
                        <p><strong>Email:</strong> {currentUser?.email}</p>
                        <p><strong>Stocks:</strong> {currentUser?.psx_stocks.length} PSX, {currentUser?.us_stocks.length} US</p>
                    </div>

                    <div className="settings-card feedback-card">
                        <h3>Leave Feedback</h3>
                        <p className="subtext">This will be emailed to {currentUser?.email}</p>
                        <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="Type your feedback here..."
                            rows={6}
                        />
                        <button
                            className="save-btn"
                            onClick={handleSendFeedback}
                            disabled={isSending || !feedback}
                        >
                            {isSending ? 'Sending...' : 'Send Feedback'}
                        </button>
                        {sendResult === 'success' && <p className="status-msg positive">✓ Feedback queued for delivery!</p>}
                        {sendResult === 'error' && <p className="status-msg negative">✗ Failed to send feedback.</p>}
                    </div>
                </div>

                <div className="report-preview">
                    <h3>Last Generated Report</h3>
                    {isLoadingReport ? (
                        <p>Loading report preview...</p>
                    ) : reportHtml ? (
                        <div className="report-frame-container">
                            <iframe
                                title="Report Preview"
                                srcDoc={reportHtml}
                                className="report-iframe"
                            />
                        </div>
                    ) : (
                        <p>No report found in data/latest_digest.html</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminView;
