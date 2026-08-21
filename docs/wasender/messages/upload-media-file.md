# Upload Media File

> Source: https://www.wasenderapi.com/api-docs/messages/upload-media-file
> Category: Messages
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/messages/upload-media-file
Endpoint: POST /api/upload
Description: This documentation details how to use the media upload endpoint, which supports both raw binary and Base64-encoded file uploads.

Details:
Upload Media File

POST
/api/upload

This endpoint uploads a media file (image, video, audio, sticker, or document) to the server. The file is validated, stored temporarily, and made accessible via a unique URL that is active for 24-hours.

There are two methods for uploading a file:

- Raw Binary Upload: Send the file directly as the request body. This is the most efficient method for file uploads from servers or modern web clients.

- JSON (Base64) Upload: Send a JSON object containing the Base64-encoded file. This is useful for clients where file data is handled as a string.

Request Method 1: Raw Binary Upload

 When uploading a binary file, the Content-Type header is mandatory and must accurately reflect the file's MIME type (e.g., image/jpeg, application/pdf). The server uses this header for validation.

Request Method 2: JSON (Base64) Upload

 To upload via Base64, send a request with Content-Type: application/json and a body containing a base64 string. The MIME type can be provided in two ways:

 - Recommended: Provide the full Data URL scheme within the base64 string. The API will automatically parse the MIME type.

 {
"base64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgA..."
}

- Alternate: Provide the MIME type in a separate mimetype field. This will override any MIME type found in the Data URL.

{
"mimetype": "image/png",
"base64": "iVBORw0KGgoAAAANSUhEUgA..."
}

Validation Rules

The API enforces the following size limits per file category:

 - Documents: 100 MB

 - Images: 16 MB

 - Videos: 50 MB

 - Audio: 16 MB

 - Stickers (webp): 5 MB

Files are also validated by their "magic numbers" to ensure the file content matches its declared type, enhancing security.

Parameters:
- base64 (string, optional): The Base64-encoded file data. Can optionally include the Data URL prefix (e.g., data:image/png;base64,...). Required if using JSON upload method.
- mimetype (string, optional): The MIME type of the file (e.g., image/png). This is only needed for JSON uploads if the base64 string does not include the Data URL prefix.
- Request Body (binary, optional): The request body can either be the raw binary data of the file or a JSON object for Base64 uploads.

