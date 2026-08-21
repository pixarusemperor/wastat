# Webhook Setup

> Source: https://www.wasenderapi.com/api-docs/webhooks/webhook-setup
> Category: Webhooks
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/webhooks/webhook-setup
Endpoint: POST /your-webhook-url
Description: How to set up and verify webhooks to receive real-time events.

Details:
Webhook Setup

 Webhooks allow your application to receive real-time notifications about events happening in your WhatsApp session, such as receiving messages, message status updates, or session status changes.

 Configuration:

 - Go to your WhatsApp Session settings in the Wasender dashboard.

 - Enter your publicly accessible webhook URL in the 'Webhook URL' field. This URL must be HTTPS.

 - Optionally, generate and save a 'Webhook Secret'. This secret is used to verify that incoming requests are genuinely from Wasender.

 - Enable the specific events you want to subscribe to.

 - Save your changes.

 Verification:

 It's crucial to verify that incoming webhook requests originate from Wasender. Check if the X-Webhook-Signature header in the request matches your stored Webhook Secret.

 Always respond to webhook requests with a 200 OK status code quickly to acknowledge receipt, even if you process the event asynchronously.

Parameters:
- X-Webhook-Signature (string, required): Secret key used to verify the webhook came from WasenderApi.
- Content-Type (string, required): Should be `application/json`.

Code examples:
```javascript
// Example webhook endpoint in Express.js
const express = require('express');
const crypto = require('crypto');
const app = express();

app.use(express.json());

// Verify webhook signature to ensure it's from WasenderApi
function verifySignature(req) {
    const signature = req.headers['x-webhook-signature'];
    const webhookSecret = 'YOUR_WEBHOOK_SECRET'; // Store securely
    if (!signature || !webhookSecret || signature !== webhookSecret) return false;
    return true;
}

app.post('/webhook', (req, res) => {
    if (!verifySignature(req)) {
        return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = req.body;
    console.log('Received webhook event:', payload.event);

    // Handle different event types (e.g., message.sent, session.status)
    switch (payload.event) {
        case 'messages.upsert':
            console.log('New message received:', payload.data.key.id);
            // Process the incoming message
            break;
        // Add other cases
    }

    res.status(200).json({ received: true });
});

app.listen(3000, () => {
    console.log('Webhook server listening on port 3000');
});
```

