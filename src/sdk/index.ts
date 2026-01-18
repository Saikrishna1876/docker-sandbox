export interface SandboxOptions {
  /** Server URL (defaults to http://localhost:4000) */
  serverUrl?: string;
  /** Git source to clone into the sandbox */
  source?: {
    url: string;
    type: "git";
  };
  /** Timeout in milliseconds */
  timeout?: number;
  /** Ports to expose from the container */
  ports?: number[];
  /** Runtime environment (e.g., "node22") */
  runtime?: string;
}

export interface CommandOptions {
  /** Command to run */
  cmd: string;
  /** Arguments for the command */
  args: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Stream to write stderr output */
  stderr?: WritableStream<Uint8Array>;
  /** Stream to write stdout output */
  stdout?: WritableStream<Uint8Array>;
  /** Run in background without waiting */
  detached?: boolean;
}

export interface CommandFinished {
  /** Exit code of the command */
  exitCode: number;
}

interface SandboxCreateResponse {
  id: string;
  ports: Record<number, number>;
}

const DEFAULT_SERVER_URL = "http://localhost:4000";

export class Sandbox {
  /** Container ID */
  id: string;
  /** Mapped ports (container port -> host port) */
  ports: Record<number, number>;
  /** Server URL */
  private serverUrl: string;

  constructor(
    id: string,
    ports: Record<number, number>,
    serverUrl: string = DEFAULT_SERVER_URL,
  ) {
    this.id = id;
    this.ports = ports;
    this.serverUrl = serverUrl;
  }

  /**
   * Create a new sandbox container
   */
  static async create(opts: SandboxOptions = {}): Promise<Sandbox> {
    const serverUrl = opts.serverUrl || DEFAULT_SERVER_URL;

    const res = await fetch(`${serverUrl}/sandbox`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: opts.source,
        ports: opts.ports,
        runtime: opts.runtime,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to create sandbox: ${await res.text()}`);
    }

    const data = (await res.json()) as SandboxCreateResponse;
    return new Sandbox(data.id, data.ports, serverUrl);
  }

  /**
   * Run a command in the sandbox
   */
  async runCommand(opts: CommandOptions): Promise<CommandFinished> {
    const res = await fetch(`${this.serverUrl}/sandbox/${this.id}/exec`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cmd: opts.cmd,
        args: opts.args,
        detached: opts.detached,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to run command: ${await res.text()}`);
    }

    if (opts.detached) {
      return { exitCode: 0 };
    }

    if (!res.body) return { exitCode: 0 };

    const reader = res.body.getReader();

    // Writers for the streams
    const stdoutWriter = opts.stdout ? opts.stdout.getWriter() : null;
    const stderrWriter = opts.stderr ? opts.stderr.getWriter() : null;

    let buffer = new Uint8Array(0);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Append new data to buffer
        const newBuffer = new Uint8Array(buffer.length + value.length);
        newBuffer.set(buffer);
        newBuffer.set(value, buffer.length);
        buffer = newBuffer;

        // Process buffer (Docker multiplexed stream format)
        while (buffer.length >= 8) {
          const type = buffer[0];
          // Safe access because we checked length
          const b4 = buffer[4]!;
          const b5 = buffer[5]!;
          const b6 = buffer[6]!;
          const b7 = buffer[7]!;

          const size = (b4 << 24) | (b5 << 16) | (b6 << 8) | b7;

          if (buffer.length < 8 + size) {
            break; // Wait for more data
          }

          const payload = buffer.slice(8, 8 + size);
          buffer = buffer.slice(8 + size);

          if (type === 1 && stdoutWriter) {
            await stdoutWriter.write(payload);
          } else if (type === 2 && stderrWriter) {
            await stderrWriter.write(payload);
          } else {
            // Default to stdout if unknown or type 0
            if (stdoutWriter) await stdoutWriter.write(payload);
          }
        }
      }
    } finally {
      if (stdoutWriter) stdoutWriter.releaseLock();
      if (stderrWriter) stderrWriter.releaseLock();
    }

    return { exitCode: 0 };
  }

  /**
   * Get the info about the sandbox container
   */
  async getInfo(): Promise<unknown> {
    const res = await fetch(`${this.serverUrl}/sandbox/${this.id}`);
    if (!res.ok) {
      throw new Error(`Failed to get sandbox info: ${await res.text()}`);
    }
    return res.json();
  }

  /**
   * Stop and remove the sandbox container
   */
  async destroy(): Promise<void> {
    const res = await fetch(`${this.serverUrl}/sandbox/${this.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      throw new Error(`Failed to destroy sandbox: ${await res.text()}`);
    }
  }

  /**
   * Get the URL for an exposed port
   */
  domain(port: number): string {
    const mapped = this.ports[port];
    if (!mapped) throw new Error(`Port ${port} not exposed`);
    return `http://localhost:${mapped}`;
  }
}

/**
 * Helper to create a WritableStream from Node.js stdout/stderr
 */
export function createLogStream(
  stream: NodeJS.WriteStream,
): WritableStream<Uint8Array> {
  return new WritableStream<Uint8Array>({
    write(chunk) {
      stream.write(chunk);
    },
  });
}
