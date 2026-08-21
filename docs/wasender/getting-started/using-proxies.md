# Using Proxies

> Source: https://www.wasenderapi.com/api-docs/getting-started/using-proxies
> Category: Getting Started
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/getting-started/using-proxies
Description: Learn how to configure proxies for your WhatsApp sessions to prevent frequent disconnects and ensure fast, reliable message delivery. SOCKS5 is highly recommended.

Details:
Configuring Proxies for WhatsApp Sessions

 Using a proxy helps mask our server's IP address and routes your session's traffic through a dedicated IP, which helps with connection stability. Proxies can be configured individually per session.

 Supported Protocols: We support http://, https://, and socks5:// proxies, but SOCKS5 is highly recommended for the best performance and seamless compatibility with WhatsApp.

 Best Practices & Recommendations

 To ensure your sessions remain stable, please follow these guidelines when selecting a proxy:

 - Location Matching: Always use a proxy located in the same country as the phone number registered to the WhatsApp session.

 - Sticky IPs: Use a sticky proxy (an IP that remains the same for a prolonged period) rather than a frequently rotating proxy.

 - Speed is Key: Ensure your proxy is fast and has low latency. Slow proxies will cause connection timeouts and lead to session not ready errors.

 Configuration via Dashboard

 You can easily assign a proxy to a session without writing any code:

 - Navigate to your dashboard and go to Sessions.

 - Click Edit Session on the session you want to modify.

 - Locate the Proxy URL field.

 - Enter your proxy string (e.g., socks5://user:pass@192.168.1.1:1080) and save.

 Configuration via API

 You can also programmatically update a session's proxy using our REST API.

 Authentication Note: Because updating a session's core configuration is an account-level action, you must authenticate this request using your Personal Access Token (found in your profile settings), not the Session API Key.

 Make a PUT request to the session endpoint with your proxy URL (example below)

Code examples:
```bash
curl -X PUT "https://www.wasenderapi.com/api/whatsapp-sessions/{whatsappSession}" 
  -H "Authorization: Bearer YOUR_PERSONAL_ACCESS_TOKEN" 
  -H "Content-Type: application/json" 
  -d '{
      "proxy_url": "socks5://username:password@ip:port"
  }'
```

