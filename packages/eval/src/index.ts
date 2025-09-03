/**
 * Evaluation harness for AgentSDK vs baseline comparisons
 */

import { AgentSDK } from "@agent-sdk/spec";
import { createRunner, RunnerMetrics } from "@agent-sdk/runner";
import OpenAI from "openai";
// Using native fetch API (Node.js 18+)

export interface EvaluationTask {
  id: string;
  name: string;
  description: string;
  prompt: string;
  expectedOutputSchema?: object;
  successChecker: (result: any) => boolean;
  timeoutMs?: number;
}

export interface TreatmentConfig {
  name: string;
  description: string;
  type: "baseline-docs" | "agent-sdk";
  config: any;
}

export interface EvaluationRun {
  taskId: string;
  treatmentName: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  result?: any;
  error?: string;
  metrics: {
    tokensIn?: number;
    tokensOut?: number;
    totalTokens?: number;
    httpCalls: number;
    invalidCalls: number;
    retries: number;
    httpErrors: number;
  };
}

export interface EvaluationReport {
  runId: string;
  timestamp: string;
  tasks: EvaluationTask[];
  treatments: TreatmentConfig[];
  runs: EvaluationRun[];
  summary: {
    [treatmentName: string]: {
      totalTasks: number;
      successfulTasks: number;
      failedTasks: number;
      successRate: number;
      avgDuration: number;
      avgTokensIn: number;
      avgTokensOut: number;
      avgTotalTokens: number;
      totalHttpCalls: number;
      totalInvalidCalls: number;
      totalRetries: number;
      totalHttpErrors: number;
    };
  };
}

/**
 * CatFacts evaluation tasks
 */
export const CATFACTS_TASKS: EvaluationTask[] = [
  {
    id: "T1",
    name: "Get 3 random facts",
    description:
      "Get 3 random cat facts and return as JSON array with fact and length properties",
    prompt:
      "Get 3 random cat facts. Return them as a JSON array where each item has 'fact' and 'length' properties.",
    successChecker: (result) => {
      if (!Array.isArray(result)) return false;
      if (result.length !== 3) return false;

      // Check each fact has required properties
      for (const fact of result) {
        if (
          !fact.fact ||
          !fact.length ||
          typeof fact.fact !== "string" ||
          typeof fact.length !== "number"
        ) {
          return false;
        }
        // Just check that length makes sense (not empty, not too long)
        if (fact.length < 10 || fact.length > 500) return false;
      }

      return true;
    },
    timeoutMs: 30000,
  },
  {
    id: "T2",
    name: "List facts with limit",
    description: "Get cat facts with limit=5, return just the data array",
    prompt:
      "Get cat facts using limit=5. Return just the data array from the response (not the full pagination object).",
    successChecker: (result) => {
      if (!Array.isArray(result)) return false;
      if (result.length !== 5) return false;

      // Check each fact has required properties
      for (const fact of result) {
        if (
          !fact.fact ||
          !fact.length ||
          typeof fact.fact !== "string" ||
          typeof fact.length !== "number"
        ) {
          return false;
        }
        // Basic sanity check on length
        if (fact.length < 10 || fact.length > 500) return false;
      }

      return true;
    },
    timeoutMs: 20000,
  },
];

/**
 * Baseline treatment - uses RAG with documentation
 */
export class BaselineTreatment {
  private openai: OpenAI;
  private docsContent: string;

  constructor(apiKey: string, docsContent: string) {
    this.openai = new OpenAI({ apiKey });
    this.docsContent = docsContent;
  }

