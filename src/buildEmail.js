function renderStockPill(ticker, data) {
  if (!data) {
    return `<span style="display:inline-block;background:#f5f5f5;border:1px solid #e0e0e0;border-radius:4px;padding:4px 8px;margin:2px 4px 2px 0;font-size:10px;color:#333333;font-weight:600;font-family:'DM Sans',sans-serif;">${ticker} N/A</span>`;
  }
  const isUp = parseFloat(data.diff) >= 0;
  const color = isUp ? '#1a7a3a' : '#b81c1c';
  const pctStr = String(data.pct || '');
  const formattedPct = (isUp && !pctStr.startsWith('+')) ? `+${pctStr}` : pctStr;
  return `<span style="display:inline-block;background:#f9f9f9;border:1px solid #e0e0e0;border-radius:4px;padding:4px 8px;margin:2px 4px 2px 0;font-size:10px;color:#111111;font-family:'DM Sans',sans-serif;">
    <span style="font-weight:700;color:#111111;">${ticker}</span> <span style="color:#111111;font-weight:600;margin:0 2px;">${data.current}</span> <span style="color:${color};font-weight:700;">(${formattedPct})</span>
  </span>`;
}

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

function buildEmail(userSections, date) {
  const navItems = userSections.map(u => `
    <a href="#section-${u.id}" style="display: inline-block; padding: 7px 16px; margin: 4px 4px; font-size: 11px; font-weight: 700; color: #111111; background-color: #ffffff; border: 1px solid #d0d0d0; border-radius: 6px; letter-spacing: 1px; text-transform: uppercase; text-decoration: none; font-family: 'DM Sans', sans-serif; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
      ${u.id === 'hassan' ? 'HASSAN' : u.id.toUpperCase()}
    </a>
  `).join('');

  const contentSections = userSections.map((u, i) => {
    const psxPills = u.psxData.map(s => renderStockPill(s.ticker, s)).join('');
    const usPills = Object.keys(u.usStockData).map(t => renderStockPill(t, u.usStockData[t])).join('');

    // Strip any empty-category fallback blocks Gemini may still output.
    const cleanedHtml = formatWhyThisMatters(stripEmptyCategoryBlocks(u.contentHtml));

    return `
    <a name="section-${u.id}"></a>
    <div style="margin-bottom: 60px; padding: 30px; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 12px;">
      
      <!-- ID Header -->
      <div style="margin-bottom: 25px;">
        <div style="font-size: 20px; font-weight: 700; color: #111111; letter-spacing: -0.5px; text-transform: uppercase;">${u.name}</div>
        <div style="font-size: 11px; font-weight: 700; color: #111111; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px;">${u.sourceLabels}</div>
      </div>

      <!-- Markets -->
      <div style="margin-bottom: 30px; padding: 18px; background-color: #f7f7f7; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="font-size: 11px; font-weight: 700; color: #111111; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 14px; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px;">MARKET WATCHLIST</div>
        
        ${psxPills ? `
        <div style="margin-bottom: 14px;">
          <div style="font-size: 9px; font-weight: 700; color: #555555; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px;">🇵🇰 PAKISTAN MARKETS (PSX)</div>
          <div>${psxPills}</div>
        </div>` : ''}

        ${usPills ? `
        <div>
          <div style="font-size: 9px; font-weight: 700; color: #555555; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px;">🌐 GLOBAL MARKETS (US)</div>
          <div>${usPills}</div>
        </div>` : ''}
      </div>

      <!-- Analyst Reports -->
      <div class="ai-content" style="font-size: 15px; font-weight: 400; color: #111111; line-height: 1.7; font-family: 'DM Sans', sans-serif;">
        ${cleanedHtml}
      </div>

      <div style="margin-top: 30px; text-align: center;">
        <a href="#top" style="font-size: 10px; color: #111111; text-decoration: none; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">↑ Scroll to Top</a>
      </div>
    </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>TechNews Daily Digest</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;700&display=swap');
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    body { background-color: #f7f7f7; margin: 0; padding: 0; font-family: 'DM Sans', -apple-system, sans-serif; }
    .ai-content h3 { margin: 35px 0 18px; font-size: 16px; font-weight: 700; text-transform: uppercase; color: #111111; letter-spacing: 1px; border-bottom: 1px solid #eeeeee; padding-bottom: 8px; }
    .ai-content ul { padding-left: 18px; margin-bottom: 0; margin-top: 10px; }
    .ai-content li { margin-bottom: 32px; font-size: 14px; line-height: 1.6; color: #111111; }
    .ai-content li:last-child { margin-bottom: 16px; }
    .ai-content b, .ai-content strong { font-weight: 700; color: #000000; }
    .ai-content a { color: #111111; font-weight: 700; text-decoration: underline; }

    /* Default Light Mode Logo */
    .light-logo { display: block !important; }
    .dark-logo { display: none !important; mso-hide: all; }

    /* Dark Mode Media Query for Gmail, Apple Mail, Outlook */
    @media (prefers-color-scheme: dark) {
      .light-logo { display: none !important; }
      .dark-logo { display: block !important; margin: 0 auto !important; }
    }
    /* Gmail Dark Mode Data Attribute Targeting */
    [data-ogsc] .light-logo { display: none !important; }
    [data-ogsc] .dark-logo { display: block !important; margin: 0 auto !important; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #fafafa;">
  <a name="top"></a>
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    
    <!-- Branding Header -->
    <div style="padding: 10px 0 35px; text-align: center;">
       <div style="text-align: center; margin-bottom: 16px;">
         <img class="light-logo" src="https://res.cloudinary.com/dereplqra/image/upload/v1765796805/vision_b_w_p1armv.png" alt="Vision Logo" width="160" style="display: block; margin: 0 auto; border: 0; max-width: 180px; height: auto;" />
         <!--[if !mso]><!-->
         <img class="dark-logo" src="https://res.cloudinary.com/dereplqra/image/upload/v1749124870/Vision71_Tech_m42tgm.webp" alt="Vision Logo" width="160" style="display: none; margin: 0 auto; border: 0; max-width: 180px; height: auto;" />
         <!--<![endif]-->
       </div>
       <div style="font-size: 14px; font-weight: 700; letter-spacing: 5px; color: #111111; text-transform: uppercase; margin-bottom: 6px;">TECHNEWS DAILY DIGEST</div>
       <div style="font-size: 11px; font-weight: 700; color: #111111; letter-spacing: 1.5px; text-transform: uppercase;">${date}</div>

       <div style="margin-top: 25px; border-top: 1px solid #e0e0e0; padding-top: 15px;">
         <div style="font-size: 10px; font-weight: 700; color: #111111; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 10px;">SCROLL TO ANY USER:</div>
         <div>${navItems}</div>
       </div>
    </div>

    <!-- User Sections -->
    ${contentSections}

    <!-- Global Footer -->
    <div style="padding: 30px 0 20px; text-align: center; border-top: 1px solid #e0e0e0;">
      <div style="font-size: 11px; font-weight: 700; color: #111111; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px;">TECHNEWS · AUTOMATED EXECUTIVE BRIEFING</div>
      <div style="font-size: 11px; font-weight: 600; color: #111111; margin-bottom: 16px; line-height: 1.5;">Curated Daily Market &amp; Tech Intelligence Engine</div>
      <div style="text-align: center; margin-top: 16px;">
        <img class="light-logo" src="https://res.cloudinary.com/dereplqra/image/upload/v1765796805/vision_b_w_p1armv.png" alt="Vision Logo" width="120" style="display: block; margin: 0 auto; border: 0; max-width: 140px; height: auto;" />
        <!--[if !mso]><!-->
        <img class="dark-logo" src="https://res.cloudinary.com/dereplqra/image/upload/v1749124870/Vision71_Tech_m42tgm.webp" alt="Vision Logo" width="120" style="display: none; margin: 0 auto; border: 0; max-width: 140px; height: auto;" />
        <!--<![endif]-->
      </div>
    </div>

  </div>
</body>
</html>
  `.trim();
}

module.exports = { buildEmail };

/**
 * Strips any <h3>Category</h3> block whose only list item is a "no coverage"
 * fallback. Gemini occasionally still outputs these despite being told not to.
 *
 * Patterns removed:
 *   <h3>...</h3> <ul><li>No tech-relevant coverage...</li></ul>
 *   <h3>...</h3> <ul><li>Limited coverage...</li></ul>
 *   <h3>...</h3> <ul><li>No coverage available...</li></ul>
 */
function stripEmptyCategoryBlocks(html) {
  if (!html) return html;

  // Match an <h3> block followed immediately by a <ul> whose only <li>
  // contains a "no/limited coverage" phrase, and remove both.
  return html.replace(
    /<h3[^>]*>[\s\S]*?<\/h3>\s*<ul[^>]*>\s*<li[^>]*>\s*(?:No tech-relevant coverage|Limited coverage|No coverage available|No relevant coverage)[^<]*<\/li>\s*<\/ul>/gi,
    ''
  ).replace(/\n{3,}/g, '\n\n').trim();
}
