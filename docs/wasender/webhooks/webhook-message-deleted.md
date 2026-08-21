# Webhook: Message Deleted

> Source: https://www.wasenderapi.com/api-docs/webhooks/webhook-message-deleted
> Category: Webhooks
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/webhooks/webhook-message-deleted
Description: Event triggered when a message is deleted.

Details:
Webhook Event: messages.delete

 Triggered when a message is deleted. The payload contains the key of the deleted message.

 See the code example below for the typical payload structure.

Code examples:
```json
{
  "event": "messages.delete",
  "timestamp": 1633456800,
  "data": {
    "keys": [
      {
        "id": "message-id-789",
        "fromMe": false,
        "remoteJid": "+1234567890"
      }
    ]
  }
}
```

