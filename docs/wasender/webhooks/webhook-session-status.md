# Webhook: Session Status

> Source: https://www.wasenderapi.com/api-docs/webhooks/webhook-session-status
> Category: Webhooks
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/webhooks/webhook-session-status
Description: Event triggered when the connection status of your WhatsApp session changes, including QR and Passkey linking states.

Details:
Webhook Event: session.status

 Triggered when the connection status of your WhatsApp session changes. The payload includes the new status and the session ID.

 Status values

 Status
 Meaning
 Recommended action

 connected
 The WhatsApp session is connected and ready to send or receive messages.
 Start using the session API key for messaging.

 connecting
 The session is starting or reconnecting.
 Wait and continue polling or listening for the next webhook event.

 need_scan
 The session needs the user to scan a WhatsApp QR code.
 Show the QR linking UI or call the QR code endpoint to get a fresh QR code.

 need_passkey
 The session needs the user to approve a WhatsApp Passkey linking request.
 Fetch the Passkey token and ask the user to complete linking with Device Link Helper.

 disconnected
 The session is disconnected but may be reconnected.
 Offer the user a reconnect action.

 logged_out
 The WhatsApp account was logged out from the linked device.
 Ask the user to link the session again with QR or Passkey.

 expired
 The session expired or can no longer be resumed safely.
 Ask the user to reconnect the session.

 Passkey fallback: If Passkey linking cannot continue, the session may return to need_scan. In that case, show the normal QR linking flow.

 See the code example below for the typical payload structure.

Code examples:
```json
{
  "event": "session.status",
  "sessionId": "YOUR_SESSION_API_KEY",
  "data": {
    "status": "need_passkey"
  }
}
```

