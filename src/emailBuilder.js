function formatWhyThisMatters(html) {
  if (!html) return html;
  return html.replace(
    /(?:<br\s*\/?>)?\s*(?:<b>|<strong>)?\s*Why\s+this\s+matters:?\s*(?:<\/b>|<\/strong>)?\s*([\s\S]*?)(?=(?:<\/li>|<li[^>]*>|<h3>|$))/gi,
    (match, impactText) => {
      const trimmedImpact = impactText.trim();
      return `<div style="margin-top: 10px; margin-bottom: 24px;"><strong style="font-weight: 700; color: #000000; font-size: 14px; display: block; margin-bottom: 4px;">Why this matters:</strong>${trimmedImpact}</div>`;
    }
  );
}

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
        <span class="category-title" style="font-size: 20px; font-weight: 700; color: #111111; text-transform: uppercase; display: inline-block; font-family: 'DM Sans', -apple-system, sans-serif;">${section.label}</span>
      </div>
      <!-- Section Content -->
      <div class="content-area" style="font-size: 15px; font-weight: 400; color: #111111; line-height: 1.75;">
        ${formatWhyThisMatters(section.html)}
      </div>
    </div>
    <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 32px 0;">
  `).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TechNews Daily Digest</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&display=swap" rel="stylesheet" />
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
      font-weight: 700;
    }
    
    a:hover {
      opacity: 0.8;
    }
    
    h1, h2, h3 {
      display: none !important;
    }
    
    p {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin-bottom: 16px;
      font-size: 15px;
      font-weight: 400;
      line-height: 1.75;
      color: #111111;
    }
    
    ul, ol {
      padding-left: 20px;
      margin-bottom: 16px;
    }
    
    li {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin-bottom: 16px;
      font-size: 14px;
      font-weight: 400;
      line-height: 1.6;
      color: #111111;
    }

    .category-title {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 20px;
      font-weight: 700;
      color: #111111;
      text-transform: uppercase;
    }

    .via-label {
      font-size: 10px;
      font-weight: 700;
      color: #111111;
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    .source-link {
      font-size: 12px;
      font-weight: 700;
      color: #111111;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    /* Default Light Mode Logo */
    .light-logo { display: block !important; }
    .dark-logo { display: none !important; mso-hide: all; }

    /* Dark Mode Media Query for Apple Mail, Outlook, Thunderbird */
    @media (prefers-color-scheme: dark) {
      .light-logo { display: none !important; }
      .dark-logo { display: block !important; margin: 0 auto !important; }
    }
    /* Gmail Dark Mode Specific Selectors */
    [data-ogsc] .light-logo { display: none !important; }
    [data-ogsc] .dark-logo { display: block !important; margin: 0 auto !important; }
    u + .body .light-logo { display: none !important; }
    u + .body .dark-logo { display: block !important; margin: 0 auto !important; }

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
    }
  </style>
</head>
<body class="body" style="background-color: #fafafa; margin: 0; padding: 40px 20px; font-family: 'DM Sans', -apple-system, sans-serif;">
  <div class="email-wrapper" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02); overflow: hidden;">
    
    <!-- Header -->
    <div class="header-area" style="padding: 28px 32px 20px; border-bottom: 1px solid #e0e0e0; background-color: #ffffff; text-align: center;">
      <div style="text-align: center; margin-bottom: 14px;">
        <img class="light-logo" src="https://res.cloudinary.com/dereplqra/image/upload/v1765796805/vision_b_w_p1armv.png" alt="Vision Logo" width="160" style="display: block; margin: 0 auto; border: 0; max-width: 180px; height: auto; filter: drop-shadow(0px 0px 1px #ffffff) drop-shadow(0px 0px 2px #ffffff);" />
        <!--[if !mso]><!-->
        <img class="dark-logo" src="https://res.cloudinary.com/dereplqra/image/upload/v1749124870/Vision71_Tech_m42tgm.png" alt="Vision Logo" width="160" style="display: none; margin: 0 auto; border: 0; max-width: 180px; height: auto;" />
        <!--<![endif]-->
      </div>
      <div style="font-size: 14px; font-weight: 700; letter-spacing: 5px; color: #111111; text-transform: uppercase; margin-bottom: 6px;">TECHNEWS DAILY DIGEST</div>
      <div style="font-size: 11px; font-weight: 700; color: #111111; letter-spacing: 1.5px; text-transform: uppercase;">${formattedDate}</div>
    </div>

    <!-- Content Section -->
    <div class="body-container" style="padding: 32px; background-color: #ffffff;">
      ${categorySections}
    </div>
    
    <!-- Footer Section -->
    <div class="footer-area" style="padding: 28px 32px; background-color: #fafafa; border-top: 1px solid #e0e0e0; text-align: center;">
      <div style="font-size: 11px; font-weight: 700; color: #111111; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px;">TECHNEWS · AUTOMATED EXECUTIVE BRIEFING</div>
      <div style="font-size: 11px; font-weight: 600; color: #111111; margin-bottom: 16px; line-height: 1.5;">Curated Daily Market &amp; Tech Intelligence Engine</div>
      <div style="text-align: center; margin-top: 16px;">
        <img class="light-logo" src="https://res.cloudinary.com/dereplqra/image/upload/v1765796805/vision_b_w_p1armv.png" alt="Vision Logo" width="120" style="display: block; margin: 0 auto; border: 0; max-width: 140px; height: auto; filter: drop-shadow(0px 0px 1px #ffffff) drop-shadow(0px 0px 2px #ffffff);" />
        <!--[if !mso]><!-->
        <img class="dark-logo" src="https://res.cloudinary.com/dereplqra/image/upload/v1749124870/Vision71_Tech_m42tgm.png" alt="Vision Logo" width="120" style="display: none; margin: 0 auto; border: 0; max-width: 140px; height: auto;" />
        <!--<![endif]-->
      </div>
    </div>

  </div>
</body>
</html>
  `.trim();
}

module.exports = { buildEmail };