# Webhook: Message Sent

> Source: https://www.wasenderapi.com/api-docs/webhooks/webhook-message-sent
> Category: Webhooks
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/webhooks/webhook-message-sent
Description: Event triggered when a message is successfully sent from your session.

Details:
Webhook Event: message.sent

 Triggered when a message is successfully sent from your session. The payload contains details about the sent message.

 See the code example below for the typical payload structure.

Code examples:
```json (message sent successfully)
{
  "event": "message.sent",
  "timestamp": 1633456790,
  "data": {
    "key": {
      "id": "message-id-456",
      "fromMe": true,
      "remoteJid": "+1987654321"
    },
    "message": {
      "conversation": "This is my reply."
    },
    "success": true
  }
}
```
```json (message failed to be sent)
{
  "event": "message.sent",
  "timestamp": 1633456790,
  "data": {
    "success": false,
    "error": "Failed to send message: Invalid number JID: +123456787"
  }
}
```

