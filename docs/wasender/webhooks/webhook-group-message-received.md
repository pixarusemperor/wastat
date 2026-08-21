# Webhook: Group Message Received

> Source: https://www.wasenderapi.com/api-docs/webhooks/webhook-group-message-received
> Category: Webhooks
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/webhooks/webhook-group-message-received
Description: Event is triggered when a message is received in any group the session is a part of.

Details:
Webhook Event: messages-group.received

 This event is triggered whenever a new message is received in a group that your session is a member of. The payload is similar to a direct message but critically includes the remoteJid of the group and the participant JID of the actual sender.

 The payload includes the message content, the group's JID, the sender's JID, and the message key.

 To learn more about handling media in this event, please refer to the help center article on handling media messages.

Code examples:
```json
{
  "event": "messages-group.received",
  "timestamp": 1633456799,
  "data": {
    "messages":
      {
        "key": {
          "id": "message-id-group-456",
          "fromMe": false,
          "remoteJid": "123456789-987654321@g.us",
          "participant": "123456789@lid",
          "participantPn": "123456789@s.whatsapp.net",
          "cleanedParticipantPn": "123456789",
          "participantLid": "123456789@lid", 
          "addressingMode": "lid"
        },
        "messageBody": "Hey everyone, just checking in!",
        "message": {
          "conversation": "Hey everyone, just checking in!"
        }
      }
  }
}
```

