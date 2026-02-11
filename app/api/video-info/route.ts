import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

const projectRoot = process.cwd(); // ✅ correct project root in Next
const binaryName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";

// youtube-dl-exec does NOT include yt-dlp.exe at that path by default in many installs.
// We'll check a couple likely locations.
const candidatePaths = [
  path.join(projectRoot, "node_modules", "youtube-dl-exec", "bin", binaryName),
  path.join(projectRoot, "node_modules", "youtube-dl-exec", "dist", "bin", binaryName),
];

const binaryPath = candidatePaths.find((p) => fs.existsSync(p));

function looksLikeJson(s: string) {
  const t = s.trim();
  return t.startsWith("{") || t.startsWith("[");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  if (!binaryPath) {
    return NextResponse.json(
      {
        error: "yt-dlp binary missing",
        details:
          "Tried:\n" + candidatePaths.join("\n") +
          "\n\nThis usually means youtube-dl-exec did not install/download the yt-dlp binary in node_modules.",
      },
      { status: 500 }
    );
  }

  try {
    const args = [
      "--dump-single-json",
      "--no-warnings",
      "--no-check-certificate",
      "--prefer-free-formats",
      "--youtube-skip-dash-manifest",
      url,
    ];

    const { stdout, stderr } = await execFileAsync(binaryPath, args, {
      windowsHide: true,
      maxBuffer: 20 * 1024 * 1024,
    });

    if (!looksLikeJson(stdout)) {
      return NextResponse.json(
        {
          error: "yt-dlp did not return JSON",
          details: (stderr || stdout || "").slice(0, 4000),
        },
        { status: 500 }
      );
    }

    return NextResponse.json(JSON.parse(stdout));
  } catch (err: unknown) {

    // If spawn fails or yt-dlp exits non-zero, Node puts details in err + err.stderr/err.stdout
    const details =
      String(
        (typeof err === "object" && err !== null && "stderr" in err && (err as { stderr?: string }).stderr) ||
        (typeof err === "object" && err !== null && "stdout" in err && (err as { stdout?: string }).stdout) ||
        (typeof err === "object" && err !== null && "message" in err && (err as { message?: string }).message) ||
        err
      )?.slice(0, 4000) ||
      "Unknown error";

    return NextResponse.json({ error: "yt-dlp failed", details }, { status: 500 });
  }
}
