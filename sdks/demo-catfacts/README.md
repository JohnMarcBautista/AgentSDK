# CatFacts Demo AgentSDK

This is a demonstration AgentSDK for the Cat Facts API (https://catfact.ninja), designed to showcase the AgentSDK format and validate our tooling.

## API Operations

### `getRandomFact`

- **Purpose**: Fetch a single random cat fact
- **Method**: GET `/fact`
- **Input**: No parameters required
- **Output**: Object with `fact` (string) and `length` (integer)
- **Guardrails**: Exponential backoff retry, 5s timeout

### `listFacts`

- **Purpose**: Get multiple cat facts with pagination and filtering
- **Method**: GET `/facts`
- **Input**: Optional `limit` (1-100) and `max_length` (>=10)
- **Output**: Paginated response with `data` array and pagination info
- **Guardrails**: Parameter validation, exponential backoff retry, 10s timeout

## Usage Patterns

### Fetch N Long Facts

```typescript
// 1. Call listFacts with limit=5 and max_length=120
// 2. Sort facts by length desc
// 3. Return top 5
```

### Random Fact with Fallback

```typescript
// 1. Try getRandomFact first
// 2. If it fails, call listFacts with limit=1
// 3. Return the first fact from the list
```

## Anti-Patterns to Avoid

❌ **Don't** request limit > 100 (API will reject)  
❌ **Don't** assume `/facts` returns a single object  
❌ **Don't** ignore empty data arrays in responses  
❌ **Don't** set max_length < 10 (too restrictive)  
❌ **Don't** make rapid successive calls without rate limiting

## Error Handling

- **400 Bad Request**: Check parameter values, not retryable
- **500 Server Error**: Retry with exponential backoff
- **503 Service Unavailable**: Retry after delay

## Testing

This AgentSDK can be used to test:

- Schema validation against the AgentSDK spec
- OpenAI tools export functionality
- Runner execution with HTTP calls
- Evaluation harness comparison with baseline approaches

## Example Usage

```bash
# Validate the AgentSDK
npx @agent-sdk/spec validate ./agent-sdk.json

# Export to OpenAI tools format
npx @agent-sdk/export-openai ./agent-sdk.json

# Run with the agent runner
npx @agent-sdk/runner ./agent-sdk.json "Get me 3 random cat facts"
```
