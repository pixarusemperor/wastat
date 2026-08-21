# Webhook: Message Status Update

> Source: https://www.wasenderapi.com/api-docs/webhooks/webhook-message-update
> Category: Webhooks
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/webhooks/webhook-message-update
Description: Event triggered when a message's status is updated (e.g., delivered, read).

Details:
Webhook Event: messages.update

 Triggered when a message's status is updated (e.g., delivered, read). The payload contains the updated status and message key.

 See the code example below for the typical payload structure.

 Status Codes

 Status Code
 Description
 Explanation

 0
 ERROR
 The message failed to send due to an error.

 1
 PENDING
 The message is queued and waiting to be sent.

 2
 SENT
 The message has been sent from the server but not yet delivered.

 3
 DELIVERED
 The message has reached the recipient’s device.

 4
 READ
 The recipient has opened and read the message.

 5
 PLAYED
 The recipient has played the media message (e.g., audio or video).

Code examples:
```json
{
  "event": "messages.update",
  "sessionId": "your_api_key",
  "data": {
    "update": {
      "status": 2
    },
    "key": {
      "remoteJid": "123456789@s.whatsapp.net",
      "id": "34874643876",
      "fromMe": false
    }
  },
  "timestamp": 1747775431467
}
```

