# Webhook: Chat Update

> Source: https://www.wasenderapi.com/api-docs/webhooks/webhook-chat-update
> Category: Webhooks
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/webhooks/webhook-chat-update
Description: Triggered when properties of a chat are updated (e.g., unread count, mute status).

Details:
Webhook: Chat Update

 Triggered when properties of a chat are updated (e.g., unread count, mute status).

Code examples:
```json
{
  "event": "chats.update",
  "timestamp": 1633456789,
  "data": [
    {
      "id": "1234567890",
      "unreadCount": 0,
      "conversationTimestamp": 1633456789
    }
  ]
}
```

