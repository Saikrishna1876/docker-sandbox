import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { stream } from "hono/streaming";
import Docker from "dockerode";
import type {
  Container,
  ContainerCreateOptions,
  ContainerInspectInfo,
  ExecStartOptions,
} from "dockerode";

export interface ServerOptions {
  port?: number;
}

export interface SandboxCreateRequest {
  source?: {
    url: string;
    type: "git";
  };
  ports?: number[];
  runtime?: string;
}

export interface ExecRequest {
  cmd: string;
  args?: string[];
  detached?: boolean;
}

export function startServer(options: ServerOptions = {}) {
  const docker = new Docker();
  const PORT = options.port || 4000;

  const app = new Hono();

  // Enable CORS
  app.use("*", cors());

  // Root endpoint
  app.get("/", (c) => {
    return c.json({
      status: "ok",
      message: "Docker Sandbox Server is running",
    });
  });

  // Create sandbox
  app.post("/sandbox", async (c) => {
    try {
      const body = (await c.req.json()) as SandboxCreateRequest;
      const { source, ports, runtime } = body;

      const image = runtime === "node22" ? "node:22" : "node:latest";

      // Ensure image exists
      try {
        await docker.getImage(image).inspect();
      } catch (e) {
        console.log(`📦 Pulling image ${image}...`);
        await new Promise<void>((resolve, reject) => {
          docker.pull(
            image,
            (err: Error | null, stream: NodeJS.ReadableStream) => {
              if (err) return reject(err);
              docker.modem.followProgress(stream, onFinished, onProgress);
              function onFinished(err: Error | null, output: unknown) {
                if (err) return reject(err);
                resolve();
              }
              function onProgress(event: unknown) {}
            },
          );
        });
      }

      const portBindings: Record<string, { HostPort: string }[]> = {};
      const exposedPorts: Record<string, {}> = {};
      if (ports) {
        ports.forEach((p) => {
          exposedPorts[`${p}/tcp`] = {};
          portBindings[`${p}/tcp`] = [{ HostPort: "0" }]; // Random host port
        });
      }

      const containerOptions: ContainerCreateOptions = {
        Image: image,
        Cmd: ["tail", "-f", "/dev/null"], // Keep alive
        ExposedPorts: exposedPorts,
        HostConfig: {
          PortBindings: portBindings,
        },
        WorkingDir: "/app",
      };

      const container: Container =
        await docker.createContainer(containerOptions);

      await container.start();

      // Clone Git Repo if source provided
      if (source && source.type === "git") {
        console.log(`📥 Cloning ${source.url}...`);
        const exec = await container.exec({
          Cmd: ["git", "clone", source.url, "."],
          AttachStdout: true,
          AttachStderr: true,
        });

        const startOpts: ExecStartOptions = { Detach: false, Tty: false };
        const execStream = (await exec.start(
          startOpts,
        )) as NodeJS.ReadableStream;

        // Wait for stream to end
        await new Promise<void>((resolve, reject) => {
          execStream.on("end", resolve);
          execStream.on("error", reject);
          execStream.resume(); // Ensure flowing
        });
      }

      const info: ContainerInspectInfo = await container.inspect();
      const mappedPorts: Record<number, number> = {};
      if (ports && info.NetworkSettings && info.NetworkSettings.Ports) {
        ports.forEach((p) => {
          const binding = info.NetworkSettings.Ports[`${p}/tcp`];
          if (binding && binding[0] && binding[0].HostPort) {
            mappedPorts[p] = parseInt(binding[0].HostPort, 10);
          }
        });
      }

      console.log(`✅ Sandbox created: ${container.id.slice(0, 12)}`);
      return c.json({ id: container.id, ports: mappedPorts });
    } catch (error) {
      console.error("Create Error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: errorMessage }, 500);
    }
  });

  // Get sandbox info
  app.get("/sandbox/:id", async (c) => {
    try {
      const containerId = c.req.param("id");
      const container = docker.getContainer(containerId);
      const info = await container.inspect();
      return c.json(info);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: errorMessage }, 500);
    }
  });

  // Delete sandbox
  app.delete("/sandbox/:id", async (c) => {
    try {
      const containerId = c.req.param("id");
      const container = docker.getContainer(containerId);
      await container.stop();
      await container.remove();
      console.log(`🗑️ Sandbox removed: ${containerId.slice(0, 12)}`);
      return c.json({ status: "removed" });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: errorMessage }, 500);
    }
  });

  // Execute command in sandbox
  app.post("/sandbox/:id/exec", async (c) => {
    const containerId = c.req.param("id");
    try {
      const body = (await c.req.json()) as ExecRequest;
      const { cmd, args, detached } = body;
      const fullCmd = [cmd, ...(args || [])];

      const container = docker.getContainer(containerId);

      const exec = await container.exec({
        Cmd: fullCmd,
        AttachStdout: !detached,
        AttachStderr: !detached,
        Tty: false,
      });

      if (detached) {
        const startOpts: ExecStartOptions = { Detach: true };
        await exec.start(startOpts);
        return c.json({ status: "started" });
      } else {
        const startOpts: ExecStartOptions = { Detach: false, Tty: false };
        const execStream = (await exec.start(
          startOpts,
        )) as NodeJS.ReadableStream;

        // Stream output back to client
        return stream(c, async (s) => {
          for await (const chunk of execStream) {
            await s.write(chunk);
          }
        });
      }
    } catch (error) {
      console.error("Exec Error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return c.json({ error: errorMessage }, 500);
    }
  });

  console.log(`🐳 Docker Sandbox Server running on http://localhost:${PORT}`);

  const server = serve({
    fetch: app.fetch,
    port: PORT,
  });

  return server;
}
