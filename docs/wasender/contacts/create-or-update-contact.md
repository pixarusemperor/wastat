# Create or Update Contact

> Source: https://www.wasenderapi.com/api-docs/contacts/create-or-update-contact
> Category: Contacts
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/contacts/create-or-update-contact
Endpoint: PUT /api/contacts
Description: Creates or updates a contact in the session's address book.

Details:
Create or Update Contact

 This endpoint allows you to manage contacts associated with the WhatsApp session. If you provide a jid that does not exist in the session's contacts, a new contact will be created with the provided fullName. If the jid already exists, its name will be updated.

 The optional saveOnPrimaryAddressbook parameter can be used to sync the contact to the primary address book of the device running WhatsApp, though this behavior may vary by platform.

Parameters:
- jid (string, required): The JID of the contact to create or update (e.g., 1234567890@s.whatsapp.net).
- fullName (string, optional): The full name to assign to the contact.
- saveOnPrimaryAddressbook (boolean, optional): If set to true, it attempts to save the contact on the device's primary address book. Defaults to false.

Code examples:
```bash
curl -X PUT "https://www.wasenderapi.com/api/contacts" 
  -H "Authorization: Bearer YOUR_API_KEY" 
  -H "Content-Type: application/json" 
  -d '{
    "jid": "1234567890@s.whatsapp.net",
    "fullName": "John Doe",
    "saveOnPrimaryAddressbook": true
}'
```
```python
import requests

url = "https://www.wasenderapi.com/api/contacts"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}

data = {
    "jid": "1234567890@s.whatsapp.net",
    "fullName": "John Doe",
    "saveOnPrimaryAddressbook": True
}

response = requests.put(url, json=data, headers=headers)
print(response.json())
```
```javascript
async function callApi() {
  const response = await fetch("https://www.wasenderapi.com/api/contacts", {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      "jid": "1234567890@s.whatsapp.net",
      "fullName": "John Doe",
      "saveOnPrimaryAddressbook": true
    })
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
$url = 'https://www.wasenderapi.com/api/contacts';

try {
    $response = $client->put($url, [
        'headers' => [
            'Authorization' => 'Bearer ' . $apiKey,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ],
        'json' => [
            'jid' => '1234567890@s.whatsapp.net',
            'fullName' => 'John Doe',
            'saveOnPrimaryAddressbook' => true
        ]
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

uri = URI.parse('https://www.wasenderapi.com/api/contacts')
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true if uri.scheme == 'https'

request = Net::HTTP::Put.new(uri.request_uri)
request['Authorization'] = 'Bearer YOUR_API_KEY'
request['Content-Type'] = 'application/json'

request.body = {
  jid: "1234567890@s.whatsapp.net",
  fullName: "John Doe",
  saveOnPrimaryAddressbook: true
}.to_json

response = http.request(request)
puts JSON.parse(response.body)
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
    url := "https://www.wasenderapi.com/api/contacts"
    apiKey := "YOUR_API_KEY"

    payloadMap := map[string]interface{}{
        "jid": "1234567890@s.whatsapp.net",
        "fullName": "John Doe",
        "saveOnPrimaryAddressbook": true,
    }
    payload, _ := json.Marshal(payloadMap)

    req, err := http.NewRequest("PUT", url, bytes.NewBuffer(payload))
    if err != nil {
        panic(err)
    }

    req.Header.Add("Authorization", "Bearer "+apiKey)
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
        var client = new RestClient("https://www.wasenderapi.com/api/contacts");
        var request = new RestRequest(Method.PUT);
        request.AddHeader("Authorization", "Bearer YOUR_API_KEY");
        request.AddHeader("Content-Type", "application/json");

        var body = @"{
            ""jid"": ""1234567890@s.whatsapp.net"",
            ""fullName"": ""John Doe"",
            ""saveOnPrimaryAddressbook"": true
        }";
        request.AddParameter("application/json", body, ParameterType.RequestBody);

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
        HttpClient client = HttpClient.newHttpClient();

        String jsonPayload = """
            {
                "jid": "1234567890@s.whatsapp.net",
                "fullName": "John Doe",
                "saveOnPrimaryAddressbook": true
            }
        """;

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://www.wasenderapi.com/api/contacts"))
            .header("Authorization", "Bearer YOUR_API_KEY")
            .header("Content-Type", "application/json")
            .PUT(HttpRequest.BodyPublishers.ofString(jsonPayload))
            .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println(response.body());
    }
}
```
```swift
import Foundation

let url = URL(string: "https://www.wasenderapi.com/api/contacts")!
var request = URLRequest(url: url)
request.httpMethod = "PUT"
request.setValue("Bearer YOUR_API_KEY", forHTTPHeaderField: "Authorization")
request.setValue("application/json", forHTTPHeaderField: "Content-Type")

let body: [String: Any] = [
    "jid": "1234567890@s.whatsapp.net",
    "fullName": "John Doe",
    "saveOnPrimaryAddressbook": true
]

let bodyData = try? JSONSerialization.data(withJSONObject: body, options: [])
request.httpBody = bodyData

let task = URLSession.shared.dataTask(with: request) { data, response, error in
    if let error = error {
        print("Error: \(error)")
        return
    }

    guard let data = data else {
        print("No data received")
        return
    }

    if let jsonString = String(data: data, encoding: .utf8) {
        print(jsonString)
    }
}

task.resume()
```
```powershell
$uri = "https://www.wasenderapi.com/api/contacts"
$headers = @{
    "Authorization" = "Bearer YOUR_API_KEY"
    "Content-Type"  = "application/json"
}
$body = @'
{
    "jid": "1234567890@s.whatsapp.net",
    "fullName": "John Doe",
    "saveOnPrimaryAddressbook": $true
}
'@

$response = Invoke-RestMethod -Uri $uri -Method PUT -Headers $headers -Body $body -ContentType "application/json"
$response | ConvertTo-Json
```
```typescript
import axios from 'axios';

async function callApi() {
  try {
    const config = {
      method: 'PUT',
      url: 'https://www.wasenderapi.com/api/contacts',
      headers: {
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
      },
      data: {
        "jid": "1234567890@s.whatsapp.net",
        "fullName": "John Doe",
        "saveOnPrimaryAddressbook": true
      }
    };

    const response = await axios(config);
    console.log(response.data);
  } catch (error) {
    console.error('Error:', error);
  }
}

callApi();
```
```rust
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let url = "https://www.wasenderapi.com/api/contacts";
    let api_key = "YOUR_API_KEY";

    let mut headers = HeaderMap::new();
    headers.insert(AUTHORIZATION, HeaderValue::from_str(&format!("Bearer {}"), api_key))?);
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    let client = reqwest::Client::new();
    let response = client.put(url)
        .headers(headers)
        .json(&json!({
            "jid": "1234567890@s.whatsapp.net",
            "fullName": "John Doe",
            "saveOnPrimaryAddressbook": true
        }))
        .send()
        .await?;

    let json_response = response.json::<serde_json::Value>().await?;
    println!("{:#?}", json_response);

    Ok(())
}
```

Response examples:
Success Response:
```json
{
    "success": true,
    "data": {
        "jid": "1234567890@s.whatsapp.net",
        "fullName": "John Doe"
    }
}
```
Error Response (Validation):
```json
{
    "success": false,
    "error": "The jid field is required."
}
```

