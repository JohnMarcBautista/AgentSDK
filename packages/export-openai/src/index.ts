/**
 * Export AgentSDK to OpenAI function calling format
 */

import { AgentSDK, Operation } from "@agent-sdk/spec";

export interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface OpenAIToolsExport {
  tools: OpenAITool[];
  metadata: {
    sdkName: string;
    sdkVersion: string;
    baseUrl?: string;
    exportedAt: string;
    operationCount: number;
  };
}

/**
 * Convert an AgentSDK operation to OpenAI function calling format
 */
export function operationToOpenAITool(operation: Operation): OpenAITool {
  // Build description from summary and key details
  let description = operation.summary || `Call ${operation.opId}`;

  if (operation.description) {
    description += `. ${operation.description}`;
  }

  // Add guardrails info to description
  const guardrails = operation["x-guardrails"];
  if (guardrails) {
    const hints: string[] = [];

    if (guardrails.preconditions && guardrails.preconditions.length > 0) {
      hints.push(`Preconditions: ${guardrails.preconditions.join(", ")}`);
    }

    if (guardrails.rateLimit) {
      hints.push(`Rate limit: ${guardrails.rateLimit}`);
    }

    if (hints.length > 0) {
      description += ` [${hints.join("; ")}]`;
    }
  }

  return {
    type: "function",
    function: {
      name: operation.opId,
      description,
      parameters: operation.input || { type: "object", properties: {} },
    },
  };
}

/**
 * Convert an entire AgentSDK to OpenAI tools format
 */
export function agentSDKToOpenAITools(sdk: AgentSDK): OpenAIToolsExport {
  const tools = sdk.operations.map(operationToOpenAITool);

  return {
    tools,
    metadata: {
      sdkName: sdk.name,
      sdkVersion: sdk.version,
      baseUrl: sdk.baseUrl,
      exportedAt: new Date().toISOString(),
      operationCount: sdk.operations.length,
    },
  };
}

/**
 * Get just the tools array for direct use with OpenAI API
 */
export function getOpenAITools(sdk: AgentSDK): OpenAITool[] {
  return agentSDKToOpenAITools(sdk).tools;
}

/**
 * Create execution context for handling tool calls
 */
export interface ExecutionContext {
  sdk: AgentSDK;
  baseUrl: string;
  authHeaders?: Record<string, string>;
}

export function createExecutionContext(
  sdk: AgentSDK,
  options: {
    baseUrl?: string;
    authHeaders?: Record<string, string>;
  } = {}
): ExecutionContext {
  return {
    sdk,
    baseUrl: options.baseUrl || sdk.baseUrl || "",
    authHeaders: options.authHeaders,
  };
}

/**
 * Find operation by tool call name (opId)
 */
export function findOperationForToolCall(
  context: ExecutionContext,
  toolCallName: string
): Operation | null {
  return context.sdk.operations.find((op) => op.opId === toolCallName) || null;
}

/**
 * Build HTTP request details from operation and tool call arguments
 */
export interface HttpRequestDetails {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timeout?: number;
}

export function buildHttpRequest(
  context: ExecutionContext,
  operation: Operation,
  args: any
): HttpRequestDetails {
  // Build URL with path parameters
  let path = operation.path;
  const queryParams: Record<string, string> = {};
  const bodyParams: Record<string, any> = {};

  // Process arguments based on HTTP method
  if (operation.method === "GET" || operation.method === "DELETE") {
    // For GET/DELETE, all params go to query string or path
    for (const [key, value] of Object.entries(args || {})) {
      if (path.includes(`{${key}}`)) {
        // Path parameter
        path = path.replace(`{${key}}`, encodeURIComponent(String(value)));
      } else {
        // Query parameter
        queryParams[key] = String(value);
      }
    }
  } else {
    // For POST/PUT/PATCH, separate path params from body
    for (const [key, value] of Object.entries(args || {})) {
      if (path.includes(`{${key}}`)) {
        // Path parameter
        path = path.replace(`{${key}}`, encodeURIComponent(String(value)));
      } else {
        // Body parameter
        bodyParams[key] = value;
      }
    }
  }

  // Build full URL
  let url = context.baseUrl.replace(/\/$/, "") + path;

  // Add query parameters
  const queryString = new URLSearchParams(queryParams).toString();
  if (queryString) {
    url += "?" + queryString;
  }

  // Build headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "AgentSDK/0.1.0",
  };

  // Add auth headers
  if (context.authHeaders) {
    Object.assign(headers, context.authHeaders);
  }

  // Add SDK-level auth headers
  if (context.sdk.auth?.headers) {
    Object.assign(headers, context.sdk.auth.headers);
  }

  const request: HttpRequestDetails = {
    url,
    method: operation.method,
    headers,
  };

  // Add body for non-GET requests
  if (
    operation.method !== "GET" &&
    operation.method !== "DELETE" &&
    Object.keys(bodyParams).length > 0
  ) {
    request.body = JSON.stringify(bodyParams);
  }

  // Add timeout from guardrails
  if (operation["x-guardrails"]?.timeout) {
    request.timeout = operation["x-guardrails"].timeout;
  }

  return request;
}

/**
 * Extract error information for tool call responses
 */
export interface ToolCallError {
  code: string;
  message: string;
  retryable: boolean;
  recoveryHint?: string;
  category?: string;
}

export function extractErrorInfo(
  operation: Operation,
  httpStatus: number,
  responseBody?: any
): ToolCallError {
  const statusCode = httpStatus.toString();

  // Look for matching error pattern
  const errorPattern = operation["x-errors"]?.find(
    (err) => err.code === statusCode || err.code === String(httpStatus)
  );

  if (errorPattern) {
    return {
      code: errorPattern.code,
      message: errorPattern.message || `HTTP ${httpStatus}`,
      retryable: errorPattern.retryable || false,
      recoveryHint: errorPattern.recoveryHint,
      category: errorPattern.category,
    };
  }

  // Default error handling
  const retryable = httpStatus >= 500 || httpStatus === 429;

  return {
    code: statusCode,
    message:
      responseBody?.message || responseBody?.error || `HTTP ${httpStatus}`,
    retryable,
    recoveryHint: retryable
      ? "Retry with exponential backoff"
      : "Check request parameters",
  };
}
