
# MASTER IMPLEMENTATION PROMPT + PRD

## Wasender Workflow Automation & A/B Testing Engine — V1

### Mission

Build a **small, standalone, responsive React application** for creating, executing, testing, and measuring WhatsApp workflows through **WasenderAPI**.

This is intentionally **NOT DeskcommCRM**.

Do not import DeskcommCRM.

Do not import its database.

Do not reproduce its architecture.

Do not add authentication in V1.

Do not add runtime AI in V1.

The purpose of this project is to build a reliable foundation that can later be integrated into a larger CRM.

The application must focus on exactly these capabilities:

```text
Wasender sessions
        ↓
Incoming WhatsApp events
        ↓
Keyword / phrase similarity detection
        ↓
Workflow routing
        ↓
Multiple workflow variants
        ↓
Workflow execution
        ↓
Delayed messages
        ↓
Media
        ↓
Queue
        ↓
Reply detection
        ↓
Variant attribution
        ↓
Statistics
        ↓
Inbox / conversation history
```

---

# 1. NON-NEGOTIABLE ARCHITECTURAL PRINCIPLE

Build the **smallest reliable system possible**.

Do not add:

* authentication
* users/roles
* AI
* CRM
* complicated pipeline
* RAG
* external automation platforms
* unnecessary microservices
* unnecessary cloud infrastructure
* unnecessary dependencies

The V1 must be understandable by one developer.

---

# 2. TECHNOLOGY

Use:

```text
Frontend:
React
TypeScript
@xyflow/react

Backend:
Node.js + TypeScript

Database:
SQLite

Object storage:
Cloudflare R2

WhatsApp:
WasenderAPI

Deployment:
Docker
Coolify

Repository:
GitHub
```

`@xyflow/react` should provide the visual workflow graph. React Flow's current model is based around nodes, edges and a viewport, with custom node types supported. ([React Flow][1])

---

# 3. WASENDER DOCUMENTATION MUST BE DOWNLOADED LOCALLY

Before writing the Wasender integration:

## Download and preserve the documentation.

Fetch:

