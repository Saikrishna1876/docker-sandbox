/**
 * Simple example showing basic sandbox operations
 */
import { Sandbox, createLogStream } from "../src";

async function main() {
  // Create a sandbox with Node.js 22
  const sandbox = await Sandbox.create({
    runtime: "node22",
    ports: [3000],
  });

  console.log(`Sandbox ID: ${sandbox.id.slice(0, 12)}`);

  // Run a simple command
  console.log("\nRunning: node --version");
  await sandbox.runCommand({
    cmd: "node",
    args: ["--version"],
    stdout: createLogStream(process.stdout),
    stderr: createLogStream(process.stderr),
  });

  // Run another command
  console.log("\nRunning: echo 'Hello from sandbox!'");
  await sandbox.runCommand({
    cmd: "echo",
    args: ["Hello from sandbox!"],
    stdout: createLogStream(process.stdout),
    stderr: createLogStream(process.stderr),
  });

  // Clean up
  console.log("\nDestroying sandbox...");
  await sandbox.destroy();
  console.log("Done!");
}

main().catch(console.error);
