/**
 * WhatsApp Cloud API – message sending helpers
 * Handles text messages, interactive buttons, and interactive lists
 */

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const API_URL = `https://graph.facebook.com/v25.0/${PHONE_ID}/messages`;

/**
 * Send a plain text message
 */
async function sendText(to, body) {
  await callApi({
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body },
  });
}

/**
 * Send interactive buttons (max 3 buttons)
 * buttons: [{ id: 'btn_1', title: 'Option A' }, ...]
 */
async function sendButtons(to, body, buttons) {
  await callApi({
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: {
        buttons: buttons.map(b => ({
          type: 'reply',
          reply: { id: b.id, title: b.title },
        })),
      },
    },
  });
}

/**
 * Send interactive list (for more than 3 options)
 * rows: [{ id: 'row_1', title: 'Option A', description: '...' }, ...]
 */
async function sendList(to, body, buttonText, rows) {
  await callApi({
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body },
      action: {
        button: buttonText,
        sections: [{ rows }],
      },
    },
  });
}

/**
 * Core API call
 */
async function callApi(payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[WhatsApp API Error]', res.status, err);
  }
}

module.exports = { sendText, sendButtons, sendList };
