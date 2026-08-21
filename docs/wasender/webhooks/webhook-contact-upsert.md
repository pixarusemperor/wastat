# Webhook: Contact Upsert

> Source: https://www.wasenderapi.com/api-docs/webhooks/webhook-contact-upsert
> Category: Webhooks
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/webhooks/webhook-contact-upsert
Description: Triggered when a new contact is added or an existing contact is updated in your session's contact list.

Details:
Webhook: Contact Upsert

 Triggered when a new contact is added or an existing contact is updated in your session's contact list.

Code examples:
```json
{
  "event": "contacts.upsert",
  "timestamp": 1633456789,
  "data": [
    {
      "jid": "1234567890",
      "name": "Contact Name",
      "notify": "Contact Display Name",
      "verifiedName": "Verified Business Name",
      "status": "Hey there! I am using WhatsApp."
    }
  ]
}
```

