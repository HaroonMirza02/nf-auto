function renderStockPill(ticker, data) {
  if (!data) {
    return `<span style="display:inline-block;background:#f5f5f5;border:1px solid #eeeeee;border-radius:4px;padding:4px 8px;margin:2px 4px 2px 0;font-size:10px;color:#999999;font-family:'DM Sans',sans-serif;">${ticker} N/A</span>`;
  }
  const isUp = parseFloat(data.diff) >= 0;
  const color = isUp ? '#1a7a3a' : '#b81c1c';
  const sign = isUp ? '+' : '';
  return `<span style="display:inline-block;background:#f9f9f9;border:1px solid #eeeeee;border-radius:4px;padding:4px 8px;margin:2px 4px 2px 0;font-size:10px;color:#333333;font-family:'DM Sans',sans-serif;">
    <span style="font-weight:700;">${ticker}</span> <span style="color:#666666;margin:0 2px;">${data.current}</span> <span style="color:${color};font-weight:700;">(${sign}${data.pct})</span>
  </span>`;
}

function buildEmail(userSections, date) {
  const navItems = userSections.map(u => `
    <a href="#section-${u.id}" style="display: inline-block; padding: 6px 12px 6px 0; margin-right: 8px; font-size: 11px; font-weight: 700; color: #111111; letter-spacing: 1.5px; text-transform: uppercase; text-decoration: none; font-family: 'DM Sans', sans-serif;">
      ${u.id === 'hassan' ? 'HASSAN' : u.id.toUpperCase()}
    </a>
  `).join('');

  const contentSections = userSections.map((u, i) => {
    const psxPills = u.psxData.map(s => renderStockPill(s.ticker, s)).join('');
    const usPills = Object.keys(u.usStockData).map(t => renderStockPill(t, u.usStockData[t])).join('');

    return `
    <a name="section-${u.id}"></a>
    <div style="margin-bottom: 60px; padding: 30px; background-color: #ffffff; border: 1px solid #f0f0f0; border-radius: 12px;">
      
      <!-- ID Header -->
      <div style="margin-bottom: 25px;">
        <div style="font-size: 20px; font-weight: 700; color: #111111; letter-spacing: -0.5px; text-transform: uppercase;">${u.name}</div>
        <div style="font-size: 10px; font-weight: 300; color: #999999; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px;">${u.sourceLabels}</div>
      </div>

      <!-- Markets -->
      <div style="margin-bottom: 30px; padding: 15px; background-color: #fafafa; border-radius: 8px;">
        <div style="font-size: 9px; font-weight: 700; color: #cccccc; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 10px;">Market Watchlist</div>
        <div style="margin-bottom: 8px;">${psxPills}</div>
        <div>${usPills}</div>
      </div>

      <!-- Analyst Reports -->
      <div class="ai-content" style="font-size: 15px; font-weight: 300; color: #111111; line-height: 1.7; font-family: 'DM Sans', sans-serif;">
        ${u.contentHtml}
      </div>

      <div style="margin-top: 30px; text-align: center;">
        <a href="#top" style="font-size: 9px; color: #cccccc; text-decoration: none; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">↑ Scroll to Top</a>
      </div>
    </div>
    `;
  }).join('\n');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>TechNews — Vision71</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;700&display=swap');
    body { background-color: #f7f7f7; margin: 0; padding: 0; font-family: 'DM Sans', -apple-system, sans-serif; }
    .ai-content h3 { margin: 30px 0 15px; font-size: 16px; font-weight: 700; text-transform: uppercase; color: #111111; letter-spacing: 1px; }
    .ai-content ul { padding-left: 18px; margin-bottom: 0; }
    .ai-content li { margin-bottom: 12px; font-size: 14px; line-height: 1.6; color: #333333; }
    .ai-content b, .ai-content strong { font-weight: 700; color: #000000; }
    .ai-content a { color: #111111; font-weight: 400; text-decoration: underline; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #fafafa;">
  <a name="top"></a>
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    
    <!-- Branding -->
    <div style="padding: 0 0 40px;">
       <table width="100%" border="0" cellspacing="0" cellpadding="0">
         <tr>
           <td>
             <div style="font-size: 14px; font-weight: 700; letter-spacing: 6px; color: #111111; text-transform: uppercase;">TECHNEWS</div>
             <div style="font-size: 11px; font-weight: 300; color: #999999; letter-spacing: 1px; text-transform: uppercase; margin-top: 4px;">Vision71 Daily Digest</div>
           </td>
           <td align="right" valign="bottom" style="font-size: 10px; color: #999999; text-transform: uppercase; letter-spacing: 1px;">
             ${date}
           </td>
         </tr>
       </table>

       <div style="margin-top: 30px; border-top: 1px solid #eeeeee; padding-top: 15px;">
         <div style="font-size: 9px; font-weight: 700; color: #bbbbbb; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 12px;">Scroll to any user:</div>
         <div>${navItems}</div>
       </div>
    </div>

    <!-- User Sections -->
    ${contentSections}

    <!-- Global Footer -->
    <div style="padding: 20px 0; text-align: center; border-top: 1px solid #eeeeee;">
      <div style="font-size: 10px; font-weight: 700; color: #bbbbbb; letter-spacing: 1.5px; text-transform: uppercase;">TECHNEWS · Vision71 Automated Briefing</div>
      <div style="font-size: 10px; color: #aaaaaa; margin-top: 8px;">Synthesized using Gemini 3.1 & Node.js</div>
    </div>

  </div>
</body>
</html>
  `.trim();
}

module.exports = { buildEmail };
