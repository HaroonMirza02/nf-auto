function buildEmail(summarizedData) {
  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const categorySections = summarizedData.map(section => `
    <div style="margin-bottom: 32px;">
      <!-- Category Meta -->
      <div style="margin-bottom: 14px;">
        <span class="category-title" style="font-size: 22px; font-weight: normal; color: #111111; text-transform: uppercase; display: inline-block; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${section.label}</span>
      </div>
      <!-- Section Content -->
      <div class="content-area" style="font-size: 15px; font-weight: 300; color: #111111; line-height: 1.75;">
        ${section.html}
      </div>
    </div>
    <hr style="border: 0; border-top: 1px solid #f2f2f2; margin: 32px 0;">
  `).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TechNews Digest</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap" rel="stylesheet" />
  <style>
    body {
      background-color: #fafafa;
      margin: 0;
      padding: 40px 20px;
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    
    a {
      color: #111111;
      text-decoration: underline;
      font-weight: 400;
    }
    
    a:hover {
      opacity: 0.6;
    }
    
    h1, h2, h3 {
      display: none !important;
    }
    
    p {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin-bottom: 16px;
      font-size: 15px;
      font-weight: 200;
      line-height: 1.75;
      color: #111111;
    }
    
    ul, ol {
      padding-left: 20px;
      margin-bottom: 16px;
    }
    
    li {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin-bottom: 8px;
      font-size: 14px;
      font-weight: 200;
      line-height: 1.6;
      color: #111111;
    }

    .category-title {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 22px;
      font-weight: normal;
      color: #111111;
      text-transform: uppercase;
    }

    /* Hide headlines and metadata panels from dynamic HTML */
    .news-meta, .news-title {
      display: none !important;
    }

    .news-summary {
      font-size: 15px;
      font-weight: 200;
      color: #111111;
      line-height: 1.75;
      max-width: 600px;
      margin-bottom: 18px;
    }

    .source-toggle-btn {
      font-size: 10px;
      font-weight: 400;
      color: #111111;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .source-details {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      background-color: #fafafa;
      border-radius: 6px;
      padding: 10px 16px;
      margin-top: 12px;
    }

    .via-label {
      font-size: 9px;
      font-weight: 400;
      color: #bbbbbb;
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    .source-link {
      font-size: 12px;
      font-weight: 400;
      color: #333333;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    
    @media (max-width: 600px) {
      body {
        padding: 20px 10px !important;
      }
      .email-wrapper {
        border-radius: 6px !important;
      }
      .header-area {
        padding: 24px 20px 20px !important;
      }
      .body-container {
        padding: 24px 20px !important;
      }
      .footer-area {
        padding: 20px 20px !important;
      }
      .category-title { font-size: 18px !important; }
      p, .news-summary { font-size: 14px !important; line-height: 1.6 !important; }
      .ticker-note-cell {
        display: none !important;
      }
    }
  </style>
</head>
<body style="background-color: #fafafa; margin: 0; padding: 40px 20px; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div class="email-wrapper" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #f0f0f0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02); overflow: hidden;">
    
    <!-- Header -->
    <div class="header-area" style="padding: 32px 32px 24px; border-bottom: 1px solid #f0f0f0; background-color: #ffffff; text-align: left;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td>
            <div style="font-size: 13px; font-weight: 300; letter-spacing: 6px; color: #111111; text-transform: uppercase; line-height: 1;">TECHNEWS</div>
            <div style="font-size: 11px; font-weight: 200; color: #000000ff; margin-top: 6px; letter-spacing: 1px; text-transform: uppercase;">Vision71 Daily Digest</div>
          </td>
          <td align="right" valign="bottom" style="font-size: 10px; font-weight: 200; color: #000000ff; letter-spacing: 1px; text-transform: uppercase; text-align: right;">
            ${formattedDate}
          </td>
        </tr>
      </table>
    </div>
    <!-- Content Section -->
    <div class="body-container" style="padding: 32px; background-color: #ffffff;">
      ${categorySections}
    </div>
    
    <!-- Footer Section -->
    <div class="footer-area" style="padding: 24px 32px; background-color: #fafafa; border-top: 1px solid #f0f0f0; text-align: left;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="padding-bottom: 12px;">
            <span style="font-size: 10px; font-weight: 300; color: #bbbbbb; letter-spacing: 1.5px; text-transform: uppercase; display: inline-block;">TECHNEWS · AUTOMATED DIGEST</span>
          </td>
        </tr>
        <tr>
          <td style="font-size: 11px; font-weight: 200; color: #aaaaaa; line-height: 1.5;">
            Powered by NewsFlash Auto Engine &middot; Node.js &middot; OpenRouter
          </td>
        </tr>
        <tr>
          <td style="font-size: 10px; font-weight: 200; color: #bbbbbb; line-height: 1.5; padding-top: 8px;">
            You are receiving this because you are subscribed to Vision71 internal digests.
          </td>
        </tr>
      </table>
    </div>

  </div>
</body>
</html>
  `.trim();
}

module.exports = { buildEmail };