# Webhook: Group Upsert

> Source: https://www.wasenderapi.com/api-docs/webhooks/webhook-group-upsert
> Category: Webhooks
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/webhooks/webhook-group-upsert
Description: Triggered when your session joins a new group or when metadata of an existing group (subject, description, etc.) is updated.

Details:
Webhook: Group Upsert

 Triggered when your session joins a new group or when metadata of an existing group (subject, description, etc.) is updated.

Code examples:
```json
{
  "event": "groups.upsert",
  "timestamp": 1633456789,
  "data": [
    {
      "jid": "123456789-987654321@g.us",
      "subject": "Group Name",
      "creation": 1633456700,
      "owner": "1234567890",
      "desc": "Group description",
      "participants": [
        {
          "jid": "1234567890",
          "isAdmin": true,
          "isSuperAdmin": true
        },
        {
          "jid": "0987654321",
          "isAdmin": false,
          "isSuperAdmin": false
        }
      ]
    }
  ]
}
```

