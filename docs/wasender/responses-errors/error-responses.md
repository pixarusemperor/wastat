# Error Responses

> Source: https://www.wasenderapi.com/api-docs/responses-errors/error-responses
> Category: Responses & Errors
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/responses-errors/error-responses
Description: Common error responses returned by the API.

Details:
Error Responses

 If an API request fails, the response will contain an error message and a relevant HTTP status code. Common error scenarios are listed below.

 The error response body typically follows this structure:

 {
 "message": "Error description",
 "errors": { // Optional: More specific field errors
 "field_name": ["Error details"]
 }
}

Response examples:
Validation Error:
```json
{
    "success": false,
    "message": "Validation failed",
    "errors": {
        "to": [
            "The to field is required."
        ],
        "text": [
            "The text field is required when no media is present."
        ]
    }
}
```
Authentication Error:
```json
{
  "success": false,
  "message": "Invalid API key"
}
```
No Active Subscription Error:
```json
{
  "success": false,
  "message": "Active subscription or trial is required to use the API"
}
```
Trial Bulk Limit Error:
```json
{
  "success": false,
  "message": "You are on a trial plan and cannot send bulk message to more than 3 recipients."
}
```
Rate Limit Error (Trial):
```json
{
  "message": "You are on a free trial. You can only send 1 message every 1 minute.",
  "retry_after": 60
}
```
Rate Limit Error (Account Protection):
```json
{
  "message": "You have account protection enabled. You can only send 1 message every 5 seconds. Check our API docs: https://www.wasenderapi.com/api-docs",
  "retry_after": 5
}
```
Session is not Connected:
```json
{
    "success": false,
    "message": "Your Whatsapp Session is not connected please connect your session first."
}
```

