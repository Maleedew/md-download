import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { UserError } from "./errors.js";
import type { Kind } from "./format.js";
import { runDownload, type ProgressUpdate } from "./ytdlp.js";

export type JobStatus = "queued" | "running" | "done" | "error";

export interface Job {
  id: string;
  ip: string;
  url: string;
  kind: Kind;
  quality: number;
  status: JobStatus;
  stage: "queued" | "downloading" | "processing" | "done" | "error";
  progress: number;
  speed: number | null;
  eta: number | null;
  error?: string;
  fileName?: string;
  filePath?: string;
  size?: number;
  dir: string;
  createdAt: number;
  finishedAt?: number;
  abort: AbortController;
  timedOut: boolean;
}

export interface PublicJob {
  id: string;
  kind: Kind;
  status: JobStatus;
  stage: Job["stage"];
  progress: number;
  speed: number | null;
  eta: number | null;
  queuePosition?: number;
  error?: string;
  fileName?: string;
  size?: number;
}

const jobs = new Map<string, Job>();
const queue: string[] = [];
let running = 0;

const MAX_ACTIVE_PER_IP = 2;

export async function initJobs() {
  await fs.rm(config.tmpDir, { recursive: true, force: true });
  await fs.mkdir(config.tmpDir, { recursive: true });
  const timer = setInterval(sweep, 60_000);
  timer.unref();
}

export function toPublic(job: Job): PublicJob {
  const pos = job.status === "queued" ? queue.indexOf(job.id) + 1 : 0;
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    stage: job.stage,
    progress: Math.round(job.progress * 10) / 10,
    speed: job.speed,
    eta: job.eta,
    queuePosition: pos > 0 ? pos : undefined,
    error: job.error,
    fileName: job.status === "done" ? job.fileName : undefined,
    size: job.status === "done" ? job.size : undefined,
  };
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function createJob(input: { url: string; kind: Kind; quality: number; ip: string }): Job {
  const mine = [...jobs.values()].filter(
    (j) => j.ip === input.ip && (j.status === "queued" || j.status === "running"),
  ).length;
  if (mine >= MAX_ACTIVE_PER_IP) {
    throw new UserError("You already have downloads in progress. Please wait for them to finish.", 429);
  }
  if (queue.length >= config.maxQueuedJobs) {
    throw new UserError("The server is busy right now. Please try again in a minute.", 503);
  }

  const id = crypto.randomUUID();
  const job: Job = {
    id,
    ...input,
    status: "queued",
    stage: "queued",
    progress: 0,
    speed: null,
    eta: null,
    dir: path.join(config.tmpDir, id),
    createdAt: Date.now(),
    abort: new AbortController(),
    timedOut: false,
  };
  jobs.set(id, job);
  queue.push(id);
  pump();
  return job;
}

function pump() {
  while (running < config.maxConcurrentJobs && queue.length > 0) {
    const id = queue.shift()!;
    const job = jobs.get(id);
    if (!job || job.status !== "queued") continue;
    running++;
    void execute(job).finally(() => {
      running--;
      pump();
    });
  }
}

async function execute(job: Job) {
  job.status = "running";
  job.stage = "downloading";
  const timer = setTimeout(() => {
    job.timedOut = true;
    job.abort.abort();
  }, config.jobTimeoutMs);

  const onProgress = (u: ProgressUpdate) => {
    job.stage = u.stage;
    job.progress = Math.max(job.progress, u.progress); // never go backwards
    job.speed = u.speed ?? null;
    job.eta = u.eta ?? null;
  };

  try {
    await fs.mkdir(job.dir, { recursive: true });
    const out = await runDownload(
      { url: job.url, kind: job.kind, quality: job.quality, outDir: job.dir },
      onProgress,
      job.abort.signal,
    );
    job.filePath = out.filePath;
    job.fileName = out.fileName;
    job.size = out.size;
    job.progress = 100;
    job.stage = "done";
    job.status = "done";
  } catch (e) {
    job.stage = "error";
    job.status = "error";
    job.error = job.timedOut
      ? "The download took too long and was stopped. Try a lower quality."
      : e instanceof UserError
        ? e.message
        : "Something went wrong while downloading. Please try again.";
    if (!(e instanceof UserError)) console.error("[job]", job.id, e);
    await fs.rm(job.dir, { recursive: true, force: true }).catch(() => {});
  } finally {
    clearTimeout(timer);
    job.speed = null;
    job.eta = null;
    job.finishedAt = Date.now();
  }
}

export function cancelJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job) return false;
  if (job.status === "queued") {
    queue.splice(queue.indexOf(id), 1);
    job.status = "error";
    job.stage = "error";
    job.error = "Download canceled.";
    job.finishedAt = Date.now();
  } else if (job.status === "running") {
    job.abort.abort();
  }
  return true;
}

/** Delete expired jobs and their files. */
async function sweep() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (job.finishedAt && now - job.finishedAt > config.fileTtlMs) {
      await fs.rm(job.dir, { recursive: true, force: true }).catch(() => {});
      jobs.delete(id);
    }
  }
}

export const _internals = { jobs, queue, sweep };
