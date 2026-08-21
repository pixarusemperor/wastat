# Model Context Protocol (MCP) Integration

> Source: https://www.wasenderapi.com/api-docs/getting-started/model-context-protocol-mcp-integration
> Category: Getting Started
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/getting-started/model-context-protocol-mcp-integration
Description: Connect WasenderAPI to AI agents and automation tools using the Model Context Protocol. This remote MCP server exposes WhatsApp session management, messaging, contacts, and groups as callable tools for Claude Code, OpenCode, n8n, and other MCP-compatible platforms. Requires a paid plan and Personal Access Token for authentication.

Details:
WasenderAPI MCP Integration Guide

 Add the WasenderAPI MCP to your favorite tools (Claude Code/Desktop/CLI, OpenCode, or n8n) using your Personal Access Token.

 MCP integration is only available on paid plans. This feature is not available on trial accounts.

 Replace YOUR_PERSONAL_ACCESS_TOKEN with the token from your WasenderAPI account settings. Keep it secret.

 Claude Code / Desktop / CLI

 - Ensure the Claude CLI is installed and logged in.

 - Register the MCP using your token:

 claude mcp add --transport http wasenderapi https://wasenderapi.com/mcp \
 --header "Authorization: Bearer YOUR_PERSONAL_ACCESS_TOKEN"

 - Verify it appears with claude mcp list and start a new Claude Code session; the WasenderAPI tools will be available.

 OpenCode

 - Open your OpenCode config (defaults to ~/.config/opencode/config.json).

 - Paste the configuration snippet below under the "mcp" key:

 {
 "mcp": {
 "WasenderAPI": {
 "type": "remote",
 "url": "https://wasenderapi.com/mcp",
 "enabled": true,
 "headers": {
 "Authorization": "Bearer YOUR_PERSONAL_ACCESS_TOKEN"
 }
 }
 },
 "$schema": "https://opencode.ai/config.json"
}

 - Restart or reload OpenCode. The WasenderAPI MCP will show up as WasenderAPI.

 If you already have other MCP entries, just add the "WasenderAPI" block alongside them.

 n8n (MCP Client Tool Node)

 Requires n8n v2.0 or later. n8n ships an MCP Tool node that can call external MCP servers.

 - Install/upgrade to n8n v2.0+

 - Create a new workflow and add the MCP Client Tool node.

 - Configure MCP endpoint: https://wasenderapi.com/mcp.

 - Add header Authorization: Bearer YOUR_PERSONAL_ACCESS_TOKEN.

 - Pick the desired tool (e.g., send-message, contacts, groups).

 - Execute the node; n8n will call the MCP tool and return the response.

 Ensure your WasenderAPI session is connected and the token is valid before running.

 Available Tools (MCP)

 The WasenderAPI MCP exposes the following tools for AI agents:

 Sessions Management

 - list_whatsapp_sessions – Retrieve all WhatsApp sessions with pagination.

 - get_specific_whatsapp_session – Retrieve details of a specific session by ID.

 - get_session_user – Get information about the WhatsApp user associated with a session.

 - create_whatsapp_session – Create a new WhatsApp session.

 - update_whatsapp_session – Update a specific WhatsApp session.

 - connect_whatsapp_session – Start/connect a WhatsApp session (returns QR code if needed).

 - disconnect_whatsapp_session – Disconnect a WhatsApp session.

 - get_message_logs – Retrieve message logs for a specific session.

 - get_session_logs – Retrieve session logs for a specific session.

 Messaging

 - send_text_message – Send a text message via a specified session.

 - send_mention_text_message – Send a text message with mentions.

 - send_image_message – Send an image message via WhatsApp.

 - send_audio_message – Send an audio message (voice note or audio file).

 - send_video_message – Send a video message via WhatsApp.

 - send_document_message – Send a document/file via WhatsApp.

 - send_location_message – Send a location message via WhatsApp.

 - send_contact_message – Send a contact card via WhatsApp.

 - send_poll_message – Send a poll via WhatsApp.

 - send_presence_update – Send a presence update (available, unavailable, composing, recording, paused).

 - resend_message – Resend a failed WhatsApp message.

 - edit_message – Edit an existing WhatsApp message.

 - delete_message – Delete a WhatsApp message.

 - get_message_info – Get information about a specific message (delivery status, read receipts).

 Contacts

 - list_contacts – List all WhatsApp contacts for a specified session.

 - add_or_edit_contact – Add a new contact or edit an existing contact in WhatsApp.

 - get_contact_info – Get information about a specific WhatsApp contact.

 - get_contact_picture – Get the profile picture URL of a WhatsApp contact.

 - block_contact – Block a WhatsApp contact.

 - unblock_contact – Unblock a WhatsApp contact.

 - check_jid_on_whatsapp – Check if a phone number/JID exists on WhatsApp.

 - get_lid_from_phone_number – Get the LID (Linked Device ID) for a given phone number.

 - get_phone_number_from_lid – Get the phone number for a given LID.

 - search_contacts – Search for WhatsApp contacts by name or phone number.

 Groups

 - list_groups – List all WhatsApp groups for a specified session.

 - create_group – Create a new WhatsApp group with specified name and participants.

 - get_group_metadata – Get metadata for a specific group (name, description, participants).

 - get_group_participants – Get participants of a specific WhatsApp group.

 - add_group_participants – Add participants to a WhatsApp group.

 - remove_group_participants – Remove participants from a WhatsApp group.

 - update_group_participants – Promote or demote participants in a WhatsApp group.

 - update_group_settings – Update settings for a WhatsApp group (subject, description, announce mode, etc.).

 - leave_group – Leave a WhatsApp group.

 - generate_invite_link – Generate an invite link for a WhatsApp group.

 - accept_group_invite – Accept a WhatsApp group invite by code.

 - search_groups – Search for WhatsApp groups by name.

 Documentation

 - get_api_documentation_tool – Get API documentation. Returns index of all APIs if no ID provided, or detailed docs for a specific entry.

Code examples:
```json
{
  "mcp": {
    "WasenderAPI": {
      "type": "remote",
      "url": "https://wasenderapi.com/mcp",
      "enabled": true,
      "headers": {
        "Authorization": "Bearer YOUR_PERSONAL_ACCESS_TOKEN"
      }
    }
  }
}
```

