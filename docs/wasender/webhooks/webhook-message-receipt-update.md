# Webhook: Message Receipt Update

> Source: https://www.wasenderapi.com/api-docs/webhooks/webhook-message-receipt-update
> Category: Webhooks
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/webhooks/webhook-message-receipt-update
Description: Event triggered specifically for message receipt status changes.

Details:
Webhook Event: message-receipt.update

 This event is triggered specifically for message receipt status updates within group chats, such as sent, delivered, or read by individual group members. The payload includes the updated receipt status and the message key identifying the message.

 See the code example below for a typical payload structure.

Code examples:
```json ( receipt )
{
  "event": "message-receipt.update",
  "sessionId": "your_session_id_here",
  "data": {
    "message": {
      "key": {
        "remoteJid": "group_jid_here@g.us",
        "id": "message_id_here",
        "fromMe": true,
        "participant": "participant_jid_here"
      },
      "receipt": {
        "userJid": "participant_jid_here",
        "receiptTimestamp": 1234567890
      }
    }
  },
  "timestamp": 1234567890123
}
```
```json ( read )
{
  "event": "message-receipt.update",
  "sessionId": "your_session_id_here",
  "data": {
    "message": {
      "key": {
        "remoteJid": "group_jid_here@g.us",
        "id": "message_id_here",
        "fromMe": true,
        "participant": "participant_jid_here"
      },
      "receipt": {
        "userJid": "participant_jid_here",
        "readTimestamp": 1234567890
      }
    }
  },
  "timestamp": 1234567890123
}
```

