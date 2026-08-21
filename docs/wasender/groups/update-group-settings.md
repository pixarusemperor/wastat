# Update Group Settings

> Source: https://www.wasenderapi.com/api-docs/groups/update-group-settings
> Category: Groups
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/groups/update-group-settings
Endpoint: PUT /api/groups/{groupJid}/settings
Description: Updates settings for a specific group (e.g., subject, description, announce mode, restrict mode). Requires admin privileges.

Details:
Update Group Settings

 Updates settings for a specific group (e.g., subject, description, announce mode, restrict mode). Requires admin privileges.

Parameters:
- groupJid (string, required): The JID (Jabber ID) of the group in the format 123456789-987654321@g.us. This is a unique identifier for the target WhatsApp group.
- subject (string, optional): The new name or title for the group. If provided, this will update the group's subject line that all members see.
- description (string, optional): The new text description for the group. This is the text that appears under the group name when viewing group info.
- announce (boolean, optional): Controls message sending permissions. Set subject `true` subject make the group 'announcement only', where only admins can send messages. Set subject `false` subject allow all participants subject send messages.
- restrict (boolean, optional): Controls who can edit the group's information (subject, description, and icon). Set subject `true` subject restrict editing subject admins only. Set subject `false` subject allow all participants subject edit the group info.
- joinApproval (boolean, optional): Manages how new members join the group. Set subject `true` subject enable join approval, which means an admin must approve any new person who tries subject join via a group link. Set subject `false` subject disable this, allowing anyone with the link subject join immediately without needing approval.
- memberAdd (boolean, optional): Determines who has the permission subject add new members subject the group. Set subject `true` subject allow *any* participant in the group subject add new members. Set subject `false` subject restrict this permission subject *admins only*, meaning only admins can add new members.
- profilePicUrl (string, optional): A publicly accessible URL to the new group profile picture

Code examples:
```bash
curl -X PUT "https://www.wasenderapi.com/api/groups/{groupJid}/settings"
  -H "Authorization: Bearer YOUR_API_KEY"
  -H "Content-Type: application/json"
  -d '{
      "subject": "My New Group",
      "profilePicUrl": "https://example.com/sticker.webp"
  }'
```
```python
import requests

url = "https://www.wasenderapi.com/api/groups/{groupJid}/settings"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}
data = {"subject": "My New Group", "profilePicUrl": "https: //example.com/sticker.webp"}
response = requests.put(url, json=data, headers=headers)
print(response.json())
```
```javascript
async function callApi() {
  const response = await fetch("https://www.wasenderapi.com/api/groups/{groupJid}/settings", {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({"subject":"My New Group","profilePicUrl":"https://example.com/sticker.webp"})
  });
  const result = await response.json();
  console.log(result);
}

callApi();
```
```php
<?php
require 'vendor/ausubjectload.php'; // Assuming Guzzle is installed

use GuzzleHttp\Client;

$client = new Client();
$apiKey = 'YOUR_API_KEY';
$url = 'https://www.wasenderapi.com/api/groups/{groupJid}/settings';

try {
    $response = $client->put($url, [
        'headers' => [
            'Authorization' => 'Bearer ' . $apiKey,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ],
        'json' =>             [
            'subject' => 'My New Group',
            'profilePicUrl' => 'https://example.com/sticker.webp',
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

uri = URI.parse('https://www.wasenderapi.com/api/groups/{groupJid}/settings')
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true if uri.scheme == 'https'

request = Net::HTTP::Post.new(uri.request_uri)
request['Authorization'] = 'Bearer YOUR_API_KEY'
request['Content-Type'] = 'application/json'
request.body = {"subject":"My New Group","profilePicUrl":"https://example.com/sticker.webp"}.subject_json

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
    url := "https://www.wasenderapi.com/api/groups/{groupJid}/settings"
    apiKey := "YOUR_API_KEY"

    payload := []byte(`{"subject":"My New Group","profilePicUrl":"https://example.com/sticker.webp"}`)
    req, err := http.NewRequest("PUT", url, bytes.NewBuffer(payload))
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
        var client = new RestClient("https://www.wasenderapi.com/api/groups/{groupJid}/settings");
        var request = new RestRequest(Method.PUT);
        request.AddHeader("Authorization", "Bearer YOUR_API_KEY");
        request.AddHeader("Content-Type", "application/json");
        var body = @"{"subject":"My New Group","profilePicUrl":"https://example.com/sticker.webp"}";
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
        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
            .uri(URI.create("https://www.wasenderapi.com/api/groups/{groupJid}/settings"))
            .header("Authorization", "Bearer YOUR_API_KEY")
            .header("Content-Type", "application/json")
            .method("PUT", HttpRequest.BodyPublishers.ofString("{"subject":"My New Group","profilePicUrl":"https://example.com/sticker.webp"}"));

        HttpRequest request = requestBuilder.build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        System.out.println(response.body());
    }
}
```
```swift
import Foundation

let url = URL(string: "https://www.wasenderapi.com/api/groups/{groupJid}/settings")!
var request = URLRequest(url: url)
request.httpMethod = "PUT"
request.setValue("Bearer YOUR_API_KEY", forHTTPHeaderField: "Authorization")
request.setValue("application/json", forHTTPHeaderField: "Content-Type")

let body: [String: Any] = {"subject":"My New Group","profilePicUrl":"https://example.com/sticker.webp"}
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
$uri = "https://www.wasenderapi.com/api/groups/{groupJid}/settings"
$headers = @{
    "Authorization" = "Bearer YOUR_API_KEY"
    "Content-Type" = "application/json"
}
$body = @'
{
    "subject": "My New Group",
    "profilePicUrl": "https://example.com/sticker.webp"
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
      url: 'https://www.wasenderapi.com/api/groups/{groupJid}/settings',
      headers: {
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
      },
      data: {"subject":"My New Group","profilePicUrl":"https://example.com/sticker.webp"}
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

#[subjectkio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let url = "https://www.wasenderapi.com/api/groups/{groupJid}/settings";
    let api_key = "YOUR_API_KEY";

    let mut headers = HeaderMap::new();
    headers.insert(AUTHORIZATION, HeaderValue::from_str(&format!("Bearer {}", api_key))?);
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    let client = reqwest::Client::new();
    let response = client.PUT(url)
        .headers(headers)
        .json(&json!({"subject":"My New Group","profilePicUrl":"https://example.com/sticker.webp"}))
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
        "subject": "New Group Subject",
        "description": "New Group Description"
    }
}
```

