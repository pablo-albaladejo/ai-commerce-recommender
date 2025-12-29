# Postman Collections

Postman collection for testing the AI Commerce Recommender Telegram webhook.

## File

- `telegram-webhook.postman_collection.json` - Complete collection

## Import into Postman

1. Open Postman
2. Click on **Import** (top left)
3. Drag the `.json` file or select it

## Configure Variables

After importing, configure these variables in the collection:

| Variable      | Description             | Where to get it                      |
| ------------- | ----------------------- | ------------------------------------ |
| `botToken`    | Telegram bot token      | [@BotFather](https://t.me/botfather) |
| `baseUrl`     | API Gateway URL         | CloudFormation outputs               |
| `secretToken` | Secret token (optional) | You define it                        |
| `chatId`      | Your chat ID            | See instructions below               |

### Getting the `botToken`

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` or `/token` for an existing bot
3. Copy the token (format: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### Getting the `baseUrl`

```bash
# After deploy, get the URL:
aws cloudformation describe-stacks \
  --stack-name telegram-chatbot-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`WebhookUrl`].OutputValue' \
  --output text
```

### Getting your `chatId`

1. Configure `botToken` in the collection
2. Run "Telegram Bot API" → "4. Delete Webhook" (to deactivate the webhook)
3. Send a message to your bot on Telegram
4. Run "Telegram Bot API" → "5. Get Updates (Polling)"
5. In the response, look for `result[0].message.chat.id`
6. Copy that number to the `chatId` variable

## Collection Structure

### 📁 Telegram Bot API

Endpoints to configure and manage the webhook with Telegram:

| Endpoint                 | Description                            |
| ------------------------ | -------------------------------------- |
| **1. Get Bot Info**      | Verify that the token is correct       |
| **2. Set Webhook**       | Register your URL with Telegram        |
| **3. Get Webhook Info**  | View current webhook status            |
| **4. Delete Webhook**    | Delete the webhook                     |
| **5. Get Updates**       | Get pending messages (without webhook) |
| **6. Send Test Message** | Send a test message                    |
| **7. Send Product Card** | Test product card format               |

### 📁 Simulate Webhook Calls

Simulates the messages that Telegram sends to your webhook. Useful for testing your Lambda without
needing a real connection to Telegram.

- **Basic Messages**: Product queries, prices, brands
- **Edge Cases**: Messages without text, edited, groups
- **Conversation Flow**: Multi-turn conversation
- **Security Tests**: Token validation, invalid JSON
- **Rate Limiting**: Test rate limits

## Typical Usage Flow

### 1. Configure the webhook

```
1. Run "1. Get Bot Info" → Verify the token
2. Run "2. Set Webhook" → Register your URL
3. Run "3. Get Webhook Info" → Confirm it's configured
```

### 2. Test with real Telegram

1. Send a message to your bot on Telegram
2. Check Lambda logs in CloudWatch
3. The bot should respond

### 3. Test by simulating Telegram

If you want to test without using real Telegram:

1. Run any request in "Simulate Webhook Calls"
2. The requests simulate exactly what Telegram sends

## Run with Newman (CLI)

```bash
# Install Newman
npm install -g newman

# Run collection
newman run postman/telegram-webhook.postman_collection.json \
  --env-var "botToken=YOUR_TOKEN" \
  --env-var "baseUrl=https://your-api.execute-api.us-east-1.amazonaws.com" \
  --env-var "chatId=123456789"
```

## Telegram Message Format

All simulated requests follow the
[Telegram Update format](https://core.telegram.org/bots/api#update):

```json
{
  "update_id": 1,
  "message": {
    "message_id": 1001,
    "from": {
      "id": 987654321,
      "is_bot": false,
      "first_name": "Test"
    },
    "date": 1703875200,
    "chat": {
      "id": 123456789,
      "type": "private"
    },
    "text": "Your message here"
  }
}
```

## Expected Responses

### Success (200)

```json
{
  "success": true,
  "answer": "Here are my recommendations...",
  "recommendations": [...]
}
```

### Acknowledged Update (200)

For messages without text:

```json
{
  "success": true,
  "message": "Update acknowledged"
}
```

### Rate Limit (429)

```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

## Troubleshooting

### "Unauthorized" or invalid token

- Verify that `botToken` is complete and without spaces
- The format is: `123456789:ABCdefGHI...`

### Webhook not receiving messages

1. Run "Get Webhook Info" and check `last_error_message`
2. Verify that the URL is publicly accessible (HTTPS)
3. Check Lambda logs in CloudWatch

### Incorrect Chat ID

- Chat ID is negative for groups (`-1001234567890`)
- It's positive for private chats (`123456789`)
