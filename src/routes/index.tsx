import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Plus,
  Search,
  SendHorizonal,
  User,
  Wrench,
} from "lucide-react";
import { agentActivity, initialScenes, type AgentEntry, type Scene, type StockResult } from "@/lib/mock-data";
import { useWebMCP, FALLBACK_VISUALS } from "@/hooks/use-webmcp";
import { interpretRequest } from "@/lib/chat-interpreter";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

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

function formatDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function statusBadge(status: string) {
  if (status === "rendering") {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-wider text-amber">
        <Loader2 className="size-2.5 animate-spin" /> Rendering
      </span>
    );
  }
  if (status === "rendered") {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-wider text-success">
        <CheckCircle2 className="size-2.5" /> Rendered
      </span>
    );
  }
  return (
    <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
      Draft
    </span>
  );
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
    <div className={cn("flex w-full min-w-0 flex-col gap-1.5", isUser && "items-end")}>
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full border border-border",
            isUser ? "bg-secondary" : "bg-panel-raised",
          )}
        >
          {isUser ? (
            <User className="size-2.5 text-muted-foreground" />
          ) : (
            <Bot className="size-2.5 text-primary" />
          )}
        </div>
        <span className="text-[10px] font-medium text-muted-foreground">
          {isUser ? "You" : "Agent"}
        </span>
        <span className="font-mono text-[9px] text-muted-foreground/60">{entry.time}</span>
      </div>
      {entry.type === "tool" ? (
        <div className="w-full max-w-full rounded-lg border border-border bg-panel-raised px-3 py-2">
          <div className="flex items-center gap-2 font-mono text-[11px] text-primary">
            <Wrench className="size-3" />
            {entry.toolName}
            {entry.source === "webmcp" && (
              <span className="rounded bg-primary/15 px-1 py-px text-[9px] uppercase tracking-wide text-primary">
                WebMCP
              </span>
            )}
            {entry.toolStatus === "running" ? (
              <Loader2 className="size-3 animate-spin text-amber" />
            ) : (
              <CheckCircle2 className="size-3 text-success" />
            )}
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">
            {entry.text}
          </p>
          {entry.results && entry.results.length > 0 && (
            <div className="mt-2 flex flex-col gap-2">
              {entry.results.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 overflow-hidden rounded-md border border-border bg-panel"
                >
                  <img
                    src={r.thumbnail}
                    alt={r.title}
                    width={96}
                    height={54}
                    loading="lazy"
                    className="aspect-video w-20 shrink-0 object-cover"
                  />
                  <div className="min-w-0 flex-1 py-1.5">
                    <p className="truncate text-[11px] font-medium text-foreground">{r.title}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {r.duration}s · {r.resolution}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="mr-2 h-6 shrink-0 rounded bg-primary px-2 text-[10px] font-medium text-primary-foreground hover:bg-primary/90"
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
            "max-w-[90%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-xs leading-relaxed",
            isUser
              ? "rounded-tr-none border border-primary/20 bg-primary/10 text-foreground"
              : "rounded-tl-none border border-border bg-panel-raised text-secondary-foreground",
          )}
        >
          {entry.text}
        </div>
      )}
    </div>
  );
}

