/**
 * Minimal typings + registration helper for the WebMCP browser API
 * (`navigator.modelContext`). Falls back to a lightweight in-page shim so the
 * tools are still inspectable/callable when the browser has no native support.
 */

export interface WebMCPToolResponse {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export interface WebMCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<WebMCPToolResponse> | WebMCPToolResponse;
}

interface ModelContext {
  registerTool?: (tool: WebMCPTool) => { unregister?: () => void } | void;
  provideContext?: (ctx: { tools: WebMCPTool[] }) => void;
}

declare global {
  interface Navigator {
    modelContext?: ModelContext;
  }
  interface Window {
    __agentStudioWebMCP?: {
      tools: WebMCPTool[];
      call: (name: string, args?: Record<string, unknown>) => Promise<WebMCPToolResponse>;
      native: boolean;
    };
  }
}

export const textResult = (text: string, isError = false): WebMCPToolResponse => ({
  content: [{ type: "text", text }],
  isError,
});

export const jsonResult = (value: unknown): WebMCPToolResponse =>
  textResult(JSON.stringify(value, null, 2));

/**
 * Registers the given tools with navigator.modelContext (native when
 * available) and always exposes a `window.__agentStudioWebMCP` shim for
 * testing. Returns a cleanup function.
 */
export function registerWebMCPTools(tools: WebMCPTool[]): () => void {
  if (typeof window === "undefined") return () => {};

  const ctx = navigator.modelContext;
  const native = Boolean(ctx?.registerTool || ctx?.provideContext);
  const cleanups: Array<() => void> = [];

  if (ctx?.registerTool) {
    for (const tool of tools) {
      const handle = ctx.registerTool(tool);
      if (handle && typeof handle.unregister === "function") {
        cleanups.push(() => handle.unregister?.());
      }
    }
  } else if (ctx?.provideContext) {
    ctx.provideContext({ tools });
    cleanups.push(() => ctx.provideContext?.({ tools: [] }));
  }

  window.__agentStudioWebMCP = {
    tools,
    native,
    call: async (name, args = {}) => {
      const tool = tools.find((t) => t.name === name);
      if (!tool) return textResult(`Unknown tool: ${name}`, true);
      return await tool.execute(args);
    },
  };
  cleanups.push(() => {
    delete window.__agentStudioWebMCP;
  });

  return () => cleanups.forEach((fn) => fn());
}
