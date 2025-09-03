/**
 * AgentSDK validation utilities using AJV
 */

import Ajv, { ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { AgentSDK, Operation } from "./types/index";
import * as agentSdkSchema from "./schemas/agent-sdk.schema.json";

// Create AJV instance with formats
const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  strict: false, // Disable strict mode for flexibility
});

addFormats(ajv);

// Compile validators (remove $schema and $id to avoid meta-schema issues)
const schemaForValidation = { ...agentSdkSchema };
delete (schemaForValidation as any).$schema;
delete (schemaForValidation as any).$id;

const validateAgentSDK = ajv.compile(schemaForValidation);

export interface ValidationError {
  path: string;
  message: string;
  value?: any;
  schema?: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate an AgentSDK document against the schema
 */
export function validateAgentSDKDocument(data: any): ValidationResult {
  const valid = validateAgentSDK(data);

  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors: ValidationError[] = (validateAgentSDK.errors || []).map(
    (error) => ({
      path: error.instancePath || error.schemaPath || "root",
      message: error.message || "Validation error",
      value: error.data,
      schema: error.schema,
    })
  );

  return { valid: false, errors };
}

/**
 * Validate operation input parameters against the operation's input schema
 */
export function validateOperationInput(
  operation: Operation,
  input: any
): ValidationResult {
  try {
    const validator = ajv.compile(operation.input);
    const valid = validator(input);

    if (valid) {
      return { valid: true, errors: [] };
    }

    const errors: ValidationError[] = (validator.errors || []).map((error) => ({
      path: error.instancePath || error.schemaPath || "root",
      message: error.message || "Input validation error",
      value: error.data,
      schema: error.schema,
    }));

    return { valid: false, errors };
  } catch (error) {
    return {
      valid: false,
      errors: [
        {
          path: "input",
          message: `Schema compilation error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

/**
 * Validate operation output against the operation's output schema
 */
export function validateOperationOutput(
  operation: Operation,
  output: any
): ValidationResult {
  try {
    const validator = ajv.compile(operation.output);
    const valid = validator(output);

    if (valid) {
      return { valid: true, errors: [] };
    }

    const errors: ValidationError[] = (validator.errors || []).map((error) => ({
      path: error.instancePath || error.schemaPath || "root",
      message: error.message || "Output validation error",
      value: error.data,
      schema: error.schema,
    }));

    return { valid: false, errors };
  } catch (error) {
    return {
      valid: false,
      errors: [
        {
          path: "output",
          message: `Schema compilation error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

/**
 * Create a cached validator for an operation's input schema
 */
export function createInputValidator(operation: Operation): ValidateFunction {
  return ajv.compile(operation.input);
}

/**
 * Create a cached validator for an operation's output schema
 */
export function createOutputValidator(operation: Operation): ValidateFunction {
  return ajv.compile(operation.output);
}

/**
 * Validate that all operation IDs in an AgentSDK are unique
 */
export function validateUniqueOperationIds(sdk: AgentSDK): ValidationResult {
  const opIds = new Set<string>();
  const duplicates: string[] = [];

  for (const operation of sdk.operations) {
    if (opIds.has(operation.opId)) {
      duplicates.push(operation.opId);
    } else {
      opIds.add(operation.opId);
    }
  }

  if (duplicates.length === 0) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: duplicates.map((opId) => ({
      path: "operations",
      message: `Duplicate operation ID: ${opId}`,
      value: opId,
    })),
  };
}

/**
 * Validate that usage patterns reference valid operation IDs
 */
export function validateUsagePatterns(sdk: AgentSDK): ValidationResult {
  if (!sdk["x-usagePatterns"]) {
    return { valid: true, errors: [] };
  }

  const validOpIds = new Set(sdk.operations.map((op) => op.opId));
  const errors: ValidationError[] = [];

  for (const [patternIndex, pattern] of sdk["x-usagePatterns"].entries()) {
    for (const [stepIndex, step] of pattern.steps.entries()) {
      // Check if step is an operation ID (simple heuristic: camelCase identifier)
      if (/^[a-zA-Z][a-zA-Z0-9_]*$/.test(step) && !validOpIds.has(step)) {
        errors.push({
          path: `x-usagePatterns[${patternIndex}].steps[${stepIndex}]`,
          message: `Usage pattern "${pattern.name}" references unknown operation ID: ${step}`,
          value: step,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Comprehensive validation of an AgentSDK document
 */
export function validateComplete(data: any): ValidationResult {
  // First validate against JSON Schema
  const schemaResult = validateAgentSDKDocument(data);
  if (!schemaResult.valid) {
    return schemaResult;
  }

  const sdk = data as AgentSDK;

  // Validate unique operation IDs
  const uniqueResult = validateUniqueOperationIds(sdk);
  if (!uniqueResult.valid) {
    return uniqueResult;
  }

  // Validate usage patterns
  const patternsResult = validateUsagePatterns(sdk);
  if (!patternsResult.valid) {
    return patternsResult;
  }

  return { valid: true, errors: [] };
}

/**
 * Format validation errors for human-readable output
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) {
    return "No validation errors";
  }

  return errors
    .map((error) => {
      let message = `${error.path}: ${error.message}`;
      if (error.value !== undefined) {
        message += ` (got: ${JSON.stringify(error.value)})`;
      }
      return message;
    })
    .join("\n");
}
