import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { ERR_GCLOUD_APPLY, ERR_GCLOUD_AUTH, ERR_PROJECT_ID, GoogleError } from "./errors.js";
import type { GcloudRunner, ProjectSetupResult } from "./types.js";

const execFileAsync = promisify(execFile);
const PROJECT_ID_RE = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

function assertProjectId(projectId: unknown): string {
  if (typeof projectId !== "string" || !PROJECT_ID_RE.test(projectId)) {
    throw new GoogleError(ERR_PROJECT_ID);
  }
  return projectId;
}

function intendedCommands(projectId: string): string[] {
  return [
    `gcloud projects describe ${projectId}`,
    `gcloud projects create ${projectId} --name="Witness Protection Program"`,
    `gcloud services enable drive.googleapis.com --project=${projectId}`,
  ];
}

function consoleUrls(projectId: string): string[] {
  return [
    `https://console.cloud.google.com/welcome?project=${projectId}`,
    `https://console.cloud.google.com/apis/library/drive.googleapis.com?project=${projectId}`,
    `https://console.cloud.google.com/auth/branding?project=${projectId}`,
    `https://console.cloud.google.com/auth/audience?project=${projectId}`,
    `https://console.cloud.google.com/auth/clients?project=${projectId}`,
  ];
}

function notes(): string[] {
  return [
    "Application name: Witness Protection Program.",
    "Publisher contact information is supplied by the owner. This tool does not invent a support identity.",
    "OAuth branding, audience, test users, and the Desktop client are created in Cloud Console while signed in.",
    "Use External audience. Add temporary test users while the app is in Testing.",
    "Retail accounts need production publishing and Google verification. Testing tokens expire.",
    "There is no API in this tool that creates a consumer OAuth client. Do not use IAP or workforce clients.",
    "Download the Desktop client JSON outside this repository. Do not commit it.",
    "Ordinary users complete Google browser consent only. They do not create a Cloud project.",
    "Ordinary users do not run gcloud. They do not download client JSON. They do not copy tokens.",
    "This tool does not enable billing, select an organization, accept terms, or change the global gcloud project.",
    "Optional organization or folder placement is deferred.",
  ];
}

async function defaultGcloud(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync("gcloud", args, { timeout: 120_000, maxBuffer: 1024 * 1024 });
    return { code: 0, stdout: String(result.stdout ?? ""), stderr: String(result.stderr ?? "") };
  } catch (err) {
    const failure = err as { code?: number | string; stdout?: string; stderr?: string };
    if (typeof failure.code === "number") {
      return { code: failure.code, stdout: String(failure.stdout ?? ""), stderr: String(failure.stderr ?? "") };
    }
    return { code: 1, stdout: String(failure.stdout ?? ""), stderr: String(failure.stderr ?? "") };
  }
}

export async function runGoogleProjectSetup(input: {
  projectId: string;
  apply?: boolean;
  runGcloud?: GcloudRunner;
}): Promise<ProjectSetupResult> {
  const projectId = assertProjectId(input.projectId);
  const result: ProjectSetupResult = {
    mode: input.apply === true ? "apply" : "dry-run",
    projectId,
    commands: intendedCommands(projectId),
    consoleUrls: consoleUrls(projectId),
    notes: notes(),
  };
  if (input.apply !== true) {
    result.mode = "dry-run";
    return result;
  }

  const run = input.runGcloud ?? defaultGcloud;
  const auth = await run(["auth", "list", "--filter=status:ACTIVE", "--format=value(account)"]);
  if (auth.code !== 0 || auth.stdout.trim().length === 0) {
    throw new GoogleError(ERR_GCLOUD_AUTH);
  }

  const described = await run(["projects", "describe", projectId, "--format=value(projectId)"]);
  if (described.code === 0) {
    if (described.stdout.trim() !== projectId) {
      throw new GoogleError(ERR_GCLOUD_APPLY);
    }
  } else {
    const created = await run(["projects", "create", projectId, "--name=Witness Protection Program"]);
    if (created.code !== 0) {
      throw new GoogleError(ERR_GCLOUD_APPLY);
    }
  }

  const enabled = await run(["services", "enable", "drive.googleapis.com", `--project=${projectId}`]);
  if (enabled.code !== 0) {
    throw new GoogleError(ERR_GCLOUD_APPLY);
  }
  return result;
}

function parseCli(argv: string[]): { projectId: string; apply: boolean } {
  let projectId: string | undefined;
  let apply = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    if (arg === "--project-id") {
      projectId = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith("--project-id=")) {
      projectId = arg.slice("--project-id=".length);
    }
  }
  if (projectId === undefined) {
    throw new GoogleError(ERR_PROJECT_ID);
  }
  return { projectId, apply };
}

export async function runGoogleProjectSetupCli(
  argv: string[],
  io?: {
    runGcloud?: GcloudRunner;
    stdout?: { write(chunk: string): boolean };
    stderr?: { write(chunk: string): boolean };
  },
): Promise<number> {
  const stdout = io?.stdout ?? process.stdout;
  const stderr = io?.stderr ?? process.stderr;
  try {
    const parsed = parseCli(argv);
    const result = await runGoogleProjectSetup({
      projectId: parsed.projectId,
      apply: parsed.apply,
      runGcloud: io?.runGcloud,
    });
    stdout.write(`mode ${result.mode}\n`);
    stdout.write(`project ${result.projectId}\n`);
    for (const command of result.commands) {
      stdout.write(`${command}\n`);
    }
    for (const url of result.consoleUrls) {
      stdout.write(`${url}\n`);
    }
    for (const note of result.notes) {
      stdout.write(`${note}\n`);
    }
    return 0;
  } catch (err) {
    const code = err instanceof GoogleError ? err.code : ERR_GCLOUD_APPLY;
    stderr.write(`${code}\n`);
    return 1;
  }
}
