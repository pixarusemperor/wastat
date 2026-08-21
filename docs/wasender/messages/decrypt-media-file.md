# Decrypt Media File

> Source: https://www.wasenderapi.com/api-docs/messages/decrypt-media-file
> Category: Messages
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/messages/decrypt-media-file
Endpoint: POST /api/decrypt-media
Description: This endpoint is used to decrypt media files sent in messages. You need to provide the encrypted media information, including the mediaKey and the url where the encrypted file is hosted. The API will then decrypt the file and store it temporarily, returning a publicUrl from which the decrypted file can be downloaded. This public URL will be active for one hour.

Details:
Decrypt Media File

 POST
 /api/decrypt-media

 This endpoint decrypts an encrypted media file (image, video, audio, document, or sticker). You provide the encrypted media information, and the API returns a temporary public URL to access the decrypted file. This URL is valid for one hour.

 Request Body

 The request body must be a JSON object containing the message data. The structure is as follows:

 {
 "data": {
 "messages": {
 "key": {
 "id": "YOUR_UNIQUE_MESSAGE_ID"
 },
 "message": {
 "imageMessage": {
 "url": "URL_OF_ENCRYPTED_IMAGE",
 "mimetype": "image/jpeg",
 "mediaKey": "YOUR_MEDIA_KEY",
 "fileSha256": "FILE_SHA256_HASH",
 "fileLength": "FILE_SIZE_IN_BYTES",
 "fileName": "example.jpg"
 }
 }
 }
 }
}

 Note: The message object can contain imageMessage, videoMessage, audioMessage, documentMessage, or stickerMessage.

Parameters:
- data (object, required): Note: The message object must contain imageMessage, videoMessage, audioMessage, documentMessage, or stickerMessage, depending on the type of media you are decrypting.

