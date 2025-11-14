// setWebhook.js - call this once (locally or from a server) to set the Telegram webhook to your VERCEL_URL
// Usage: set BOT_TOKEN and VERCEL_URL in env or edit the .env file before running: node setWebhook.js
const axios = require('axios');
const BOT_TOKEN = process.env.BOT_TOKEN;
const VERCEL_URL = process.env.VERCEL_URL; // e.g. https://your-app.vercel.app
if (!BOT_TOKEN || !VERCEL_URL) {
  console.error('Please set BOT_TOKEN and VERCEL_URL environment variables.');
  process.exit(1);
}
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const webhookUrl = `${VERCEL_URL.replace(/\/+$/,'')}/api/webhook`;
axios.post(`${TELEGRAM_API}/setWebhook`, { url: webhookUrl })
  .then(res => {
    console.log('setWebhook response:', res.data);
  })
  .catch(err => {
    console.error('setWebhook error:', err.toString());
  });
