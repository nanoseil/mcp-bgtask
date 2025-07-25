# MCP Background Task Server

A Model Context Protocol (MCP) server that enables running and managing long-running background tasks from within Claude Desktop or other MCP-compatible clients.

## Features

- **Run Background Tasks**: Execute long-running commands (like `npm run dev`, servers, builds) in the background
- **Task Management**: Start, stop, and list running background tasks
- **Interactive Communication**: Send data to task stdin and retrieve stdout/stderr output
- **Process Monitoring**: Track task states, PIDs, and exit codes
- **Graceful Shutdown**: Automatically cleanup all background processes when the server stops

## Available Tools

### `run-background-task`
Starts a new background task with a unique name.

**Parameters:**
- `name` (string): Unique identifier for the task
- `shell` (string): Shell command to run in background

### `stop-background-task`
Stops a running background task by name.

**Parameters:**
- `name` (string): Name of the task to stop

### `list-background-tasks`
Lists all currently running background tasks with their PIDs and states.

### `get-task-stdout`
Retrieves the stdout output from a background task.

**Parameters:**
- `name` (string): Name of the task

### `get-task-stderr`
Retrieves the stderr output from a background task.

**Parameters:**
- `name` (string): Name of the task

### `send-to-task-stdin`
Sends data to the stdin of a running background task (useful for interactive commands).

**Parameters:**
- `name` (string): Name of the task
- `data` (string): Data to send to stdin

## Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd mcp-bgtask
```

2. Install dependencies:
```bash
pnpm install
```

3. Build the project:
```bash
pnpm run build
```

## Usage

### Development
```bash
pnpm run start
```

### Production
```bash
pnpm run build
node dist/index.js
```

### Development with Inspector
```bash
pnpm run dev
```

## Configuration

To use this MCP server with Claude Desktop, add it to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bgtask": {
      "command": "node",
      "args": ["/path/to/mcp-bgtask/dist/index.js"],
      "cwd": "/path/to/mcp-bgtask"
    }
  }
}
```

Replace `/path/to/mcp-bgtask` with the actual path to your project directory.

## Example Use Cases

1. **Development Server**: Start a development server and monitor its output
   ```
   run-background-task: name="dev-server", shell="npm run dev"
   ```

2. **Build Process**: Run a long build process and check its progress
   ```
   run-background-task: name="build", shell="npm run build:watch"
   ```

3. **Interactive Commands**: Run interactive CLI tools and send input
   ```
   run-background-task: name="cli-tool", shell="my-interactive-cli"
   send-to-task-stdin: name="cli-tool", data="user input\n"
   ```

4. **Log Monitoring**: Monitor logs from running processes
   ```
   get-task-stdout: name="dev-server"
   get-task-stderr: name="dev-server"
   ```

## Architecture

The server is built using:
- **Model Context Protocol SDK**: For MCP server implementation
- **Node.js Child Process**: For spawning and managing background processes
- **Zod**: For input validation and schema definition
- **TypeScript**: For type safety and better development experience

### Key Components

- **Child Class**: Manages individual background processes with state tracking
- **Process Map**: Maintains a registry of all running tasks
- **Signal Handlers**: Ensures graceful cleanup on server termination

## Development

### Scripts

- `pnpm run start`: Run the server in development mode
- `pnpm run build`: Build for production
- `pnpm run type-check`: Run TypeScript type checking
- `pnpm run dev`: Run with MCP inspector for debugging

### Testing

The project includes Vitest configuration for testing. Run tests with:
```bash
pnpm test
```

## Error Handling

The server includes robust error handling for:
- Duplicate task names
- Missing tasks
- Process communication failures
- Stdin/stdout availability issues

## Security Considerations

⚠️ **Warning**: This server can execute arbitrary shell commands. Only use it in trusted environments and be careful about what commands you run through it.

## License

ISC

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Troubleshooting

### Common Issues

1. **Task not starting**: Check if the shell command is valid and executable
2. **No output**: Some commands may not produce output immediately; check stderr as well
3. **Process not stopping**: Some processes may need specific signals; the server uses SIGTERM by default

### Debugging

Use the MCP inspector for debugging:
```bash
pnpm run dev
```

Then open the provided URL in your browser to inspect MCP communications.
