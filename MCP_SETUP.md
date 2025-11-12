# Better Auth MCP Server Setup

This project includes configuration for the Better Auth MCP (Model Context Protocol) server, which enables AI models to understand and interact with your authentication system.

## Configuration File

The `.mcp.json` file in the project root configures the Better Auth MCP server:

```json
{
  "mcpServers": {
    "better-auth": {
      "type": "remote",
      "url": "https://mcp.chonkie.ai/better-auth/better-auth-builder/mcp",
      "transport": "http",
      "description": "Better Auth MCP server for authentication system understanding and code generation"
    }
  }
}
```

## What the MCP Server Provides

- **Configuration Understanding**: AI models can understand your Better Auth configuration
- **Code Generation**: Helps generate auth-related code and configurations
- **Plugin Context**: Provides context about Better Auth plugins and patterns
- **Debugging Support**: Assists with debugging authentication issues
- **Best Practices**: Guides implementation of secure authentication patterns

## Installation for Claude Code

### Quick Installation
```bash
pnpm @better-auth/cli mcp --claude-code
```

### Alternative Methods
```bash
# For Cursor
pnpm @better-auth/cli mcp --cursor

# For Open Code
pnpm @better-auth/cli mcp --open-code

# Manual setup
pnpm @better-auth/cli mcp --manual
```

### Manual Claude Code Configuration
```bash
claude mcp add --transport http better-auth https://mcp.chonkie.ai/better-auth/better-auth-builder/mcp
```

## Project Context

This configuration includes project-specific context to help the MCP server understand:

- **Plugin Type**: Client-side Better Auth plugin
- **Framework**: Better Auth authentication framework
- **Integrations**: Sigma Identity, Bitcoin Auth, OAuth2
- **Target Platforms**: Next.js, React, Vite

## Using the MCP Server

Once configured, AI assistants (like Claude Code) can:

1. **Understand your auth flow**: Analyze the OAuth redirect pattern
2. **Suggest improvements**: Recommend security enhancements
3. **Generate boilerplate**: Create callback handlers and API routes
4. **Debug issues**: Help troubleshoot authentication problems
5. **Explain patterns**: Clarify Better Auth plugin architecture

## Related Documentation

- [Better Auth MCP Docs](https://better-auth.com/mcp)
- [Project README](./README.md) - Full plugin documentation
- [Better Auth Plugins](https://better-auth.com/plugins)

## Notes

- The MCP server is "powered by Chonkie" and operates via HTTP transport
- Alternative providers like `context7` can also be used
- Configuration is checked into version control for team consistency
- No API keys or secrets required for the default remote endpoint
