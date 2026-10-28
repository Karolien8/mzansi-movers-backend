/**
 * WhatsApp Webhook Handler
 * Receives incoming messages from Meta Cloud API and routes them through the flow
 *
 * GET  /webhook → verification (Meta checks this when you set up the webhook)
 * POST /webhook → incoming messages
 */
const { getOrCreateUser } = require('./_firebase');
const { handleStep } = require('./_flow');

module.exports = async function handler(req, res) {
  // ─── Webhook verification (GET) ───
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      console.log('[Webhook] Verified');
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  // ─── Incoming message (POST) ───
  if (req.method === 'POST') {
    try {
      const body = req.body;

      // Meta sends various webhook events — we only care about messages
      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (!value?.messages?.[0]) {
        // Not a message event (e.g. status update) — acknowledge and ignore
        return res.status(200).send('OK');
      }

      const message = value.messages[0];
      const phone = message.from; // sender's phone number
      const messageType = message.type;

      // Extract the user's input
      let inputText = '';
      let inputButtonId = '';

      if (messageType === 'text') {
        inputText = message.text?.body?.trim() || '';
      } else if (messageType === 'interactive') {
        // Button reply or list reply
        const interactive = message.interactive;
        if (interactive.type === 'button_reply') {
          inputButtonId = interactive.button_reply?.id || '';
          inputText = interactive.button_reply?.title || '';
        } else if (interactive.type === 'list_reply') {
          inputButtonId = interactive.list_reply?.id || '';
          inputText = interactive.list_reply?.title || '';
        }
      }

      console.log(`[Webhook] From: ${phone.slice(-4)}, Type: ${messageType}, Input: ${inputButtonId || inputText}`);

      // Get or create user in Firebase
      const { isNew, token, data } = await getOrCreateUser(phone);

      if (isNew || inputText.toUpperCase() === 'START') {
        // New user or explicit restart
        await handleStep(phone, token, { step: 'welcome' }, inputText, inputButtonId);
      } else {
        // Existing user — continue from their current step
        await handleStep(phone, token, data, inputText, inputButtonId);
      }

      return res.status(200).send('OK');
    } catch (err) {
      console.error('[Webhook] Error:', err);
      return res.status(200).send('OK'); // Always return 200 to Meta
    }
  }

  return res.status(405).send('Method not allowed');
};
