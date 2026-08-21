# Webhook: Message Reaction

> Source: https://www.wasenderapi.com/api-docs/webhooks/webhook-message-reaction
> Category: Webhooks
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/webhooks/webhook-message-reaction
Description: Event triggered when someone reacts to a message.

Details:
Webhook Event: messages.reaction

 Triggered when someone reacts to a message. The payload includes the reaction details and the message key.

 See the code example below for the typical payload structure.

Code examples:
```json
{
  "event": "messages.reaction",
  "timestamp": 1633456810,
  "data": [
    {
      "key": {
        "id": "message-id-123",
        "fromMe": false,
        "remoteJid": "+1234567890"
      },
      "reaction": {
        "text": "👍", // The emoji reaction
        "key": {
          "id": "message-id-123",
          "fromMe": false,
          "remoteJid": "+1234567890"
        }
      }
    }
  ]
}
```

