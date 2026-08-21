# How to Authenticate API Requests Using Bearer Tokens

> Source: https://www.wasenderapi.com/api-docs/authentication/how-to-authenticate-api-requests-using-bearer-tokens
> Category: Authentication
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/authentication/how-to-authenticate-api-requests-using-bearer-tokens
Description: This guide explains how to authenticate API requests using a Bearer Token, generated after connecting your WhatsApp session through the Session Management screen.

Details:
Authentication

 All WasenderAPI endpoints are secured and require authentication via an API Key. This API key is automatically generated when you create or restore a session from the Session Management screen.

 Obtaining Your API Key

 Once your WhatsApp session is connected, a unique API Key will be available. This API Key must be included in the Authorization header for every API request.

 Authorization Header Format

 Authorization: Bearer token YOUR_SESSION_API_KEY

 Replace YOUR_SESSION_API_KEY with the API key you received from the session screen.

 ℹ️ API Keys are tied to a specific session. If the session is deleted, the key becomes invalid.

 Keep your API Key private. Avoid exposing it in public repositories or frontend code.

Parameters:
- Authorization (string, required): Bearer token obtained after session connection. Format: Bearer YOUR_SESSION_API_JEY

Response examples:
No API KEY Response:
```json
{
 "success": false,
 "message": "API key is required"
}
```
Invalid API KEY Response:
```json
{
 "success": false,
 "message": "Invalid API key"
}
```

