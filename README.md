# Agent Studio — WebMCP Video Editor

Agent Studio is a WebMCP-enabled video editing prototype where people and AI
agents work on the same project. The creator uses a visual editor, while an
agent uses structured WebMCP tools to inspect scenes, update captions, change
scene durations, search for stock footage, and preview the project.

> Built for The WebMCP Challenge.

## Live Demo

- Application: https://agent-studio-webmcp-yi9j.vercel.app/
- Demo video: https://youtube.com/watch?v=wSXqH-0oJZk
- Devpost submission: ADD_YOUR_DEVPOST_PROJECT_URL

## Why WebMCP?

Traditional browser agents must interpret page layouts and guess which controls
to click. Agent Studio exposes editing operations as structured tools, allowing
an agent to interact directly with the editor's current state.

Humans retain the visual editing experience, while agents can perform repetitive
operations through validated tool calls.

## WebMCP Tools

Agent Studio currently exposes seven tools:

| Tool | Purpose |
|---|---|
| `get_project` | Returns the project name, format, duration, and scene list |
| `get_scene` | Returns details for a selected scene |
| `update_caption` | Updates a scene's caption text |
| `change_scene_duration` | Changes a scene duration within the allowed range |
| `replace_scene_visual` | Replaces a scene visual using an image URL or bundled visual |
| `search_stock_visual` | Searches Pexels for portrait stock footage |
| `preview_project` | Returns a summary of the project in playback order |

Tools are registered through the browser's WebMCP model-context API. For
development and inspection, the project also provides an in-page test shim at:

```javascript
window.__agentStudioWebMCP
