# Webhook: Chat Upsert

> Source: https://www.wasenderapi.com/api-docs/webhooks/webhook-chat-upsert
> Category: Webhooks
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/webhooks/webhook-chat-upsert
Description: Triggered when a chat is created or updated (e.g., new message, read status change).

Details:
Webhook: Chat Upsert

 Triggered when a chat is created or updated (e.g., new message, read status change).

Code examples:
```json
{
  "event": "chats.upsert",
  "timestamp": 1633456789,
  "data": [
    {
      "id": "1234567890",
      "name": "Contact Name",
      "conversationTimestamp": 1633456789,
      "unreadCount": 2
    }
  ]
}
```

