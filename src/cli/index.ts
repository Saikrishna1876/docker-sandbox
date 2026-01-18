#!/usr/bin/env node
import { startServer } from "../server/index.js";

const args = process.argv.slice(2);

const VERSION = "1.0.0";

function printHelp() {
  console.log(`
🐳 Docker Sandbox CLI

Usage:
  @saikrishnaambeti/docker-sandbox [options]

Options:
  -p, --port <port>   Port to run the server on (default: 4000)
  -h, --help          Show this help message
  -v, --version       Show version

Examples:
  @saikrishnaambeti/docker-sandbox                  # Start server on port 4000
  @saikrishnaambeti/docker-sandbox --port 8080      # Start server on port 8080
  npx @saikrishnaambeti/docker-sandbox              # Start server using npx
`);
}

function printVersion() {
  console.log(`@saikrishnaambeti/docker-sandbox v${VERSION}`);
}

function parseArgs(args: string[]): { port: number } {
  let port = 4000;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "-h" || arg === "--help") {
      printHelp();
      process.exit(0);
    }

    if (arg === "-v" || arg === "--version") {
      printVersion();
      process.exit(0);
    }

    if (arg === "-p" || arg === "--port") {
      const nextArg = args[i + 1];
      if (!nextArg) {
        console.error("Error: --port requires a value");
        process.exit(1);
      }
      port = parseInt(nextArg, 10);
      if (isNaN(port)) {
        console.error("Error: --port must be a number");
        process.exit(1);
      }
      i++; // Skip next arg
    }
  }

  return { port };
}

async function main() {
  const { port } = parseArgs(args);

  console.log(`
╔═══════════════════════════════════════════════════════╗
║           🐳 Docker Sandbox Server                    ║
╚═══════════════════════════════════════════════════════╝
`);

  startServer({ port });
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
