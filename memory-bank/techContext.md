# AgentSDK Technical Context

## Technology Stack

### Core Languages & Runtimes

- **Primary**: TypeScript/Node.js
- **Rationale**:
  - Excellent JSON/schema tooling ecosystem
  - Native async/await for HTTP operations
  - Rich LLM integration libraries
  - Cross-platform compatibility

### Key Dependencies

#### Schema & Validation

- **AJV** (Another JSON Schema Validator)
  - JSON Schema 2020-12 support
  - High performance validation
  - Custom keyword support for x-\* extensions

#### HTTP & Network

- **node-fetch** or **axios**: HTTP client with retry support
- **p-retry**: Exponential backoff implementation
- **rate-limiter-flexible**: Rate limiting enforcement

#### LLM Integration

- **openai**: Official OpenAI SDK
- **@anthropic-ai/sdk**: Anthropic Claude integration
- **langchain**: For enricher LLM workflows

#### Development & Testing

- **Jest**: Testing framework
- **TypeScript**: Type safety and tooling
- **ESLint + Prettier**: Code quality
- **Zod**: Runtime type validation (alternative to AJV)

#### CLI & Utilities

- **commander**: CLI argument parsing
- **chalk**: Terminal colors and formatting
- **csv-writer**: Metrics export
- **yaml**: OpenAPI spec parsing

## Project Structure Standards

### Monorepo Layout

```
agent-sdk/
├── packages/           # Core modules
│   ├── spec/          # JSON Schema definitions
│   ├── converter-lite/ # OpenAPI converter
│   ├── enricher/      # LLM enhancement
│   ├── export-openai/ # OpenAI tools export
│   ├── export-mcp/    # MCP export
│   ├── runner/        # Execution runtime
│   └── eval/          # Evaluation harness
├── sdks/              # Example AgentSDK files
│   ├── demo-catfacts/
│   └── demo-slack-lite/
├── tools/             # Build and dev utilities
└── docs/              # Documentation
```

### Package Standards

- Each package has its own `package.json`
- Shared dependencies managed at root level
- TypeScript configuration inheritance
- Consistent build and test scripts

## Development Environment

### Prerequisites

- Node.js 18+ (for native fetch support)
- npm 8+ or pnpm (workspace support)
- TypeScript 4.9+

### Build System

- **TypeScript Compiler**: Source transformation
- **esbuild**: Fast bundling for CLI tools
- **Rollup**: Library builds with tree shaking

### Testing Strategy

- **Unit Tests**: Jest with TypeScript
- **Integration Tests**: Real API calls (with mocking)
- **E2E Tests**: Full evaluation harness runs
- **Schema Tests**: JSON Schema validation coverage

## Configuration Management

### Environment Variables

```bash
# LLM API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=...

# Test API Keys
SLACK_BOT_TOKEN=xoxb-...
GITHUB_TOKEN=ghp_...

# Runtime Configuration
LOG_LEVEL=info
NO_NETWORK=false
METRICS_ENDPOINT=...
```

### Config Files

- `agent-sdk.config.json`: Global settings
- `.env.local`: Local development overrides
- `eval.config.json`: Evaluation parameters

## Performance Considerations

### Schema Validation

- Pre-compile AJV validators for hot paths
- Cache compiled schemas across requests
- Lazy loading for large schema sets

### HTTP Operations

- Connection pooling for API calls
- Request/response streaming for large payloads
- Parallel execution where possible

### Memory Management

- Stream processing for large OpenAPI specs
- Incremental JSON parsing
- Cleanup of temporary artifacts

## Security Requirements

### API Key Management

- Never log or persist API keys
- Environment variable injection only
- Automatic redaction in debug output

### Network Security

- HTTPS only for all API calls
- Certificate validation enforced
- Configurable timeout policies

### Input Sanitization

- All user inputs validated against schemas
- Path traversal prevention in file operations
- SQL injection prevention (if database added)

## Deployment Considerations

### Packaging

- NPM packages for each module
- CLI tools as global installs
- Docker images for evaluation runners

### CI/CD Pipeline

- Automated testing on PR
- Schema validation in CI
- Performance regression detection
- Security scanning

### Monitoring

- Structured logging (JSON format)
- Metrics export (Prometheus format)
- Error tracking and alerting
- Usage analytics (privacy-compliant)

## Integration Points

### LLM Providers

- OpenAI GPT-3.5/4 for enrichment
- Anthropic Claude as alternative
- Local models via Ollama for development

### Tool Calling Formats

- OpenAI function calling JSON
- MCP (Model Context Protocol) tools
- Anthropic tool use format
- Custom formats via plugins

### API Documentation Sources

- OpenAPI 3.x specifications
- Postman collections (future)
- API Blueprint (future)
- Custom documentation formats
