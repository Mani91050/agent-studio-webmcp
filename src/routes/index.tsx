import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Clapperboard,
  Clock,
  Eye,
  Image as ImageIcon,
  Loader2,
  MessageSquareText,
  Minus,
  Play,
  Plus,
  Search,
  Sparkles,
  User,
  Wrench,
} from "lucide-react";
import { agentActivity, initialScenes, type AgentEntry, type Scene, type StockResult } from "@/lib/mock-data";
import { useWebMCP } from "@/hooks/use-webmcp";
import { interpretRequest } from "@/lib/chat-interpreter";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Agent Studio — AI Video Editor" },
      {
        name: "description",
        content:
          "Agent Studio is an AI-assisted vertical video editor: scene timeline, 9:16 preview, and an agent panel for tool activity.",
      },
      { property: "og:title", content: "Agent Studio — AI Video Editor" },
      {
        property: "og:description",
        content:
          "Scene timeline, vertical preview, and AI agent activity in one dark, focused editing surface.",
      },
    ],
  }),
  component: AgentStudio,
});

function statusBadge(status: string) {
  if (status === "rendering") {
    return (
      <Badge className="gap-1 border-amber/40 bg-amber/10 text-amber hover:bg-amber/10">
        <Loader2 className="size-3 animate-spin" /> Rendering
      </Badge>
    );
  }
  if (status === "rendered") {
    return (
      <Badge className="gap-1 border-success/40 bg-success/10 text-success hover:bg-success/10">
        <CheckCircle2 className="size-3" /> Rendered
      </Badge>
    );
  }
  return <Badge variant="secondary">Draft</Badge>;
}

