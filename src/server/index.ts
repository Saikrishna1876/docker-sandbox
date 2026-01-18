import { serve } from "bun";
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

// CORS headers
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function startServer(options: ServerOptions = {}) {
  const docker = new Docker();
  const PORT = options.port || 4000;

  console.log(`🐳 Docker Sandbox Server running on http://localhost:${PORT}`);

  const server = serve({
    port: PORT,
    routes: {
      "/": {
        OPTIONS: async () => {
          return new Response(null, { headers });
        },
        GET: async () => {
          return Response.json(
            { status: "ok", message: "Docker Sandbox Server is running" },
            { headers },
          );
        },
      },
      "/sandbox": {
        OPTIONS: async () => {
          return new Response(null, { headers });
        },
        POST: async (req) => {
          try {
            const body = (await req.json()) as SandboxCreateRequest;
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
              const stream = (await exec.start(
                startOpts,
              )) as NodeJS.ReadableStream;

              // Wait for stream to end
              await new Promise<void>((resolve, reject) => {
                stream.on("end", resolve);
                stream.on("error", reject);
                stream.resume(); // Ensure flowing
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
            return Response.json(
              { id: container.id, ports: mappedPorts },
              { headers },
            );
          } catch (error) {
            console.error("Create Error:", error);
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            return Response.json(
              { error: errorMessage },
              { status: 500, headers },
            );
          }
        },
      },
      "/sandbox/:id": {
        OPTIONS: async () => {
          return new Response(null, { headers });
        },
        GET: async (req) => {
          try {
            const containerId = req.params.id;
            const container = docker.getContainer(containerId);
            const info = await container.inspect();
            return Response.json(info, { headers });
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            return Response.json(
              { error: errorMessage },
              { status: 500, headers },
            );
          }
        },
        DELETE: async (req) => {
          try {
            const containerId = req.params.id;
            const container = docker.getContainer(containerId);
            await container.stop();
            await container.remove();
            console.log(`🗑️ Sandbox removed: ${containerId.slice(0, 12)}`);
            return Response.json({ status: "removed" }, { headers });
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            return Response.json(
              { error: errorMessage },
              { status: 500, headers },
            );
          }
        },
      },
      "/sandbox/:id/exec": {
        OPTIONS: async () => {
          return new Response(null, { headers });
        },
        POST: async (req) => {
          const containerId = req.params.id;
          try {
            const body = (await req.json()) as ExecRequest;
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
              return Response.json({ status: "started" }, { headers });
            } else {
              const startOpts: ExecStartOptions = { Detach: false, Tty: false };
              const stream = (await exec.start(
                startOpts,
              )) as NodeJS.ReadableStream;

              // Stream output back to client
              return new Response(
                new ReadableStream({
                  start(controller) {
                    stream.on("data", (chunk: Buffer) => {
                      controller.enqueue(chunk);
                    });
                    stream.on("end", () => {
                      controller.close();
                    });
                    stream.on("error", (err: Error) => {
                      controller.error(err);
                    });
                  },
                }),
                { headers },
              );
            }
          } catch (error) {
            console.error("Exec Error:", error);
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            return Response.json(
              { error: errorMessage },
              { status: 500, headers },
            );
          }
        },
      },
    },
    async fetch() {
      return new Response("Not Found", { status: 404 });
    },
  });

  return server;
}
