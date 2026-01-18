# docker-sandbox

A Docker-based sandbox for running isolated code execution environments. Start a server with one `npx` command and use the SDK to create and manage sandboxes.

## Features

- 🐳 Create isolated Docker containers for code execution
- 🔄 Clone Git repositories into sandboxes
- 🔌 Expose and map container ports
- 📡 Stream command output in real-time
- 🎯 Simple SDK for programmatic control

## Quick Start

### Start the Server

```bash
# Using npx (no installation required)
npx @saikrishnaambeti/docker-sandbox
# Or with a custom port
npx @saikrishnaambeti/docker-sandbox --port 8080
```

### Install the SDK

````bash
bun add @saikrishnaambeti/docker-sandbox```

### Use the SDK

```typescript
import { Sandbox, createLogStream } from "@saikrishnaambeti/docker-sandbox";

async function main() {
  // Create a sandbox
  const sandbox = await Sandbox.create({
    runtime: "node22",
    ports: [3000],
    source: {
      url: "https://github.com/your/repo.git",
      type: "git",
    },
  });

  // Run commands
  await sandbox.runCommand({
    cmd: "npm",
    args: ["install"],
    stdout: createLogStream(process.stdout),
    stderr: createLogStream(process.stderr),
  });

  // Start a dev server (detached)
  await sandbox.runCommand({
    cmd: "npm",
    args: ["run", "dev"],
    detached: true,
  });

  // Get the URL for the exposed port
  const url = sandbox.domain(3000);
  console.log(`Server running at: ${url}`);

  // Clean up when done
  await sandbox.destroy();
}

main();
````

## CLI Options

```
Usage:
  @saikrishnaambeti/docker-sandbox [options]

Options:
  -p, --port <port>   Port to run the server on (default: 4000)
  -h, --help          Show help message
  -v, --version       Show version
```

## SDK API

### `Sandbox.create(options)`

Create a new sandbox container.

**Options:**

- `serverUrl?: string` - Server URL (default: `http://localhost:4000`)
- `source?: { url: string, type: "git" }` - Git repository to clone
- `timeout?: number` - Timeout in milliseconds
- `ports?: number[]` - Ports to expose from the container
- `runtime?: string` - Runtime environment (e.g., `"node22"`)

**Returns:** `Promise<Sandbox>`

### `sandbox.runCommand(options)`

Run a command in the sandbox.

**Options:**

- `cmd: string` - Command to run
- `args: string[]` - Arguments for the command
- `env?: Record<string, string>` - Environment variables
- `stdout?: WritableStream<Uint8Array>` - Stream for stdout
- `stderr?: WritableStream<Uint8Array>` - Stream for stderr
- `detached?: boolean` - Run in background

**Returns:** `Promise<{ exitCode: number }>`

### `sandbox.domain(port)`

Get the URL for an exposed port.

**Returns:** `string` (e.g., `http://localhost:32789`)

### `sandbox.getInfo()`

Get container information.

**Returns:** `Promise<unknown>`

### `sandbox.destroy()`

Stop and remove the sandbox container.

**Returns:** `Promise<void>`

### `createLogStream(stream)`

Helper to create a `WritableStream` from Node.js `stdout`/`stderr`.

```typescript
import { createLogStream } from "@saikrishnaambeti/docker-sandbox";

await sandbox.runCommand({
  cmd: "echo",
  args: ["hello"],
  stdout: createLogStream(process.stdout),
});
```

## Development

```bash
# Install dependencies
bun install

# Run the server in development mode
bun run dev

# Build the package
bun run build

# Run the example
bun run example
```

## Requirements

- Docker must be installed and running
- Node.js 18+ or Bun

## License

MIT
