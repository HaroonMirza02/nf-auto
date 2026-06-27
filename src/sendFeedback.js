const { sendDigest } = require('./mailer');

async function sendFeedback() {
    const userEmail = process.env.FEEDBACK_USER_EMAIL;
    const userName = process.env.FEEDBACK_USER_NAME;
    const feedbackText = process.env.FEEDBACK_TEXT;

    if (!userEmail || !feedbackText) {
        console.error("Missing required environment variables: FEEDBACK_USER_EMAIL, FEEDBACK_TEXT");
        process.exit(1);
    }

    const html = `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #007bff;">Feedback from Admin</h2>
            <p>Hello <strong>${userName || 'User'}</strong>,</p>
            <p>An administrator has left feedback regarding your NewsFlash Auto reports:</p>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #007bff; margin: 20px 0;">
                ${feedbackText.replace(/\n/g, '<br>')}
            </div>
            <p style="font-size: 12px; color: #777;">This is an automated message. Please do not reply directly to this email.</p>
        </div>
    `;

    try {
        await sendDigest(html, userEmail, "NewsData.io Admin Feedback");
        console.log(`Feedback sent successfully to ${userEmail}`);
    } catch (error) {
        console.error("Failed to send feedback:", error);
        process.exit(1);
    }
}

sendFeedback();
