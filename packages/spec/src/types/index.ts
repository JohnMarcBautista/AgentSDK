/**
 * TypeScript types for AgentSDK specification
 * Generated from JSON Schema - do not edit manually
 */

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export type AuthMode = "none" | "apiKey" | "oauth2" | "bearer";

export type RetryStrategy = "none" | "exponentialBackoff" | "linearBackoff";

export type ErrorCategory =
  | "auth"
  | "validation"
  | "rate_limit"
  | "server_error"
  | "network"
  | "not_found";

export interface AuthConfig {
  modes?: AuthMode[];
  headers?: Record<string, string>;
  apiKeyParam?: string;
  apiKeyLocation?: "header" | "query";
}

export interface Guardrails {
  preconditions?: string[];
  rateLimit?: string; // Format: "number/(second|minute|hour|day)"
  retry?: RetryStrategy;
  timeout?: number; // milliseconds, 1000-300000
  maxRetries?: number; // 0-10
}

export interface ErrorPattern {
  code: string;
  message?: string;
  retryable?: boolean;
  recoveryHint?: string;
  category?: ErrorCategory;
}

export interface Example {
  name?: string;
  input: any;
  output: any;
  description?: string;
}

export interface Operation {
  opId: string;
  summary?: string;
  description?: string;
  method: HttpMethod;
  path: string;
  input: object; // JSON Schema
  output: object; // JSON Schema
  "x-guardrails"?: Guardrails;
  "x-errors"?: ErrorPattern[];
  "x-examples"?: Example[];
}

export interface UsagePattern {
  name: string;
  description?: string;
  steps: string[];
  condition?: string;
}

export interface AgentSDKMetadata {
  source?: string;
  convertedAt?: string; // ISO date-time
  enrichedAt?: string; // ISO date-time
  [key: string]: any;
}

export interface AgentSDK {
  name: string;
  version: string;
  baseUrl?: string;
  auth?: AuthConfig;
  operations: Operation[];
  "x-usagePatterns"?: UsagePattern[];
  "x-antiPatterns"?: string[];
  "x-metadata"?: AgentSDKMetadata;
}

// Utility types for working with operations
export type OperationById<T extends AgentSDK> = {
  [K in T["operations"][number]["opId"]]: Extract<
    T["operations"][number],
    { opId: K }
  >;
};

export type OperationInput<T extends Operation> = T["input"];
export type OperationOutput<T extends Operation> = T["output"];

// Type guards
export function isAgentSDK(obj: any): obj is AgentSDK {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof obj.name === "string" &&
    typeof obj.version === "string" &&
    Array.isArray(obj.operations) &&
    obj.operations.length > 0
  );
}

export function isOperation(obj: any): obj is Operation {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof obj.opId === "string" &&
    typeof obj.method === "string" &&
    typeof obj.path === "string" &&
    typeof obj.input === "object" &&
    typeof obj.output === "object"
  );
}

// Helper functions
export function getOperationById(
  sdk: AgentSDK,
  opId: string
): Operation | undefined {
  return sdk.operations.find((op) => op.opId === opId);
}

export function getOperationsByMethod(
  sdk: AgentSDK,
  method: HttpMethod
): Operation[] {
  return sdk.operations.filter((op) => op.method === method);
}

export function hasRetryStrategy(operation: Operation): boolean {
  return (
    operation["x-guardrails"]?.retry !== undefined &&
    operation["x-guardrails"].retry !== "none"
  );
}

export function isRetryableError(
  operation: Operation,
  errorCode: string
): boolean {
  const errorPattern = operation["x-errors"]?.find(
    (err) => err.code === errorCode
  );
  return errorPattern?.retryable === true;
}

export function getRateLimit(
  operation: Operation
): { limit: number; period: string } | null {
  const rateLimitStr = operation["x-guardrails"]?.rateLimit;
  if (!rateLimitStr) return null;

  const match = rateLimitStr.match(/^(\d+)\/(second|minute|hour|day)$/);
  if (!match) return null;

  return {
    limit: parseInt(match[1], 10),
    period: match[2],
  };
}
