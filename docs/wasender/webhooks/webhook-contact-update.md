# Webhook: Contact Update

> Source: https://www.wasenderapi.com/api-docs/webhooks/webhook-contact-update
> Category: Webhooks
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/webhooks/webhook-contact-update
Description: Triggered for other contact updates, such as a contact changing their profile picture or status (if available).

Details:
Webhook: Contact Update

 Triggered for other contact updates, such as a contact changing their profile picture or status (if available).

Code examples:
```json
{
  "event": "contacts.update",
  "timestamp": 1633456789,
  "data": [
    {
      "jid": "1234567890",
      "imgUrl": "https://pps.whatsapp.net/v/t61.24694-24/123456789_123456789_123456789_123456789_123456789.jpg"
    }
  ]
}
```