  async executeTask(task: EvaluationTask): Promise<EvaluationRun> {
    const startTime = Date.now();
    let tokensIn = 0;
    let tokensOut = 0;
    let httpCalls = 0;
    let httpErrors = 0;

    try {
      const systemPrompt = `You are an assistant that helps users interact with APIs. Here is the API documentation:

${this.docsContent}

When the user asks for data, I will make the HTTP requests for you and give you the results. Just tell me what API calls to make and I'll execute them.`;

      // First, ask the LLM what API calls it needs
      const planCompletion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content:
              task.prompt +
              "\n\nWhat API calls do I need to make? Respond with just the HTTP method and URL(s), one per line.",
          },
        ],
        temperature: 0,
      });

      tokensIn += planCompletion.usage?.prompt_tokens || 0;
      tokensOut += planCompletion.usage?.completion_tokens || 0;

      const planResponse = planCompletion.choices[0].message.content || "";

      // Extract API calls from the response
      const apiCalls = planResponse.match(/GET\s+https?:\/\/[^\s\n]+/g) || [];

      // Execute the API calls
      const apiResults = [];
      for (const call of apiCalls) {
        try {
          const url = call.replace("GET ", "");
          httpCalls++;
          const response = await fetch(url);
          if (!response.ok) {
            httpErrors++;
            throw new Error(`HTTP ${response.status}`);
          }
          const data = await response.json();
          apiResults.push(data);
        } catch (error) {
          httpErrors++;
          apiResults.push({
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Now ask the LLM to process the results
      const processCompletion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant that processes API responses.",
          },
          {
            role: "user",
            content: `Original task: ${task.prompt}

API Results: ${JSON.stringify(apiResults, null, 2)}

Process these results and return the exact JSON format requested. Return only the final JSON result, no explanation.`,
          },
        ],
        temperature: 0,
      });

      tokensIn += processCompletion.usage?.prompt_tokens || 0;
      tokensOut += processCompletion.usage?.completion_tokens || 0;

      const responseContent =
        processCompletion.choices[0].message.content || "";

      // Try to extract JSON from response
      let result: any;
      try {
        // Look for JSON in code blocks or try to parse the whole response
        const jsonMatch = responseContent.match(
          /```(?:json)?\s*(\[.*?\]|\{.*?\})\s*```/s
        );
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[1]);
        } else {
          result = JSON.parse(responseContent);
        }
      } catch {
        // If no valid JSON, the task failed
        throw new Error("No valid JSON in response");
      }

      const success = task.successChecker(result);

      return {
        taskId: task.id,
        treatmentName: "baseline-docs",
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        success,
        result,
        metrics: {
          tokensIn,
          tokensOut,
          totalTokens: tokensIn + tokensOut,
          httpCalls,
          invalidCalls: success ? 0 : 1,
          retries: 0,
          httpErrors,
        },
      };
    } catch (error) {
      return {
        taskId: task.id,
        treatmentName: "baseline-docs",
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          tokensIn,
          tokensOut,
          totalTokens: tokensIn + tokensOut,
          httpCalls,
          invalidCalls: 1,
          retries: 0,
          httpErrors,
        },
      };
    }
  }
}

/**
 * AgentSDK treatment - uses structured tools
 */
export class AgentSDKTreatment {
  private openai: OpenAI;
  private sdk: AgentSDK;
  private baseUrl?: string;

  constructor(apiKey: string, sdk: AgentSDK, baseUrl?: string) {
    this.openai = new OpenAI({ apiKey });
    this.sdk = sdk;
    this.baseUrl = baseUrl;
  }

