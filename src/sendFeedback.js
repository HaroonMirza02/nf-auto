const { sendDigest } = require('./mailer');

async function sendFeedback() {
    const userEmail = process.env.FEEDBACK_USER_EMAIL;       // The user the feedback is about
    const userName = process.env.FEEDBACK_USER_NAME;         // Their display name
    const feedbackText = process.env.FEEDBACK_TEXT;
    const allEmails = process.env.FEEDBACK_ALL_EMAILS;       // Comma-separated list of ALL user emails

    if (!userEmail || !feedbackText || !allEmails) {
        console.error("Missing required environment variables: FEEDBACK_USER_EMAIL, FEEDBACK_TEXT, FEEDBACK_ALL_EMAILS");
        process.exit(1);
    }

    const html = `
        <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #007bff; margin-bottom: 4px;">Admin Feedback</h2>
            <p style="color: #999; font-size: 13px; margin-top: 0;">For: <strong>${userName || userEmail}</strong></p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
            <p>Hello team,</p>
            <p>An administrator has left the following feedback regarding <strong>${userName || 'the user'}</strong>'s NewsFlash Auto reports:</p>
            <div style="background: #f8f9fa; padding: 15px 20px; border-radius: 8px; border-left: 4px solid #007bff; margin: 20px 0; font-size: 15px; line-height: 1.6;">
                ${feedbackText.replace(/\n/g, '<br>')}
            </div>
            <p style="font-weight: bold; color: #007bff;">Please Collaborate.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
            <p style="font-size: 12px; color: #aaa;">This is an automated message from the NF AUTO Admin Dashboard.</p>
        </div>
    `;

    const subject = `Admin Feedback for ${userName || userEmail}`;

    try {
        // Send to ALL users so everyone is in the loop
        await sendDigest(html, allEmails, subject);
        console.log(`Feedback sent successfully to all users: ${allEmails}`);
    } catch (error) {
        console.error("Failed to send feedback:", error);
        process.exit(1);
    }
}

sendFeedback();
