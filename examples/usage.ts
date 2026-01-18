/**
 * Example usage of the @saikrishnaambeti/docker-sandbox SDK
 *
 * Before running this example:
 * 1. Start the server: npx @saikrishnaambeti/docker-sandbox
 * 2. Run this file: bun run examples/usage.ts
 */
import ms from "ms";
import { Sandbox, createLogStream } from "../src";
import { setTimeout } from "timers/promises";
import { spawn } from "child_process";

async function main() {
  console.log("Creating sandbox...");

  const sandbox = await Sandbox.create({
    source: {
      url: "https://github.com/vercel/sandbox-example-next.git",
      type: "git",
    },
    timeout: ms("5m"),
    ports: [3000],
    runtime: "node22",
  });

  console.log(`Sandbox created with ID: ${sandbox.id.slice(0, 12)}`);
  console.log(`Ports: ${JSON.stringify(sandbox.ports)}`);

  console.log(`\nInstalling dependencies...`);
  const install = await sandbox.runCommand({
    cmd: "npm",
    args: ["install", "--loglevel", "info"],
    stderr: createLogStream(process.stderr),
    stdout: createLogStream(process.stdout),
  });

  if (install.exitCode !== 0) {
    console.log("Installing packages failed");
    process.exit(1);
  }

  console.log(`\nStarting the development server...`);
  await sandbox.runCommand({
    cmd: "npm",
    args: ["run", "dev"],
    stderr: createLogStream(process.stderr),
    stdout: createLogStream(process.stdout),
    detached: true,
  });

  await setTimeout(2000);
  const url = sandbox.domain(3000);
  console.log(`\nOpening ${url}`);
  spawn("open", [url]);
}

main().catch(console.error);
