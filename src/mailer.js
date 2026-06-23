require('dotenv').config();
const nodemailer = require('nodemailer');

async function sendDigest(emailHtml, recipientOverride, dateOverride) {
    const {
        SMTP_HOST,
        SMTP_PORT,
        SMTP_SECURE,
        SMTP_USER,
        SMTP_PASS,
        RECEIVER_EMAIL
    } = process.env;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    const displayDate = dateOverride || dateStr;
    const recipient = recipientOverride || RECEIVER_EMAIL;

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT || "587"),
        secure: SMTP_SECURE === "true",
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS
        }
    });

    const mailOptions = {
        from: `"NewsFlash Auto" <${SMTP_USER}>`,
        to: recipient,
        subject: `⚡ NewsFlash Auto — [${displayDate}]`,
        html: emailHtml
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`[${new Date().toISOString()}] Digest sent successfully:`, info.messageId);
        return info;
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Failed to send digest:`, error.message);
        throw error;
    }
}

module.exports = { sendDigest };
