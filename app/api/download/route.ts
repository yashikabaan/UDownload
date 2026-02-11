import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";

export const runtime = "nodejs";

const projectRoot = process.cwd();
const binaryName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
const candidatePaths = [
  path.join(projectRoot, "node_modules", "youtube-dl-exec", "bin", binaryName),
  path.join(projectRoot, "node_modules", "youtube-dl-exec", "dist", "bin", binaryName),
];
const binaryPath = candidatePaths.find((p) => fs.existsSync(p));

function safeFilename(name: string) {
  return (name || "video")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "") // Windows-illegal + control chars
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

async function getTitle(url: string) {
  return new Promise<string>((resolve) => {
    if (!binaryPath) return resolve("video");
    const child = spawn(binaryPath, ["--print", "%(title)s", "--no-warnings", url], {
      windowsHide: true,
    });

    let out = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.on("close", () => resolve(safeFilename(out.trim()) || "video"));
    child.on("error", () => resolve("video"));
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  // format_id from dropdown (optional). If missing, default to best MP4 progressive.
  const format = searchParams.get("format") || "best[ext=mp4][acodec!=none][vcodec!=none]";

  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }
  if (!binaryPath) {
    return NextResponse.json(
      { error: "yt-dlp binary missing", details: "Tried:\n" + candidatePaths.join("\n") },
      { status: 500 }
    );
  }

  const title = await getTitle(url);

  // Stream a single selected format to stdout.
  // Note: If the chosen format requires merging, yt-dlp may fail without ffmpeg.
  const args = [
    "-f",
    format,
    "-o",
    "-", // stdout
    "--no-warnings",
    "--no-check-certificate",
    url,
  ];

  const child = spawn(binaryPath, args, { windowsHide: true });

  let errBuf = "";
  child.stderr.on("data", (d) => (errBuf += d.toString()));

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      child.stdout.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      child.stdout.on("end", () => controller.close());
      child.on("error", (e) => controller.error(e));
      child.on("close", (code) => {
        if (code !== 0) controller.error(new Error(errBuf || `yt-dlp exited ${code}`));
      });
    },
    cancel() {
      child.kill("SIGKILL");
    },
  });

  // If you always default to MP4 selector, you can set mp4 headers safely.
  // (If user selects a non-mp4 format_id, this might be wrong; we can improve later.)
  return new Response(stream, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${title}.mp4"`,
    },
  });
}
