import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import childProcess from "node:child_process";

class Child {
  process: childProcess.ChildProcess;
  state: "running" | "stopped" = "running";
  stopCode: number | null = null;

  stdout: string = "";
  stderr: string = "";

  constructor(shell: string) {
    const child = childProcess.spawn(shell, {
      shell: true,
    });

    child.stdout?.on("data", (data) => {
      this.stdout += data.toString();
    });
    child.stderr?.on("data", (data) => {
      this.stderr += data.toString();
    });

    child.on("exit", (code) => {
      this.state = "stopped";
      this.stopCode = code;
    });

    this.process = child;
  }

  public getStdout(): string {
    return this.stdout;
  }
  public getStderr(): string {
    return this.stderr;
  }
  public getState(): "running" | "stopped" {
    return this.state;
  }
  public getStopCode(): number | null {
    return this.stopCode;
  }
  public getPid(): number {
    return this.process.pid || -1;
  }
  public writeToStdin(data: string): void {
    if (this.process.stdin) {
      this.process.stdin.write(data);
    } else {
      throw new Error("Child process stdin is not available.");
    }
  }
  public kill(): void {
    if (this.process.killed) {
      return;
    }
    this.process.kill();
    this.state = "stopped";
  }
}

// Create an MCP server
const server = new McpServer({
  name: "bgtask-server",
  version: "1.0.0",
});

const processes = new Map<string, Child>();

// Add an addition tool
server.registerTool(
  "run-background-task",
  {
    title: "Run Background Task",
    description:
      "Runs a long-running command (like 'npm run dev') in background. When the command is running, you can interact with it using other tools.",
    inputSchema: {
      name: z.string().describe("Unique name of the task"),
      shell: z.string().describe("Shell command to run in background"),
    },
  },
  async ({ name, shell }) => {
    if (processes.has(name)) {
      throw new Error(`Task with name "${name}" is already running.`);
    }

    const child = new Child(shell);

    processes.set(name, child);

    return {
      content: [
        {
          type: "text",
          text: `Task "${name}" started with PID ${child.getPid()}.`,
        },
      ],
    };
  }
);

server.registerTool(
  "stop-background-task",
  {
    title: "Stop Background Task",
    description: "Stops a running background task by its name.",
    inputSchema: {
      name: z.string().describe("Unique name of the task to stop"),
    },
  },
  async ({ name }) => {
    const child = processes.get(name);
    if (!child) {
      return {
        content: [
          {
            type: "text",
            text: `No task found with name "${name}".`,
          },
        ],
      };
    }

    child.kill();
    processes.delete(name);

    return {
      content: [
        {
          type: "text",
          text: `Task "${name}" has been stopped.`,
        },
      ],
    };
  }
);

server.registerTool(
  "list-background-tasks",
  {
    title: "List Background Tasks",
    description: "Lists all currently running background tasks.",
    inputSchema: {},
  },
  async () => {
    if (processes.size === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No background tasks are currently running.",
          },
        ],
      };
    } else {
      const tasks = Array.from(processes.entries()).map(([name, child]) => ({
        name,
        pid: child.getPid(),
        state: child.getState(),
      }));
      return {
        content: [
          {
            type: "text",
            text: `Currently running tasks:\n${tasks
              .map(
                (task) =>
                  `- ${task.name} (PID: ${task.pid}, State: ${task.state})`
              )
              .join("\n")}`,
          },
        ],
      };
    }
  }
);

server.registerTool(
  "get-task-stdout",
  {
    title: "Get Task Stdout",
    description: "Retrieves the stdout of a running background task.",
    inputSchema: {
      name: z.string().describe("Unique name of the task"),
    },
  },
  async ({ name }) => {
    const child = processes.get(name);
    if (!child) {
      return {
        content: [
          {
            type: "text",
            text: `No task found with name "${name}".`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Stdout of task "${name}":\n${
            child.stdout || "No output yet."
          }`,
        },
      ],
    };
  }
);

server.registerTool(
  "get-task-stderr",
  {
    title: "Get Task Stderr",
    description: "Retrieves the stderr of a running background task.",
    inputSchema: {
      name: z.string().describe("Unique name of the task"),
    },
  },
  async ({ name }) => {
    const child = processes.get(name);
    if (!child) {
      return {
        content: [
          {
            type: "text",
            text: `No task found with name "${name}".`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Stderr of task "${name}":\n${
            child.stderr || "No error output yet."
          }`,
        },
      ],
    };
  }
);

server.registerTool(
  "send-to-task-stdin",
  {
    title: "Send to Task Stdin",
    description: "Sends data to the stdin of a running background task.",
    inputSchema: {
      name: z.string().describe("Unique name of the task"),
      data: z.string().describe("Data to send to the task's stdin"),
    },
  },
  async ({ name, data }) => {
    const child = processes.get(name);
    if (!child) {
      return {
        content: [
          {
            type: "text",
            text: `No task found with name "${name}".`,
          },
        ],
      };
    }

    try {
      child.writeToStdin(data);
      return {
        content: [
          {
            type: "text",
            text: `Data sent to task "${name}" stdin.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to send data to task "${name}" stdin: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      };
    }
  }
);

// Exit child processes when the server is stopped
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    // console.log(`Received ${signal}, stopping all background tasks...`);
    for (const [name, child] of processes.entries()) {
      // console.log(`Stopping task "${name}" with PID ${child.pid}...`);
      child.kill();
    }
    // console.log("All background tasks stopped.");
    process.exit(0);
  });
}

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
