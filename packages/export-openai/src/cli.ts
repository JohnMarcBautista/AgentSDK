#!/usr/bin/env node

/**
 * CLI tool for exporting AgentSDK to OpenAI function calling format
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
import { agentSDKToOpenAITools, getOpenAITools } from "./index.js";

const program = new Command();

program
  .name("export-openai")
  .description("Export AgentSDK to OpenAI function calling format")
  .version("0.1.0");

program
  .argument("<input>", "Path to AgentSDK JSON file")
  .option("-o, --output <file>", "Output file path (default: stdout)")
  .option("--tools-only", "Export only the tools array (not full metadata)")
  .option("--pretty", "Pretty-print the JSON output")
  .option("--validate", "Validate AgentSDK before export (default: true)", true)
  .action(async (input: string, options: any) => {
    try {
      console.error(chalk.blue("🔧 Exporting AgentSDK to OpenAI format..."));

      // Read and parse input file
      const inputPath = resolve(input);
      console.error(chalk.gray(`Reading: ${inputPath}`));

      const content = readFileSync(inputPath, "utf-8");
      const sdk = JSON.parse(content);

      // Validate if requested
      if (options.validate) {
        console.error(chalk.gray("Validating AgentSDK..."));
        const validation = validateAgentSDKDocument(sdk);

        if (!validation.valid) {
          console.error(chalk.red("❌ Validation failed:"));
          validation.errors.forEach((error) => {
            console.error(chalk.red(`  ${error.path}: ${error.message}`));
          });
          process.exit(1);
        }

        console.error(chalk.green("✅ Validation passed"));
      }

      // Export to OpenAI format
      console.error(chalk.gray("Converting to OpenAI format..."));

      const result = options.toolsOnly
        ? getOpenAITools(sdk)
        : agentSDKToOpenAITools(sdk);

      // Format output
      const jsonOutput = options.pretty
        ? JSON.stringify(result, null, 2)
        : JSON.stringify(result);

      // Write output
      if (options.output) {
        const outputPath = resolve(options.output);
        writeFileSync(outputPath, jsonOutput);
        console.error(chalk.green(`✅ Exported to: ${outputPath}`));

        // Show summary
        const toolCount = Array.isArray(result)
          ? result.length
          : result.tools.length;
        console.error(
          chalk.blue(
            `📊 Exported ${toolCount} tools from ${sdk.name} v${sdk.version}`
          )
        );
      } else {
        // Output to stdout
        console.log(jsonOutput);
      }
    } catch (error) {
      console.error(chalk.red("❌ Export failed:"));
      console.error(
        chalk.red(error instanceof Error ? error.message : String(error))
      );
      process.exit(1);
    }
  });

// Add info command
program
  .command("info")
  .description("Show information about an AgentSDK file")
  .argument("<input>", "Path to AgentSDK JSON file")
  .action(async (input: string) => {
    try {
      const inputPath = resolve(input);
      const content = readFileSync(inputPath, "utf-8");
      const sdk = JSON.parse(content);

      console.log(chalk.bold.blue(`📋 AgentSDK Information`));
      console.log(chalk.gray("─".repeat(50)));
      console.log(`${chalk.bold("Name:")} ${sdk.name}`);
      console.log(`${chalk.bold("Version:")} ${sdk.version}`);
      console.log(
        `${chalk.bold("Base URL:")} ${sdk.baseUrl || "Not specified"}`
      );
      console.log(
        `${chalk.bold("Operations:")} ${sdk.operations?.length || 0}`
      );

      if (sdk.auth?.modes) {
        console.log(
          `${chalk.bold("Auth Modes:")} ${sdk.auth.modes.join(", ")}`
        );
      }

      if (sdk["x-usagePatterns"]) {
        console.log(
          `${chalk.bold("Usage Patterns:")} ${sdk["x-usagePatterns"].length}`
        );
      }

      if (sdk["x-antiPatterns"]) {
        console.log(
          `${chalk.bold("Anti-Patterns:")} ${sdk["x-antiPatterns"].length}`
        );
      }

      console.log(chalk.gray("─".repeat(50)));
      console.log(chalk.bold.green("Operations:"));

      sdk.operations?.forEach((op: any, index: number) => {
        console.log(
          `  ${index + 1}. ${chalk.cyan(op.opId)} (${op.method} ${op.path})`
        );
        if (op.summary) {
          console.log(`     ${chalk.gray(op.summary)}`);
        }
      });
    } catch (error) {
      console.error(chalk.red("❌ Failed to read AgentSDK:"));
      console.error(
        chalk.red(error instanceof Error ? error.message : String(error))
      );
      process.exit(1);
    }
  });

// Add validate command
program
  .command("validate")
  .description("Validate an AgentSDK file")
  .argument("<input>", "Path to AgentSDK JSON file")
  .action(async (input: string) => {
    try {
      const inputPath = resolve(input);
      const content = readFileSync(inputPath, "utf-8");
      const sdk = JSON.parse(content);

      console.log(chalk.blue("🔍 Validating AgentSDK..."));

      const validation = validateAgentSDKDocument(sdk);

      if (validation.valid) {
        console.log(chalk.green("✅ AgentSDK is valid!"));

        // Show additional info
        console.log(
          chalk.gray(`📊 ${sdk.operations?.length || 0} operations defined`)
        );

        if (sdk["x-usagePatterns"]) {
          console.log(
            chalk.gray(`🔄 ${sdk["x-usagePatterns"].length} usage patterns`)
          );
        }

        if (sdk["x-antiPatterns"]) {
          console.log(
            chalk.gray(
              `⚠️  ${sdk["x-antiPatterns"].length} anti-patterns listed`
            )
          );
        }
      } else {
        console.log(chalk.red("❌ AgentSDK validation failed:"));
        validation.errors.forEach((error) => {
          console.log(chalk.red(`  ${error.path}: ${error.message}`));
        });
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red("❌ Validation failed:"));
      console.error(
        chalk.red(error instanceof Error ? error.message : String(error))
      );
      process.exit(1);
    }
  });

program.parse();
