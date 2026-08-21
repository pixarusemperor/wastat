# Create a New Group

> Source: https://www.wasenderapi.com/api-docs/groups/create-a-new-group
> Category: Groups
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/groups/create-a-new-group
Endpoint: POST /api/groups
Description: Creates a new WhatsApp group with a given name and a list of participants.

Details:
Create a new group

 Creates a new WhatsApp group with a given name and a list of participants.

Parameters:
- name (string, required): The name of the group to be created.
- participants (string[], optional): An array of participant JIDs to add to the group.

Code examples:
```bash
curl -X POST "https://www.wasenderapi.com/api/groups" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "My New Group", "participants": ["1234567890@s.whatsapp.net", "0987654321@s.whatsapp.net"]}'
```
```python
import requests
import json

url = "https://www.wasenderapi.com/api/groups"
payload = {
    "name": "My New Group",
    "participants": ["1234567890@s.whatsapp.net", "0987654321@s.whatsapp.net"]
}
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}
response = requests.post(url, headers=headers, data=json.dumps(payload))
print(response.json())
```
```javascript
async function callApi() {
  const response = await fetch("https://www.wasenderapi.com/api/groups", {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'My New Group',
      participants: ['1234567890@s.whatsapp.net', '0987654321@s.whatsapp.net']
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
$url = 'https://www.wasenderapi.com/api/groups';

try {
    $response = $client->post($url, [
        'headers' => [
            'Authorization' => 'Bearer ' . $apiKey,
            'Content-Type' => 'application/json',
        ],
        'json' => [
            'name' => 'My New Group',
            'participants' => ['1234567890@s.whatsapp.net', '0987654321@s.whatsapp.net']
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

uri = URI.parse('https://www.wasenderapi.com/api/groups')
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true if uri.scheme == 'https'

request = Net::HTTP::Post.new(uri.request_uri)
request['Authorization'] = 'Bearer YOUR_API_KEY'
request['Content-Type'] = 'application/json'
request.body = JSON.generate({
  name: "My New Group",
  participants: ["1234567890@s.whatsapp.net", "0987654321@s.whatsapp.net"]
})

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
    url := "https://www.wasenderapi.com/api/groups"
    apiKey := "YOUR_API_KEY"

    payload := map[string]interface{}{
        "name":         "My New Group",
        "participants": []string{"1234567890@s.whatsapp.net", "0987654321@s.whatsapp.net"},
    }
    jsonData, err := json.Marshal(payload)
    if err != nil {
        panic(err)
    }

    req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
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
        var client = new RestClient("https://www.wasenderapi.com/api/groups");
        var request = new RestRequest(Method.POST);
        request.AddHeader("Authorization", "Bearer YOUR_API_KEY");
        request.AddHeader("Content-Type", "application/json");
        var body = new {
            name = "My New Group",
            participants = new[] { "1234567890@s.whatsapp.net", "0987654321@s.whatsapp.net" }
        };
        request.AddJsonBody(body);

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
        String requestBody = "{\"name\":\"My New Group\",\"participants\":[\"1234567890@s.whatsapp.net\",\"0987654321@s.whatsapp.net\"]}";

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://www.wasenderapi.com/api/groups"))
            .header("Authorization", "Bearer YOUR_API_KEY")
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(requestBody))
            .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        System.out.println(response.body());
    }
}
```
```swift
import Foundation

let url = URL(string: "https://www.wasenderapi.com/api/groups")!
var request = URLRequest(url: url)
request.httpMethod = "POST"
request.setValue("Bearer YOUR_API_KEY", forHTTPHeaderField: "Authorization")
request.setValue("application/json", forHTTPHeaderField: "Content-Type")

let body: [String: Any] = [
    "name": "My New Group",
    "participants": ["1234567890@s.whatsapp.net", "0987654321@s.whatsapp.net"]
]

do {
    request.httpBody = try JSONSerialization.data(withJSONObject: body, options: [])
} catch {
    print("Error: unable to serialize JSON body")
    return
}

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
$uri = "https://www.wasenderapi.com/api/groups"
$headers = @{
    "Authorization" = "Bearer YOUR_API_KEY"
    "Content-Type"  = "application/json"
}
$body = @{
    name         = "My New Group"
    participants = @("1234567890@s.whatsapp.net", "0987654321@s.whatsapp.net")
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri $uri -Method POST -Headers $headers -Body $body
$response | ConvertTo-Json
```
```typescript
import axios from 'axios';

async function callApi() {
  try {
    const config = {
      method: 'POST',
      url: 'https://www.wasenderapi.com/api/groups',
      headers: {
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
      },
      data: {
        name: 'My New Group',
        participants: ['1234567890@s.whatsapp.net', '0987654321@s.whatsapp.net']
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
    let url = "https://www.wasenderapi.com/api/groups";
    let api_key = "YOUR_API_KEY";

    let mut headers = HeaderMap::new();
    headers.insert(AUTHORIZATION, HeaderValue::from_str(&format!("Bearer {}", api_key))?);
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    let client = reqwest::Client::new();
    let response = client.post(url)
        .headers(headers)
        .json(&json!({
            "name": "My New Group",
            "participants": ["1234567890@s.whatsapp.net", "0987654321@s.whatsapp.net"]
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
[
  {
    "title": "Success Response",
    "code": {
      "success": true,
      "data": {
        "id": "123456789-987654321@g.us",
        "owner": "1122334455@s.whatsapp.net",
        "subject": "My New Group",
        "creation": 1678886400,
        "participants": [
          {
            "id": "1122334455@s.whatsapp.net",
            "admin": "superadmin"
          },
          {
            "id": "1234567890@s.whatsapp.net",
            "admin": null
          },
          {
            "id": "0987654321@s.whatsapp.net",
            "admin": null
          }
        ]
      }
    }
  }
]
```

