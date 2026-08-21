# Update Group Participants

> Source: https://www.wasenderapi.com/api-docs/groups/update-group-participants
> Category: Groups
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/groups/update-group-participants
Endpoint: PUT /api/groups/{groupId}/participants/update
Description: Promote or demote one or more participants in a specific group.

Details:
Update Group Participants' Roles

 This endpoint allows you to change the role of participants within a group. You can either promote a member to an admin or demote an admin back to a regular member.

 This action requires that your session has admin privileges in the target group. You can perform the action on multiple participants in a single API call by including their JIDs in the participants array.

 The action parameter determines the operation to be performed:

 - promote: Grants admin privileges to the specified participants.

 - demote: Revokes admin privileges from the specified participants.

Parameters:
- groupId (string, required): The JID of the group (e.g., 123456789-987654321@g.us).
- action (string, required): The action to perform on the participants. Must be either `promote` or `demote`.
- participants (array, required): An array of user JIDs (strings) to update.

Code examples:
```bash
curl -X PUT "https://www.wasenderapi.com/api/groups/123456789-987654321@g.us/participants/update" 
  -H "Authorization: Bearer YOUR_API_KEY" 
  -H "Content-Type: application/json" 
  -d '{
    "action": "promote",
    "participants": ["111111111@s.whatsapp.net", "222222222@s.whatsapp.net"]
}'
```
```python
import requests

url = "https://www.wasenderapi.com/api/groups/123456789-987654321@g.us/participants/update"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}

data = {
    "action": "promote",
    "participants": ["111111111@s.whatsapp.net", "222222222@s.whatsapp.net"]
}

response = requests.put(url, json=data, headers=headers)
print(response.json())
```
```javascript
async function callApi() {
  const response = await fetch("https://www.wasenderapi.com/api/groups/123456789-987654321@g.us/participants/update", {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      "action": "promote",
      "participants": ["111111111@s.whatsapp.net", "222222222@s.whatsapp.net"]
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
$groupId = '123456789-987654321@g.us';
$url = 'https://www.wasenderapi.com/api/groups/' . $groupId . '/participants/update';

try {
    $response = $client->put($url, [
        'headers' => [
            'Authorization' => 'Bearer ' . $apiKey,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ],
        'json' => [
            'action' => 'promote',
            'participants' => ['111111111@s.whatsapp.net', '222222222@s.whatsapp.net']
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

uri = URI.parse('https://www.wasenderapi.com/api/groups/123456789-987654321@g.us/participants/update')
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true if uri.scheme == 'https'

request = Net::HTTP::Put.new(uri.request_uri)
request['Authorization'] = 'Bearer YOUR_API_KEY'
request['Content-Type'] = 'application/json'

request.body = {
  action: "promote",
  participants: ["111111111@s.whatsapp.net", "222222222@s.whatsapp.net"]
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
    url := "https://www.wasenderapi.com/api/groups/123456789-987654321@g.us/participants/update"
    apiKey := "YOUR_API_KEY"

    payloadMap := map[string]interface{}{
        "action": "promote",
        "participants": []string{"111111111@s.whatsapp.net", "222222222@s.whatsapp.net"},
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
        var client = new RestClient("https://www.wasenderapi.com/api/groups/123456789-987654321@g.us/participants/update");
        var request = new RestRequest(Method.PUT);
        request.AddHeader("Authorization", "Bearer YOUR_API_KEY");
        request.AddHeader("Content-Type", "application/json");

        var body = @"{
            ""action"": ""promote"",
            ""participants"": [""111111111@s.whatsapp.net"", ""222222222@s.whatsapp.net""]
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
                "action": "promote",
                "participants": ["111111111@s.whatsapp.net", "222222222@s.whatsapp.net"]
            }
        """;

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://www.wasenderapi.com/api/groups/123456789-987654321@g.us/participants/update"))
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

let url = URL(string: "https://www.wasenderapi.com/api/groups/123456789-987654321@g.us/participants/update")!
var request = URLRequest(url: url)
request.httpMethod = "PUT"
request.setValue("Bearer YOUR_API_KEY", forHTTPHeaderField: "Authorization")
request.setValue("application/json", forHTTPHeaderField: "Content-Type")

let body: [String: Any] = [
    "action": "promote",
    "participants": ["111111111@s.whatsapp.net", "222222222@s.whatsapp.net"]
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
$uri = "https://www.wasenderapi.com/api/groups/123456789-987654321@g.us/participants/update"
$headers = @{
    "Authorization" = "Bearer YOUR_API_KEY"
    "Content-Type"  = "application/json"
}
$body = @'
{
    "action": "promote",
    "participants": ["111111111@s.whatsapp.net", "222222222@s.whatsapp.net"]
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
      url: 'https://www.wasenderapi.com/api/groups/123456789-987654321@g.us/participants/update',
      headers: {
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
      },
      data: {
        "action": "promote",
        "participants": ["111111111@s.whatsapp.net", "222222222@s.whatsapp.net"]
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
    let url = "https://www.wasenderapi.com/api/groups/123456789-987654321@g.us/participants/update";
    let api_key = "YOUR_API_KEY";

    let mut headers = HeaderMap::new();
    headers.insert(AUTHORIZATION, HeaderValue::from_str(&format!("Bearer {}"), api_key))?);
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    let client = reqwest::Client::new();
    let response = client.put(url)
        .headers(headers)
        .json(&json!({
            "action": "promote",
            "participants": ["111111111@s.whatsapp.net", "222222222@s.whatsapp.net"]
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
        "participants": ["111111111@s.whatsapp.net"]
    }
}
```
Error Response:
```json
{
    "success": false,
    "error": "Failed to promote group participants: You are not an admin in this group."
}
```

