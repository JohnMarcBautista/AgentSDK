/**
 * AgentSDK Runner - Execution runtime with validation and metrics
 */

import {
  AgentSDK,
  Operation,
  validateOperationInput,
  validateOperationOutput,
} from "@agent-sdk/spec";
import {
  ExecutionContext,
  createExecutionContext,
  findOperationForToolCall,
  buildHttpRequest,
  extractErrorInfo,
  getOpenAITools,
} from "@agent-sdk/export-openai";
// Using native fetch API (Node.js 18+)

// Simple retry implementation to avoid ESM issues
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        throw lastError;
      }

      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

export interface RunnerConfig {
  sdk: AgentSDK;
  baseUrl?: string;
  authHeaders?: Record<string, string>;
  timeout?: number;
  maxRetries?: number;
  enableMetrics?: boolean;
  enableLogging?: boolean;
}

export interface ExecutionMetrics {
  operationId: string;
  startTime: number;
  endTime: number;
  duration: number;
  httpStatus?: number;
  tokensIn?: number;
  tokensOut?: number;
  retryCount: number;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export interface RunnerMetrics {
  sessionId: string;
  startTime: number;
  endTime?: number;
  totalDuration?: number;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  totalRetries: number;
  operations: ExecutionMetrics[];
}

export class AgentSDKRunner {
  private context: ExecutionContext;
  private config: RunnerConfig;
  private metrics: RunnerMetrics;

  constructor(config: RunnerConfig) {
    this.config = config;
    this.context = createExecutionContext(config.sdk, {
      baseUrl: config.baseUrl,
      authHeaders: config.authHeaders,
    });

    this.metrics = {
      sessionId: this.generateSessionId(),
      startTime: Date.now(),
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      totalRetries: 0,
      operations: [],
    };
  }