  async executeTask(task: EvaluationTask): Promise<EvaluationRun> {
    const startTime = Date.now();
    let tokensIn = 0;
    let tokensOut = 0;

    try {
      const runner = createRunner({
        sdk: this.sdk,
        baseUrl: this.baseUrl,
        enableMetrics: true,
        enableLogging: false,
      });

      const tools = runner.getOpenAITools();

      const systemPrompt = `You are an assistant that can use the ${this.sdk.name} API through function calls. Use the available tools to complete the user's request. Return results as JSON.`;

      const messages: any[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: task.prompt },
      ];

      // Initial completion with tools
      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0,
      });

      tokensIn += completion.usage?.prompt_tokens || 0;
      tokensOut += completion.usage?.completion_tokens || 0;

      const assistantMessage = completion.choices[0].message;
      messages.push(assistantMessage);

      // Execute tool calls if any
      if (assistantMessage.tool_calls) {
        for (const toolCall of assistantMessage.tool_calls) {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            const result = await runner.executeToolCall(
              toolCall.function.name,
              args
            );

            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });
          } catch (error) {
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: `Error: ${error instanceof Error ? error.message : String(error)}`,
            });
          }
        }

        // Get final response
        const finalCompletion = await this.openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages,
          temperature: 0,
        });

        tokensIn += finalCompletion.usage?.prompt_tokens || 0;
        tokensOut += finalCompletion.usage?.completion_tokens || 0;

        const finalContent = finalCompletion.choices[0].message.content || "";

        // Extract result
        let result: any;
        try {
          const jsonMatch = finalContent.match(
            /```(?:json)?\s*(\[.*?\]|\{.*?\})\s*```/s
          );
          if (jsonMatch) {
            result = JSON.parse(jsonMatch[1]);
          } else {
            result = JSON.parse(finalContent);
          }
        } catch {
          throw new Error("No valid JSON in final response");
        }

        // Unwrap common response patterns
        if (result && typeof result === "object" && !Array.isArray(result)) {
          // Look for arrays in common wrapper keys
          const arrayKeys = ["cat_facts", "facts", "data", "results", "items"];
          for (const key of arrayKeys) {
            if (Array.isArray(result[key])) {
              result = result[key];
              break;
            }
          }
        }

        const success = task.successChecker(result);
        const runnerMetrics = runner.getMetrics();

        return {
          taskId: task.id,
          treatmentName: "agent-sdk",
          startTime,
          endTime: Date.now(),
          duration: Date.now() - startTime,
          success,
          result,
          metrics: {
            tokensIn,
            tokensOut,
            totalTokens: tokensIn + tokensOut,
            httpCalls: runnerMetrics.totalOperations,
            invalidCalls: success ? 0 : 1,
            retries: runnerMetrics.totalRetries,
            httpErrors: runnerMetrics.failedOperations,
          },
        };
      } else {
        // No tool calls - extract direct result
        const content = assistantMessage.content || "";
        let result: any;

        try {
          const jsonMatch = content.match(
            /```(?:json)?\s*(\[.*?\]|\{.*?\})\s*```/s
          );
          if (jsonMatch) {
            result = JSON.parse(jsonMatch[1]);
          } else {
            result = JSON.parse(content);
          }
        } catch {
          throw new Error("No valid JSON in response");
        }

        // Unwrap common response patterns
        if (result && typeof result === "object" && !Array.isArray(result)) {
          // Look for arrays in common wrapper keys
          const arrayKeys = ["cat_facts", "facts", "data", "results", "items"];
          for (const key of arrayKeys) {
            if (Array.isArray(result[key])) {
              result = result[key];
              break;
            }
          }
        }

        const success = task.successChecker(result);

        return {
          taskId: task.id,
          treatmentName: "agent-sdk",
          startTime,
          endTime: Date.now(),
          duration: Date.now() - startTime,
          success,
          result,
          metrics: {
            tokensIn,
            tokensOut,
            totalTokens: tokensIn + tokensOut,
            httpCalls: 0,
            invalidCalls: success ? 0 : 1,
            retries: 0,
            httpErrors: 0,
          },
        };
      }
    } catch (error) {
      return {
        taskId: task.id,
        treatmentName: "agent-sdk",
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          tokensIn,
          tokensOut,
          totalTokens: tokensIn + tokensOut,
          httpCalls: 0,
          invalidCalls: 1,
          retries: 0,
          httpErrors: 0,
        },
      };
    }
  }
}

/**
 * Main evaluation runner
 */
export class EvaluationHarness {
  private runId: string;
  private tasks: EvaluationTask[];
  private treatments: Map<string, BaselineTreatment | AgentSDKTreatment>;
  private runs: EvaluationRun[] = [];

