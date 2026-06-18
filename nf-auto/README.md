# NF AUTO

NewsFlash Auto - An automated curated news digest engine by Vision71. It fetches news from multiple categories, summarizes them using AI, and delivers a professional dark-themed HTML email to recipients.

## How It Works

1.  **Collect**: Fetches the latest articles from NewsData.io for configured categories (Global, Pakistan, Technology, AI, Business).
2.  **Summarize**: Uses OpenRouter (Llama 3.3 70B) to generate concise, bulleted summaries for each category.
3.  **Build**: Assembles a premium, dark-themed HTML email document.
4.  **Send**: Delivers the digest via Gmail SMTP to the specified list of recipients.

## Setup Instructions

1.  **Clone the repository**.
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Configure environments**:
    - Copy `.env.example` to `.env`.
    - Fill in your API keys and SMTP credentials.

## GitHub Secrets Setup

To run this via GitHub Actions, add the following secrets to your repository:

- `NEWSDATA_API_KEY`: Your API key from [NewsData.io](https://newsdata.io).
- `OPENROUTER_API_KEY`: Your API key from [OpenRouter](https://openrouter.ai).
- `SMTP_HOST`: Typically `smtp.gmail.com`.
- `SMTP_PORT`: Typically `587`.
- `SMTP_SECURE`: `false` for port 587 (TLS).
- `SMTP_USER`: Your Gmail/Vision71 email address.
- `SMTP_PASS`: Your Gmail App Password.
- `RECEIVER_EMAIL`: Comma-separated list of recipient emails.

## How to Test Manually

- **Locally**: Run `npm run test` (Make sure `.env` is populated).
- **GitHub**: Go to the "Actions" tab, select "NF AUTO Daily Digest", and click "Run workflow".

## Customization

- **Add Recipients**: Update the `RECEIVER_EMAIL` secret/env variable with a comma-separated string.
- **Add Categories**: Modify `config/categories.js`. Each category needs an `id`, `label`, and `params` (refer to NewsData.io API docs).

## Tech Stack

- **Runtime**: Node.js 18+ (using native fetch)
- **AI**: OpenRouter (meta-llama/llama-3.3-70b-instruct:free)
- **News**: NewsData.io API
- **Email**: Nodemailer
- **Automation**: GitHub Actions