[WasenderAPI llms.txt](https://www.wasenderapi.com/llms.txt?utm_source=chatgpt.com)

Do NOT repeatedly fetch the internet while developing.

Create something like:

```text
docs/
└── wasender/
    ├── llms.txt
    ├── README.md
    ├── sessions.md
    ├── authentication.md
    ├── messages.md
    ├── media.md
    ├── webhooks.md
    ├── contacts.md
    ├── groups.md
    ├── rate-limits.md
    └── capabilities.json
```

The exact structure may differ.

The important requirement is:

> **The project must contain a versioned local snapshot of the relevant Wasender documentation used to implement the integration.**

Record:

```text
documentation URL
download date
documentation version/date if available
hash of downloaded documentation
```

If the documentation changes later, the agent can deliberately refresh the snapshot.

---

# 4. EXTRACT THE COMPLETE WASENDER CAPABILITY MATRIX

Do not manually guess which Wasender functionality exists.

Parse the downloaded documentation and create a machine-readable capability registry.

For example:

```json
{
  "provider": "wasender",
  "version": "...",
  "triggers": [],
  "actions": [],
  "sessionOperations": [],
  "webhooks": [],
  "messageTypes": [],
  "mediaTypes": []
}
```

The current documentation exposes, among other things:

* session creation
* session status
* QR code
* connect/disconnect
* session restart
* message logs
* contacts
* text messages
* images
* videos
* documents
* audio
* stickers
* contact cards
* locations
* polls
* quoted messages
* message editing
* message deletion
* mark-as-read
* message information
* webhooks
* message received
* message upsert
* message sent
* message status
* message deleted
* session status
* group events
* reactions
* poll results
* calls

These must be verified against the local documentation snapshot rather than assumed. 

---

# 5. CRITICAL: EVERY WASENDER EVENT MUST BE REPRESENTABLE AS A TRIGGER

The workflow builder must have a **Wasender Trigger catalog**.

Do not hardcode only:

```text
Keyword received
```

Instead, derive the trigger catalog from the Wasender capability registry.

The UI should expose every relevant Wasender webhook/event that can logically initiate a workflow.

For example:

```text
Triggers
├── Message Received
├── Message Upsert
├── Message Sent
├── Message Status Updated
├── Message Deleted
├── Personal Message Received
├── Group Message Received
├── Contact Updated
├── Contact Upserted
├── Chat Updated
├── Chat Upserted
├── Session Status Changed
├── QR Updated
├── Reaction
├── Poll Result
├── Call Received
└── other documented triggerable events
```

Do not expose an event merely because it exists if it cannot meaningfully initiate a workflow.

Instead mark it:

```text
Supported
Not suitable as workflow trigger
Not implemented yet
```

---

# 6. EVERY WASENDER ACTION MUST BE REPRESENTABLE

Create the same concept for Actions.

Example:

```text
Actions
├── Send Text
├── Send Image
├── Send Audio
├── Send Video
├── Send Document
├── Send Sticker
├── Send Contact
├── Send Location
├── Send Poll
├── Send Quoted Message
├── Mark Message Read
├── Edit Message
├── Delete Message
├── Block Contact
├── Unblock Contact
├── Add Contact
├── etc.
```

Only expose actions actually supported by the current Wasender API.

Wasender documents multiple message types through its send-message API and separately documents `mark-message-as-read`, editing, deleting, and other operations. 

---

# 7. PROVIDER CAPABILITY REGISTRY

Create:

```text
src/providers/wasender/
```

with a capability layer.

Conceptually:

```text
WasenderProvider
├── authentication
├── sessions
├── webhooks
├── messages
├── media
├── contacts
├── groups
└── capabilities
```

The workflow builder should consume the capability registry.

This means:

```text
Wasender documentation
        ↓
Capability registry
        ↓
Trigger catalog
        ↓
Action catalog
        ↓
Workflow builder
```

The UI should never independently invent provider capabilities.

---

# 8. PAT AND SESSION API KEY

Support multiple Wasender sessions.

Store:

```text
Personal Access Token
```

separately from:

```text
Session API Key
```

Never confuse the two.

The Wasender documentation distinguishes personal access-token authentication from session bearer-token authentication. 

The application must explicitly document the difference.

---

# 9. MULTIPLE WHATSAPP SESSIONS

The application must support:

```text
Session A → WhatsApp Number A

Session B → WhatsApp Number B

Session C → WhatsApp Number C
```

Each session must have:

```text
id
name
phone
status
credential reference
created_at
updated_at
```

Never mix events between sessions.

---

# 10. SESSION MANAGEMENT

The UI should allow:

```text
Add Session
Connect Session
View QR
View Status
Disconnect
Restart
Delete
```

Wasender documents session creation, QR retrieval, connection, status, restart and disconnect operations. 

---

# 11. WORKFLOW BUILDER

Use:

```text
@xyflow/react
```

The workflow canvas should work like a lightweight n8n-style builder.

Example:

```text
┌───────────────┐
│ Trigger       │
│ Keyword       │
└───────┬───────┘
        ↓
┌───────────────┐
│ Send Text     │
└───────┬───────┘
        ↓
┌───────────────┐
│ Wait          │
│ Random 30-60s │
└───────┬───────┘
        ↓
┌───────────────┐
│ Send Audio    │
└───────┬───────┘
        ↓
┌───────────────┐
│ Wait 2-5 min  │
└───────┬───────┘
        ↓
┌───────────────┐
│ Send Image    │
└───────────────┘
```

The builder must support:

* drag nodes
* connect nodes
* delete nodes
* configure nodes
* save workflow
* activate workflow
* deactivate workflow
* duplicate workflow
* test workflow

---

# 12. WORKFLOW NODES

V1 should minimally support:

### Trigger

```text
Wasender event
```

### Keyword/Phrase Match

```text
phrase
threshold
```

### Send Text

```text
text
```

### Send Media

```text
image
audio
video
document
sticker
```

where supported.

### Delay

```text
fixed:
30 seconds

random:
minimum = 30 seconds
maximum = 90 seconds
```

### End

```text
END
```

Additional Wasender actions should be added progressively from the capability registry.

---

# 13. RANDOM DELAYS

The delay node must support:

```text
Fixed
```

and:

```text
Random
```

Example:

```text
minimum: 30 seconds
maximum: 90 seconds
```

The scheduler selects:

```text
random(30,90)
```

seconds.

The actual selected delay must be persisted for the execution.

---

# 14. TIME MUST BE TESTABLE

Automated tests must NOT wait 90 real seconds.

Use an injectable clock / scheduler abstraction.

Production:

```text
real time
```

Testing:

```text
fake time
```

Example:

```text
workflow says wait 90 seconds

test:
advance clock 90 seconds

execution continues
```

---

# 15. KEYWORD / PHRASE MATCHING

The trigger system must support:

```text
exact phrase
```

and:

```text
similarity threshold
```

Example:

```text
Target:
"I want to know the price"

Threshold:
80%
```

Incoming:

```text
"hello I want to know your price"
```

If similarity ≥ 80%:

```text
MATCH
```

---

# 16. SENTENCES, NOT JUST WORDS

The matcher must work with:

```text
single keyword
```

and:

```text
sentence
```

and:

```text
keyword embedded inside a sentence
```

Examples:

```text
"price"

"what is the price?"

"I saw your Facebook advert and want to know the price"
```

The trigger configuration must allow:

```text
Target phrase
Threshold
```

---

# 17. MULTIPLE TRIGGER ROUTING

Example:

```text
Incoming message
        ↓
Trigger engine
        │
        ├── ≥90% "price"
        │       ↓
        │   Experiment A
        │
        ├── ≥85% "interested"
        │       ↓
        │   Experiment B
        │
        └── ≥80% "delivery"
                ↓
            Experiment C
```

The system must define deterministic conflict behavior if multiple triggers match.

For V1:

> Highest similarity wins.

If similarity is equal:

> Highest configured priority wins.

---

# 18. MARK MESSAGE AS READ

This is mandatory.

When an incoming message arrives:

```text
Wasender webhook
       ↓
Persist incoming message
       ↓
Mark message as read
       ↓
Evaluate trigger
       ↓
Execute workflow
```

The application must use Wasender's documented **Mark Message as Read** operation. Wasender exposes `POST /api/messages/read` for this purpose. 

Do NOT mark a message as read before it has been safely persisted.

The system must guarantee:

```text
received
→ persisted
→ read acknowledgement attempted
```

If marking read fails, workflow processing should still have deterministic behavior and the error must be recorded.

---

# 19. INBOX

Build a simple inbox.

Navigation:

```text
Inbox
```

Then:

```text
Session 1
├── Customer A
├── Customer B
└── Customer C

Session 2
├── Customer X
├── Customer Y
└── Customer Z
```

The inbox must show:

* customer
* number
* last message
* timestamp
* session
* unread/read status
* active workflow
* workflow status

---

# 20. CONVERSATION VIEW

When selecting a customer:

```text
┌──────────────────────────────┐
│ Customer                     │
├──────────────────────────────┤
│ Customer message             │
│                              │
│ Workflow A → sent            │
│                              │
│ Customer reply               │
│                              │
│ Workflow A → step 2          │
└──────────────────────────────┘
```

Each message must display:

```text
direction
timestamp
content
media
session
workflow
workflow execution
variant
status
```

---

# 21. WORKFLOW EXECUTION STATUS

Every workflow execution must have a state.

Example:

```text
QUEUED
RUNNING
WAITING
COMPLETED
FAILED
CANCELLED
PAUSED
```

The inbox must show whether the workflow was:

```text
not started
queued
running
waiting
completed
failed
```

---

# 22. INDEPENDENT WORKFLOW EXECUTIONS

This is critical.

If:

```text
Customer A
```

starts Workflow A:

```text
Workflow A
WAIT 5 minutes
```

and:

```text
Customer B
```

starts Workflow B:

```text
Workflow B
SEND MESSAGE
```

Customer B must NOT wait for Customer A's five-minute delay.

The architecture must therefore use independent workflow execution records.

Conceptually:

```text
Execution A
WAITING

Execution B
RUNNING

Execution C
RUNNING
```

---

# 23. QUEUE SYSTEM

Implement a persistent queue.

The queue must manage:

```text
workflow execution
message action
scheduled_at
priority
session
recipient
status
attempt count
```

A delayed workflow should not block the worker.

Bad architecture:

```text
worker
 ↓
sleep 5 minutes
 ↓
send
```

Correct architecture:

```text
database
 ↓
scheduled job
 ↓
worker checks due jobs
 ↓
execute
```

---

# 24. GLOBAL OUTBOUND RATE LIMIT

For safety, V1 must enforce:

> **At least 5 seconds between outbound WhatsApp message sends per WhatsApp session.**

This is an **application safety policy**, not a claim about Wasender's official rate limit.

Wasender has its own rate-limit behavior which must also be respected. 

Therefore:

```text
Session A
Message → t=0
Message → t=5+
Message → t=10+
```

while:

```text
Session B
Message → t=0
```

can proceed independently.

The rate limiter must therefore be **session-scoped**.

---

# 25. QUEUE EXAMPLE

If:

```text
Customer A → Workflow A
Customer B → Workflow B
Customer C → Workflow C
```

all become ready simultaneously:

```text
Session A
   ↓
Message A
   ↓
wait ≥5 sec
   ↓
Message B
   ↓
wait ≥5 sec
   ↓
Message C
```

But the workflow state machines remain independent.

Only the outbound send operation is serialized by the session rate limiter.

---

# 26. RETRIES

If Wasender returns an error:

```text
FAILED
```

must not automatically mean:

```text
send again immediately
```

The queue must distinguish:

```text
retryable
non-retryable
unknown
```

and respect provider rate limits.

Every retry must be idempotency-aware to minimize duplicate messages.

---

# 27. INCOMING MESSAGE LOGGING

Every incoming message must be persisted.

Minimum:

```text
messages
├── id
├── session_id
├── contact_id
├── direction
├── provider_message_id
├── message_type
├── text
├── media_id
├── timestamp
├── raw_event_reference
└── created_at
```

Do not unnecessarily store giant duplicated payloads.

Store the normalized message plus enough raw data/reference for debugging.

---

# 28. OUTGOING MESSAGE LOGGING

Every outgoing message must also be persisted.

Record:

```text
session
contact
workflow
execution
node
variant
provider message ID
status
timestamp
```

This is what makes reply attribution possible.

---

# 29. VARIANT / WORKFLOW EXPERIMENTS

An experiment consists of:

```text
Experiment
├── Workflow A
├── Workflow B
├── Workflow C
└── Workflow N
```

Every workflow must have:

```text
name
description
active/inactive
experiment_id
```

---

# 30. AUTOMATIC DISTRIBUTION

When a trigger matches:

```text
Incoming message
        ↓
Experiment
        ↓
A / B / C
```

The system automatically assigns the customer.

V1 should support:

```text
equal distribution
```

Example:

```text
100 customers

A = 33
B = 33
C = 34
```

---

# 31. STICKY ASSIGNMENT

Once a customer is assigned:

```text
Customer 123 → Workflow B
```

they remain associated with Workflow B for that experiment.

This is necessary for meaningful attribution.

---

# 32. REPLY ATTRIBUTION

If:

```text
Customer
 ↓
Workflow B
 ↓
Message
 ↓
Customer replies
```

the reply must be attributed to:

```text
Workflow B
```

The system must record:

```text
experiment
workflow
execution
variant
original message
reply message
```

---

# 33. PRIMARY V1 KPI

The primary statistic is:

> **Reply Rate**

Formula:

```text
reply rate =
customers who replied
/
customers assigned
```

Display:

```text
Workflow A
Assigned: 100
Replies: 24
Reply rate: 24%

Workflow B
Assigned: 100
Replies: 38
Reply rate: 38%

Workflow C
Assigned: 100
Replies: 17
Reply rate: 17%
```

Do not claim statistical significance in V1.

---

# 34. MEDIA STORAGE

Use Cloudflare R2.

Cloudflare documents R2 as S3-compatible, allowing standard S3 SDKs to be used. ([Cloudflare Docs][2])

Store:

```text
R2
├── images/
├── audio/
├── video/
├── documents/
└── other/
```

The database stores metadata:

```text
media_assets
├── id
├── filename
├── mime_type
├── size
├── r2_key
├── hash
├── created_at
```

---

# 35. FILE PREVIEW

When a file is uploaded, the UI must immediately allow preview where technically possible.

Examples:

```text
image → image preview

audio → audio player

video → video player

PDF → PDF preview

document → metadata + download
```

The application should not expose permanent private storage credentials.

Cloudflare recommends presigned URLs for temporary direct access to individual R2 objects. ([Cloudflare Docs][3])

---

# 36. DOWNLOAD MEDIA

Every uploaded asset must have:

```text
Preview
Download
Delete
```

where appropriate.

The application should generate temporary signed URLs for private objects rather than exposing R2 credentials. Presigned URLs can grant temporary GET/PUT access to specific objects. ([Cloudflare Docs][3])

---

# 37. WASENDER MEDIA COMPATIBILITY

Before sending media, the Wasender adapter must validate:

```text
mime type
file availability
URL accessibility
file size where applicable
supported media type
```

The media must be converted into the exact format required by the corresponding Wasender action.

Wasender documents media upload as well as sending image, video, audio, document and other message types. 

Do not let the workflow engine know Wasender-specific HTTP details.

---

# 38. DOCUMENTATION SNAPSHOTS FOR ALL EXTERNAL SERVICES

Do not only download Wasender documentation.

Create:

```text
docs/
├── wasender/
├── cloudflare-r2/
├── react-flow/
├── docker/
└── deployment/
```

For every external service that materially affects implementation:

1. Retrieve official documentation.
2. Store relevant documentation locally.
3. Record source URL.
4. Record retrieval date.
5. Record version if available.
6. Use local documentation during implementation.
7. Refresh deliberately when needed.

Examples:

### Wasender

[Wasender documentation](https://www.wasenderapi.com/llms.txt?utm_source=chatgpt.com)

### Cloudflare R2

[Cloudflare R2 documentation](https://developers.cloudflare.com/r2/?utm_source=chatgpt.com)

### React Flow

[React Flow documentation](https://reactflow.dev/learn?utm_source=chatgpt.com)

### Docker

[Docker volumes documentation](https://docs.docker.com/engine/storage/volumes/?utm_source=chatgpt.com)

The agent should prefer official documentation for each service.

---

# 39. LOCAL DOCUMENTATION INDEX

Create:

```text
docs/INDEX.md
```

Example:

```text
Wasender
├── Authentication
├── Sessions
├── Webhooks
├── Messages
├── Media
├── Contacts
└── Rate limits

Cloudflare R2
├── S3 compatibility
├── Upload
├── Download
├── Presigned URLs
└── Security

React Flow
├── Nodes
├── Edges
├── Custom nodes
└── Interaction

Docker
├── Images
├── Containers
├── Volumes
└── Deployment
```

---

# 40. NO RUNTIME WEB DEPENDENCY FOR DOCUMENTATION

The application must never fetch documentation from the web to operate.

Documentation is developer knowledge, not a runtime dependency.

---

# 41. DATABASE

Use SQLite.

Suggested tables:

```text
sessions

contacts

conversations

messages

media_assets

workflows

workflow_nodes

workflow_edges

workflow_executions

workflow_execution_events

experiments

experiment_variants

experiment_assignments

scheduled_jobs

outbound_queue

```

Do not blindly copy this schema.

Design the smallest normalized schema that satisfies the requirements.

---

# 42. EVENT MODEL

Persist important events.

Examples:

```text
message_received
message_read
trigger_matched
workflow_assigned
workflow_started
workflow_waiting
workflow_resumed
message_queued
message_sent
message_delivered
message_read
customer_replied
workflow_completed
workflow_failed
```

This creates an audit trail for statistics and debugging.

---

# 43. PROGRAMMATIC WORKFLOW CREATION

The backend must expose an API that allows a coding agent to create workflows.

Example conceptual request:

```json
{
  "name": "Variant A",
  "experimentId": "exp-001",
  "nodes": [
    {
      "type": "trigger",
      "config": {}
    },
    {
      "type": "send_text",
      "config": {
        "text": "Hello!"
      }
    },
    {
      "type": "delay",
      "config": {
        "mode": "random",
        "minSeconds": 30,
        "maxSeconds": 90
      }
    },
    {
      "type": "send_audio",
      "config": {
        "mediaId": "..."
      }
    }
  ]
}
```

The exact schema is implementation-defined.

---

# 44. VISUAL AND PROGRAMMATIC WORKFLOWS MUST USE THE SAME ENGINE

This is mandatory.

```text
Visual Builder
      ↓
Workflow Definition
      ↓
Workflow Engine
```

and:

```text
API / Coding Agent
      ↓
Workflow Definition
      ↓
Workflow Engine
```

must converge.

Do NOT build two separate workflow systems.

---

# 45. EXTERNAL AI CODING AGENTS

Claude Code/OpenCode may later interact with the application API.

They can:

```text
create workflows
duplicate workflows
modify workflows
create experiments
upload media
associate media
activate/deactivate workflows
inspect statistics
```

But they must use the application's API.

They must not manipulate SQLite directly during normal operation.

---

# 46. INBOX + EXPERIMENT CONNECTION

The conversation view should display:

```text
Customer
Session
Experiment
Assigned Workflow
Current Execution
Current Step
```

Example:

```text
Customer: +237...
Session: Number 1
Experiment: Facebook Price Test
Workflow: Variant B
Status: Waiting
Next action: Audio
Next execution: 14:32
```

---

# 47. RESPONSIVE UI

The application must work on:

```text
Desktop
Tablet
Mobile
```

At minimum:

### Desktop

Full workflow canvas.

### Tablet

Responsive canvas with collapsible side panels.

### Mobile

Workflow builder remains usable, but may switch to a simplified node configuration interface.

Do not merely shrink the desktop UI.

---

# 48. NO LOGIN IN V1

There is intentionally no authentication in this first version.

However:

> The application must NOT be exposed publicly without protection.

It should be deployed behind the user's private environment / controlled subdomain / network access.

If authentication is introduced later, it should be added without rewriting the application.

---

# 49. "NO LOGGING" CLARIFICATION

Do not implement an external user-facing logging dashboard.

But **internal operational event records are mandatory** because workflow execution, statistics and debugging depend on them.

Therefore:

```text
No:
external logging platform
centralized log SaaS
unnecessary logging service

Yes:
SQLite workflow execution events
SQLite message history
application error logs
```

Do not send customer message content to an external logging service.

---

# 50. SECURITY

Never commit:

```text
Wasender PAT
Wasender session keys
R2 access keys
R2 secrets
webhook secrets
```

Use environment variables.

Never expose provider credentials to the React frontend.

Architecture:

```text
React
 ↓
Backend
 ↓
Wasender
```

not:

```text
React
 ↓
Wasender using secret credential
```

---

# 51. WEBHOOK SECURITY

Wasender webhooks must be validated according to the official documentation.

The agent must inspect the local Wasender documentation for:

* authentication
* signature verification
* headers
* event structure
* replay/duplicate behavior

Do not accept arbitrary webhook payloads blindly.

---

# 52. IDEMPOTENCY

Webhook events may be delivered more than once.

Therefore:

```text
provider_event_id
```

or an equivalent deterministic identifier must be used to prevent duplicate processing.

Example:

```text
same Wasender event
→ received twice
→ stored once
→ workflow triggered once
```

---

# 53. DUPLICATE WORKFLOW EXECUTION PROTECTION

If the same incoming message is received twice:

```text
Customer message
        ↓
Trigger
```

the system must not create two workflow executions.

This must be explicitly tested.

---

# 54. QUEUE CONCURRENCY TEST

Test:

```text
Customer A → Workflow A
Customer B → Workflow B
Customer C → Workflow C
Customer D → Workflow D
```

simultaneously.

Verify:

```text
A does not block B
B does not block C
C does not block D
```

while the session-level outbound limiter still ensures:

```text
send
≥5 sec
send
≥5 sec
send
```

---

# 55. TWO-NUMBER REAL-WORLD TEST

After automated testing:

```text
Wasender Session A → WhatsApp Number A
Wasender Session B → WhatsApp Number B
```

Use the two controlled numbers to test:

```text
A → B keyword
B → workflow

A → B reply

B → A keyword
A → workflow

B → A reply
```

Test multiple workflows.

Example:

```text
Workflow A
Workflow B
Workflow C
```

Then verify:

```text
reply A → attributed A
reply B → attributed B
reply C → attributed C
```

---

# 56. PROGRAMMATIC STRESS TEST

Before real WhatsApp:

Generate:

```text
100 simulated contacts
```

Then:

```text
100 incoming events
```

with:

```text
Workflow A
Workflow B
Workflow C
```

Verify:

* assignments
* queues
* delays
* rate limiting
* executions
* replies
* statistics
* no cross-customer contamination

---

# 57. WORKFLOW ISOLATION

Customer A must never receive:

```text
Customer B's
text
audio
image
video
workflow
```

Test media specifically.

---

# 58. SESSION ISOLATION

Session A must never send using:

```text
Session B's credentials
```

Test this explicitly.

---

# 59. FAILURE TESTS

Simulate:

```text
Wasender timeout
Wasender 401
Wasender rate limit
Wasender unavailable
invalid session
R2 unavailable
media missing
SQLite locked
duplicate webhook
workflow malformed
```

The application must fail gracefully.

---

# 60. PHASED IMPLEMENTATION

Do NOT build everything at once.

## V1.0

Build:

```text
React UI
SQLite
Wasender sessions
Wasender webhook
Inbox
Text workflow
Fixed/random delay
Queue
5-second session limiter
Basic statistics
```

Test.

---

## V1.1

Add:

```text
Media
R2
Preview
Download
Audio/video/image/document
```

Test.

---

## V1.2

Add:

```text
Keyword similarity
phrase matching
thresholds
routing
```

Test.

---

## V1.3

Add:

```text
Experiments
multiple workflows
automatic distribution
sticky assignment
reply attribution
```

Test.

---

## V1.4

Add:

```text
Complete Wasender trigger catalog
Complete relevant Wasender action catalog
```

Test.

---

## V1.5

Add:

```text
Programmatic workflow API
bulk workflow creation
workflow import/export
```

Test.

---

# 61. EACH VERSION MUST HAVE A WORKING CHECKPOINT

Never proceed:

```text
V1.0
 ↓
add everything
 ↓
debug disaster
```

Instead:

```text
V1.0
 ↓
E2E test
 ↓
PASS
 ↓
checkpoint

V1.1
 ↓
E2E test
 ↓
PASS
 ↓
checkpoint

V1.2
 ↓
E2E test
 ↓
PASS
 ↓
checkpoint
```

---

# 62. QA

Use automated testing at multiple levels.

### Unit tests

Test:

```text
similarity
delay calculation
variant assignment
statistics
rate limiter
queue
workflow state machine
```

### Integration tests

Test:

```text
SQLite
R2
Wasender adapter
webhook processing
queue
```

### E2E tests

Test:

```text
UI
workflow creation
activation
incoming message
workflow execution
inbox
statistics
```

### Real WhatsApp tests

Use the two controlled numbers.

---

# 63. PLAYWRIGHT UI TEST

The QA agent must operate the application like a human.

It must:

```text
open application
create session
create workflow
drag node
connect node
configure node
upload file
preview file
save workflow
activate workflow
create experiment
inspect inbox
inspect statistics
```

Do not only test APIs.

---

# 64. WORKFLOW BUILDER QA

The QA agent must verify visually:

```text
Node appears
Node can move
Node can connect
Node configuration opens
Node configuration saves
Node can be deleted
Edges persist
Workflow reloads correctly
Workflow executes according to graph
```

React Flow's architecture explicitly models flows as nodes and edges, so the persisted workflow representation must preserve those relationships. ([React Flow][4])

---

# 65. FINAL ACCEPTANCE TEST

The complete V1 must demonstrate:

```text
Multiple Wasender sessions
        ↓
Incoming webhook
        ↓
Message persisted
        ↓
Message marked read
        ↓
Keyword/phrase matched
        ↓
Experiment selected
        ↓
Workflow A/B/C selected
        ↓
Execution queued
        ↓
Delay respected
        ↓
Outbound limiter respected
        ↓
Message sent
        ↓
Media sent correctly
        ↓
Customer reply received
        ↓
Reply attributed to correct workflow
        ↓
Statistics updated
        ↓
Inbox displays everything
```

while simultaneously allowing:

```text
Customer A workflow running
Customer B workflow waiting
Customer C workflow running
```

without one blocking another.

---

# 66. FINAL ARCHITECTURE

The target architecture should be approximately:

```text
                   ┌────────────────────┐
                   │   React UI         │
                   │                    │
                   │ @xyflow/react      │
                   │ Inbox              │
                   │ Sessions           │
                   │ Statistics         │
                   └─────────┬──────────┘
                             │
                             ▼
                   ┌────────────────────┐
                   │    Backend API     │
                   ├────────────────────┤
                   │ Wasender Adapter   │
                   │ Webhook Processor  │
                   │ Trigger Engine     │
                   │ Workflow Engine    │
                   │ Experiment Engine  │
                   │ Queue              │
                   │ Rate Limiter       │
                   │ Reply Attribution  │
                   └───────┬───────┬────┘
                           │       │
                 ┌─────────┘       └─────────┐
                 ▼                           ▼
          ┌──────────────┐            ┌──────────────┐
          │    SQLite    │            │ Cloudflare R2│
          │              │            │              │
          │ messages     │            │ media        │
          │ workflows    │            │ audio        │
          │ executions   │            │ video        │
          │ experiments  │            │ images       │
          └──────────────┘            └──────────────┘
                 │
                 ▼
          ┌────────────────┐
          │  Wasender API  │
          ├────────────────┤
          │ Session A      │
          │ Session B      │
          │ Session C      │
          └────────────────┘
```

---

# 67. THE MOST IMPORTANT RULE

Do not build a generic automation platform.

Build:

> **A Wasender-native workflow experimentation engine.**

But architect the internal workflow model cleanly enough that a future provider adapter can be introduced.

The V1 success criterion is not how many features we can add.

It is:

> **Can two real WhatsApp numbers independently receive triggers, execute different workflows, send different media with controlled delays, handle concurrent executions, respect the outbound safety limiter, record every interaction, attribute replies to the correct workflow, and produce trustworthy reply-rate statistics?**

If yes, V1 is successful.

If no, **do not add more features. Fix the foundation first.**

[1]: https://reactflow.dev/learn?utm_source=chatgpt.com "Quick Start - React Flow"
[2]: https://developers.cloudflare.com/r2/get-started/s3/?utm_source=chatgpt.com "S3 · Cloudflare R2 docs"
[3]: https://developers.cloudflare.com/r2/api/s3/presigned-urls/?utm_source=chatgpt.com "Presigned URLs · Cloudflare R2 docs"
[4]: https://reactflow.dev/learn/concepts/building-a-flow?utm_source=chatgpt.com "Building a Flow - React Flow"

