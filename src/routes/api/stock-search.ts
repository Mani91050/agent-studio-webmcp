import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/stock-search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const query = url.searchParams.get("query")?.trim();

        if (!query) {
          return Response.json(
            { error: "Missing query parameter" },
            { status: 400 },
          );
        }

        const apiKey = process.env.PEXELS_API_KEY;

        if (!apiKey) {
          return Response.json(
            { error: "PEXELS_API_KEY is not configured" },
            { status: 500 },
          );
        }

        const pexelsUrl = new URL("https://api.pexels.com/videos/search");
        pexelsUrl.searchParams.set("query", query);
        pexelsUrl.searchParams.set("per_page", "6");
        pexelsUrl.searchParams.set("orientation", "portrait");

        try {
          const response = await fetch(pexelsUrl, {
            headers: {
              Authorization: apiKey,
            },
          });

          if (!response.ok) {
            const message = await response.text();
            console.error("Pexels API error:", response.status, message);

            return Response.json(
              { error: "Pexels request failed" },
              { status: 502 },
            );
          }

          const data = await response.json();

          const results = (data.videos ?? [])
            .map((video: any) => {
              const files = Array.isArray(video.video_files)
                ? video.video_files
                : [];

              const mp4Files = files.filter(
                (file: any) =>
                  file.file_type === "video/mp4" &&
                  typeof file.link === "string",
              );

              const preferred =
                mp4Files.find(
                  (file: any) =>
                    file.width <= 1080 &&
                    file.height > file.width &&
                    file.width >= 480,
                ) ??
                mp4Files.find(
                  (file: any) =>
                    file.height > file.width,
                ) ??
                mp4Files[0];

              if (!preferred) return null;

              return {
                id: String(video.id),
                title: `Pexels video ${video.id}`,
                url: preferred.link,
                thumbnail: video.image,
                duration: video.duration,
                width: preferred.width,
                height: preferred.height,
                tags: [query],
              };
            })
            .filter(Boolean);

          return Response.json({ results });
        } catch (error) {
          console.error("Stock search failed:", error);

          return Response.json(
            { error: "Unable to search stock footage" },
            { status: 500 },
          );
        }
      },
    },
  },
});