  private generateSessionId(): string {
    return `runner_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get OpenAI tools for this SDK
   */
  getOpenAITools() {
    return getOpenAITools(this.config.sdk);
  }

  /**
   * Execute a tool call (operation)
   */
  async executeToolCall(toolCallName: string, args: any): Promise<any> {
    const startTime = Date.now();
    let retryCount = 0;
    let httpStatus: number | undefined;
    let errorCode: string | undefined;
    let errorMessage: string | undefined;

    try {
      // Find the operation
      const operation = findOperationForToolCall(this.context, toolCallName);
      if (!operation) {
        throw new Error(`Unknown operation: ${toolCallName}`);
      }

      // Validate input
      const inputValidation = validateOperationInput(operation, args);
      if (!inputValidation.valid) {
        const errorMsg = `Input validation failed: ${inputValidation.errors.map((e) => e.message).join(", ")}`;
        throw new Error(errorMsg);
      }

      // Execute with retry logic
      const result = await this.executeWithRetry(operation, args, (attempt) => {
        retryCount = attempt - 1; // p-retry is 1-indexed
      });

      httpStatus = result.httpStatus;

      // Validate output
      if (result.data && operation.output) {
        const outputValidation = validateOperationOutput(
          operation,
          result.data
        );
        if (!outputValidation.valid && this.config.enableLogging) {
          console.warn(
            `Output validation failed for ${toolCallName}:`,
            outputValidation.errors
          );
        }
      }

      // Record successful execution
      this.recordExecution({
        operationId: toolCallName,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        httpStatus,
        retryCount,
        success: true,
      });

      return result.data;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      errorCode = this.extractErrorCode(error);

      // Record failed execution
      this.recordExecution({
        operationId: toolCallName,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        httpStatus,
        retryCount,
        success: false,
        errorCode,
        errorMessage,
      });

      throw error;
    }
  }

  private async executeWithRetry(
    operation: Operation,
    args: any,
    onRetry?: (attempt: number) => void
  ): Promise<{ data: any; httpStatus: number }> {
    const guardrails = operation["x-guardrails"];
    const shouldRetry =
      guardrails?.retry && guardrails.retry.strategy !== "none";
    const maxRetries = Math.min(
      guardrails?.retry?.maxRetries || 3,
      this.config.maxRetries || 3
    );

    if (!shouldRetry) {
      return await this.executeHttp(operation, args);
    }

    let attempt = 0;
    return await retryWithBackoff(
      async () => {
        attempt++;
        if (onRetry && attempt > 1) {
          onRetry(attempt);
        }

        try {
          return await this.executeHttp(operation, args);
        } catch (error) {
          // Check if error is retryable
          if (this.isRetryableError(operation, error)) {
            if (this.config.enableLogging) {
              console.warn(
                `Attempt ${attempt} failed for ${operation.opId}:`,
                error instanceof Error ? error.message : String(error)
              );
            }
            throw error; // Let retryWithBackoff handle it
          } else {
            // Non-retryable error, don't retry
            throw error;
          }
        }
      },
      maxRetries,
      300
    );
  }

  private async executeHttp(
    operation: Operation,
    args: any
  ): Promise<{ data: any; httpStatus: number }> {
    const request = buildHttpRequest(this.context, operation, args);

    // Apply timeout
    const timeout = request.timeout || this.config.timeout || 10000;

    if (this.config.enableLogging) {
      console.log(`🔄 ${operation.method} ${request.url}`);
    }

    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: AbortSignal.timeout(timeout),
    });

    const httpStatus = response.status;
    let data: any;

    try {
      const text = await response.text();
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }

    if (!response.ok) {
      const errorInfo = extractErrorInfo(operation, httpStatus, data);
      const error = new Error(`HTTP ${httpStatus}: ${errorInfo.message}`);
      (error as any).httpStatus = httpStatus;
      (error as any).retryable = errorInfo.retryable;
      (error as any).errorCode = errorInfo.code;
      throw error;
    }

    return { data, httpStatus };
  }

  private isRetryableError(operation: Operation, error: any): boolean {
    // Check if error has explicit retryable flag
    if (typeof error.retryable === "boolean") {
      return error.retryable;
    }

    // Default retry logic
    const httpStatus = error.httpStatus;
    if (typeof httpStatus === "number") {
      // Retry on server errors and rate limiting
      return httpStatus >= 500 || httpStatus === 429;
    }

    // Retry on network errors
    return (
      error.code === "ENOTFOUND" ||
      error.code === "ECONNRESET" ||
      error.code === "ETIMEDOUT"
    );
  }

  private extractErrorCode(error: any): string | undefined {
    return error.errorCode || error.code || error.httpStatus?.toString();
  }

  private recordExecution(metrics: ExecutionMetrics): void {
    if (!this.config.enableMetrics) return;

    this.metrics.operations.push(metrics);
    this.metrics.totalOperations++;
    this.metrics.totalRetries += metrics.retryCount;

    if (metrics.success) {
      this.metrics.successfulOperations++;
    } else {
      this.metrics.failedOperations++;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): RunnerMetrics {
    return {
      ...this.metrics,
      endTime: Date.now(),
      totalDuration: Date.now() - this.metrics.startTime,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      sessionId: this.generateSessionId(),
      startTime: Date.now(),
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      totalRetries: 0,
      operations: [],
    };
  }

  /**
   * Export metrics to CSV format
   */
  exportMetricsCSV(): string {
    const headers = [
      "sessionId",
      "operationId",
      "startTime",
      "duration",
      "httpStatus",
      "retryCount",
      "success",
      "errorCode",
      "errorMessage",
    ];

    const rows = this.metrics.operations.map((op) => [
      this.metrics.sessionId,
      op.operationId,
      op.startTime.toString(),
      op.duration.toString(),
      op.httpStatus?.toString() || "",
      op.retryCount.toString(),
      op.success.toString(),
      op.errorCode || "",
      (op.errorMessage || "").replace(/"/g, '""'), // Escape quotes
    ]);

    return [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");
  }
}

/**
 * Create a runner instance
 */
export function createRunner(config: RunnerConfig): AgentSDKRunner {
  return new AgentSDKRunner({
    enableMetrics: true,
    enableLogging: true,
    ...config,
  });
}

/**
 * Execute a single tool call with a temporary runner
 */
export async function executeToolCall(
  sdk: AgentSDK,
  toolCallName: string,
  args: any,
  options: Omit<RunnerConfig, "sdk"> = {}
): Promise<any> {
  const runner = createRunner({ sdk, ...options });
  return await runner.executeToolCall(toolCallName, args);
}
