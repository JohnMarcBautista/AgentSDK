/**
 * TypeScript types for AgentSDK v0.2 specification
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

export type RetryStrategy = 
  | "none" 
  | "exponentialBackoff" 
  | "linearBackoff" 
  | "fixedDelay";

export type BackoffStrategy = 
  | "exponentialBackoff" 
  | "linearBackoff" 
  | "fixedDelay" 
  | "none";

export type ErrorCategory =
  | "auth"
  | "validation"
  | "rate_limit"
  | "server_error"
  | "network"
  | "not_found"
  | "quota"
  | "permission"
  | "timeout"
  | "unknown";

export type SideEffects = "none" | "read" | "write" | "destructive";

export type Complexity = "low" | "medium" | "high";

export type Escalation = "block" | "warn" | "human-review";

export type ErrorEscalation = "retry" | "abort" | "human-review" | "fallback";

export type StepErrorStrategy = "abort" | "continue" | "retry" | "fallback";

export type RateLimitScope = "global" | "user" | "ip" | "operation";

export interface AuthConfig {
  modes?: AuthMode[];
  headers?: Record<string, string>;
  apiKeyParam?: string;
  apiKeyLocation?: "header" | "query";
}

export interface Precondition {
  condition: string;
  message?: string;
  escalation?: Escalation;
}

export interface RateLimit {
  requests: number;
  window: string; // Format: "1m", "1h", "1d"
  scope?: RateLimitScope;
  backoffStrategy?: BackoffStrategy;
}

export interface RetryConfig {
  strategy?: RetryStrategy;
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  jitter?: boolean;
}

export interface Cost {
  tokens?: number;
  credits?: number;
  complexity?: Complexity;
}

export interface CircuitBreaker {
  enabled?: boolean;
  failureThreshold?: number;
  recoveryTimeout?: number;
}

export interface Guardrails {
  preconditions?: Precondition[];
  rateLimit?: RateLimit;
  retry?: RetryConfig;
  timeout?: number;
  sideEffects?: SideEffects;
  cost?: Cost;
  circuitBreaker?: CircuitBreaker;
}

export interface ErrorContext {
  retryAfter?: string;
  quotaReset?: string;
  supportUrl?: string;
  requiredFields?: string[];
  [key: string]: any;
}

export interface ErrorExample {
  input?: any;
  response: any;
  recovery?: string;
}

export interface ErrorPattern {
  code: string;
  httpStatus?: number;
  message?: string;
  retryable?: boolean;
  backoffStrategy?: BackoffStrategy;
  recoveryHint?: string;
  humanMessage?: string;
  category: ErrorCategory;
  escalation?: ErrorEscalation;
  context?: ErrorContext;
  examples?: ErrorExample[];
}

export interface Example {
  name?: string;
  input: any;
  output: any;
  description?: string;
}

export interface OutputCapture {
  variables?: Record<string, string>;
}

export interface StepErrorHandling {
  strategy?: StepErrorStrategy;
  fallbackStep?: string;
}

export interface UsagePatternStep {
  opId: string;
  description?: string;
  condition?: string;
  inputMapping?: Record<string, any>;
  outputCapture?: OutputCapture;
  errorHandling?: StepErrorHandling;
}

export interface PatternCost {
  tokens?: number;
  credits?: number;
  timeEstimate?: string;
}

export interface PatternAlternative {
  name: string;
  condition?: string;
  costComparison?: string;
}

export interface PatternExample {
  name: string;
  inputs: Record<string, any>;
  expectedOutputs?: Record<string, any>;
}

export interface UsagePattern {
  name: string;
  description?: string;
  steps: UsagePatternStep[];
  preconditions?: string[];
  postconditions?: string[];
  cost?: PatternCost;
  alternatives?: PatternAlternative[];
  examples?: PatternExample[];
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

export interface Toolchain {
  converter?: string;
  enricher?: string;
  [key: string]: any;
}

export interface Provenance {
  sourceUrl?: string;
  sourceHash?: string;
  generatedAt: string;
  agentSdkVersion: string;
  enrichedAt?: string;
  toolchain?: Toolchain;
}

export interface Profile {
  description?: string;
  operations: string[];
  usagePatterns?: string[];
}

export interface WellKnown {
  endpoint?: string;
  versions?: string[];
  deprecated?: string[];
}

export interface AgentSDK {
  name: string;
  version: string;
  baseUrl?: string;
  auth?: AuthConfig;
  operations: Operation[];
  "x-usagePatterns"?: UsagePattern[];
  "x-antiPatterns"?: string[];
  "x-provenance"?: Provenance;
  "x-profiles"?: Record<string, Profile>;
  "x-wellKnown"?: WellKnown;
  "x-metadata"?: Record<string, any>;
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

export function hasAdvancedGuardrails(operation: Operation): boolean {
  const guardrails = operation["x-guardrails"];
  return !!(
    guardrails?.preconditions?.length ||
    guardrails?.rateLimit ||
    guardrails?.circuitBreaker?.enabled ||
    guardrails?.cost
  );
}

export function isDestructiveOperation(operation: Operation): boolean {
  return operation["x-guardrails"]?.sideEffects === "destructive";
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

export function getOperationsByProfile(
  sdk: AgentSDK,
  profileName: string
): Operation[] {
  const profile = sdk["x-profiles"]?.[profileName];
  if (!profile) return [];
  
  return profile.operations
    .map(opId => getOperationById(sdk, opId))
    .filter((op): op is Operation => op !== undefined);
}

export function hasRetryStrategy(operation: Operation): boolean {
  return (
    operation["x-guardrails"]?.retry?.strategy !== undefined &&
    operation["x-guardrails"].retry.strategy !== "none"
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

export function getRateLimit(operation: Operation): RateLimit | null {
  return operation["x-guardrails"]?.rateLimit || null;
}

export function getOperationCost(operation: Operation): Cost | null {
  return operation["x-guardrails"]?.cost || null;
}

export function getPreconditions(operation: Operation): Precondition[] {
  return operation["x-guardrails"]?.preconditions || [];
}

export function getUsagePattern(
  sdk: AgentSDK,
  patternName: string
): UsagePattern | undefined {
  return sdk["x-usagePatterns"]?.find(pattern => pattern.name === patternName);
}

export function getPatternsByOperation(
  sdk: AgentSDK,
  opId: string
): UsagePattern[] {
  return sdk["x-usagePatterns"]?.filter(pattern =>
    pattern.steps.some(step => step.opId === opId)
  ) || [];
}

export function calculatePatternCost(pattern: UsagePattern): PatternCost {
  if (pattern.cost) return pattern.cost;
  
  // Estimate based on steps if not provided
  const estimatedTokens = pattern.steps.length * 30; // rough estimate
  return {
    tokens: estimatedTokens,
    timeEstimate: `${pattern.steps.length * 2}s`
  };
}

export function isSDKDriftProtected(sdk: AgentSDK): boolean {
  return !!(
    sdk["x-provenance"]?.sourceHash &&
    sdk["x-provenance"]?.generatedAt
  );
}

export function getSDKProfiles(sdk: AgentSDK): string[] {
  return Object.keys(sdk["x-profiles"] || {});
}