import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { ERR_OAUTH_BROWSER, GoogleError } from "./errors.js";
import { GOOGLE_BROWSER_LAUNCH_WAIT_MS } from "./types.js";

function commandOnPath(name: string): boolean {
  const parts = (process.env.PATH ?? "").split(":");
  for (const dir of parts) {
    if (dir.length > 0 && existsSync(`${dir}/${name}`)) {
      return true;
    }
  }
  return false;
}

function isWsl(): boolean {
  try {
    return /microsoft/i.test(readFileSync("/proc/version", "utf8"));
  } catch {
    return false;
  }
}

function opener(url: string): { file: string; args: string[] } {
  if (process.platform === "darwin") {
    return { file: "open", args: [url] };
  }
  if (process.platform === "win32") {
    return { file: "rundll32.exe", args: ["url.dll,FileProtocolHandler", url] };
  }
  if (isWsl() && commandOnPath("wslview")) {
    return { file: "wslview", args: [url] };
  }
  return { file: "xdg-open", args: [url] };
}

export async function launchSystemBrowser(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new GoogleError(ERR_OAUTH_BROWSER);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new GoogleError(ERR_OAUTH_BROWSER);
  }
  const { file, args } = opener(url);
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(file, args, {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
    } catch {
      reject(new GoogleError(ERR_OAUTH_BROWSER));
      return;
    }
    function finish(ok: boolean): void {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (ok) {
        resolve();
      } else {
        reject(new GoogleError(ERR_OAUTH_BROWSER));
      }
    }
    const timer = setTimeout(() => {
      finish(true);
    }, GOOGLE_BROWSER_LAUNCH_WAIT_MS);
    child.once("error", () => {
      finish(false);
    });
    child.once("exit", (code, signal) => {
      if (signal == null && code === 0) {
        finish(true);
        return;
      }
      finish(false);
    });
    try {
      child.unref();
    } catch {
      // ignore
    }
  });
}
