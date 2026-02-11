"use client";
import { useMemo, useState } from "react";

type Format = {
  format_id: string;
  ext?: string;
  format_note?: string;
  resolution?: string;
  width?: number;
  height?: number;
  fps?: number;
  vcodec?: string;
  acodec?: string;
  filesize?: number;
  filesize_approx?: number;
  tbr?: number; // total bitrate
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("");
  type VideoInfo = {
    title?: string;
    id?: string;
    uploader?: string;
    duration?: number;
    thumbnail?: string;
    thumbnails?: { url?: string; width?: number }[];
    formats?: Format[];
    [key: string]: unknown;
  };

  const [data, setData] = useState<VideoInfo | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string>("");

  const formats: Format[] = useMemo(() => data?.formats ?? [], [data]);

  // Progressive formats: include BOTH audio and video (no ffmpeg needed)
  const progressive = useMemo(() => {
    return formats
      .filter((f) => f.vcodec && f.vcodec !== "none" && f.acodec && f.acodec !== "none")
      .filter((f) => (f.ext ?? "").toLowerCase() === "mp4") // keep it simple/reliable
      .sort((a, b) => ((b.height ?? 0) - (a.height ?? 0)) || ((b.tbr ?? 0) - (a.tbr ?? 0)));
  }, [formats]);

  const previewThumb = useMemo(() => {
    if (!data) return "";
    if (data.thumbnail) return data.thumbnail;
    const thumbs = data.thumbnails || [];
    if (thumbs.length) {
      // choose largest by width
      const best = thumbs
        .slice()
        .sort(
          (a: { width?: number }, b: { width?: number }) =>
            (b.width ?? 0) - (a.width ?? 0)
        )[0];
      return best?.url || "";
    }
    return "";
  }, [data]);

  const handleFetchInfo = async () => {
    setStatus("Fetching info...");
    setData(null);
    setSelectedFormat("");

    const res = await fetch(`/api/video-info?url=${encodeURIComponent(url)}`);
    const text = await res.text();

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      setStatus("Error: API did not return JSON");
      setData({ raw: text } as unknown as VideoInfo);
      return;
    }

    if (!res.ok) {
      setStatus(`Error (${res.status})`);
      setData(json as VideoInfo);
      return;
    }

    setStatus("Loaded");
    setData(json as VideoInfo);
  };

  const handleDownload = () => {
    if (!url) return;
    const fmt = selectedFormat || "best[ext=mp4][acodec!=none][vcodec!=none]";
    window.open(`/api/download?url=${encodeURIComponent(url)}&format=${encodeURIComponent(fmt)}`, "_blank");

  };

  return (
    // vertically and horizontally center all content
    <div className="flex flex-col items-center justify-start p-6 space-y-8">
      {/* // make it so when the screen size changes the input and button resize accordingly */}
      <div className="flex w-full max-w-2xl gap-2">
        {/* Input box for url */}
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="border rounded-md grow p-2"
          placeholder="Enter YouTube URL"
        />
        {/* button for fetching information for video */}
        <button className="bg-red-600 text-white px-4 py-2 rounded-md" onClick={handleFetchInfo}>
          Fetch Info
        </button>
      </div>

      {/* Status display */}
      <div className="text-sm">
        <b>Status:</b> {status || "(idle)"}
      </div>

      {/* dis */}
      {data?.title && (
        <div className="space-y-3">
          <div className="text-lg font-semibold">{data.title}</div>

          <div className="flex gap-4  flex-wrap self-center align-middle items-center">
            {previewThumb && (
              <div className="w-[320px] max-w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewThumb}
                  alt="thumbnail"
                  className="rounded-md border w-full"
                />
              </div>
            )}

            <div className="space-y-2 flex-col self-center align-middle items-center">
              <div className="text-sm text-gray-700 self-center align-middle items-center">
                <div><b>ID:</b> {data.id}</div>
                {data.uploader && <div><b>Channel:</b> {data.uploader}</div>}
                {data.duration && <div><b>Duration:</b> {data.duration}s</div>}
              </div>

              <div className="space-y-2 self-center align-middle items-center">
                <label className="block text-sm font-medium">Quality (MP4 with audio)</label>
                <select
                  className="border rounded-md p-2 w-full"
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                >
                  <option value="">Auto (best MP4)</option>

                  {progressive.map((f) => {
                    const label = [
                      f.height ? `${f.height}p` : f.resolution || "unknown",
                      f.fps ? `${Math.round(f.fps)}fps` : null,
                      f.format_note,
                      f.ext,
                      f.filesize ? `${Math.round(f.filesize / 1024 / 1024)}MB` : null,
                      f.filesize_approx ? `~${Math.round(f.filesize_approx / 1024 / 1024)}MB` : null,
                    ]
                      .filter(Boolean)
                      .join(" • ");

                    return (

                      <option key={f.format_id} value={f.format_id}>
                        {f.format_id} — {label}
                      </option>
                    );
                  })}
                </select>

                <button
                  className="bg-red-600 text-white px-4 py-2 rounded-md w-full"
                  onClick={handleDownload}
                  disabled={!data}
                >
                  Download
                </button>

                <div className="text-xs text-gray-600">
                  Only “MP4 with audio” options are shown to avoid needing FFmpeg.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {data && !data.title && (
        <pre className="bg-gray-100 p-3 rounded-md text-xs overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