  constructor(tasks: EvaluationTask[]) {
    this.runId = `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.tasks = tasks;
    this.treatments = new Map();
  }

  addBaseline(name: string, apiKey: string, docsContent: string): void {
    this.treatments.set(name, new BaselineTreatment(apiKey, docsContent));
  }

  addAgentSDK(
    name: string,
    apiKey: string,
    sdk: AgentSDK,
    baseUrl?: string
  ): void {
    this.treatments.set(name, new AgentSDKTreatment(apiKey, sdk, baseUrl));
  }

  async runEvaluation(): Promise<EvaluationReport> {
    console.log(`🚀 Starting evaluation ${this.runId}`);
    console.log(
      `📋 ${this.tasks.length} tasks, ${this.treatments.size} treatments`
    );

    for (const task of this.tasks) {
      console.log(`\n🎯 Running task: ${task.name}`);

      for (const [treatmentName, treatment] of this.treatments) {
        console.log(`  📊 Treatment: ${treatmentName}`);

        try {
          const run = await treatment.executeTask(task);
          this.runs.push(run);

          const status = run.success ? "✅" : "❌";
          console.log(
            `    ${status} ${run.success ? "Success" : "Failed"} (${run.duration}ms)`
          );
          if (run.error) {
            console.log(`      Error: ${run.error}`);
          }
        } catch (error) {
          console.log(
            `    ❌ Treatment failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }

    return this.generateReport();
  }

  private generateReport(): EvaluationReport {
    const summary: EvaluationReport["summary"] = {};

    // Calculate summary statistics for each treatment
    for (const treatmentName of this.treatments.keys()) {
      const treatmentRuns = this.runs.filter(
        (run) => run.treatmentName === treatmentName
      );
      const successfulRuns = treatmentRuns.filter((run) => run.success);

      const totalTokensIn = treatmentRuns.reduce(
        (sum, run) => sum + (run.metrics.tokensIn || 0),
        0
      );
      const totalTokensOut = treatmentRuns.reduce(
        (sum, run) => sum + (run.metrics.tokensOut || 0),
        0
      );
      const totalTokensTotal = treatmentRuns.reduce(
        (sum, run) => sum + (run.metrics.totalTokens || 0),
        0
      );
      const totalDuration = treatmentRuns.reduce(
        (sum, run) => sum + run.duration,
        0
      );

      summary[treatmentName] = {
        totalTasks: treatmentRuns.length,
        successfulTasks: successfulRuns.length,
        failedTasks: treatmentRuns.length - successfulRuns.length,
        successRate:
          treatmentRuns.length > 0
            ? successfulRuns.length / treatmentRuns.length
            : 0,
        avgDuration:
          treatmentRuns.length > 0 ? totalDuration / treatmentRuns.length : 0,
        avgTokensIn:
          treatmentRuns.length > 0 ? totalTokensIn / treatmentRuns.length : 0,
        avgTokensOut:
          treatmentRuns.length > 0 ? totalTokensOut / treatmentRuns.length : 0,
        avgTotalTokens:
          treatmentRuns.length > 0
            ? totalTokensTotal / treatmentRuns.length
            : 0,
        totalHttpCalls: treatmentRuns.reduce(
          (sum, run) => sum + run.metrics.httpCalls,
          0
        ),
        totalInvalidCalls: treatmentRuns.reduce(
          (sum, run) => sum + run.metrics.invalidCalls,
          0
        ),
        totalRetries: treatmentRuns.reduce(
          (sum, run) => sum + run.metrics.retries,
          0
        ),
        totalHttpErrors: treatmentRuns.reduce(
          (sum, run) => sum + run.metrics.httpErrors,
          0
        ),
      };
    }

    return {
      runId: this.runId,
      timestamp: new Date().toISOString(),
      tasks: this.tasks,
      treatments: Array.from(this.treatments.keys()).map((name) => ({
        name,
        description: `${name} treatment`,
        type: name.includes("baseline") ? "baseline-docs" : "agent-sdk",
        config: {},
      })),
      runs: this.runs,
      summary,
    };
  }
}
