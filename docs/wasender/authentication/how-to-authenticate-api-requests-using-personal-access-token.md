# How to Authenticate API Requests Using Personal Access Token

> Source: https://www.wasenderapi.com/api-docs/authentication/how-to-authenticate-api-requests-using-personal-access-token
> Category: Authentication
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/authentication/how-to-authenticate-api-requests-using-personal-access-token
Description: This guide explains how to authenticate API requests using a Bearer Token, generated from your settings - personal access token page.

Details:
Authentication
 To authenticate account-level requests on WasenderAPI, you must use a Personal Access Token.
 What Is a Personal Access Token?
 A Personal Access Token (PAT) is used to authorize access to your account-level endpoints, such as:
 - Creating or deleting WhatsApp sessions
 - Listing all existing sessions
 - Accessing user account information

 Where to Get It
 You can generate and manage your Personal Access Token from the Settings > Personal Access Token page in your Wasender dashboard.
 Authorization Header Format
 Include your token in the Authorization header of your HTTP requests using the following format:
 Authorization: Bearer YOUR_PERSONAL_ACCESS_TOKEN
 Replace YOUR_PERSONAL_ACCESS_TOKEN with the token you obtained from the settings page.
 ⚠️ Your Personal Access Token provides full access to your account. Keep it confidential and avoid sharing or exposing it in public code repositories or frontend code.

Parameters:
- Authorization (string, required): Bearer token obtained from the settings - personal access token page . Format: Bearer YOUR_PERSONAL_ACCESS_TOKEN

Response examples:
No API KEY Response:
```json
{
 "success": false,
 "message": "Unnotarized"
}
```

