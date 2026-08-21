# Getting Started with WasenderAPI

> Source: https://www.wasenderapi.com/api-docs/getting-started/getting-started-with-wasenderapi
> Category: Getting Started
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/getting-started/getting-started-with-wasenderapi
Description: Learn how to quickly set up your WasenderAPI account and start sending WhatsApp messages in minutes. This guide covers account creation, token generation, sending your first message, and tracking delivery using our developer-friendly REST API.

Details:
Getting Started with WasenderAPI – WhatsApp Messaging API

 Introduction

 Welcome to WasenderAPI – your reliable WhatsApp API platform. This guide will walk you through the steps to set up and start sending messages using our powerful API. It's quick, secure, and developer-friendly.

 Step 1: Create an Account

 - Go to the registration page.

 - Fill in your details and verify your email address.

 - Once verified, log in to access your dashboard.

 Step 2: Create Your First WhatsApp Session

 - Log In to Your Dashboard: Access your account at wasenderapi.com/dashboard.

 - Navigate to the Sessions Section: In the dashboard, go to the Sessions tab.

 - Create a New Session: Click on Create New Session.

 - Scan the QR Code: A QR code will appear. Open WhatsApp on your phone, go to Settings > Linked Devices, and scan the QR code to link your WhatsApp account.

 - Session Activation: Once scanned, your session will connected, and you can copy your API key.

 For a more advanced walkthrough, check out the detailed guide here:

 Creating Your First Session – WasenderAPI Help Center

 Step 3: Send Your First Message

 API Endpoint

 POST https://www.wasenderapi.com/api/send-message

 Headers

 Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

 Request Body

 {
 "to": "212612345678",
 "text": "Hello from WasenderAPI!"
}

 Note: The number you're messaging must have agreed to receive WhatsApp messages.

 Step 4: Track Message Delivery

 You can track the status of your messages through the session page or set up webhooks for real-time updates.

 Need Help?

 Check out our Help Center or reach out to our support team at contact@wasenderapi.com.

 Go to Dashboard

