## Agent, Assistant, and LLM Terminology (Project Definitions)

This document defines what the following terms mean **in this repository**: **Agent**,
**Assistant**, **LLM**, **Channel**, **Turn**, **Event**, **Action**, and **Multimodal Content**.

These definitions exist to keep architecture clean and extensible as we add:

- More channels (WhatsApp, WebChat, etc.)
- More modalities (images/audio/files/UI payloads)
- Memory/session/DB
- Tools (catalog search, order flows, etc.)

## Core principle: “Agent” is the domain, “LLM” is just a component

- **Agent**: the system that processes an inbound user interaction and decides what to do next.
- **LLM**: one optional dependency the agent may call to generate language or structured output.

This separation is intentional: it prevents the codebase from conflating “call the model” with
“solve the user’s problem”.

## Definitions

### Agent

An **Agent** is a decision-making component that:

- receives a **turn input** (channel-agnostic)
- can consult **state** (memory/session) and **tools**
- returns a list of **actions** to execute (channel-agnostic)

In code, this is modeled as:

- **Turn input**: `packages/lambda/src/domain/agent/turn.ts` (`AgentTurnInput`)
- **Inbound events**: `packages/lambda/src/domain/agent/events.ts` (`AgentInboundEvent`)
- **Outbound actions**: `packages/lambda/src/domain/agent/actions.ts` (`AgentAction`)
- **Agent engine port**: `packages/lambda/src/application/services/agent-engine-service.ts`
  (`RunAgentTurn`)

Implication:

- Adding a new channel should not require changing the agent logic; you add an adapter that maps
  platform updates to `AgentTurnInput` and maps `AgentAction` back to that platform.

### Assistant

In this project, an **Assistant** is a **special case of an Agent**:

- It primarily produces `send_message` actions.
- It does not necessarily call tools.

Today’s implementation is a “single-turn assistant-style agent”:

- `packages/lambda/src/application/agents/single-turn-llm-agent.ts`

Implication:

- We use “assistant” in conversational/UI language, but our architecture trends toward “agent”
  because we anticipate tools, selections, and commerce flows.

### LLM (Large Language Model)

An **LLM** is a model capable of generating text (and potentially structured output) from
prompts/messages.

In this project, the LLM is accessed through an application port:

- `packages/lambda/src/application/services/agent-model-service.ts` (`GenerateAgentReply`)

Implication:

- We can swap Claude/Bedrock for other providers without changing agent logic, as long as the
  provider implements `GenerateAgentReply`.

### Model Provider / Adapter

The “provider adapter” is the infrastructure implementation of the LLM port.

Today:

- **AI SDK v6** + **Amazon Bedrock** adapter:
  - `packages/lambda/src/infrastructure/llm/ai-sdk-bedrock-agent-model.ts`
  - Uses `CLAUDE_MODEL_ID` + `AWS_REGION`/`AWS_DEFAULT_REGION`

Implication:

- Provider-specific concerns (credentials/env vars/SDK quirks) stay in **infrastructure**, not
  inside use-cases or domain types.

### Channel

A **Channel** is where an interaction happens (Telegram, WhatsApp, WebChat, etc.).

In code:

- `packages/lambda/src/domain/agent/channel.ts` (`ChannelId`)

Implications:

- IDs are **channel-scoped** (strings), because each platform has different ID formats.
- Channel adapters own how IDs are extracted and translated.

### Channel Adapter

A **Channel Adapter** is the glue between a platform (Telegram/WhatsApp/WebChat) and the agent
domain.

Responsibilities:

- validate webhook/security (signatures)
- translate platform updates → `AgentTurnInput`
- execute `AgentAction[]` (send messages, show selections, emit UI commands)

Non-responsibilities:

- business logic (recommendation rules, ranking, tool selection)

Implication:

- Platform logic should be localized under `packages/lambda/src/handlers/<channel>/...` and stay
  thin.

### Turn

A **Turn** is the unit of work: “the agent processes one inbound event and produces zero or more
actions”.

In code:

- `packages/lambda/src/domain/agent/turn.ts` (`AgentTurnInput`)

Implication:

- One inbound message can produce multiple actions (send text + request selection + emit client
  command).

### Event (Inbound)

An **Event** describes what the user did (or what happened) in a turn.

Current inbound event types:

- `user_message`: the user sent a message (text today; multimodal later)
- `user_selection`: the user clicked/selected something from a UI
- `user_command`: explicit command (e.g. `/help`) or UI action

In code:

- `packages/lambda/src/domain/agent/events.ts`

Implication:

- As we add WebChat/WhatsApp, we translate their “button clicks / quick replies / postbacks” into
  `user_selection` (or future event types) without changing the agent engine.

### Action (Outbound)

An **Action** is an intent produced by the agent engine that a channel adapter must execute (or
gracefully ignore if unsupported).

Current outbound action types:

- `send_message`: send multimodal content back to the user
- `request_selection`: ask the user to choose from options (UI buttons, quick replies)
- `emit_client_command`: instruct a front-end client to do something (navigate/open URL)
- `emit_order_intent`: placeholder for commerce flows (checkout/order)

In code:

- `packages/lambda/src/domain/agent/actions.ts`

Implications:

- The agent engine can remain stable while each channel implements only the subset it supports.
- Channel adapters should log unsupported actions but not crash.

### Multimodal Content

**Multimodal content** is represented as an array of parts (not a single string).

In code:

- `packages/lambda/src/domain/agent/content.ts` (`ContentPart[]`)

Implications:

- Channels can render content differently (Telegram vs WebChat).
- Some LLM providers are text-only or have different image/audio APIs.
  - Adapters may degrade gracefully via `contentToPlainText(...)` for now.

## Why we chose this split

### 1) Multi-channel without rewriting business logic

Telegram is just one adapter. WhatsApp/WebChat should not require forking the “conversation logic”.

### 2) Multi-modal without breaking contracts

If we model everything as `messageText: string`, we will have to refactor when
images/audio/selections arrive. By introducing `ContentPart[]` now, the shape is stable.

### 3) “LLM call” is not “agent behavior”

As we add memory, tools, and commerce flows, the agent will:

- call retrieval and ranking (from `@ai-commerce/core`)
- request user selections
- manage state and constraints
- only sometimes call the LLM

Keeping the LLM behind a port prevents “LLM-first architecture”.

## Practical implications (where to add things)

### Add a new channel (WhatsApp/WebChat)

- Create a handler under `packages/lambda/src/handlers/<channel>/...`
- Translate platform update → `AgentTurnInput`
- Execute `AgentAction[]` by mapping to platform APIs
- Do not add business logic in the handler

### Add memory/session (later)

- Add a memory port and implementation (DynamoDB, etc.)
- Agent engine builds `messages: AgentMessage[]` including history and summaries
- Keep the channel adapters unchanged

### Add tools (later)

Tools are agent-callable operations with side effects (search catalog, create order, etc.).

Guideline:

- Define tool ports in `packages/lambda/src/application/services/*`
- Implement infra in `packages/lambda/src/infrastructure/*`
- Keep pure recommendation logic in `@ai-commerce/core`

### Add multimodal inputs (later)

- Channel adapters populate `ContentPart[]` with images/audio/files/json parts
- Agent engine decides which parts to pass to the model (cost + provider constraints)

## What we mean by “domain” here

In this repository:

- The “agent domain” is the stable language we use to represent interactions (`AgentTurnInput`,
  `AgentAction`, `Content`).
- It is designed to survive changes in channels, models, and UI capabilities.
