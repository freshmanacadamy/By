// index.js - Telegram bot using webhooks (suitable for Vercel serverless functions)
// Expects environment variables: BOT_TOKEN, ADMIN_ID (numeric), VERCEL_URL (https://your-deployment.vercel.app)
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID && parseInt(process.env.ADMIN_ID);
const CHANNEL_USERNAME = process.env.CHANNEL_USERNAME || '@jumarket'; // default channel
if (!BOT_TOKEN) {
  console.error('BOT_TOKEN is required in env');
  process.exit(1);
}

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const app = express();
app.use(bodyParser.json());

// Simple in-memory posts store (serverless functions are ephemeral; persistent DB recommended)
const posts = {}; // postId => { userId, username, text, photoFileId, status }

function makeInlineKeyboard(buttons) {
  return { inline_keyboard: buttons };
}

app.get('/', (req, res) => {
  res.send('Bot is alive');
});

// Telegram webhook endpoint configured on Vercel as /api/webhook
app.post('/api/webhook', async (req, res) => {
  try {
    const update = req.body;
    // handle message updates
    if (update.message) {
      await handleMessage(update.message);
    } else if (update.callback_query) {
      await handleCallback(update.callback_query);
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err && err.toString());
    res.sendStatus(500);
  }
});

async function sendMessage(chatId, text, extra) {
  const payload = { chat_id: chatId, text: text, parse_mode: 'HTML', ...extra };
  await axios.post(`${TELEGRAM_API}/sendMessage`, payload);
}

async function sendPhoto(chatId, photoFileId, caption, extra) {
  const payload = { chat_id: chatId, photo: photoFileId, caption: caption || '', parse_mode: 'HTML', ...extra };
  await axios.post(`${TELEGRAM_API}/sendPhoto`, payload);
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const from = message.from;
  const text = message.text || '';
  // If user sends "/start"
  if (text.startsWith('/start')) {
    const name = from.first_name || '';
    await sendMessage(chatId, `Hello ${name}! Use /post <description> and attach a photo (optional) to post for approval.`);
    return;
  }
  // If user sends /post command with optional caption, or a photo with caption
  if (text.startsWith('/post') || (message.photo && (message.caption || '').length >= 0 && text.trim().length === 0)) {
    // Create postId
    const postId = Date.now().toString();
    let caption = '';
    let photoFileId = null;
    if (message.photo && message.photo.length > 0) {
      // Use highest resolution photo last element
      photoFileId = message.photo[message.photo.length - 1].file_id;
      caption = message.caption || '';
    } else {
      // text-only post: remove /post command
      caption = text.replace(/^\/post\s*/i, '').trim();
    }
    posts[postId] = {
      userId: from.id,
      username: from.username || '',
      text: caption,
      photoFileId,
      status: 'pending'
    };
    // Notify user
    await sendMessage(chatId, `Thanks — your post is submitted for admin approval (post id: ${postId}).`);
    // Send to admin for review with approve/reject buttons
    const approveData = `action:approve:${postId}`;
    const rejectData = `action:reject:${postId}`;
    const keyboard = makeInlineKeyboard([[{ text: '✅ Approve', callback_data: approveData }, { text: '❌ Reject', callback_data: rejectData }]]);
    if (photoFileId) {
      // send photo to admin with buttons
      await sendPhoto(ADMIN_ID, photoFileId, `New post (id: ${postId}) from @${from.username || from.first_name}\n\n${caption}`, { reply_markup: keyboard });
    } else {
      await sendMessage(ADMIN_ID, `New post (id: ${postId}) from @${from.username || from.first_name}\n\n${caption}`, { reply_markup: keyboard });
    }
    return;
  }

  // Admin commands: /approve <postId> or /reject <postId>
  if (from.id === ADMIN_ID && text.startsWith('/approve')) {
    const parts = text.split(/\s+/);
    const postId = parts[1];
    await processApproval(postId, true);
    return;
  }
  if (from.id === ADMIN_ID && text.startsWith('/reject')) {
    const parts = text.split(/\s+/);
    const postId = parts[1];
    await processApproval(postId, false);
    return;
  }

  // Other messages: simple reply echo for now
  await sendMessage(chatId, `I received your message. To submit a post for the channel, use /post <description> and attach a photo (optional).`);
}

async function handleCallback(callbackQuery) {
  const data = callbackQuery.data;
  const from = callbackQuery.from;
  const message = callbackQuery.message;
  // Acknowledge callback
  await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, { callback_query_id: callbackQuery.id });
  if (!data) return;
  const parts = data.split(':');
  if (parts.length !== 3) return;
  const [, action, postId] = parts;
  if (from.id !== ADMIN_ID) {
    await sendMessage(from.id, 'Only admin can use these buttons.');
    return;
  }
  if (action === 'approve') {
    await processApproval(postId, true, message);
  } else if (action === 'reject') {
    await processApproval(postId, false, message);
  }
}

async function processApproval(postId, approve, messageContext) {
  const post = posts[postId];
  if (!post) {
    await sendMessage(ADMIN_ID, `Post ${postId} not found.`);
    return;
  }
  if (approve) {
    // Post to channel
    if (post.photoFileId) {
      await sendPhoto(CHANNEL_USERNAME, post.photoFileId, `Post by @${post.username}\n\n${post.text}`);
    } else {
      await sendMessage(CHANNEL_USERNAME, `Post by @${post.username}\n\n${post.text}`);
    }
    post.status = 'approved';
    await sendMessage(post.userId, `Your post (id: ${postId}) has been approved and posted to ${CHANNEL_USERNAME}.`);
    await sendMessage(ADMIN_ID, `Post ${postId} approved and posted.`);
  } else {
    post.status = 'rejected';
    await sendMessage(post.userId, `Your post (id: ${postId}) has been rejected by the admin.`);
    await sendMessage(ADMIN_ID, `Post ${postId} rejected.`);
  }
  // Optionally edit the admin's message to show action taken (if messageContext available)
  if (messageContext && messageContext.message_id) {
    try {
      await axios.post(`${TELEGRAM_API}/editMessageReplyMarkup`, {
        chat_id: messageContext.chat.id,
        message_id: messageContext.message_id,
        reply_markup: { inline_keyboard: [] }
      });
    } catch (e) {
      // ignore edit errors
    }
  }
}

// Start express server for local testing (not used by Vercel; Vercel uses API route)
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('Server listening on port', port);
});

module.exports = app;
