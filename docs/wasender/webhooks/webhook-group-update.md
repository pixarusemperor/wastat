# Webhook: Group Update

> Source: https://www.wasenderapi.com/api-docs/webhooks/webhook-group-update
> Category: Webhooks
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/webhooks/webhook-group-update
Description: Triggered for other group-related updates, such as changes to group settings like announce mode or restrict mode by an admin.

Details:
Webhook: Group Update

 Triggered for other group-related updates, such as changes to group settings like announce mode or restrict mode by an admin.

Code examples:
```json
{
  "event": "groups.update",
  "timestamp": 1633456789,
  "data": [
    {
      "jid": "123456789-987654321@g.us",
      "announce": true,
      "restrict": false
    }
  ]
}
```

