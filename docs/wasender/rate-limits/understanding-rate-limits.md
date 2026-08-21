# Understanding Rate Limits

> Source: https://www.wasenderapi.com/api-docs/rate-limits/understanding-rate-limits
> Category: Rate Limits
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/rate-limits/understanding-rate-limits
Description: Details on the rate limits applied to API requests based on subscription plans.

Details:
Understanding Rate Limits

 WasenderAPI applies rate limits to keep the platform stable, ensure fair usage, and reduce the risk of WhatsApp
 restrictions or bans. Limits depend on the endpoint, your plan, and whether account protection is enabled.

 Quick Summary

 Area
 Trial
 Paid Plans

 Send Message
 1 request / minute
50 requests / day
 256 requests / minute
No daily send-message cap

 Group participants / metadata
 10 requests / minute
100 requests / day
 10 requests / minute
500 requests / day

 Contact picture
 10 requests / minute
100 requests / day
 60 requests / minute
1,000 requests / day

 Check if a number is on WhatsApp
 10 requests / minute
100 requests / day
 60 requests / minute
1,000 requests / day

 Account Protection
 Trial send-message limits still apply
 1 send-message request / 5 seconds

 Important: Limits are enforced per endpoint per session. Different endpoints have different
 thresholds because some WhatsApp actions are riskier than others.

 Message Sending Limits

 The Send Message endpoint has stricter trial limits because it is the highest-risk endpoint for
 free-account abuse and WhatsApp number safety.

 Plan / Setting
 Rate Limit
 Daily Cap
 Why

 Trial Plan
 1 request / minute
 50 requests / day
 Allows safe testing while preventing free-account spam.

 Paid Plans
(Basic, Pro, Plus, Business)
 256 requests / minute
 No daily send-message cap
 Supports high-throughput messaging while protecting the platform from traffic spikes.

 Account Protection Enabled
(Paid plans)
 1 request / 5 seconds
 No daily send-message cap

 Safety-first mode that reduces WhatsApp flag or ban risk.
 This overrides the normal paid send-message limit.

 Utility Endpoint Limits

 Utility endpoints are less restricted than trial message sending, but they are still limited because excessive
 lookups, contact picture requests, and group scraping can look suspicious to WhatsApp.

 Endpoint / Action
 Trial Limit
 Paid Plan Limit
 Risk Notes

 Get group participants / metadata
 10 requests / minute
100 requests / day
 10 requests / minute
500 requests / day

 High-risk endpoint. WhatsApp monitors group scraping heavily. Call once per group and cache
 the result.

 Get contact picture
 10 requests / minute
100 requests / day
 60 requests / minute
1,000 requests / day
 Use only when necessary. Excessive usage may trigger WhatsApp anti-abuse systems.

 Check if a number is on WhatsApp
 10 requests / minute
100 requests / day
 60 requests / minute
1,000 requests / day

 High-risk endpoint. Avoid automated or bulk usage. Repeated calls may affect both number
 checks and contact picture requests.

 Concurrent Request Limits

 In addition to per-minute and daily limits, WasenderAPI enforces a global concurrent request limit per session.
 This controls how many requests can be processed at the same time.

 Scope
 Limit Type
 Purpose

 All endpoints per session
 Concurrent request cap

 Prevents excessive parallel requests that may trigger WhatsApp anti-abuse systems, even if minute limits are
 respected.

 How Concurrent Limits Work

 - The limit applies globally across all endpoints.

 - It is enforced per WhatsApp session.

 - If too many requests are sent at the same time, additional requests may be rejected temporarily.

 - This protection applies regardless of your plan.

 High concurrency is one of the most common causes of WhatsApp number bans. We strongly recommend using a queue
 system with controlled parallelism, such as 1 to 5 concurrent workers per session.

 Rate Limit Headers

 Rate-limited API responses include headers to help you monitor usage:

 - X-RateLimit-Limit — maximum requests allowed in the current window.

 - X-RateLimit-Remaining — remaining requests before the limit is reached.

 - X-RateLimit-Reset — seconds until the current window resets.

 Endpoints with daily caps may also include:

 - X-RateLimit-Daily-Limit — maximum requests allowed for the day.

 - X-RateLimit-Daily-Remaining — remaining requests before the daily cap is reached.

 - X-RateLimit-Daily-Reset — seconds until the daily cap resets.

 Repeatedly hitting rate limits, or repeatedly triggering high-risk endpoints, may result in a temporary
 restriction of your API access while your usage is reviewed.

Parameters:
- X-RateLimit-Limit (integer, optional): The maximum number of requests allowed per time window.
- X-RateLimit-Remaining (integer, optional): The number of requests remaining in the current time window.
- X-RateLimit-Reset (integer, optional): The time in seconds until the rate limit resets.

Response examples:
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
  "message": "You have account protection enabled. You can only send 1 message every 5 seconds.",
  "retry_after": 5
}
```

## Optional

- [llms.txt proposal](https://llmstxt.org/index.md): Format reference used for this LLM-friendly documentation file.

