# Webhook: Personal Message Received

> Source: https://www.wasenderapi.com/api-docs/webhooks/webhook-personal-message-received
> Category: Webhooks
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/webhooks/webhook-personal-message-received
Description: Event is triggered when a message is received in a personal (one-to-one) chat.

Details:
Webhook Event: messages-personal.received

 This event is triggered when a new message is received in a direct, one-to-one conversation with a contact.

 The payload includes the message content and the sender's JID in the remoteJid field. This event is distinct from group or newsletter messages.

 To learn more about handling media in this event, please refer to the help center article on handling media messages.

Code examples:
```json
{
  "event": "messages-personal.received",
  "timestamp": 1633456789,
  "data": {
    "messages":
      {
        "key": {
          "id": "3EB0X123456789",
          "fromMe": false,
          "remoteJid": "1234567890@s.whatsapp.net",
          "addressingMode": "pn", 
          "senderPn": "1234567890@s.whatsapp.net",
          "cleanedSenderPn": "1234567890",
          "senderLid": "555555555@lid"
        },
        "messageBody": "Hello, I have a question",
        "message": {
          "conversation": "Hello, I have a question"
        }
      }
  }
}
```