Code examples:
```bash
curl -X POST "https://www.wasenderapi.com/api/decrypt-media" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "messages": {
        "key": {
          "id": "YOUR_UNIQUE_MESSAGE_ID"
        },
        "message": {
          "imageMessage": {
            "url": "URL_OF_ENCRYPTED_IMAGE",
            "mimetype": "image/jpeg",
            "mediaKey": "YOUR_MEDIA_KEY"
          }
        }
      }
    }
  }'
```
```python
import requests
import json

url = "https://www.wasenderapi.com/api/decrypt-media"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}
payload = {
    "data": {
        "messages": {
            "key": {
                "id": "YOUR_UNIQUE_MESSAGE_ID"
            },
            "message": {
                "imageMessage": {
                    "url": "URL_OF_ENCRYPTED_IMAGE",
                    "mimetype": "image/jpeg",
                    "mediaKey": "YOUR_MEDIA_KEY"
                }
            }
        }
    }
}

response = requests.post(url, headers=headers, data=json.dumps(payload))
print(response.json())
```
```javascript
async function callApi() {
  const payload = {
    data: {
      messages: {
        key: {
          id: "YOUR_UNIQUE_MESSAGE_ID"
        },
        message: {
          imageMessage: {
            url: "URL_OF_ENCRYPTED_IMAGE",
            mimetype: "image/jpeg",
            mediaKey: "YOUR_MEDIA_KEY"
          }
        }
      }
    }
  };

  const response = await fetch("https://www.wasenderapi.com/api/decrypt-media", {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  console.log(result);
}

callApi();
```
```php
<?php
require 'vendor/autoload.php'; // Assuming Guzzle is installed

use GuzzleHttp\Client;

$client = new Client();
$apiKey = 'YOUR_API_KEY';
$url = 'https://www.wasenderapi.com/api/decrypt-media';

$payload = [
    'data' => [
        'messages' => [
            'key' => [
                'id' => 'YOUR_UNIQUE_MESSAGE_ID'
            ],
            'message' => [
                'imageMessage' => [
                    'url' => 'URL_OF_ENCRYPTED_IMAGE',
                    'mimetype' => 'image/jpeg',
                    'mediaKey' => 'YOUR_MEDIA_KEY'
                ]
            ]
        ]
    ]
];

try {
    $response = $client->post($url, [
        'headers' => [
            'Authorization' => 'Bearer ' . $apiKey,
            'Content-Type' => 'application/json',
        ],
        'json' => $payload
    ]);

    echo $response->getBody();
} catch (\GuzzleHttp\Exception\RequestException $e) {
    echo "Request failed: " . $e->getMessage();
    if ($e->hasResponse()) {
        echo "\nResponse: " . $e->getResponse()->getBody();
    }
}
```
```ruby
require 'net/http'
require 'uri'
require 'json'

uri = URI.parse('https://www.wasenderapi.com/api/decrypt-media')
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true

request = Net::HTTP::Post.new(uri.request_uri)
request['Authorization'] = 'Bearer YOUR_API_KEY'
request['Content-Type'] = 'application/json'

payload = {
  data: {
    messages: {
      key: { id: 'YOUR_UNIQUE_MESSAGE_ID' },
      message: {
        imageMessage: {
          url: 'URL_OF_ENCRYPTED_IMAGE',
          mimetype: 'image/jpeg',
          mediaKey: 'YOUR_MEDIA_KEY'
        }
      }
    }
  }
}
request.body = payload.to_json

response = http.request(request)

puts "Status Code: #{response.code}"
puts "Response Body: #{JSON.parse(response.body)}"
```
```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io/ioutil"
    "net/http"
)

func main() {
    url := "https://www.wasenderapi.com/api/decrypt-media"
    apiKey := "YOUR_API_KEY"

    payload := map[string]interface{}{
        "data": map[string]interface{}{
            "messages": map[string]interface{}{
                "key": map[string]interface{}{
                    "id": "YOUR_UNIQUE_MESSAGE_ID",
                },
                "message": map[string]interface{}{
                    "imageMessage": map[string]interface{}{
                        "url":      "URL_OF_ENCRYPTED_IMAGE",
                        "mimetype": "image/jpeg",
                        "mediaKey": "YOUR_MEDIA_KEY",
                    },
                },
            },
        },
    }
    jsonPayload, _ := json.Marshal(payload)

    req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonPayload))
    if err != nil {
        panic(err)
    }

    req.Header.Add("Authorization", "Bearer " + apiKey)
    req.Header.Add("Content-Type", "application/json")

    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()

    body, _ := ioutil.ReadAll(resp.Body)
    fmt.Println(string(body))
}
```
```csharp
using RestSharp;
using System;
using System.Threading.Tasks;

class Program
{
    static async Task Main(string[] args)
    {
        var client = new RestClient("https://www.wasenderapi.com/api/decrypt-media");
        var request = new RestRequest(Method.POST);

        // Add headers
        request.AddHeader("Authorization", "Bearer YOUR_API_KEY");
        request.AddHeader("Content-Type", "application/json");

        // Create payload
        var payload = new {
            data = new {
                messages = new {
                    key = new { id = "YOUR_UNIQUE_MESSAGE_ID" },
                    message = new {
                        imageMessage = new {
                            url = "URL_OF_ENCRYPTED_IMAGE",
                            mimetype = "image/jpeg",
                            mediaKey = "YOUR_MEDIA_KEY"
                        }
                    }
                }
            }
        };
        request.AddJsonBody(payload);

        // Execute request
        var response = await client.ExecuteAsync(request);
        Console.WriteLine(response.Content);
    }
}
```
```java
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class ApiClient {
    public static void main(String[] args) throws IOException, InterruptedException {
        // Construct the JSON payload
        String payload = """
        {
          "data": {
            "messages": {
              "key": { "id": "YOUR_UNIQUE_MESSAGE_ID" },
              "message": {
                "imageMessage": {
                  "url": "URL_OF_ENCRYPTED_IMAGE",
                  "mimetype": "image/jpeg",
                  "mediaKey": "YOUR_MEDIA_KEY"
                }
              }
            }
          }
        }
        """;

        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://www.wasenderapi.com/api/decrypt-media"))
            .header("Authorization", "Bearer YOUR_API_KEY")
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(payload))
            .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        System.out.println("Status Code: " + response.statusCode());
        System.out.println("Response Body: " + response.body());
    }
}
```
```swift
import Foundation

guard let url = URL(string: "https://www.wasenderapi.com/api/decrypt-media") else {
    fatalError("Invalid URL")
}

var request = URLRequest(url: url)
request.httpMethod = "POST"
request.setValue("Bearer YOUR_API_KEY", forHTTPHeaderField: "Authorization")
request.setValue("application/json", forHTTPHeaderField: "Content-Type")

let payload: [String: Any] = [
    "data": [
        "messages": [
            "key": ["id": "YOUR_UNIQUE_MESSAGE_ID"],
            "message": [
                "imageMessage": [
                    "url": "URL_OF_ENCRYPTED_IMAGE",
                    "mimetype": "image/jpeg",
                    "mediaKey": "YOUR_MEDIA_KEY"
                ]
            ]
        ]
    ]
]

do {
    request.httpBody = try JSONSerialization.data(withJSONObject: payload, options: [])
} catch {
    print("Error creating JSON body: \(error)")
    return
}


let task = URLSession.shared.dataTask(with: request) { data, response, error in
    if let error = error {
```
```powershell
# Define the API endpoint and your authentication token
$uri = "https://www.wasenderapi.com/api/decrypt-media"
$apiKey = "YOUR_API_KEY" # Replace with your actual API key

# Set the request headers
$headers = @{
    "Authorization" = "Bearer $apiKey"
    "Content-Type"  = "application/json"
}

# Construct the payload as a PowerShell object (hashtable)
# This will be converted to JSON before sending
$payload = @{
    data = @{
        messages = @{
            key = @{
                id = "YOUR_UNIQUE_MESSAGE_ID"
            }
            message = @{
                # You can use imageMessage, videoMessage, etc. here
                imageMessage = @{
                    url      = "URL_OF_ENCRYPTED_IMAGE"
                    mimetype = "image/jpeg"
                    mediaKey = "YOUR_MEDIA_KEY"
                }
            }
        }
    }
}

# Convert the PowerShell object to a JSON string.
# -Depth is important for nested objects.
$jsonPayload = $payload | ConvertTo-Json -Depth 5

# Make the API call using Invoke-RestMethod
try {
    # Invoke-RestMethod sends the request and automatically parses the JSON response
    $response = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $jsonPayload

    # Display the response (already a PowerShell object)
    Write-Host "API call successful."
    # Pipe to ConvertTo-Json for a clean, readable output
    $response | ConvertTo-Json
}
catch {
    # This block will run if the API returns an error (e.g., 400, 401, 500)
    Write-Error "The API call failed: $_"

    # You can inspect the full error details for more information
    if ($_.Exception.Response) {
        $errorResponse = $_.Exception.Response.GetResponseStream()
        $streamReader = New-Object System.IO.StreamReader($errorResponse)
        $errorBody = $streamReader.ReadToEnd()
        Write-Host "Error Response Body: $errorBody"
    }
}
```
```typescript
import axios from 'axios';

async function sendDecryptionRequest() {
  const url = 'https://www.wasenderapi.com/api/decrypt-media';
  const apiKey = 'YOUR_API_KEY'; // <-- Replace with your key

  const payload = {
    data: {
      messages: {
        key: {
          id: 'YOUR_UNIQUE_MESSAGE_ID'
        },
        message: {
          imageMessage: {
            url: 'URL_OF_ENCRYPTED_IMAGE',
            mimetype: 'image/jpeg',
            mediaKey: 'YOUR_MEDIA_KEY'
          }
        }
      }
    }
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    console.log('Success:', response.data);

  } catch (error) {
    // A simple way to log the error response from the server
    console.error('Error:', error.response?.data || error.message);
  }
}

sendDecryptionRequest();
```
```rust
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let api_url = "https://www.wasenderapi.com/api/decrypt-media";
    let api_key = "YOUR_API_KEY"; // <-- Replace with your key

    // Use the json! macro to create the payload without structs
    let payload = json!({
        "data": {
            "messages": {
                "key": {
                    "id": "YOUR_UNIQUE_MESSAGE_ID"
                },
                "message": {
                    "imageMessage": {
                        "url": "URL_OF_ENCRYPTED_IMAGE",
                        "mimetype": "image/jpeg",
                        "mediaKey": "YOUR_MEDIA_KEY"
                    }
                }
            }
        }
    });

    let client = reqwest::Client::new();
    let response = client
        .post(api_url)
        .bearer_auth(api_key)
        .json(&payload) // Automatically serializes the payload to JSON
        .send()
        .await?;

    // Get the response from the server as text
    let response_text = response.text().await?;

    println!("{}", response_text);

    Ok(())
}
```

Response examples:
Success Response:
```json
{
  "success": true,
  "publicUrl": "https://www.wasenderapi.com/api/decrypted-media/YOUR_UNIQUE_MESSAGE_ID"
}
```
Error Response:
```json
{
  "success": false,
  "error": "No supported media object (image, video, etc.) found in the message."
}
```

