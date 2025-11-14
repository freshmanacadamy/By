
# Telegram Bot (Vercel-ready, webhook based)

This project implements a simple Telegram bot that uses **webhooks** (required for serverless hosts like Vercel).
It includes basic features:
- Submit a post with `/post <description>` and optional photo attachment
- Admin receives approve/reject buttons
- Approved posts are forwarded to the Telegram channel (default `@jumarket`)
- Admin actions notify the original poster

## Files
- `index.js` - main Express app and webhook handler
- `setWebhook.js` - helper to set Telegram webhook (run locally once or via a server)
- `package.json` - dependencies and scripts
- `.env` - environment variables (created in the ZIP with your provided BOT_TOKEN & ADMIN_ID)

## Environment variables
Create a `.env` file or set the following in Vercel environment variables:
- `BOT_TOKEN` - your bot token from @BotFather
- `ADMIN_ID` - numeric Telegram ID of the admin (e.g., 5747226778)
- `VERCEL_URL` - (only needed for setWebhook) your Vercel deployment URL, e.g. https://your-app.vercel.app
- `CHANNEL_USERNAME` - optional - default `@jumarket`

## Deploying to Vercel
1. Push this project to a Git repository.
2. Import the repo in Vercel dashboard.
3. In Vercel project settings, set `BOT_TOKEN` and `ADMIN_ID` as Environment Variables (do NOT use .env in production).
4. Deploy the project.
5. Run `node setWebhook.js` locally with `BOT_TOKEN` and `VERCEL_URL` set to set the webhook. Example:
   ```bash
   BOT_TOKEN=... VERCEL_URL=https://your-app.vercel.app node setWebhook.js
   ```
6. After webhook is set, send `/start` to your bot to confirm it's working. Use `/post` to submit posts.

## Notes & limitations
- This implementation uses an in-memory store (`posts` object) that is **ephemeral**. For production use, connect to a database (e.g., MongoDB, Firebase, or Supabase) to persist posts.
- Vercel serverless functions cannot run long-polling. This webhook approach is necessary.
- Make sure your channel (`CHANNEL_USERNAME`) allows the bot to post (add the bot as admin in the channel if needed).
