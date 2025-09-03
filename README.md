# AgentSDK

**The Gold Standard for Agent-First API Integration**

AgentSDK transforms traditional APIs into agent-optimized formats, delivering fewer invalid tool calls, lower token usage, and higher task success rates for AI coding agents.

## 🎯 Core Objective

Prove that structured AgentSDK (JSON + semantics) yields:

- **Fewer invalid tool calls** through schema validation
- **Lower token usage/latency** via compact structured representation
- **Equal or higher task success** compared to RAG-based documentation approaches

## 🏗️ Architecture

```mermaid
flowchart TD
    subgraph "Authoring"
        OpenAPI[OpenAPI Spec] --> Converter[converter-lite]
        Docs[Human Docs] --> Enricher[enricher]
        Converter --> AgentSDK[AgentSDK JSON]
        Enricher --> AgentSDK
    end

    subgraph "Export"
        AgentSDK --> OpenAI[export-openai]
        AgentSDK --> MCP[export-mcp]
        AgentSDK --> TypeScript[export-ts]
    end

    subgraph "Runtime"
        OpenAI --> Runner[runner]
        Runner --> APIs[HTTP APIs]
        Runner --> Metrics[Metrics Logger]
    end

    subgraph "Evaluation"
        Runner --> Eval[eval harness]
        Eval --> Reports[Performance Reports]
    end
```

## 📦 Packages

| Package                     | Description                            | Status      |
| --------------------------- | -------------------------------------- | ----------- |
| `@agent-sdk/spec`           | JSON Schema specification & validation | ✅ Complete |
| `@agent-sdk/converter-lite` | OpenAPI → AgentSDK converter           | ⏳ Planned  |
| `@agent-sdk/enricher`       | LLM-powered semantic enhancement       | ⏳ Planned  |
| `@agent-sdk/export-openai`  | OpenAI function calling export         | ✅ Complete |
| `@agent-sdk/export-mcp`     | MCP tool manifest export               | ⏳ Planned  |
| `@agent-sdk/runner`         | Execution runtime with validation      | ✅ Complete |
| `@agent-sdk/eval`           | Evaluation harness                     | ✅ Complete |

## 🧪 Example SDKs

- **`demo-catfacts/`** - Simple REST API example for initial validation
- **`demo-slack-lite/`** - Multi-operation workflow example with rate limiting

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run evaluation on CatFacts demo
cd packages/eval
npm run eval

# Convert an OpenAPI spec
npx @agent-sdk/converter-lite convert ./my-api.yaml

# Export to OpenAI tools format
npx @agent-sdk/export-openai ./sdks/demo-catfacts/agent-sdk.json
```

## 📋 AgentSDK Format

AgentSDK extends JSON Schema with agent-specific semantics:

```json
{
  "name": "MyAPI",
  "version": "1.0.0",
  "baseUrl": "https://api.example.com",
  "operations": [
    {
      "opId": "getUser",
      "method": "GET",
      "path": "/users/{id}",
      "input": { "type": "object", "properties": {...} },
      "output": { "type": "object", "properties": {...} },
      "x-guardrails": {
        "retry": "exponentialBackoff",
        "rateLimit": "100/minute"
      },
      "x-errors": [
        {
          "code": "USER_NOT_FOUND",
          "retryable": false,
          "recoveryHint": "Check user ID format"
        }
      ]
    }
  ],
  "x-usagePatterns": [
    {
      "name": "User Profile Flow",
      "steps": ["getUser", "getUserPreferences", "updateLastSeen"]
    }
  ]
}
```

## 🎯 Key Features

### Agent-Optimized Design

- **Structured Validation**: AJV-powered schema validation at runtime
- **Guardrails**: Built-in rate limiting, retry policies, and preconditions
- **Error Semantics**: Structured error codes with recovery hints
- **Usage Patterns**: Multi-step workflows and best practices

### Developer Experience

- **Type Safety**: Generated TypeScript types from JSON Schema
- **Multiple Exports**: OpenAI tools, MCP manifests, typed clients
- **Comprehensive Metrics**: Token usage, latency, success rates
- **Evaluation Framework**: A/B testing against baseline approaches

### Performance Focus

- **Token Efficiency**: Compact representation vs verbose documentation
- **Validation Speed**: Pre-compiled schema validators
- **Smart Retries**: Exponential backoff with circuit breaking
- **Parallel Execution**: Concurrent operation support

## 📊 Evaluation Results

_Coming soon - evaluation harness will compare AgentSDK vs baseline approaches_

## 🛠️ Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm run test

# Lint code
npm run lint

# Format code
npm run format
```

## 📖 Documentation

- [AgentSDK Specification](./packages/spec/README.md)
- [Conversion Guide](./packages/converter-lite/README.md)
- [Runner Usage](./packages/runner/README.md)
- [Evaluation Framework](./packages/eval/README.md)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

---

**AgentSDK** - Making APIs speak the language of AI agents.

┌────────────────────────────┐ ┌────────────────────────────┐
│ Normal API Docs │ │ AgentSDK │
│ (Markdown / HTML / PDF) │ │ (JSON Schema + semantics) │
└─────────────┬──────────────┘ └─────────────┬──────────────┘
│ │
▼ ▼
┌─────────────────┐ ┌─────────────────┐
│ LLM reads text │ │ LLM sees tools │
│ + retrieves │ │ (function defs) │
│ (token heavy) │ │ (tokenlight) │
└────────┬────────┘ └────────┬────────┘
│ │
▼ ▼
┌─────────────────┐ ┌──────────────────────────┐
│ Infer intent │ (guess types, │ Emit structured call │
│ & parameters │ defaults, flows) │ (JSON args per schema) │
└────────┬────────┘ └───────────┬──────────────┘
│ │
▼ ▼
┌─────────────────┐ ┌──────────────────────────┐
│ Call API │ (often malformed) │ Validate args w/ schema │
│ (trial & error)│ │ (reject invalid early) │
└────────┬────────┘ └───────────┬──────────────┘
│ │
▼ ▼
┌─────────────────┐ ┌──────────────────────────┐
│ Observe error │ (“429?”, “400?”) │ Execute w/ guardrails │
│ → Retry/guess │ │ (retries, timeouts, │
└────────┬────────┘ │ preconditions) │
│ └───────────┬──────────────┘
▼ │
┌─────────────────┐ ▼
│ Maybe fix │ ┌──────────────────────────┐
│ after loops │ (latency, tokens) │ Structured error surface │
└─────────────────┘ │ (“rate_limit; wait=60s”) │
└───────────┬──────────────┘
│
▼
┌──────────────────────────┐
│ Complete task sooner │
│ (fewer tokens/loops) │
└──────────────────────────┘
