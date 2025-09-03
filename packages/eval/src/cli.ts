#!/usr/bin/env node

/**
 * CLI tool for running AgentSDK evaluations
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
import { createObjectCsvWriter } from "csv-writer";
import { validateAgentSDKDocument } from "@agent-sdk/spec";
import { EvaluationHarness, CATFACTS_TASKS } from "./index.js";

const program = new Command();

program
  .name("eval-agent-sdk")
  .description("Run evaluation comparing AgentSDK vs baseline approaches")
  .version("0.1.0");

// CatFacts evaluation
program
  .command("catfacts")
  .description("Run CatFacts evaluation (T1 and T2 tasks)")
  .argument("<sdk-file>", "Path to CatFacts AgentSDK JSON file")
  .option("--openai-key <key>", "OpenAI API key (or set OPENAI_API_KEY)")
  .option("--output <dir>", "Output directory for results", "./eval-results")
  .option("--base-url <url>", "Override SDK base URL")
  .option("--runs <n>", "Number of runs per task/treatment", "3")
  .action(async (sdkFile: string, options: any) => {
    try {
      console.log(chalk.blue("🧪 Starting CatFacts evaluation..."));

      // Setup
      const apiKey = options.openaiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.error(
          chalk.red(
            "❌ OpenAI API key required. Use --openai-key or set OPENAI_API_KEY"
          )
        );
        process.exit(1);
      }

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

      console.log(chalk.green(`✅ Loaded ${sdk.name} v${sdk.version}`));

      // Create baseline documentation
      const baselineDocs = `
# Cat Facts API Documentation

Base URL: https://catfact.ninja

## Endpoints

### GET /fact
Returns a random cat fact.

Response:
{
  "fact": "string - the cat fact",
  "length": "integer - character length"
}

### GET /facts
Returns multiple cat facts with pagination.

Query Parameters:
- limit: integer (1-100) - number of facts to return
- max_length: integer (min 10) - maximum character length

Response:
{
  "data": [
    {
      "fact": "string - the cat fact", 
      "length": "integer - character length"
    }
  ],
  "current_page": "integer - current page",
  "total": "integer - total facts available"
}
`;

      const runs = parseInt(options.runs);
      const allRuns = [];

      // Run evaluation multiple times
      for (let runIndex = 0; runIndex < runs; runIndex++) {
        console.log(chalk.blue(`\n🔄 Run ${runIndex + 1}/${runs}`));

        const harness = new EvaluationHarness(CATFACTS_TASKS);

        // Add treatments
        harness.addBaseline("baseline-docs", apiKey, baselineDocs);
        harness.addAgentSDK("agent-sdk", apiKey, sdk, options.baseUrl);

        const report = await harness.runEvaluation();
        allRuns.push(report);
      }

      // Aggregate results
      console.log(chalk.blue("\n📊 Aggregating results..."));

      const outputDir = resolve(options.output);
      require("fs").mkdirSync(outputDir, { recursive: true });

      // Export detailed runs to CSV
      const csvData = allRuns.flatMap((report) =>
        report.runs.map((run) => ({
          runId: report.runId,
          timestamp: report.timestamp,
          taskId: run.taskId,
          treatmentName: run.treatmentName,
          success: run.success,
          duration: run.duration,
          tokensIn: run.metrics.tokensIn || 0,
          tokensOut: run.metrics.tokensOut || 0,
          totalTokens: run.metrics.totalTokens || 0,
          httpCalls: run.metrics.httpCalls,
          invalidCalls: run.metrics.invalidCalls,
          retries: run.metrics.retries,
          httpErrors: run.metrics.httpErrors,
          error: run.error || "",
        }))
      );

      const csvWriter = createObjectCsvWriter({
        path: `${outputDir}/detailed-results.csv`,
        header: [
          { id: "runId", title: "Run ID" },
          { id: "timestamp", title: "Timestamp" },
          { id: "taskId", title: "Task ID" },
          { id: "treatmentName", title: "Treatment" },
          { id: "success", title: "Success" },
          { id: "duration", title: "Duration (ms)" },
          { id: "tokensIn", title: "Tokens In" },
          { id: "tokensOut", title: "Tokens Out" },
          { id: "totalTokens", title: "Total Tokens" },
          { id: "httpCalls", title: "HTTP Calls" },
          { id: "invalidCalls", title: "Invalid Calls" },
          { id: "retries", title: "Retries" },
          { id: "httpErrors", title: "HTTP Errors" },
          { id: "error", title: "Error Message" },
        ],
      });

      await csvWriter.writeRecords(csvData);
      console.log(
        chalk.green(`📄 Detailed results: ${outputDir}/detailed-results.csv`)
      );

      // Calculate aggregate statistics
      const aggregateStats: any = {};

      for (const treatmentName of ["baseline-docs", "agent-sdk"]) {
        const treatmentRuns = csvData.filter(
          (run) => run.treatmentName === treatmentName
        );
        const successfulRuns = treatmentRuns.filter((run) => run.success);

        aggregateStats[treatmentName] = {
          totalRuns: treatmentRuns.length,
          successfulRuns: successfulRuns.length,
          failedRuns: treatmentRuns.length - successfulRuns.length,
          successRate:
            treatmentRuns.length > 0
              ? ((successfulRuns.length / treatmentRuns.length) * 100).toFixed(
                  1
                ) + "%"
              : "0%",
          avgDuration:
            treatmentRuns.length > 0
              ? Math.round(
                  treatmentRuns.reduce((sum, run) => sum + run.duration, 0) /
                    treatmentRuns.length
                )
              : 0,
          avgTokensTotal:
            treatmentRuns.length > 0
              ? Math.round(
                  treatmentRuns.reduce((sum, run) => sum + run.totalTokens, 0) /
                    treatmentRuns.length
                )
              : 0,
          totalHttpCalls: treatmentRuns.reduce(
            (sum, run) => sum + run.httpCalls,
            0
          ),
          totalInvalidCalls: treatmentRuns.reduce(
            (sum, run) => sum + run.invalidCalls,
            0
          ),
          totalRetries: treatmentRuns.reduce(
            (sum, run) => sum + run.retries,
            0
          ),
          totalHttpErrors: treatmentRuns.reduce(
            (sum, run) => sum + run.httpErrors,
            0
          ),
        };
      }

      // Generate markdown report
      const markdownReport = `# CatFacts Evaluation Report
      
Generated: ${new Date().toISOString()}
Runs: ${runs} per treatment
Tasks: ${CATFACTS_TASKS.length} (T1, T2)

## Summary

| Metric | Baseline-Docs | AgentSDK | Improvement |
|--------|---------------|----------|-------------|
| Success Rate | ${aggregateStats["baseline-docs"].successRate} | ${aggregateStats["agent-sdk"].successRate} | ${(parseFloat(aggregateStats["agent-sdk"].successRate) - parseFloat(aggregateStats["baseline-docs"].successRate)).toFixed(1)}pp |
| Avg Duration (ms) | ${aggregateStats["baseline-docs"].avgDuration} | ${aggregateStats["agent-sdk"].avgDuration} | ${(((aggregateStats["baseline-docs"].avgDuration - aggregateStats["agent-sdk"].avgDuration) / aggregateStats["baseline-docs"].avgDuration) * 100).toFixed(1)}% |
| Avg Total Tokens | ${aggregateStats["baseline-docs"].avgTokensTotal} | ${aggregateStats["agent-sdk"].avgTokensTotal} | ${(((aggregateStats["baseline-docs"].avgTokensTotal - aggregateStats["agent-sdk"].avgTokensTotal) / aggregateStats["baseline-docs"].avgTokensTotal) * 100).toFixed(1)}% |
| Total Invalid Calls | ${aggregateStats["baseline-docs"].totalInvalidCalls} | ${aggregateStats["agent-sdk"].totalInvalidCalls} | ${aggregateStats["baseline-docs"].totalInvalidCalls - aggregateStats["agent-sdk"].totalInvalidCalls} |
| Total Retries | ${aggregateStats["baseline-docs"].totalRetries} | ${aggregateStats["agent-sdk"].totalRetries} | ${aggregateStats["baseline-docs"].totalRetries - aggregateStats["agent-sdk"].totalRetries} |

## Task Results

### T1: Fetch 3 random facts over 100 chars
${csvData
  .filter((r) => r.taskId === "T1")
  .map(
    (r) =>
      `- ${r.treatmentName}: ${r.success ? "✅" : "❌"} (${r.duration}ms, ${r.totalTokens} tokens)`
  )
  .join("\n")}

### T2: List facts with filtering  
${csvData
  .filter((r) => r.taskId === "T2")
  .map(
    (r) =>
      `- ${r.treatmentName}: ${r.success ? "✅" : "❌"} (${r.duration}ms, ${r.totalTokens} tokens)`
  )
  .join("\n")}

## Key Findings

${aggregateStats["agent-sdk"].successRate > aggregateStats["baseline-docs"].successRate ? "✅" : "❌"} **Success Rate**: AgentSDK ${parseFloat(aggregateStats["agent-sdk"].successRate) > parseFloat(aggregateStats["baseline-docs"].successRate) ? "outperformed" : "underperformed"} baseline by ${Math.abs(parseFloat(aggregateStats["agent-sdk"].successRate) - parseFloat(aggregateStats["baseline-docs"].successRate)).toFixed(1)} percentage points

${aggregateStats["agent-sdk"].avgTokensTotal < aggregateStats["baseline-docs"].avgTokensTotal ? "✅" : "❌"} **Token Efficiency**: AgentSDK used ${Math.abs(((aggregateStats["baseline-docs"].avgTokensTotal - aggregateStats["agent-sdk"].avgTokensTotal) / aggregateStats["baseline-docs"].avgTokensTotal) * 100).toFixed(1)}% ${aggregateStats["agent-sdk"].avgTokensTotal < aggregateStats["baseline-docs"].avgTokensTotal ? "fewer" : "more"} tokens on average

${aggregateStats["agent-sdk"].totalInvalidCalls < aggregateStats["baseline-docs"].totalInvalidCalls ? "✅" : "❌"} **Invalid Calls**: AgentSDK had ${Math.abs(aggregateStats["agent-sdk"].totalInvalidCalls - aggregateStats["baseline-docs"].totalInvalidCalls)} ${aggregateStats["agent-sdk"].totalInvalidCalls < aggregateStats["baseline-docs"].totalInvalidCalls ? "fewer" : "more"} invalid calls

## Conclusion

${aggregateStats["agent-sdk"].successRate >= aggregateStats["baseline-docs"].successRate && aggregateStats["agent-sdk"].avgTokensTotal <= aggregateStats["baseline-docs"].avgTokensTotal && aggregateStats["agent-sdk"].totalInvalidCalls <= aggregateStats["baseline-docs"].totalInvalidCalls ? "🎉 **AgentSDK successfully demonstrated improvements over baseline approach!**" : "⚠️ **Mixed results - AgentSDK shows promise but needs refinement.**"}

The evaluation shows that AgentSDK's structured approach to API consumption ${aggregateStats["agent-sdk"].successRate > aggregateStats["baseline-docs"].successRate ? "delivers measurable improvements in reliability and efficiency" : "provides a foundation for improvement with further optimization"}.
`;

      writeFileSync(`${outputDir}/report.md`, markdownReport);
      console.log(chalk.green(`📋 Report: ${outputDir}/report.md`));

      // Export full results JSON
      writeFileSync(
        `${outputDir}/full-results.json`,
        JSON.stringify(
          {
            aggregateStats,
            allRuns,
            csvData,
          },
          null,
          2
        )
      );
      console.log(
        chalk.green(`📦 Full results: ${outputDir}/full-results.json`)
      );

      // Show summary
      console.log(chalk.blue("\n📈 Evaluation Summary:"));
      console.log(chalk.gray("─".repeat(60)));

      for (const [treatment, stats] of Object.entries(aggregateStats)) {
        const typedStats = stats as any;
        console.log(chalk.bold(treatment.toUpperCase()));
        console.log(`  Success Rate: ${typedStats.successRate}`);
        console.log(`  Avg Duration: ${typedStats.avgDuration}ms`);
        console.log(`  Avg Tokens: ${typedStats.avgTokensTotal}`);
        console.log(`  Invalid Calls: ${typedStats.totalInvalidCalls}`);
        console.log("");
      }

      const agentSDKBetter =
        parseFloat(aggregateStats["agent-sdk"].successRate) >=
          parseFloat(aggregateStats["baseline-docs"].successRate) &&
        aggregateStats["agent-sdk"].avgTokensTotal <=
          aggregateStats["baseline-docs"].avgTokensTotal &&
        aggregateStats["agent-sdk"].totalInvalidCalls <=
          aggregateStats["baseline-docs"].totalInvalidCalls;

      console.log(
        agentSDKBetter
          ? chalk.green("🎉 AgentSDK outperformed baseline!")
          : chalk.yellow("⚠️  Mixed results - room for improvement")
      );
    } catch (error) {
      console.error(chalk.red("❌ Evaluation failed:"));
      console.error(
        chalk.red(error instanceof Error ? error.message : String(error))
      );
      process.exit(1);
    }
  });

program.parse();
