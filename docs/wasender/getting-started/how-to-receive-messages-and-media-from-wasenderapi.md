# How To Receive Messages and Media From Wasenderapi

> Source: https://www.wasenderapi.com/api-docs/getting-started/how-to-receive-messages-and-media-from-wasenderapi
> Category: Getting Started
> Snapshot: https://www.wasenderapi.com/llms.txt (2026-08-21T13:43:12.119Z)

URL: https://www.wasenderapi.com/api-docs/getting-started/how-to-receive-messages-and-media-from-wasenderapi
Description: A developer's guide to receiving and processing real-time message events. This documentation details the flattened JSON payload, unified messageBody field, and handling for both Private and Group chats.

Details:
How to Handle Incoming WhatsApp Messages

 When you get a new WhatsApp message, we send a POST request to your server (webhook). Inside is a JSON payload with all the message details.

 The Message Payload

 The JSON structure has been updated. The data.messages field is now a single object (not an array) containing the normalized key, the unified messageBody, and the raw message content.

 {
 "event": "messages.received",
 "timestamp": 1633456789,
 "data": {
 "messages": {
 "key": {
 "id": "3EB0X123456789",
 "fromMe": false,
 "remoteJid": "123456789@lid",
 "cleanedSenderPn": "5551234567",
 "senderLid": "123456789@lid"
 },
 "messageBody": "Hello! This is a test.",
 "message": {
 "conversation": "Hello! This is a test."
 }
 }
 }
}

 Key Fields Explained:

 - key.cleanedSenderPn: (Recommended) The sender's phone number in private chats. Use this for your database or logic.

 - key.cleanedParticipantPn: (Recommended) The sender's phone number in group chats.

 - key.remoteJid: The unique ID of the chat.

 ⚠️ Important: Do not rely on remoteJid to be a phone number. It can often be a LID (Linked ID, ending in @lid). Always use the "cleaned" fields if you need the specific phone number.

 - messageBody: The unified text content of the message. Whether it's a text message, an image caption, or a reply, the text will always be here.

 Reading the Message Content

 1. The Easy Way (Text)

 You no longer need to check multiple fields (like conversation vs extendedTextMessage). Just use data.messages.messageBody.

 2. Media Messages

 For media, look inside the raw data.messages.message object for keys like imageMessage, videoMessage, or audioMessage.

 How to Decrypt Media Files

 Important Update: You no longer have to decrypt the media yourself if you don’t want to. We now provide a secure API endpoint that does it for you automatically: Decrypt Media File API.

 If you choose to decrypt manually, use the code examples below.