function AgentRow({
  entry,
  onSelectResult,
}: {
  entry: AgentEntry;
  onSelectResult: (sceneId: string | null, result: StockResult) => void;
}) {
  const isUser = entry.author === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border",
          isUser ? "bg-secondary" : "bg-teal/15 text-teal",
        )}
      >
        {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </div>
      <div className={cn("min-w-0 max-w-[85%]", isUser && "items-end text-right")}>
        {entry.type === "tool" ? (
          <div className="rounded-lg border border-border bg-panel-raised px-3 py-2">
            <div className="flex items-center gap-2 font-mono text-[11px] text-teal">
              <Wrench className="size-3" />
              {entry.toolName}
              {entry.source === "webmcp" && (
                <span className="rounded bg-teal/15 px-1 py-px text-[9px] uppercase tracking-wide text-teal">
                  WebMCP
                </span>
              )}
              {entry.toolStatus === "running" ? (
                <Loader2 className="size-3 animate-spin text-amber" />
              ) : (
                <CheckCircle2 className="size-3 text-success" />
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{entry.text}</p>
            {entry.results && entry.results.length > 0 && (
              <div className="mt-2 flex flex-col gap-2">
                {entry.results.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-panel p-1.5"
                  >
                    <img
                      src={r.thumbnail}
                      alt={r.title}
                      width={96}
                      height={54}
                      loading="lazy"
                      className="h-12 w-20 shrink-0 rounded object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-foreground">{r.title}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {r.duration}s · {r.resolution}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 shrink-0 px-2 text-[10px]"
                      onClick={() => onSelectResult(entry.sceneId ?? null, r)}
                    >
                      Select
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div
            className={cn(
              "rounded-lg px-3 py-2 text-sm leading-relaxed",
              isUser
                ? "bg-teal text-teal-foreground"
                : "border border-border bg-panel-raised text-foreground",
            )}
          >
            {entry.text}
          </div>
        )}
        <span className="mt-1 block font-mono text-[10px] text-muted-foreground/70">
          {entry.time}
        </span>
      </div>
    </div>
  );
}

function AgentStudio() {
  const [scenes, setScenes] = useState(initialScenes);
  const [selectedId, setSelectedId] = useState(initialScenes[0]!.id);
  const [entries, setEntries] = useState<AgentEntry[]>(agentActivity);
  const [draft, setDraft] = useState("");
  const [pendingVisual, setPendingVisual] = useState<{
    sceneId: string;
    result: StockResult;
  } | null>(null);

  const selected = scenes.find((s) => s.id === selectedId) ?? initialScenes[0]!;
  const totalDuration = useMemo(
    () => scenes.reduce((sum, s) => sum + s.duration, 0),
    [scenes],
  );

  const updateScene = useCallback(
    (id: string, patch: Partial<Pick<Scene, "caption" | "duration" | "thumbnail">>) => {
      setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    },
    [],
  );

  const updateSelected = (patch: Partial<{ caption: string; duration: number }>) => {
    updateScene(selected.id, patch);
  };

  const logToolCall = useCallback(
    (toolName: string, text: string, extra?: { sceneId?: string | null; results?: StockResult[] }) => {
      setEntries((prev) => [
        ...prev,
        {
          id: `webmcp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: "tool",
          author: "agent",
          toolName,
          toolStatus: "done",
          text,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          source: "webmcp",
          ...(extra?.sceneId ? { sceneId: extra.sceneId } : {}),
          ...(extra?.results ? { results: extra.results } : {}),
        },
      ]);
    },
    [],
  );

  const selectStockResult = useCallback(
    (sceneId: string | null, result: StockResult) => {
      const targetId = sceneId ?? selectedId;
      updateScene(targetId, { thumbnail: result.thumbnail });
      logToolCall("replace_scene_visual", `Applied "${result.title}" to the scene.`, {
        sceneId: targetId,
      });
    },
    [selectedId, updateScene, logToolCall],
  );

  useWebMCP({ scenes, selectedScene: selected, updateScene, logToolCall });

  const approveVisual = useCallback(async () => {
    if (!pendingVisual) return;

    const { sceneId, result } = pendingVisual;
    const response = await window.__agentStudioWebMCP?.call("replace_scene_visual", {
      scene_id: sceneId,
      image_url: result.thumbnail,
    });

    if (!response?.isError) {
      logToolCall("replace_scene_visual", `Approved "${result.title}" for scene ${sceneId}.`, {
        sceneId,
      });
    }

    setPendingVisual(null);
  }, [pendingVisual, logToolCall]);

  const rejectVisual = useCallback(() => {
    if (!pendingVisual) return;

    logToolCall("replace_scene_visual", `Rejected visual "${pendingVisual.result.title}".`, {
      sceneId: pendingVisual.sceneId,
    });

    setPendingVisual(null);
  }, [pendingVisual, logToolCall]);


  const runTool = async (tool: string, args: Record<string, unknown> = {}) => {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const result = await window.__agentStudioWebMCP?.call(tool, args);
    const text = result?.content?.[0]?.text ?? "Tool unavailable.";
    setEntries((prev) => [
      ...prev,
      {
        id: `ctl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: "message",
        author: "agent",
        text: result?.isError ? `⚠️ ${text}` : text,
        time,
      },
    ]);
  };

  const agentControls = [
    { label: "Get project", icon: Clapperboard, run: () => runTool("get_project") },
    { label: "Get scene", icon: Eye, run: () => runTool("get_scene", { scene_id: selected.id }) },
    {
      label: "Caption",
      icon: MessageSquareText,
      run: () => runTool("update_caption", { scene_id: selected.id, caption: selected.caption }),
    },
    {
      label: "+1s",
      icon: Plus,
      run: () =>
        runTool("change_scene_duration", {
          scene_id: selected.id,
          duration: Math.min(12, selected.duration + 1),
        }),
    },
    { label: "New visual", icon: ImageIcon, run: () => runTool("replace_scene_visual", { scene_id: selected.id }) },
    {
      label: "Search",
      icon: Search,
      run: () =>
        runTool("search_stock_visual", { query: selected.title.toLowerCase(), scene_id: selected.id }),
    },
    { label: "Preview", icon: Play, run: () => runTool("preview_project") },
  ];

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    const time = () =>
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const uid = () => `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    setEntries((prev) => [
      ...prev,
      { id: uid(), type: "message", author: "user", text, time: time() },
    ]);

    const calls = interpretRequest(text);
    if (calls.length === 0) {
      setEntries((prev) => [
        ...prev,
        {
          id: uid(),
          type: "message",
          author: "agent",
          text: 'I can adjust scenes for you. Try "Change scene 1 caption to…", "Make scene 2 5 seconds", "Replace scene 3 visual", or "Show me the project".',
          time: time(),
        },
      ]);
      return;
    }

    const summaries: string[] = [];
    for (const call of calls) {
      const result = await window.__agentStudioWebMCP?.call(call.tool, call.args);
      const resultText = result?.content?.[0]?.text ?? "";
      if (result?.isError) {
        summaries.push(`⚠️ ${resultText}`);
      } else if (call.tool === "update_caption") {
        summaries.push(`Caption updated: "${String(call.args["caption"])}"`);
      } else if (call.tool === "change_scene_duration") {
        summaries.push(`Duration set to ${String(call.args["duration"])}s.`);
      } else if (call.tool === "replace_scene_visual") {
        summaries.push("Scene visual replaced.");
      } else if (call.tool === "search_stock_visual") {
        summaries.push(`Found 3 stock clips for "${String(call.args["query"])}".`);
        try {
          const parsed = JSON.parse(resultText) as { results?: StockResult[]; scene_id?: string | null };
          const best = parsed.results?.[0];
          if (best) {
            const targetId = parsed.scene_id ?? selectedId;
            setPendingVisual({ sceneId: targetId, result: best });
            summaries.push(`Proposed "${best.title}" for scene ${targetId}. Waiting for approval.`);
          }
        } catch {
          // no parsable results; leave manual selection
        }
      } else if (call.tool === "get_scene" || call.tool === "get_project" || call.tool === "preview_project") {
        summaries.push(resultText);
      }
    }

    setEntries((prev) => [
      ...prev,
      { id: uid(), type: "message", author: "agent", text: summaries.join("\n\n"), time: time() },
    ]);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-panel px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-teal text-teal-foreground">
            <Clapperboard className="size-4" />
          </div>
          <span className="font-display text-base font-semibold tracking-tight">
            Agent Studio
          </span>
        </div>
        <div className="mx-2 h-5 w-px bg-border" />
        <span className="truncate text-sm text-muted-foreground">
          Neon District — Teaser Cut
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden font-mono text-xs text-muted-foreground sm:block">
            {totalDuration}s · 9:16
          </span>
          <Button size="sm" className="bg-teal text-teal-foreground hover:bg-teal/90">
            <Play className="size-3.5" /> Preview
          </Button>
        </div>
      </header>

      {/* Main workspace */}
      <main className="grid flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[280px_minmax(0,1fr)_340px]">
        {/* Left: scene timeline */}
        <section
          aria-label="Scenes"
          className="flex flex-col rounded-xl border border-border bg-panel"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-display text-sm font-semibold">Scenes</h2>
            <Badge variant="secondary" className="font-mono">
              {scenes.length}
            </Badge>
          </div>
          <div className="flex gap-3 overflow-x-auto p-3 lg:flex-col lg:overflow-visible">
            {scenes.map((scene) => {
              const active = scene.id === selected.id;
              return (
                <button
                  key={scene.id}
                  onClick={() => setSelectedId(scene.id)}
                  className={cn(
                    "group w-56 shrink-0 rounded-lg border p-2 text-left transition-colors lg:w-full",
                    active
                      ? "border-teal/60 bg-accent"
                      : "border-border bg-panel-raised hover:border-input",
                  )}
                >
                  <div className="relative overflow-hidden rounded-md">
                    <img
                      src={scene.thumbnail}
                      alt={`${scene.title} thumbnail`}
                      width={576}
                      height={1024}
                      loading="lazy"
                      className="aspect-video w-full object-cover"
                    />
                    <span className="absolute left-1.5 top-1.5 rounded bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                      S{scene.index}
                    </span>
                    <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                      <Clock className="size-2.5" /> {scene.duration}s
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 px-0.5 pb-0.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{scene.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {scene.caption}
                      </p>
                    </div>
                    {statusBadge(scene.status)}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Center: 9:16 preview */}
        <section
          aria-label="Video preview"
          className="flex min-h-[520px] items-center justify-center rounded-xl border border-border bg-panel p-4"
        >
          <div className="relative h-full max-h-[calc(100vh-220px)] min-h-[420px] w-auto overflow-hidden rounded-xl border border-border shadow-2xl shadow-black/50" style={{ aspectRatio: "9 / 16" }}>
            <img
              src={selected.thumbnail}
              alt={`Preview of ${selected.title}`}
              className="absolute inset-0 size-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
            <div className="absolute left-3 top-3 flex items-center gap-2">
              <Badge variant="secondary" className="bg-background/70 font-mono text-[10px]">
                Scene {selected.index} / {scenes.length}
              </Badge>
            </div>
            <div className="absolute inset-x-4 bottom-10 text-center">
              <p className="font-display text-lg font-semibold leading-snug text-white drop-shadow">
                {selected.caption}
              </p>
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-black/50 px-3 py-2 backdrop-blur-sm">
              <Play className="size-3.5 text-white" />
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-teal"
                  style={{ width: `${(selected.index / scenes.length) * 100}%` }}
                />
              </div>
              <span className="font-mono text-[10px] text-white/80">
                0:0{selected.duration}
              </span>
            </div>
          </div>
        </section>

        {/* Right: AI agent panel */}
        <section
          aria-label="AI agent"
          className="flex min-h-[360px] flex-col rounded-xl border border-border bg-panel"
        >
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Sparkles className="size-4 text-teal" />
            <h2 className="font-display text-sm font-semibold">Agent</h2>
            <Badge className="ml-auto gap-1 border-success/40 bg-success/10 text-success hover:bg-success/10">
              <span className="size-1.5 animate-pulse rounded-full bg-success" />
              Working
            </Badge>
          </div>
          {pendingVisual && (
            <div className="border-b border-border p-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-sm font-medium">Agent proposes a visual change</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Replace scene {pendingVisual.sceneId} with "{pendingVisual.result.title}"?
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={approveVisual}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={rejectVisual}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2" aria-label="WebMCP agent controls">
            {agentControls.map((ctl) => (
              <Button
                key={ctl.label}
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 font-mono text-[10px]"
                title={`Run WebMCP tool`}
                onClick={() => void ctl.run()}
              >
                <ctl.icon className="size-3 text-teal" />
                {ctl.label}
              </Button>
            ))}
          </div>
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-4 p-4">
              {entries.map((entry) => (
                <AgentRow key={entry.id} entry={entry} onSelectResult={selectStockResult} />
              ))}
            </div>
          </ScrollArea>
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2 rounded-lg border border-input bg-panel-raised px-3 py-2">
              <MessageSquareText className="size-4 text-muted-foreground" />
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void sendMessage();
                }}
                placeholder="Ask the agent to adjust a scene…"
                aria-label="Message the agent"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <Button
                size="sm"
                className="bg-teal text-teal-foreground hover:bg-teal/90"
                onClick={() => void sendMessage()}
              >
                Send
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Bottom: scene controls */}
      <footer className="shrink-0 border-t border-border bg-panel px-4 py-3">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 md:flex-row md:items-center md:gap-6">
          <div className="flex items-center gap-2 md:w-40">
            <span className="font-mono text-[10px] text-muted-foreground">
              S{selected.index}
            </span>
            <span className="truncate text-sm font-medium">{selected.title}</span>
          </div>
          <div className="flex flex-1 items-center gap-2">
            <label htmlFor="caption" className="sr-only">
              Caption
            </label>
            <input
              id="caption"
              value={selected.caption}
              onChange={(e) => updateSelected({ caption: e.target.value })}
              className="w-full rounded-md border border-input bg-panel-raised px-3 py-1.5 text-sm outline-none focus:border-ring"
            />
          </div>
          <div className="flex items-center gap-3 md:w-72">
            <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
              {selected.duration}s
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() =>
                updateSelected({ duration: Math.max(1, selected.duration - 1) })
              }
              aria-label="Decrease duration"
            >
              <Minus className="size-3" />
            </Button>
            <Slider
              value={[selected.duration]}
              min={1}
              max={12}
              step={1}
              onValueChange={([v]) => updateSelected({ duration: v ?? selected.duration })}
              className="flex-1"
              aria-label="Scene duration"
            />
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() =>
                updateSelected({ duration: Math.min(12, selected.duration + 1) })
              }
              aria-label="Increase duration"
            >
              <Plus className="size-3" />
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
