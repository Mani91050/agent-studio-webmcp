/**
 * Lightweight client-side interpreter that maps agent chat requests
 * onto the registered WebMCP tools.
 */

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
}

const sceneId = (n: string) => `scene-${n}`;

/**
 * Interprets a natural-language request into one or more WebMCP tool calls.
 * Returns an empty array when no intent matches.
 */
export function interpretRequest(input: string): ToolCall[] {
  const text = input.trim();
  if (!text) return [];
  const lower = text.toLowerCase();

  // "Change scene 1 caption to ..." / "set caption of scene 2 to ..."
  const captionMatch =
    lower.match(/scene\s*(\d+)/) &&
    text.match(/caption[^a-zA-Z]*(?:to|as|:)?\s*["'“]?(.+?)["'”]?[.!]?$/i);
  if (captionMatch) {
    const n = lower.match(/scene\s*(\d+)/)![1]!;
    let caption = captionMatch[1]!.trim();
    // Guard: if no explicit "to/as/:" separator, the regex may swallow the command itself
    if (/caption/i.test(caption)) {
      const afterTo = text.match(/(?:caption[^a-zA-Z]*(?:to|as|:))\s*["'“]?(.+?)["'”]?[.!]?$/i);
      if (!afterTo) return [];
      caption = afterTo[1]!.trim();
    }
    return [{ tool: "update_caption", args: { scene_id: sceneId(n), caption } }];
  }

  // "Make scene 2 5 seconds." / "set scene 3 duration to 8s"
  const durationMatch =
    lower.match(/scene\s*(\d+)/) &&
    lower.match(/(\d+)\s*(?:seconds|secs|s\b)/);
  if (
    durationMatch &&
    /(make|set|change|duration|long|length)/.test(lower)
  ) {
    const n = lower.match(/scene\s*(\d+)/)![1]!;
    const secs = Number(lower.match(/(\d+)\s*(?:seconds|secs|s\b)/)![1]);
    return [
      { tool: "change_scene_duration", args: { scene_id: sceneId(n), duration: secs } },
    ];
  }

  // "Replace scene 3 visual." / "new visual for scene 2" / "change scene 1 image"
  const visualMatch =
    /(replace|change|swap|new|update)/.test(lower) &&
    /(visual|image|thumbnail|picture)/.test(lower);
  if (visualMatch) {
    const n = lower.match(/scene\s*(\d+)/)?.[1];
    const url = text.match(/https:\/\/\S+/)?.[0];
    return [
      {
        tool: "replace_scene_visual",
        args: { ...(n ? { scene_id: sceneId(n) } : {}), ...(url ? { image_url: url } : {}) },
      },
    ];
  }

  // "Show me the project." / "preview the project"
  if (/(preview)/.test(lower)) {
    return [{ tool: "preview_project", args: {} }];
  }
  if (/(show|get|read|describe|what)/.test(lower) && /project/.test(lower)) {
    return [{ tool: "get_project", args: {} }];
  }

  // "Show scene 2" / "get scene 1"
  if (/(show|get|read|describe)/.test(lower) && /scene\s*\d+/.test(lower)) {
    const n = lower.match(/scene\s*(\d+)/)![1]!;
    return [{ tool: "get_scene", args: { scene_id: sceneId(n) } }];
  }

  return [];
}
