function buildEmail(summarizedData) {
  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const categorySections = summarizedData.map(section => `
    <div style="margin-bottom: 30px;">
      <div style="display: inline-block; background-color: #23232A; padding: 6px 14px; border-radius: 20px; margin-bottom: 15px;">
        <span style="color: #FFFFFF; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">${section.label}</span>
      </div>
      <div style="color: #D4D4D8; line-height: 1.6; font-size: 15px;">
        ${section.html}
      </div>
    </div>
    <hr style="border: 0; border-top: 1px solid #2D2D34; margin: 30px 0;">
  `).join('');
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NF AUTO Digest</title>
  <style>
    body {
      background-color: #121214;
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    a {
      color: #38BDF8;
      text-decoration: none;
    }
    a:hover {
      color: #7DD3FC;
      text-decoration: underline;
    }
    ul {
      padding-left: 20px;
      margin: 0;
    }
    li {
      margin-bottom: 12px;
    }
  </style>
</head>
<body style="background-color: #121214; margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #1A1A1E; border: 1px solid #2D2D34; border-radius: 12px; overflow: hidden;">
    <!-- Header -->
    <div style="padding: 40px 30px; text-align: center; border-bottom: 1px solid #2D2D34;">
      <h1 style="color: #FFFFFF; margin: 0 0 10px 0; font-size: 28px; letter-spacing: -0.5px;">⚡ NewsFlash Auto</h1>
      <p style="color: #A1A1AA; margin: 0 0 5px 0; font-size: 16px;">Your daily curated news digest</p>
      <p style="color: #71717A; margin: 0; font-size: 14px;">${formattedDate}</p>
    </div>
    <!-- Content -->
    <div style="padding: 30px;">
      ${categorySections}
    </div>
    <!-- Footer -->
    <div style="padding: 30px; text-align: center; background-color: #16161A; border-top: 1px solid #2D2D34;">
      <p style="color: #71717A; margin: 0 0 10px 0; font-size: 13px;">Automated NewsFlash Engine &middot; Powered by OpenRouter & Node.js</p>
      <p style="color: #71717A; margin: 0; font-size: 12px;">You are receiving this because you are subscribed to Vision71 internal digests.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
module.exports = { buildEmail };
