# Slack Lite AgentSDK Demo

A comprehensive demonstration of AgentSDK v0.2 capabilities using Slack's Web API as a complex, real-world example.

## 🎯 Overview

This demo showcases AgentSDK's advanced features with a realistic Slack integration that demonstrates:

- **Multi-operation workflows** (authentication, messaging, channel management)
- **Complex error handling** with recovery strategies
- **Advanced guardrails** including rate limiting and circuit breakers
- **Dynamic operation profiles** for different use cases
- **Sophisticated usage patterns** with conditional logic and error handling

## 🏗️ Architecture Features

### **Operation Profiles**

- **Basic**: Simple messaging operations (`postMessage`, `getChannelInfo`)
- **Moderator**: Channel management and user operations
- **Admin**: Full workspace management capabilities

### **Advanced Guardrails**

```json
{
  "preconditions": [
    {
      "condition": "auth.token.valid",
      "escalation": "block"
    }
  ],
  "rateLimit": {
    "requests": 100,
    "window": "1m",
    "backoffStrategy": "exponentialBackoff"
  },
  "circuitBreaker": {
    "enabled": true,
    "failureThreshold": 5
  }
}
```

### **Sophisticated Error Handling**

- **Context-aware errors** with recovery hints
- **Escalation strategies**: retry, abort, human-review
- **Rich error taxonomy** covering auth, validation, rate limits
- **Structured error context** with support URLs and required fields

## 🚀 Usage Patterns

### 1. Simple Message (`simpleMessage`)

```json
{
  "targetChannel": "#general",
  "messageText": "Hello team! 👋"
}
```

**Flow**: Verify channel → Send message  
**Cost**: ~225 tokens, 2-3s

### 2. Channel Setup (`channelSetup`)

```json
{
  "channelName": "project-alpha",
  "channelTopic": "Discussion for Project Alpha",
  "initialMembers": "U1234567890,U0987654321",
  "welcomeMessage": "Welcome to Project Alpha! 🚀"
}
```

**Flow**: Create channel → Set topic → Invite members → Send welcome  
**Cost**: ~450 tokens, 5-8s

### 3. User Onboarding (`userOnboarding`)

```json
{
  "userId": "U1234567890",
  "onboardingChannel": "#new-hires"
}
```

**Flow**: Get user info → Welcome message → Invite to onboarding  
**Cost**: ~290 tokens, 3-5s

### 4. Workspace Management (`workspaceManagement`)

```json
{
  "targetChannel": "#admin-reports"
}
```

**Flow**: List all users → Get channel info → Send summary  
**Cost**: ~520 tokens, 8-12s

## 📊 Operations

| Operation         | Method | Purpose              | Side Effects | Complexity |
| ----------------- | ------ | -------------------- | ------------ | ---------- |
| `postMessage`     | POST   | Send messages        | Write        | Medium     |
| `getChannelInfo`  | GET    | Channel details      | Read         | Low        |
| `getUserInfo`     | GET    | User profiles        | Read         | Low        |
| `createChannel`   | POST   | Create channels      | Write        | Medium     |
| `inviteToChannel` | POST   | Invite users         | Write        | Medium     |
| `listUsers`       | GET    | List workspace users | Read         | Medium     |
| `setChannelTopic` | POST   | Set channel topic    | Write        | Low        |

## 🛡️ Security & Reliability

### **Authentication**

- Bearer token authentication
- Permission validation for write operations
- Token validity checks in preconditions

### **Rate Limiting**

- **Messaging**: 100 requests/minute
- **Channel operations**: 20-50 requests/minute
- **User operations**: 200 requests/minute
- Exponential backoff with jitter

### **Error Recovery**

- Automatic retries for transient errors
- Circuit breaker pattern for service protection
- Human escalation for auth/permission issues
- Structured error context for debugging

## 🧪 Evaluation Tasks

This demo supports complex evaluation scenarios:

### **T1: Basic Messaging**

- Send messages to multiple channels
- Handle channel not found errors
- Verify message delivery

### **T2: Channel Management**

- Create channels with validation
- Set topics and invite members
- Handle naming conflicts

### **T3: User Operations**

- Retrieve user information
- Onboard new team members
- Handle user not found scenarios

### **T4: Workspace Administration**

- List and analyze users
- Generate workspace reports
- Manage bulk operations

## 🔍 Anti-Patterns Addressed

- ❌ **Channel access assumptions** → ✅ Always verify channel access first
- ❌ **Invalid channel names** → ✅ Validate naming conventions
- ❌ **Rate limit violations** → ✅ Built-in rate limiting and backoff
- ❌ **Long message handling** → ✅ Length validation and truncation hints
- ❌ **Permission assumptions** → ✅ Role-based precondition checks

## 💡 AgentSDK v0.2 Features Demonstrated

1. **✅ Provenance Tracking**: Source hash and generation metadata
2. **✅ Operation Profiles**: Dynamic toolset loading for different roles
3. **✅ Advanced Guardrails**: Preconditions, circuit breakers, cost estimation
4. **✅ Rich Error Semantics**: Recovery hints, escalation strategies, context
5. **✅ Complex Usage Patterns**: Multi-step workflows with conditional logic
6. **✅ Well-Known Endpoints**: Version negotiation and capability discovery

## 🎯 Expected Improvements vs Baseline

Based on AgentSDK v0.2 architecture:

- **Token Efficiency**: 20-30% reduction through structured operations
- **Error Rate**: 80%+ reduction through validation and guardrails
- **Execution Speed**: 15-25% improvement through optimized flows
- **Reliability**: Near-zero invalid calls through schema validation

This complex demo provides a rigorous test of AgentSDK's capabilities with real-world API complexity, multi-step workflows, and sophisticated error handling scenarios.
