---
inclusion: fileMatch
fileMatchPattern: "**/chat-handler.ts"
---

# API Contracts

## Main Chat Endpoint

**Endpoint**: `POST /chat`

### Input Format

```json
{
  "userMessage": "string",
  "conversationState": {
    "filters": {},
    "prefs": {}
  }
}
```

### Output Format

```json
{
  "answer": "string",
  "recommendations": [
    {
      "id": 123,
      "title": "...",
      "url": "...",
      "price": 99.99,
      "image": "https://...",
      "reason": "short"
    }
  ],
  "debug": {
    "bm25Top": [ ... ],
    "semanticTop": [ ... ],
    "fusedTop": [ ... ]
  }
}
```

## Contract Stability

- `answer` + `recommendations` fields must remain stable
- Output format may evolve but core structure should be maintained
- Debug information is optional and can change

## Channel Adapters

- Telegram/Instagram webhooks should only translate messages ↔ `/chat` API
- Avoid channel-specific business logic in core handlers
- Keep adapters lightweight and focused on protocol translation