function PreviewPlayer({
  open,
  onOpenChange,
  scenes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenes: Scene[];
}) {
  const [position, setPosition] = useState(0); // seconds across the whole timeline
  const [playing, setPlaying] = useState(true);

  const total = useMemo(() => scenes.reduce((a, s) => a + s.duration, 0), [scenes]);
  const starts = useMemo(() => {
    const acc: number[] = [];
    let t = 0;
    for (const s of scenes) {
      acc.push(t);
      t += s.duration;
    }
    return acc;
  }, [scenes]);

  // Derive the current scene from overall playback position.
  let index = scenes.length - 1;
  for (let i = 0; i < scenes.length; i++) {
    if (position < (starts[i] ?? 0) + (scenes[i]?.duration ?? 0)) {
      index = i;
      break;
    }
  }
  const scene = scenes[index];
  const sceneElapsed = Math.max(0, position - (starts[index] ?? 0));

  // Reset playback whenever the modal opens.
  useEffect(() => {
    if (open) {
      setPosition(0);
      setPlaying(true);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !playing || total <= 0) return;
    const tick = setInterval(() => {
      setPosition((p) => {
        const next = p + 0.1;
        if (next >= total) {
          setPlaying(false);
          return total;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(tick);
  }, [open, playing, total]);

  const jumpToScene = (i: number) => {
    if (i < 0 || i >= scenes.length) return;
    setPosition(starts[i] ?? 0);
    setPlaying(true);
  };

  const replay = () => {
    setPosition(0);
    setPlaying(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[92vh] w-auto max-w-[94vw] flex-col gap-3 overflow-hidden border-border bg-panel p-4 sm:max-w-md"
        aria-label="Project preview player"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <DialogTitle className="font-display text-sm font-semibold tracking-tight">
              Neon District — Teaser Cut
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-[11px] text-muted-foreground">
              9:16 preview · {formatDuration(position)} / {formatDuration(total)}
            </DialogDescription>
          </div>
          <Badge variant="secondary" className="h-4 shrink-0 px-1.5 font-mono text-[9px]">
            {scenes.length} SCENES
          </Badge>
        </div>

        {/* 9:16 stage */}
        <div
          className="relative mx-auto h-[58vh] max-h-[560px] w-auto overflow-hidden rounded-lg border border-border bg-black"
          style={{ aspectRatio: "9 / 16" }}
        >
          {scene && (
            <img
              key={scene.id}
              src={scene.thumbnail}
              alt={`Preview of ${scene.title}`}
              className="absolute inset-0 size-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
          <div className="absolute left-3 right-3 top-3 flex justify-between">
            <span className="rounded bg-black/40 px-2 py-1 font-mono text-[10px] text-white/80 backdrop-blur-md">
              Scene {(scene?.index ?? 0)} / {scenes.length}
            </span>
            <span className="rounded bg-black/40 px-2 py-1 font-mono text-[10px] text-white/80 backdrop-blur-md">
              {scene?.title}
            </span>
          </div>
          <div className="absolute inset-x-5 bottom-12 text-center">
            <p className="font-display text-base font-semibold leading-snug text-white drop-shadow-md">
              {scene?.caption}
            </p>
          </div>
          {/* overall progress */}
          <div className="absolute inset-x-3 bottom-3 flex gap-1">
            {scenes.map((s, i) => {
              const start = starts[i] ?? 0;
              const pct =
                total <= 0
                  ? 0
                  : Math.min(1, Math.max(0, (position - start) / Math.max(0.001, s.duration)));
              return (
                <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-100"
                    style={{ width: `${pct * 100}%` }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* transport */}
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-8 rounded"
            onClick={() => jumpToScene(index - 1)}
            disabled={index <= 0}
            aria-label="Previous scene"
          >
            <SkipBack className="size-3.5" />
          </Button>
          <Button
            size="icon"
            className="size-9 rounded bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => (playing ? setPlaying(false) : position >= total ? replay() : setPlaying(true))}
            aria-label={playing ? "Pause preview" : "Play preview"}
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8 rounded"
            onClick={() => jumpToScene(index + 1)}
            disabled={index >= scenes.length - 1}
            aria-label="Next scene"
          >
            <SkipForward className="size-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AgentStudio() {
  const [scenes, setScenes] = useState(initialScenes);
  const [selectedId, setSelectedId] = useState(initialScenes[0]!.id);
  const [entries, setEntries] = useState<AgentEntry[]>(agentActivity);
  const [draft, setDraft] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
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
      const isImage = /\.(jpe?g|png|webp|avif|gif)(\?|$)/i.test(result.url) || result.url.startsWith("data:image/");
      updateScene(targetId, { thumbnail: isImage ? result.url : result.thumbnail });
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

    if (response?.isError) {
      logToolCall(
        "replace_scene_visual",
        `⚠️ Could not apply "${result.title}": ${response.content?.[0]?.text ?? "unknown error"}`,
        { sceneId },
      );
    } else {
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

  // Propose the next generated visual for a scene without applying it —
  // the change only lands if the user approves the proposal.
  const proposeNewVisual = useCallback(
    (scene: Scene) => {
      const i = FALLBACK_VISUALS.indexOf(scene.thumbnail);
      const url = FALLBACK_VISUALS[(i + 1) % FALLBACK_VISUALS.length]!;
      setPendingVisual({
        sceneId: scene.id,
        result: {
          id: `generated-${scene.id}`,
          title: `Generated visual — ${scene.title}`,
          thumbnail: url,
          url,
          duration: scene.duration,
          resolution: "1080x1920",
        },
      });
      logToolCall(
        "replace_scene_visual",
        `Proposed a new generated visual for scene ${scene.index}. Waiting for approval.`,
        { sceneId: scene.id },
      );
    },
    [logToolCall],
  );

  const runTool = async (tool: string, args: Record<string, unknown> = {}) => {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const result = await window.__agentStudioWebMCP?.call(tool, args);
    const raw = result?.content?.[0]?.text ?? "Tool unavailable.";
    // search results are rendered as selectable cards by the tool log entry —
    // never echo the raw JSON payload into the feed.
    let text = raw;
    if (tool === "search_stock_visual" && !result?.isError) {
      let count = 0;
      try {
        count = (JSON.parse(raw) as { results?: unknown[] }).results?.length ?? 0;
      } catch {
        count = 0;
      }
      if (count === 0) {
        text = "No matching stock footage found.";
      } else {
        return;
      }
    }
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
    { label: "New visual", icon: ImageIcon, run: () => proposeNewVisual(selected) },
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
      // replace_scene_visual goes through the Approve/Reject proposal flow —
      // don't execute the tool directly here.
      const result =
        call.tool === "replace_scene_visual"
          ? undefined
          : await window.__agentStudioWebMCP?.call(call.tool, call.args);
      const resultText = result?.content?.[0]?.text ?? "";
      if (result?.isError) {
        summaries.push(`⚠️ ${resultText}`);
      } else if (call.tool === "update_caption") {
        summaries.push(`Caption updated: "${String(call.args["caption"])}"`);
      } else if (call.tool === "change_scene_duration") {
        summaries.push(`Duration set to ${String(call.args["duration"])}s.`);
      } else if (call.tool === "replace_scene_visual") {
        // Route visual replacement through the Approve/Reject proposal flow
        // instead of applying it immediately.
        const targetScene =
          scenes.find((s) => s.id === call.args["scene_id"] || String(s.index) === call.args["scene_id"]) ??
          selected;
        proposeNewVisual(targetScene);
        summaries.push(`Proposed a new visual for scene ${targetScene.index}. Waiting for approval.`);
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
      {/* Top header */}
      <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded bg-primary font-bold text-primary-foreground shadow-lg shadow-primary/20">
            <Clapperboard className="size-4" />
          </div>
          <div className="flex min-w-0 flex-col">
            <h1 className="font-display text-sm font-semibold leading-none tracking-tight">
              Agent Studio
            </h1>
            <span className="mt-1 truncate text-[10px] text-muted-foreground">
              Neon District — Teaser Cut · {totalDuration}s · 9:16
            </span>
          </div>
        </div>
        <Button
          size="sm"
          className="shrink-0 rounded bg-primary text-xs font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
          onClick={() => setPreviewOpen(true)}
        >
          <Play className="size-3.5" /> Preview
        </Button>
      </header>

      {/* Main workspace */}
      <main className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Left: storyline */}
        <aside
          aria-label="Scenes"
          className="flex shrink-0 flex-col border-b border-border bg-panel/50 lg:w-64 lg:border-b-0 lg:border-r"
        >
          <div className="flex items-center justify-between px-3 pt-3">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Storyline
            </span>
            <Badge variant="secondary" className="h-4 px-1.5 font-mono text-[9px]">
              {scenes.length}
            </Badge>
          </div>
          <div className="flex gap-3 overflow-x-auto p-3 lg:flex-1 lg:flex-col lg:overflow-y-auto">
            {scenes.map((scene) => {
              const active = scene.id === selected.id;
              return (
                <button
                  key={scene.id}
                  onClick={() => setSelectedId(scene.id)}
                  className={cn(
                    "group w-40 shrink-0 cursor-pointer text-left transition-opacity lg:w-full",
                    !active && "opacity-60 hover:opacity-100",
                  )}
                >
                  <div
                    className={cn(
                      "relative overflow-hidden rounded-lg bg-secondary transition-all",
                      active
                        ? "border-2 border-primary shadow-xl ring-4 ring-primary/10"
                        : "border border-border group-hover:border-muted-foreground/40",
                    )}
                  >
                    <img
                      src={scene.thumbnail}
                      alt={`${scene.title} thumbnail`}
                      width={576}
                      height={1024}
                      loading="lazy"
                      className="aspect-video w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1.5">
                      <span
                        className={cn(
                          "flex size-4 items-center justify-center rounded-full text-[10px] font-semibold",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-black/60 text-foreground",
                        )}
                      >
                        {scene.index}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-[10px] text-white/90">
                        <Clock className="size-2.5" /> {scene.duration}s
                      </span>
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2 px-0.5">
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "truncate text-[11px] font-medium",
                          active ? "text-primary" : "text-foreground",
                        )}
                      >
                        {active ? `${scene.title} — Selected` : scene.title}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">{scene.caption}</p>
                    </div>
                    {statusBadge(scene.status)}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Center: 9:16 preview + transport */}
        <section
          aria-label="Video preview"
          className="flex min-h-[520px] flex-1 flex-col bg-secondary/30"
        >
          <div className="flex flex-1 items-center justify-center p-6 lg:p-8">
            <div
              className="relative h-full max-h-[calc(100vh-260px)] min-h-[420px] w-auto overflow-hidden rounded-xl border border-border bg-black shadow-2xl"
              style={{ aspectRatio: "9 / 16" }}
            >
              <img
                src={selected.thumbnail}
                alt={`Preview of ${selected.title}`}
                className="absolute inset-0 size-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
              <div className="absolute left-4 right-4 top-4 flex justify-between">
                <span className="rounded bg-black/40 px-2 py-1 font-mono text-[10px] text-white/80 backdrop-blur-md">
                  Scene {selected.index} / {scenes.length}
                </span>
              </div>
              <div className="absolute inset-x-6 bottom-16 text-center">
                <p className="font-display text-lg font-semibold leading-snug text-white drop-shadow-md">
                  {selected.caption}
                </p>
              </div>
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-8">
                <Play className="size-3.5 shrink-0 text-white" />
                <div className="relative h-1 flex-1 overflow-visible rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(selected.index / scenes.length) * 100}%` }}
                  />
                  <div
                    className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-white shadow-lg"
                    style={{ left: `${(selected.index / scenes.length) * 100}%` }}
                  />
                </div>
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-white/80">
                  {formatDuration(selected.duration)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Right: AI agent panel */}
        <aside
          aria-label="AI agent"
          className="flex min-h-[360px] shrink-0 flex-col border-t border-border bg-panel/50 lg:w-80 lg:border-l lg:border-t-0"
        >
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <span className="size-1.5 animate-pulse rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              AI Agent
            </h2>
            <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-success">
              Working
            </span>
          </div>

          {/* WebMCP tool controls */}
          <div
            className="grid grid-cols-7 gap-1 border-b border-border p-2"
            aria-label="WebMCP agent controls"
          >
            {agentControls.map((ctl) => (
              <button
                key={ctl.label}
                type="button"
                title={ctl.label}
                aria-label={ctl.label}
                onClick={() => void ctl.run()}
                className="flex aspect-square items-center justify-center rounded bg-secondary text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ctl.icon className="size-3.5" />
              </button>
            ))}
          </div>

          {pendingVisual && (
            <div className="border-b border-border p-3">
              <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/20">
                    <ImageIcon className="size-3.5 text-primary" />
                  </div>
                  <p className="text-xs font-medium leading-normal text-secondary-foreground">
                    Replace scene {pendingVisual.sceneId} with "{pendingVisual.result.title}"?
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={approveVisual}
                    className="flex-1 rounded-lg bg-primary py-2 text-[10px] font-bold uppercase tracking-wide text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:bg-primary/90"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={rejectVisual}
                    className="flex-1 rounded-lg border border-border bg-secondary py-2 text-[10px] font-bold uppercase tracking-wide text-secondary-foreground transition-all hover:bg-muted"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          )}

          <ScrollArea className="flex-1 [&>div>div]:!block">
            <div className="flex flex-col gap-4 p-4">
              {entries.map((entry) => (
                <AgentRow key={entry.id} entry={entry} onSelectResult={selectStockResult} />
              ))}
            </div>
          </ScrollArea>

          {/* Composer */}
          <div className="border-t border-border p-4">
            <div className="relative">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void sendMessage();
                }}
                placeholder="Message AI Agent…"
                aria-label="Message the agent"
                className="w-full rounded-lg border border-border bg-secondary py-2.5 pl-3 pr-10 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60"
              />
              <button
                type="button"
                aria-label="Send message"
                onClick={() => void sendMessage()}
                className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <SendHorizonal className="size-3.5" />
              </button>
            </div>
          </div>
        </aside>
      </main>

      {/* Bottom: scene editor bar */}
      <footer className="flex h-auto shrink-0 flex-col gap-3 border-t border-border bg-background px-4 py-3 md:h-16 md:flex-row md:items-center md:gap-6 md:py-0">
        <div className="flex min-w-0 items-center gap-2 md:w-44">
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            S{selected.index}
          </span>
          <span className="truncate text-xs font-medium">{selected.title}</span>
        </div>
        <div className="flex flex-1 items-center gap-3 rounded-lg border border-border bg-panel px-3 py-1.5">
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Caption
          </span>
          <label htmlFor="caption" className="sr-only">
            Caption
          </label>
          <input
            id="caption"
            value={selected.caption}
            onChange={(e) => updateSelected({ caption: e.target.value })}
            className="w-full bg-transparent text-xs text-secondary-foreground outline-none"
          />
        </div>
        <div className="flex items-center gap-4 md:w-72">
          <div className="flex w-full flex-col gap-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span className="font-bold uppercase tracking-wider">Duration</span>
              <span className="font-mono tabular-nums text-foreground">{selected.duration}s</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="size-6 shrink-0 rounded"
                onClick={() => updateSelected({ duration: Math.max(1, selected.duration - 1) })}
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
                className="size-6 shrink-0 rounded"
                onClick={() => updateSelected({ duration: Math.min(12, selected.duration + 1) })}
                aria-label="Increase duration"
              >
                <Plus className="size-3" />
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
