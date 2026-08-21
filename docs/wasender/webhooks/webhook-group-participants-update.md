# Webhook: Group Participants Update

> Source: https://www.wasenderapi.com/api-docs/webhooks/webhook-group-participants-update
> Category: Webhooks
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/webhooks/webhook-group-participants-update
Description: Triggered when participants are added, removed, promoted, or demoted in a group.

Details:
Webhook: Group Participants Update

 Triggered when participants are added, removed, promoted, or demoted in a group.

Code examples:
```json
{
  "event": "group-participants.update",
  "timestamp": 1633456789,
  "data": {
    "jid": "123456789-987654321@g.us",
    "participants": ["1234567890"],
    "action": "add" // or "remove", "promote", "demote"
  }
}
```

