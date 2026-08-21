# Webhook: Message Upsert

> Source: https://www.wasenderapi.com/api-docs/webhooks/webhook-message-upsert
> Category: Webhooks
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/webhooks/webhook-message-upsert
Description: Event is triggered for all messages in your session, both incoming and outgoing. To listen only for incoming events, please refer to messages.received.

Details:
Webhook Event: messages.upsert
 This event is triggered for all messages in your session, both incoming and outgoing. To listen only for incoming events, please refer to messages.received. The payload includes the message content, sender information, and message key.
 See the code example below for a typical payload structure.
 To learn more about handling media in this event, please refer to the help center article on handling media messages.

Code examples:
```json
{
  "event": "messages.upsert",
  "timestamp": 1633456789,
  "data": {
    "messages": [
      {
        "key": {
          "id": "message-id-123",
          "fromMe": false,
          // This can be a LID (e.g., "123456@lid") depending on the addressing mode.
          "remoteJid": "5551234567@s.whatsapp.net", 
          // Use these fields for phone number logic:
          "senderPn": "5551234567@s.whatsapp.net",
          "cleanedSenderPn": "5551234567",
          // This will match remoteJid if remoteJid is already an LID
          "senderLid": "123456789@lid",
          "addressingMode": "pn"
        },
        "messageBody": "Hello!",
        "message": {
          "conversation": "Hello!"
        }
      }
    ]
  }
}
```

