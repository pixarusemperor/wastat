# n8n Integration (Community Node)

> Source: https://www.wasenderapi.com/api-docs/getting-started/n8n-integration-community-node
> Category: Getting Started
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/getting-started/n8n-integration-community-node
Description: Easily automate your WhatsApp workflows using our official n8n community node. Extremely user-friendly with no API knowledge required.

Details:
n8n Community Node Integration

 We are thrilled to announce our official n8n Community Node! This node makes it incredibly easy to integrate WasenderAPI into your n8n workflows. It is extremely user-friendly and completely bypasses the need for deep API knowledge or complex HTTP requests.

 NPM Package: n8n-nodes-wasenderapi

 1. Get Your Personal Access Token

 To use the n8n node, you need to authenticate using your Personal Access Token. This token allows the node to manage your sessions, fetch dynamic lists, and send messages seamlessly behind the scenes.

 Important: Do not use a Session API Key for the n8n node. You must use the Personal Access Token.

 - Log into your WasenderAPI dashboard.

 - Navigate to Settings > Personal Access Token.

 - Click Generate to create a new token.

 - Copy the token and keep it secure. You will need this to set up your credentials inside n8n.

 2. Install the Node in n8n

 Installing a community node in n8n is quick and easy directly from the UI:

 - Open your n8n instance.

 - Navigate to Settings (the gear icon on the left sidebar) > Community Nodes.

 - Click Install a community node.

 - Enter the exact package name: n8n-nodes-wasenderapi

 - Check the "I understand the risks" acknowledgment box and click Install.

 Self-hosted Docker users: If you prefer managing nodes via environment variables, you can install it by adding n8n-nodes-wasenderapi to your N8N_CUSTOM_EXTENSIONS variable.

 3. Using the Node in Your Workflow

 Once installed, you can start building powerful automations immediately!

 - Open a workflow and click the + Add node button.

 - Search for WasenderAPI and add it to your canvas.

 - Click on the node to open its configuration panel.

 - Under Credentials, select "Create New Credential". Paste the Personal Access Token you generated in Step 1.

 - Select the Resource (e.g., Message, Session, Contact, Group) and the Operation (e.g., Send Message, Create Session) you want to perform.

 - Fill in the required fields. The node will dynamically load your active sessions, making it just a matter of pointing and clicking!

