import { useEffect } from "react";
import scene1 from "@/assets/scene-1.jpg";
import scene2 from "@/assets/scene-2.jpg";
import scene3 from "@/assets/scene-3.jpg";
import type { Scene, StockResult } from "@/lib/mock-data";
import { registerWebMCPTools, jsonResult, textResult, type WebMCPTool } from "@/lib/webmcp";

export const FALLBACK_VISUALS = [scene1, scene2, scene3];
const PROJECT_NAME = "Neon District — Teaser Cut";

interface UseWebMCPOptions {
  scenes: Scene[];
  selectedScene: Scene;
  updateScene: (id: string, patch: Partial<Pick<Scene, "caption" | "duration" | "thumbnail" | "videoUrl">>) => void;
  logToolCall: (
    toolName: string,
    text: string,
    extra?: { sceneId?: string | null; results?: StockResult[] },
  ) => void;
}

const sceneView = (s: Scene) => ({
  id: s.id,
  index: s.index,
  title: s.title,
  caption: s.caption,
  duration: s.duration,
  status: s.status,
  thumbnail: s.thumbnail,
});

export function useWebMCP({ scenes, selectedScene, updateScene, logToolCall }: UseWebMCPOptions) {
  useEffect(() => {
    const findScene = (id?: unknown): Scene | undefined => {
      if (typeof id === "string" && id) {
        return scenes.find((s) => s.id === id || String(s.index) === id);
      }
      return scenes.find((s) => s.id === selectedScene.id);
    };

    const project = () => ({
      name: PROJECT_NAME,
      format: "9:16",
      sceneCount: scenes.length,
      totalDuration: scenes.reduce((sum, s) => sum + s.duration, 0),
      scenes: scenes.map(sceneView),
    });

    const tools: WebMCPTool[] = [
      {
        name: "get_project",
        description: "Get the current Agent Studio project: name, format, total duration and all scenes.",
        inputSchema: { type: "object", properties: {} },
        execute: async () => {
          logToolCall("get_project", `Read project "${PROJECT_NAME}" (${scenes.length} scenes).`);
          return jsonResult(project());
        },
      },
      {
        name: "get_scene",
        description: "Get details for one scene by id or number. Defaults to the currently selected scene.",
        inputSchema: {
          type: "object",
          properties: { scene_id: { type: "string", description: "Scene id or number; optional." } },
        },
        execute: async (args) => {
          const scene = findScene(args["scene_id"]);
          if (!scene) {
            logToolCall("get_scene", `Scene not found for "${String(args["scene_id"])}".`);
            return textResult(`Scene not found: ${String(args["scene_id"])}`, true);
          }
          logToolCall("get_scene", `Read scene ${scene.index} "${scene.title}".`);
          return jsonResult(sceneView(scene));
        },
      },
      {
        name: "update_caption",
        description: "Update the caption text of a scene and reflect it in the editor UI.",
        inputSchema: {
          type: "object",
          properties: {
            scene_id: { type: "string", description: "Scene id or number; optional." },
            caption: { type: "string", description: "New caption text." },
          },
          required: ["caption"],
        },
        execute: async (args) => {
          const scene = findScene(args["scene_id"]);
          const caption = typeof args["caption"] === "string" ? args["caption"].trim() : "";
          if (!scene) return textResult(`Scene not found: ${String(args["scene_id"])}`, true);
          if (!caption) return textResult("caption must be a non-empty string", true);
          updateScene(scene.id, { caption });
          logToolCall("update_caption", `Scene ${scene.index} caption → "${caption}".`);
          return jsonResult(sceneView({ ...scene, caption }));
        },
      },
      {
        name: "change_scene_duration",
        description: "Change a scene's duration in seconds (1–12) and update the timeline.",
        inputSchema: {
          type: "object",
          properties: {
            scene_id: { type: "string", description: "Scene id or number; optional." },
            duration: { type: "number", description: "Duration in seconds, 1–12." },
          },
          required: ["duration"],
        },
        execute: async (args) => {
          const scene = findScene(args["scene_id"]);
          const duration = typeof args["duration"] === "number" ? args["duration"] : Number(args["duration"]);
          if (!scene) return textResult(`Scene not found: ${String(args["scene_id"])}`, true);
          if (!Number.isFinite(duration)) return textResult("duration must be a number", true);
          const clamped = Math.min(12, Math.max(1, Math.round(duration)));
          updateScene(scene.id, { duration: clamped });
          logToolCall("change_scene_duration", `Scene ${scene.index} duration → ${clamped}s.`);
          return jsonResult(sceneView({ ...scene, duration: clamped }));
        },
      },
      {
        name: "replace_scene_visual",
        description: "Replace a scene's visual (thumbnail) with a new image URL, or cycle the generated fallback art when no URL is given.",
        inputSchema: {
          type: "object",
          properties: {
            scene_id: { type: "string", description: "Scene id or number; optional." },
            image_url: { type: "string", description: "https image URL; optional." },
          },
        },
        execute: async (args) => {
          const scene = findScene(args["scene_id"]);
          if (!scene) return textResult(`Scene not found: ${String(args["scene_id"])}`, true);
          let url = typeof args["image_url"] === "string" ? args["image_url"].trim() : "";
          if (url && !/^(https:\/\/|\/|data:image\/)/.test(url)) {
            return textResult("image_url must be an https URL or an in-app asset path", true);
          }
          if (!url) {
            const i = FALLBACK_VISUALS.indexOf(scene.thumbnail);
            url = FALLBACK_VISUALS[(i + 1) % FALLBACK_VISUALS.length]!;
          }
          updateScene(scene.id, { thumbnail: url, videoUrl: null });
          logToolCall("replace_scene_visual", `Scene ${scene.index} visual replaced.`);
          return jsonResult(sceneView({ ...scene, thumbnail: url }));
        },
      },
      {
        name: "search_stock_visual",
        description:
          "Search real Pexels stock video for clips matching a query and optionally scoped to a scene. Returns matching video results with title, thumbnail, url, duration and resolution.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search keywords, e.g. 'neon city night'." },
            scene_id: { type: "string", description: "Scene id or number the search is for; optional." },
          },
          required: ["query"],
        },
        execute: async (args) => {
          const query = typeof args["query"] === "string" ? args["query"].trim() : "";
          if (!query) {
            return textResult("query must be a non-empty string", true);
          }
          const scene = findScene(args["scene_id"]);
          const response = await fetch(
            `/api/stock-search?query=${encodeURIComponent(query)}`,
          );

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            return textResult(
              typeof data.error === "string"
                ? data.error
                : "Stock footage search failed",
              true,
            );
          }

          const data = await response.json();

          const results: StockResult[] = (data.results ?? []).map((item: any) => ({
            id: String(item.id),
            title: String(item.title),
            thumbnail: String(item.thumbnail),
            url: String(item.url),
            duration: Number(item.duration) || 0,
            resolution: `${item.width}x${item.height}`,
          }));

          if (results.length === 0) {
            return jsonResult({
              query,
              scene_id: scene?.id ?? null,
              count: 0,
              results: [],
              message: "No matching stock footage found.",
            });
          }
          const scope = scene ? ` for scene ${scene.index} "${scene.title}"` : "";
          logToolCall("search_stock_visual", `Searched "${query}"${scope} — ${results.length} results.`, {
            sceneId: scene?.id ?? null,
            results,
          });
          return jsonResult({ query, scene_id: scene?.id ?? null, count: results.length, results });
        },
      },
      {
        name: "preview_project",
        description: "Get a preview summary of the full project in playback order (scenes, captions, durations).",
        inputSchema: { type: "object", properties: {} },
        execute: async () => {
          const timeline = scenes.map((s) => `S${s.index} "${s.title}" — ${s.duration}s — ${s.caption}`);
          logToolCall("preview_project", `Generated preview of ${scenes.length} scenes.`);
          return textResult(
            [`${PROJECT_NAME} (9:16, ${scenes.reduce((a, s) => a + s.duration, 0)}s)`, ...timeline].join("\n"),
          );
        },
      },
    ];

    return registerWebMCPTools(tools);
  }, [scenes, selectedScene, updateScene, logToolCall]);
}
