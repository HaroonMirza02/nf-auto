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
                        all_emails: config.users.map(u => u.email).join(','),
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

    const getFilteredReport = () => {
        if (!reportHtml) return '';
        if (reportHtml.startsWith('Error:')) return `<p style="color: red; padding: 20px;">${reportHtml}</p>`;

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(reportHtml, 'text/html');

            // Find the anchor for the selected user
            const anchor = doc.querySelector(`a[name="section-${selectedUserId}"]`);
            if (!anchor) return `<div style="padding: 20px; font-family: sans-serif; color: #666;">No report section generated for ${currentUser?.name || selectedUserId} yet.</div>`;

            // get the next sibling, which is the div container for that user's digest
            let userDiv = anchor.nextElementSibling;

            // Just in case it's not a div, find the nearest element
            while (userDiv && userDiv.tagName !== 'DIV') {
                userDiv = userDiv.nextElementSibling;
            }

            if (!userDiv) return `<div style="padding: 20px; font-family: sans-serif; color: #666;">No content found for user ${selectedUserId}.</div>`;

            // Extract global CSS and styles
            const styles = doc.head ? doc.head.innerHTML : '';

            // Extract the general branding header (contains "TechNews" and the date)
            const brandHeader = doc.querySelector('div[style*="padding: 0 0 40px;"]') ||
                doc.querySelector('div[style*="padding: 0 0 40px"]');

            let brandHtml = '';
            if (brandHeader) {
                // Clone the header to avoid modifying the original parsed doc
                const clonedHeader = brandHeader.cloneNode(true);

                // Find and remove the "Scroll to any user" section
                const navSections = clonedHeader.querySelectorAll('div');
                navSections.forEach(div => {
                    if (div.textContent.includes('Scroll to any user:') || div.style.borderTop) {
                        div.remove();
                    }
                });

                brandHtml = clonedHeader.outerHTML;
            }

            return `
                <!DOCTYPE html>
                <html>
                    <head>
                        <meta charset="UTF-8">
                        ${styles}
                        <style>
                            body { background-color: #ffffff !important; padding: 20px !important; }
                        </style>
                    </head>
                    <body>
                        <div style="max-width: 600px; margin: 0 auto;">
                            ${brandHtml}
                            ${(() => {
                    const clonedUser = userDiv.cloneNode(true);
                    // Remove "Scroll to Top" links
                    clonedUser.querySelectorAll('a[href="#top"]').forEach(a => a.parentElement?.remove());
                    return clonedUser.outerHTML;
                })()}
                        </div>
                    </body>
                </html>
            `;
        } catch (err) {
            console.error('Filtering error:', err);
            return reportHtml; // Fallback to full report on error
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
                        <p><strong>Stocks:</strong> {currentUser?.psx_stocks ? currentUser.psx_stocks.length : 0} PSX, {currentUser?.us_stocks ? currentUser.us_stocks.length : 0} US</p>
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
                    <h3>Report Preview for {currentUser?.name}</h3>
                    {isLoadingReport ? (
                        <p>Loading report preview...</p>
                    ) : reportHtml ? (
                        <div className="report-frame-container">
                            <iframe
                                title="Report Preview"
                                srcDoc={getFilteredReport()}
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
