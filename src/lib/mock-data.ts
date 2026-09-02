import scene1 from "@/assets/scene-1.jpg";
import scene2 from "@/assets/scene-2.jpg";
import scene3 from "@/assets/scene-3.jpg";

export interface Scene {
  id: string;
  index: number;
  title: string;
  caption: string;
  duration: number; // seconds
  thumbnail: string;
  /** Playable video source (e.g. an approved Pexels clip); null when the scene is a still. */
  videoUrl: string | null;
  status: "rendered" | "rendering" | "draft";
}

export const initialScenes: Scene[] = [
  {
    id: "scene-1",
    index: 1,
    title: "The Arrival",
    caption: "Every journey begins in the dark.",
    duration: 4,
    thumbnail: scene1,
    videoUrl: null,
    status: "rendered",
  },
  {
    id: "scene-2",
    index: 2,
    title: "The Signal",
    caption: "One message can change everything.",
    duration: 6,
    thumbnail: scene2,
    videoUrl: null,
    status: "rendered",
  },
  {
    id: "scene-3",
    index: 3,
    title: "The Long Road",
    caption: "And then, the way forward.",
    duration: 5,
    thumbnail: scene3,
    videoUrl: null,
    status: "rendering",
  },
];

export type AgentEntryType = "message" | "tool";

export interface StockResult {
  id: string;
  title: string;
  thumbnail: string;
  url: string;
  duration: number;
  resolution: string;
}

export interface AgentEntry {
  id: string;
  type: AgentEntryType;
  author: "agent" | "user";
  text: string;
  toolName?: string;
  toolStatus?: "done" | "running";
  time: string;
  source?: "webmcp";
  sceneId?: string;
  results?: StockResult[];
}

export const agentActivity: AgentEntry[] = [
  {
    id: "a1",
    type: "message",
    author: "user",
    text: "Create a 3-scene teaser for a sci-fi short. Vertical format, moody tone.",
    time: "09:41",
  },
  {
    id: "a2",
    type: "tool",
    author: "agent",
    toolName: "generate_script",
    text: "Drafted 3-scene script with captions and timing.",
    toolStatus: "done",
    time: "09:41",
  },
  {
    id: "a3",
    type: "tool",
    author: "agent",
    toolName: "generate_visuals",
    text: "Rendered keyframes for scenes 1–2. Scene 3 in progress.",
    toolStatus: "running",
    time: "09:42",
  },
  {
    id: "a4",
    type: "message",
    author: "agent",
    text: "Scenes 1 and 2 are ready for review. I kept the palette teal-forward with an amber accent in the final scene for contrast. Want me to adjust pacing?",
    time: "09:42",
  },
];
