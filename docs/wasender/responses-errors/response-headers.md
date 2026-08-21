# Response Headers

> Source: https://www.wasenderapi.com/api-docs/responses-errors/response-headers
> Category: Responses & Errors
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/responses-errors/response-headers
Description: Information about standard headers included in API responses, particularly rate limiting.

Details:
Response Headers

 API responses include standard HTTP headers. Some important headers, especially related to rate limiting, are:

 - Content-Type: Typically application/json.

 - X-RateLimit-Limit: Max requests per window.

 - X-RateLimit-Remaining: Remaining requests in window.

 - X-RateLimit-Reset: Timestamp (seconds) when the window resets.

Parameters:
- X-RateLimit-Limit (integer, optional): The maximum number of requests allowed per time window.
- X-RateLimit-Remaining (integer, optional): The number of requests remaining in the current time window.
- X-RateLimit-Reset (integer, optional): The time in seconds until the rate limit resets.
- Content-Type (string, optional): Usually `application/json`.

