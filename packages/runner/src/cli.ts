#!/usr/bin/env node

/**
 * CLI tool for running AgentSDK operations
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { Command } from "commander";
// Simple color utility to avoid ESM issues
const chalk = {
  blue: (text: string) => `\u001b[34m${text}\u001b[0m`,
  green: (text: string) => `\u001b[32m${text}\u001b[0m`,
  red: (text: string) => `\u001b[31m${text}\u001b[0m`,
  gray: (text: string) => `\u001b[90m${text}\u001b[0m`,
  yellow: (text: string) => `\u001b[33m${text}\u001b[0m`,
  cyan: (text: string) => `\u001b[36m${text}\u001b[0m`,
  bold: Object.assign((text: string) => `\u001b[1m${text}\u001b[0m`, {
    blue: (text: string) => `\u001b[1m\u001b[34m${text}\u001b[0m`,
    green: (text: string) => `\u001b[1m\u001b[32m${text}\u001b[0m`,
  }),
};
import { validateAgentSDKDocument } from "@agent-sdk/spec";
import { createRunner, executeToolCall } from "./index.js";
import OpenAI from "openai";

const program = new Command();

program
  .name("agent-runner")
  .description("Execute AgentSDK operations with validation and metrics")
  .version("0.1.0");

// Direct tool call execution
program
  .command("call")
  .description("Execute a single tool call")
  .argument("<sdk-file>", "Path to AgentSDK JSON file")
  .argument("<operation>", "Operation ID to call")
  .option("-a, --args <json>", "Arguments as JSON string", "{}")
  .option("--base-url <url>", "Override base URL")
  .option("--auth-header <header>", 'Auth header (format: "key:value")')
  .option("--timeout <ms>", "Request timeout in milliseconds", "10000")
  .option("--no-validate", "Skip input validation")
  .option("--metrics <file>", "Export metrics to CSV file")
  .action(async (sdkFile: string, operation: string, options: any) => {
    try {
      console.error(chalk.blue("🚀 Executing tool call..."));

      // Load SDK
      const sdkPath = resolve(sdkFile);
      const sdkContent = readFileSync(sdkPath, "utf-8");
      const sdk = JSON.parse(sdkContent);

      // Validate SDK
      if (options.validate !== false) {
        const validation = validateAgentSDKDocument(sdk);
        if (!validation.valid) {
          console.error(chalk.red("❌ SDK validation failed:"));
          validation.errors.forEach((error) => {
            console.error(chalk.red(`  ${error.path}: ${error.message}`));
          });
          process.exit(1);
        }
      }

      // Parse arguments
      let args: any = {};
      try {
        args = JSON.parse(options.args);
      } catch (error) {
        console.error(chalk.red("❌ Invalid JSON in --args"));
        process.exit(1);
      }

      // Parse auth header
      let authHeaders: Record<string, string> | undefined;
      if (options.authHeader) {
        const [key, ...valueParts] = options.authHeader.split(":");
        if (!key || valueParts.length === 0) {
          console.error(
            chalk.red('❌ Invalid auth header format. Use "key:value"')
          );
          process.exit(1);
        }
        authHeaders = { [key]: valueParts.join(":") };
      }

      // Create runner
      const runner = createRunner({
        sdk,
        baseUrl: options.baseUrl,
        authHeaders,
        timeout: parseInt(options.timeout),
        enableMetrics: true,
        enableLogging: true,
      });

      console.error(chalk.gray(`Calling ${operation} with args:`));
      console.error(chalk.gray(JSON.stringify(args, null, 2)));

      // Execute
      const result = await runner.executeToolCall(operation, args);

      // Output result
      console.log(JSON.stringify(result, null, 2));

      // Export metrics if requested
      if (options.metrics) {
        const metricsPath = resolve(options.metrics);
        const csv = runner.exportMetricsCSV();
        writeFileSync(metricsPath, csv);
        console.error(chalk.green(`📊 Metrics exported to: ${metricsPath}`));
      }

      // Show summary
      const metrics = runner.getMetrics();
      console.error(
        chalk.blue(
          `✅ Completed in ${metrics.totalDuration}ms (${metrics.totalRetries} retries)`
        )
      );
    } catch (error) {
      console.error(chalk.red("❌ Execution failed:"));
      console.error(
        chalk.red(error instanceof Error ? error.message : String(error))
      );
      process.exit(1);
    }
  });

// Interactive chat mode with OpenAI
program
  .command("chat")
  .description("Interactive chat using AgentSDK tools")
  .argument("<sdk-file>", "Path to AgentSDK JSON file")
  .option("--openai-key <key>", "OpenAI API key (or set OPENAI_API_KEY)")
  .option("--model <model>", "OpenAI model to use", "gpt-3.5-turbo")
  .option("--base-url <url>", "Override SDK base URL")
  .option("--auth-header <header>", 'Auth header (format: "key:value")')
  .option("--system <prompt>", "System prompt")
  .option("--max-turns <n>", "Maximum conversation turns", "10")
  .option("--metrics <file>", "Export metrics to CSV file")
  .action(async (sdkFile: string, options: any) => {
    try {
      console.log(chalk.blue("🤖 Starting AgentSDK chat session..."));

      // Load SDK
      const sdkPath = resolve(sdkFile);
      const sdkContent = readFileSync(sdkPath, "utf-8");
      const sdk = JSON.parse(sdkContent);

      // Validate SDK
      const validation = validateAgentSDKDocument(sdk);
      if (!validation.valid) {
        console.error(chalk.red("❌ SDK validation failed:"));
        validation.errors.forEach((error) => {
          console.error(chalk.red(`  ${error.path}: ${error.message}`));
        });
        process.exit(1);
      }

      // Setup OpenAI
      const apiKey = options.openaiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.error(
          chalk.red(
            "❌ OpenAI API key required. Use --openai-key or set OPENAI_API_KEY"
          )
        );
        process.exit(1);
      }

      const openai = new OpenAI({ apiKey });

      // Parse auth header
      let authHeaders: Record<string, string> | undefined;
      if (options.authHeader) {
        const [key, ...valueParts] = options.authHeader.split(":");
        if (!key || valueParts.length === 0) {
          console.error(
            chalk.red('❌ Invalid auth header format. Use "key:value"')
          );
          process.exit(1);
        }
        authHeaders = { [key]: valueParts.join(":") };
      }

      // Create runner
      const runner = createRunner({
        sdk,
        baseUrl: options.baseUrl,
        authHeaders,
        enableMetrics: true,
        enableLogging: true,
      });

      // Get tools
      const tools = runner.getOpenAITools();
      console.log(
        chalk.green(`✅ Loaded ${tools.length} tools from ${sdk.name}`)
      );

      // Chat loop
      const messages: any[] = [];

      if (options.system) {
        messages.push({ role: "system", content: options.system });
      } else {
        messages.push({
          role: "system",
          content: `You are an assistant that can use the ${sdk.name} API. Use the available tools to help the user.`,
        });
      }

      console.log(chalk.gray('Type your message (or "quit" to exit):'));

      const readline = require("readline");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      let turnCount = 0;
      const maxTurns = parseInt(options.maxTurns);

      const askQuestion = () => {
        rl.question(chalk.cyan("You: "), async (userInput: string) => {
          if (userInput.toLowerCase() === "quit" || turnCount >= maxTurns) {
            rl.close();

            // Export metrics
            if (options.metrics) {
              const metricsPath = resolve(options.metrics);
              const csv = runner.exportMetricsCSV();
              writeFileSync(metricsPath, csv);
              console.log(
                chalk.green(`📊 Metrics exported to: ${metricsPath}`)
              );
            }

            // Show final metrics
            const metrics = runner.getMetrics();
            console.log(chalk.blue(`\n📈 Session Summary:`));
            console.log(
              chalk.gray(`  Total operations: ${metrics.totalOperations}`)
            );
            console.log(
              chalk.gray(`  Successful: ${metrics.successfulOperations}`)
            );
            console.log(chalk.gray(`  Failed: ${metrics.failedOperations}`));
            console.log(chalk.gray(`  Total retries: ${metrics.totalRetries}`));
            console.log(chalk.gray(`  Duration: ${metrics.totalDuration}ms`));

            return;
          }

          turnCount++;
          messages.push({ role: "user", content: userInput });

          try {
            // Call OpenAI with tools
            const completion = await openai.chat.completions.create({
              model: options.model,
              messages,
              tools,
              tool_choice: "auto",
            });

            const assistantMessage = completion.choices[0].message;
            messages.push(assistantMessage);

            // Handle tool calls
            if (assistantMessage.tool_calls) {
              console.log(
                chalk.yellow(
                  `🔧 Assistant is using ${assistantMessage.tool_calls.length} tool(s)...`
                )
              );

              for (const toolCall of assistantMessage.tool_calls) {
                try {
                  const args = JSON.parse(toolCall.function.arguments);
                  console.log(
                    chalk.gray(
                      `  Calling ${toolCall.function.name}(${JSON.stringify(args)})`
                    )
                  );

                  const result = await runner.executeToolCall(
                    toolCall.function.name,
                    args
                  );

                  messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(result),
                  });

                  console.log(
                    chalk.green(`  ✅ ${toolCall.function.name} completed`)
                  );
                } catch (error) {
                  const errorMsg =
                    error instanceof Error ? error.message : String(error);
                  console.log(
                    chalk.red(
                      `  ❌ ${toolCall.function.name} failed: ${errorMsg}`
                    )
                  );

                  messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: `Error: ${errorMsg}`,
                  });
                }
              }

              // Get final response after tool calls
              const followUp = await openai.chat.completions.create({
                model: options.model,
                messages,
              });

              const finalMessage = followUp.choices[0].message;
              messages.push(finalMessage);
              console.log(chalk.green(`Assistant: ${finalMessage.content}`));
            } else {
              console.log(
                chalk.green(`Assistant: ${assistantMessage.content}`)
              );
            }
          } catch (error) {
            console.error(
              chalk.red(
                `❌ Error: ${error instanceof Error ? error.message : String(error)}`
              )
            );
          }

          askQuestion();
        });
      };

      askQuestion();
    } catch (error) {
      console.error(chalk.red("❌ Chat session failed:"));
      console.error(
        chalk.red(error instanceof Error ? error.message : String(error))
      );
      process.exit(1);
    }
  });

program.parse();