Code examples:
```bash
# Raw Binary Upload (Recommended)
curl -X POST "https://wasenderapi.com/api/upload" \
  -H "Content-Type: image/jpeg" \
  --data-binary "@path/to/your/image.jpg"

# JSON (Base64) Upload
curl -X POST "https://wasenderapi.com/api/upload" \
  -H "Content-Type: application/json" \
  -d '{
    "base64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQE..."
  }'
```
```python
import requests

# Endpoint URL
url = "https://wasenderapi.com/api/upload"

# Path to the local file
file_path = "path/to/your/image.jpg"

# Set the correct MIME type for the file
headers = {
    "Content-Type": "image/jpeg"
}

# Read the file in binary mode and send it in the request body
with open(file_path, "rb") as f:
    response = requests.post(url, headers=headers, data=f)

print(response.json())
```
```javascript
async function uploadFile(file) {
  const url = "https://wasenderapi.com/api/upload";

  if (!file) {
    console.error("No file provided.");
    return;
  }

  try {
    // Send the file object directly as the body.
    // The browser will correctly set Content-Length.
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': file.type // The browser provides the file's MIME type
      },
      body: file
    });

    const result = await response.json();
    console.log(result);

  } catch (error) {
    console.error("Upload failed:", error);
  }
}

// Example usage in a browser with an HTML input element:
// const fileInput = document.getElementById('myFileInput');
// uploadFile(fileInput.files[0]);
```
```php
<?php
require 'vendor/autoload.php'; // Assuming Guzzle is installed

use GuzzleHttp\Client;

$client = new Client();
$url = 'https://wasenderapi.com/api/upload';
$filePath = 'path/to/your/image.jpg';

try {
    $response = $client->post($url, [
        'headers' => [
            'Content-Type' => 'image/jpeg',
        ],
        // Open the file as a stream for efficient uploading
        'body' => fopen($filePath, 'r')
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

uri = URI.parse('https://wasenderapi.com/api/upload')
file_path = 'path/to/your/image.jpg'

request = Net::HTTP::Post.new(uri)
request.content_type = 'image/jpeg'
request.body = File.read(file_path)

req_options = {
  use_ssl: uri.scheme == 'https'
}

response = Net::HTTP.start(uri.hostname, uri.port, req_options) do |http|
  http.request(request)
end

puts "Status Code: #{response.code}"
puts "Response Body: #{response.body}"
```
```go
package main

import (
    "fmt"
    "io/ioutil"
    "net/http"
    "os"
)

func main() {
    url := "https://wasenderapi.com/api/upload"
    filePath := "path/to/your/image.jpg"

    file, err := os.Open(filePath)
    if err != nil {
        panic(err)
    }
    defer file.Close()

    req, err := http.NewRequest("POST", url, file)
    if err != nil {
        panic(err)
    }

    // The Content-Type header is crucial for the server to validate the file
    req.Header.Set("Content-Type", "image/jpeg")

    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()

    body, _ := ioutil.ReadAll(resp.Body)
    fmt.Printf("Status: %s\n", resp.Status)
    fmt.Printf("Body: %s\n", string(body))
}
```
```csharp
using var client = new HttpClient();
var url = "https://wasenderapi.com/api/upload";
var filePath = "path/to/your/image.jpg";

// Read the file into a byte array
var fileBytes = File.ReadAllBytes(filePath);

// Create content with correct Content-Type
using var content = new ByteArrayContent(fileBytes);
content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/jpeg");

var response = await client.PostAsync(url, content);

if (response.IsSuccessStatusCode)
{
    var result = await response.Content.ReadAsStringAsync();
    Console.WriteLine(result);
}
else
{
    Console.WriteLine($"Request failed: {response.StatusCode}");
    var error = await response.Content.ReadAsStringAsync();
    Console.WriteLine(error);
}
```
```java
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Path;
import java.nio.file.Paths;

public class ApiClient {
    public static void main(String[] args) throws IOException, InterruptedException {
        HttpClient client = HttpClient.newHttpClient();
        Path filePath = Paths.get("path/to/your/image.jpg");

        // The BodyPublishers.ofFile method streams the file efficiently
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://wasenderapi.com/api/upload"))
            .header("Content-Type", "image/jpeg")
            .POST(HttpRequest.BodyPublishers.ofFile(filePath))
            .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        System.out.println("Status Code: " + response.statusCode());
        System.out.println("Response Body: " + response.body());
    }
}
```
```swift
import Foundation

guard let url = URL(string: "https://wasenderapi.com/api/upload") else {
    fatalError("Invalid URL")
}

// Assuming the file is in your app's bundle. For user-selected files, use a file picker URL.
guard let fileURL = Bundle.main.url(forResource: "image", withExtension: "jpg") else {
    fatalError("File not found in app bundle")
}

var request = URLRequest(url: url)
request.httpMethod = "POST"
request.setValue("image/jpeg", forHTTPHeaderField: "Content-Type")

do {
    // Load the file data into the request body
    let fileData = try Data(contentsOf: fileURL)
    request.httpBody = fileData

    let task = URLSession.shared.dataTask(with: request) { data, response, error in
        if let error = error {
            print("Client Error: \(error)")
            return
        }
        guard let data = data, let result = String(data: data, encoding: .utf8) else {
            print("No data received or data is not valid UTF-8.")
            return
        }
        print("Server Response: \(result)")
    }
    task.resume()

} catch {
    print("Error loading file data: \(error)")
}
```
```powershell
# Define the API endpoint and file path
$uri = "https://wasenderapi.com/api/upload"
$filePath = "C:\path\to\your\image.jpg"

# Set the headers
$headers = @{
    "Content-Type"  = "image/jpeg"
}

# Make the API call using Invoke-RestMethod
try {
    # The -InFile parameter streams the file, which is memory efficient.
    $response = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -InFile $filePath

    # Display the response (already a PowerShell object)
    Write-Host "API call successful."
    $response | ConvertTo-Json
}
catch {
    Write-Error "The API call failed: $_"
    if ($_.Exception.Response) {
        $errorStream = $_.Exception.Response.GetResponseStream()
        $streamReader = New-Object System.IO.StreamReader($errorStream)
        $errorBody = $streamReader.ReadToEnd()
        Write-Host "Error Response Body: $errorBody"
    }
}
```
```typescript
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// This example is for a Node.js environment.
// For browsers, use a File object from an input element.
async function uploadFile(filePath: string) {
  const url = 'https://wasenderapi.com/api/upload';
  
  // Create a readable stream from the file
  const fileStream = fs.createReadStream(filePath);
  const stats = fs.statSync(filePath);

  try {
    const response = await axios.post(url, fileStream, {
      headers: {
        'Content-Type': 'image/jpeg',
        // It's good practice to set Content-Length when known
        'Content-Length': stats.size
      },
      // It's important to set a high maxBodyLength for large files
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    console.log('Success:', response.data);
  } catch (error) {
    const err = error as any;
    console.error('Error:', err.response?.data || err.message);
  }
}

uploadFile(path.join(__dirname, 'image.jpg'));
```
```rust
use reqwest::Client;
use std::fs::File;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let api_url = "https://wasenderapi.com/api/upload";
    let file_path = "path/to/your/image.jpg";

    let client = Client::new();
    
    // Open the file to be streamed in the request body.
    let file = File::open(file_path)?;

    let response = client
        .post(api_url)
        .header("Content-Type", "image/jpeg")
        .body(file) // The body is set to the file stream.
        .send()
        .await?;

    // Check if the request was successful and print the response.
    if response.status().is_success() {
        let response_text = response.text().await?;
        println!("Success: {}", response_text);
    } else {
        println!("Error: Status {}, Body: {}", response.status(), response.text().await?);
    }

    Ok(())
}
```

Response examples:
Success Response:
```json
{
  "success": true,
  "publicUrl": "https://wasenderapi.com/media/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg"
}
```
Error Response:
```json
{
  "success": false,
  "error": "File size exceeds the limit of 16 MB for this file type."
}
```

