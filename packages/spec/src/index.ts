/**
 * AgentSDK Specification Package
 *
 * This package provides the core JSON Schema specification for AgentSDK
 * along with TypeScript types and validation utilities.
 */

// Export types
export * from "./types/index";

// Export validation utilities
export * from "./validator";

// Export the JSON Schema directly
import * as agentSdkSchema from "./schemas/agent-sdk.schema.json";
export { agentSdkSchema };

// Version information
export const AGENT_SDK_SPEC_VERSION = "0.1.0";
export const AGENT_SDK_SCHEMA_VERSION = "0.1.0";

// Utility constants
export const SUPPORTED_HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;
export const SUPPORTED_AUTH_MODES = [
  "none",
  "apiKey",
  "oauth2",
  "bearer",
] as const;
export const SUPPORTED_RETRY_STRATEGIES = [
  "none",
  "exponentialBackoff",
  "linearBackoff",
] as const;
export const SUPPORTED_ERROR_CATEGORIES = [
  "auth",
  "validation",
  "rate_limit",
  "server_error",
  "network",
  "not_found",
] as const;

// Re-export for convenience
export type { JSONSchemaType } from "ajv";