Code examples:
```php
<?php

declare(strict_types=1);

// The directory to save downloaded media files.
// Make sure this directory exists and your web server can write to it.
define('DOWNLOAD_DIR', __DIR__ . '/downloads');

/**
 * A simple logging function for demonstration.
 * In a real application, you would use a proper logger like Monolog.
 */
function logMessage(string $message): void
{
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents('webhook.log', "[$timestamp] $message\n", FILE_APPEND);
}

/**
 * Finds the first available media object and its type from the message.
 */
function findMediaInfo(array $messageObject): ?array
{
    $mediaKeys = [
        'imageMessage'    => 'image',
        'videoMessage'    => 'video',
        'audioMessage'    => 'audio',
        'documentMessage' => 'document',
        'stickerMessage'  => 'sticker',
    ];

    foreach ($mediaKeys as $key => $type) {
        if (isset($messageObject[$key])) {
            return [$messageObject[$key], $type];
        }
    }
    return null;
}

/**
 * Downloads a file from a URL.
 */
function downloadFile(string $url)
{
    $context = stream_context_create(['http' => ['follow_location' => true]]);
    return file_get_contents($url, false, $context);
}

/**
 * Derives the decryption keys using HKDF.
 */
function getDecryptionKeys(string $mediaKey, string $mediaType): string
{
    $info = match ($mediaType) {
        'image', 'sticker' => 'WhatsApp Image Keys',
        'video'           => 'WhatsApp Video Keys',
        'audio'           => 'WhatsApp Audio Keys',
        'document'        => 'WhatsApp Document Keys',
        default           => throw new Exception("Invalid media type: {$mediaType}"),
    };
    
    return hash_hkdf('sha256', base64_decode($mediaKey), 112, $info, '');
}

/**
 * Main function to decrypt and save a media file.
 */
function handleMediaDecryption(array $mediaInfo, string $mediaType, string $messageId): void
{
    $url = $mediaInfo['url'] ?? null;
    $mediaKey = $mediaInfo['mediaKey'] ?? null;
    
    if (!$url || !$mediaKey) {
        throw new Exception("Media object is missing url or mediaKey.");
    }

    $encryptedData = downloadFile($url);
    if (!$encryptedData) {
        throw new Exception("Failed to download media from URL: {$url}");
    }

    $keys = getDecryptionKeys($mediaKey, $mediaType);
    $iv = substr($keys, 0, 16);
    $cipherKey = substr($keys, 16, 32);
    $ciphertext = substr($encryptedData, 0, -10);

    $decryptedData = openssl_decrypt($ciphertext, 'aes-256-cbc', $cipherKey, OPENSSL_RAW_DATA, $iv);
    if ($decryptedData === false) {
        throw new Exception('Failed to decrypt media.');
    }

    if (!is_dir(DOWNLOAD_DIR)) {
        mkdir(DOWNLOAD_DIR, 0755, true);
    }
    $mimeType = $mediaInfo['mimetype'] ?? 'application/octet-stream';
    $extension = explode('/', $mimeType)[1] ?? 'bin';
    $filename = $mediaInfo['fileName'] ?? "{$messageId}.{$extension}";
    $outputPath = DOWNLOAD_DIR . '/' . basename($filename);
    
    file_put_contents($outputPath, $decryptedData);
    logMessage("Successfully decrypted and saved media to: {$outputPath}");
}

// --- MAIN WEBHOOK PROCESSING LOGIC ---

$jsonPayload = file_get_contents('php://input');
$payload = json_decode($jsonPayload, true);

// 1. Access data.messages (Direct Object Access)
$messageData = $payload['data']['messages'] ?? null;

if (!$messageData) {
    logMessage('Webhook received but no message data found.');
    http_response_code(200);
    exit();
}

$key = $messageData['key'] ?? [];
$messageId = $key['id'] ?? 'unknown_id';

// 2. Identify Sender (Group vs Private)
$sender = $key['cleanedParticipantPn'] ?? $key['cleanedSenderPn'] ?? $key['remoteJid'];

// 3. Get Unified Text Body
$messageContent = $messageData['messageBody'] ?? '';

logMessage("Processing message from {$sender}. ID: {$messageId}");

if (!empty($messageContent)) {
    logMessage("Text: {$messageContent}");
    // TODO: Save text message to your database here.
}

// 4. Handle Media
$mediaInfo = findMediaInfo($messageData['message'] ?? []);
if ($mediaInfo) {
    try {
        logMessage("Media found. Type: {$mediaInfo[1]}. Attempting to decrypt...");
        handleMediaDecryption($mediaInfo[0], $mediaInfo[1], $messageId);
    } catch (Exception $e) {
        logMessage("ERROR processing media: " . $e->getMessage());
    }
}

http_response_code(200);
logMessage("--- Finished processing webhook ---");
```
```javascript
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

// The directory to save downloaded media files.
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');

function logMessage(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

function findMediaInfo(messageObject) {
    const mediaKeys = {
        imageMessage: 'image',
        videoMessage: 'video',
        audioMessage: 'audio',
        documentMessage: 'document',
        stickerMessage: 'sticker',
    };

    for (const key in mediaKeys) {
        if (messageObject && messageObject[key]) {
            return [messageObject[key], mediaKeys[key]];
        }
    }
    return null;
}

function getDecryptionKeys(mediaKeyBuffer, mediaType) {
    const infoMap = {
        image: 'WhatsApp Image Keys',
        sticker: 'WhatsApp Image Keys',
        video: 'WhatsApp Video Keys',
        audio: 'WhatsApp Audio Keys',
        document: 'WhatsApp Document Keys',
    };

    const info = infoMap[mediaType];
    if (!info) {
        throw new Error(`Invalid media type: ${mediaType}`);
    }

    return new Promise((resolve, reject) => {
        crypto.hkdf('sha256', mediaKeyBuffer, '', info, 112, (err, derivedKey) => {
            if (err) return reject(err);
            resolve(Buffer.from(derivedKey));
        });
    });
}

async function handleMediaDecryption(mediaInfo, mediaType, messageId) {
    const { url, mediaKey } = mediaInfo;
    if (!url || !mediaKey) {
        throw new Error("Media object is missing url or mediaKey.");
    }

    // 1. Download the encrypted file
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const encryptedData = Buffer.from(response.data);

    // 2. Derive the IV and Cipher Key
    const mediaKeyBuffer = Buffer.from(mediaKey, 'base64');
    const keys = await getDecryptionKeys(mediaKeyBuffer, mediaType);
    const iv = keys.slice(0, 16);
    const cipherKey = keys.slice(16, 48);

    // 3. Decrypt
    const ciphertext = encryptedData.slice(0, -10);
    const decipher = crypto.createDecipheriv('aes-256-cbc', cipherKey, iv);
    const decryptedData = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    // 4. Save the decrypted file
    await fs.mkdir(DOWNLOAD_DIR, { recursive: true });
    const extension = mediaInfo.mimetype ? mediaInfo.mimetype.split('/')[1] : 'bin';
    const filename = mediaInfo.fileName || `${messageId}.${extension}`;
    const outputPath = path.join(DOWNLOAD_DIR, path.basename(filename));

    await fs.writeFile(outputPath, decryptedData);
    logMessage(`Successfully decrypted and saved media to: ${outputPath}`);
}

async function processWebhook(payload) {
    try {
        // 1. Access data.messages (Direct Object Access)
        const messageData = payload?.data?.messages;
        if (!messageData) {
            logMessage('Webhook received but no message data found.');
            return;
        }

        const key = messageData.key || {};
        const messageId = key.id || 'unknown_id';

        // 2. Identify Sender (Group vs Private)
        const sender = key.cleanedParticipantPn || key.cleanedSenderPn || key.remoteJid;
        
        // 3. Get Unified Text
        const messageContent = messageData.messageBody;
        const mediaInfo = findMediaInfo(messageData.message);

        if (!messageContent && !mediaInfo) {
            logMessage(`Ignoring event with no content (ID: ${messageId})`);
            return;
        }

        logMessage(`Processing message from ${sender}. ID: ${messageId}`);

        if (messageContent) {
            logMessage(`Text: ${messageContent}`);
        }

        if (mediaInfo) {
            logMessage(`Media found. Type: ${mediaInfo[1]}. Attempting to decrypt...`);
            await handleMediaDecryption(mediaInfo[0], mediaInfo[1], messageId);
        }
    } catch (error) {
        logMessage(`ERROR processing webhook: ${error.message}`);
    } finally {
        logMessage("--- Finished processing webhook ---");
    }
}
// processWebhook(samplePayload);
```
```python
import os
import json
import base64
import requests
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend

DOWNLOAD_DIR = os.path.join(os.path.dirname(__file__), 'downloads')

def log_message(message):
    from datetime import datetime
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] {message}")

def find_media_info(message_object):
    media_keys = {
        'imageMessage': 'image',
        'videoMessage': 'video',
        'audioMessage': 'audio',
        'documentMessage': 'document',
        'stickerMessage': 'sticker',
    }
    if not message_object:
        return None
    for key, type_str in media_keys.items():
        if key in message_object:
            return message_object[key], type_str
    return None

def get_decryption_keys(media_key, media_type):
    info_map = {
        'image': b'WhatsApp Image Keys',
        'sticker': b'WhatsApp Image Keys',
        'video': b'WhatsApp Video Keys',
        'audio': b'WhatsApp Audio Keys',
        'document': b'WhatsApp Document Keys',
    }
    info = info_map.get(media_type)
    if not info:
        raise ValueError(f"Invalid media type: {media_type}")

    media_key_bytes = base64.b64decode(media_key)
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=112,
        salt=b'',
        info=info,
        backend=default_backend()
    )
    return hkdf.derive(media_key_bytes)

def handle_media_decryption(media_info, media_type, message_id):
    url = media_info.get('url')
    media_key = media_info.get('mediaKey')
    if not url or not media_key:
        raise ValueError("Media object is missing url or mediaKey.")

    response = requests.get(url)
    response.raise_for_status()
    encrypted_data = response.content

    keys = get_decryption_keys(media_key, media_type)
    iv = keys[:16]
    cipher_key = keys[16:48]
    ciphertext = encrypted_data[:-10]

    cipher = Cipher(algorithms.AES(cipher_key), modes.CBC(iv), backend=default_backend())
    decryptor = cipher.decryptor()
    decrypted_data = decryptor.update(ciphertext) + decryptor.finalize()

    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    extension = media_info.get('mimetype', 'application/octet-stream').split('/')[-1]
    filename = media_info.get('fileName') or f"{message_id}.{extension}"
    output_path = os.path.join(DOWNLOAD_DIR, os.path.basename(filename))
    
    with open(output_path, 'wb') as f:
        f.write(decrypted_data)
    log_message(f"Successfully decrypted and saved media to: {output_path}")

def process_webhook(payload):
    try:
        # 1. Access data.messages (Direct Object Access)
        data = payload.get('data', {})
        message_data = data.get('messages')
        if not message_data:
            log_message('Webhook received but no message data found.')
            return

        key = message_data.get('key', {})
        message_id = key.get('id', 'unknown_id')

        # 2. Identify Sender
        sender = key.get('cleanedParticipantPn') or key.get('cleanedSenderPn') or key.get('remoteJid')

        # 3. Get Unified Text
        message_content = message_data.get('messageBody')
        media_result = find_media_info(message_data.get('message', {}))
        
        if not message_content and not media_result:
            log_message(f"Ignoring event with no content (ID: {message_id})")
            return

        log_message(f"Processing message from {sender}. ID: {message_id}")
        
        if message_content:
            log_message(f"Text: {message_content}")
            
        if media_result:
            media_info, media_type = media_result
            log_message(f"Media found. Type: {media_type}. Decrypting...")
            handle_media_decryption(media_info, media_type, message_id)

    except Exception as e:
        log_message(f"ERROR processing webhook: {e}")
    finally:
        log_message("--- Finished processing webhook ---")

if __name__ == "__main__":
    try:
        with open('sample.json', 'r') as f:
            process_webhook(json.load(f))
    except Exception as e:
        print(e)
```
```n8n code - javascript
const crypto = require('crypto');

function getDecryptionKeys(mediaKeyBuffer, mediaType) {
    const infoMap = {
        image: 'WhatsApp Image Keys', sticker: 'WhatsApp Image Keys',
        video: 'WhatsApp Video Keys', audio: 'WhatsApp Audio Keys',
        document: 'WhatsApp Document Keys',
    };
    const info = infoMap[mediaType];
    if (!info) throw new Error(`Invalid media type: ${mediaType}`);
    return new Promise((resolve, reject) => {
        crypto.hkdf('sha256', mediaKeyBuffer, '', Buffer.from(info), 112, (err, key) => {
            if (err) return reject(err);
            resolve(Buffer.from(key));
        });
    });
}

try {
    const item = items[0];
    
    // 1. Access body.data.messages directly (Object)
    const messageData = item.json.body?.data?.messages;
    const message = messageData?.message;

    if (!message) {
        return null; 
    }

    let mediaDetails;
    let mediaType = '';

    if (message.imageMessage) {
        mediaType = 'image';
        mediaDetails = message.imageMessage;
    } else if (message.audioMessage) {
        mediaType = 'audio';
        mediaDetails = message.audioMessage;
    } else if (message.videoMessage) {
        mediaType = 'video';
        mediaDetails = message.videoMessage;
    } else if (message.documentMessage) {
        mediaType = 'document';
        mediaDetails = message.documentMessage;
    }

    if (!mediaDetails) {
        return null;
    }

    const mediaUrl = mediaDetails.url;
    const mediaKey = mediaDetails.mediaKey;
    const response = await this.helpers.httpRequest({ url: mediaUrl, method: 'GET', encoding: 'arraybuffer' });
    const encryptedData = Buffer.from(response);

    const mediaKeyBuffer = Buffer.from(mediaKey, 'base64');
    const keys = await getDecryptionKeys(mediaKeyBuffer, mediaType);
    const iv = keys.slice(0, 16);
    const cipherKey = keys.slice(16, 48);
    const ciphertext = encryptedData.slice(0, -10);

    const decipher = crypto.createDecipheriv('aes-256-cbc', cipherKey, iv);
    const decryptedData = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const mimeType = mediaDetails.mimetype;
    const fileName = mediaDetails.fileName || crypto.randomUUID();
    const extension = mimeType.split('/')[1].split(';')[0].trim() || 'bin';
    const finalFileNameWithExt = `${fileName}.${extension}`;

    const binaryData = await this.helpers.prepareBinaryData(decryptedData, finalFileNameWithExt, mimeType);
    item.binary = { data: binaryData };
    item.json.decryptionSuccess = true;
      
    return item;

} catch (error) {
    throw error;
}
```
```Csharp
using System;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

// ... [Omitted Helper Classes like WhatsAppMediaHandler] ...
// ... [Assume standard decryption logic from previous examples] ...

public class WebhookPayload
{
    [JsonPropertyName("data")]
    public WebhookData? Data { get; set; }
}

public class WebhookData
{
    // 1. Messages is now a single Object, not a List
    [JsonPropertyName("messages")]
    public MessageData? Messages { get; set; }
}

public class MessageData
{
    [JsonPropertyName("key")]
    public MessageKey? Key { get; set; }
    
    [JsonPropertyName("messageBody")]
    public string? MessageBody { get; set; }
    
    [JsonPropertyName("message")]
    public Message? Message { get; set; }
}

public class MessageKey
{
    [JsonPropertyName("remoteJid")]
    public string RemoteJid { get; set; } = string.Empty;

    [JsonPropertyName("cleanedSenderPn")]
    public string? CleanedSenderPn { get; set; }

    [JsonPropertyName("cleanedParticipantPn")]
    public string? CleanedParticipantPn { get; set; }
    
    [JsonPropertyName("id")]
    public string? Id { get; set; }
}

public static async Task ProcessWebhookAsync(WebhookPayload payload)
{
    try
    {
        var data = payload?.Data;
        var messageData = data?.Messages;

        if (messageData == null)
        {
            Console.WriteLine("No message data found.");
            return;
        }

        var key = messageData.Key;
        if (key == null) return;

        // 2. Identify Sender
        string sender = key.CleanedParticipantPn ?? key.CleanedSenderPn ?? key.RemoteJid;
        
        // 3. Get Unified Text
        string messageContent = messageData.MessageBody;

        Console.WriteLine($"Processing message from {sender}");

        if (!string.IsNullOrEmpty(messageContent))
        {
            Console.WriteLine($"Text: {messageContent}");
        }

        // 4. Handle Media
        // var (mediaInfo, mediaType) = FindMediaInfo(messageData.Message);
        // ... Call decryption ...
    }
    catch (Exception error)
    {
        Console.WriteLine($"Error: {error.Message}");
    }
}
```

