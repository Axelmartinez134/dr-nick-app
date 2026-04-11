import http from "node:http";
import {
  DEFAULT_BRIDGE_HOST,
  DEFAULT_BRIDGE_PORT,
  previewUnifiedWorkflow,
  runUnifiedWorkflowBatch,
} from "./outreach_followup_workflow_lib.mjs";

const host = process.env.OUTREACH_LOCAL_BRIDGE_HOST || DEFAULT_BRIDGE_HOST;
const port = Number(process.env.OUTREACH_LOCAL_BRIDGE_PORT || DEFAULT_BRIDGE_PORT);
const debuggerUrl = "http://127.0.0.1:9222";
const jobs = new Map();
let requestCounter = 0;

function nowIso() {
  return new Date().toISOString();
}

function nextRequestId() {
  requestCounter += 1;
  return `bridge_${Date.now()}_${String(requestCounter).padStart(4, "0")}`;
}

function summarizeRequestBody(body) {
  if (!body || typeof body !== "object") return body;
  return {
    accountId: typeof body.accountId === "string" ? body.accountId : null,
    bucket: typeof body.bucket === "string" ? body.bucket : null,
    limit: Number.isFinite(body.limit) ? body.limit : body.limit ?? null,
    offset: Number.isFinite(body.offset) ? body.offset : body.offset ?? null,
    minDaysSinceLastContact: Number.isFinite(body.minDaysSinceLastContact)
      ? body.minDaysSinceLastContact
      : body.minDaysSinceLastContact ?? null,
    duplicateGuardHours: Number.isFinite(body.duplicateGuardHours)
      ? body.duplicateGuardHours
      : body.duplicateGuardHours ?? null,
    sendLive: !!body.sendLive,
    maxSends: Number.isFinite(body.maxSends) ? body.maxSends : body.maxSends ?? null,
    stopAfterFailures: Number.isFinite(body.stopAfterFailures)
      ? body.stopAfterFailures
      : body.stopAfterFailures ?? null,
    delayMsMin: Number.isFinite(body.delayMsMin) ? body.delayMsMin : body.delayMsMin ?? null,
    delayMsMax: Number.isFinite(body.delayMsMax) ? body.delayMsMax : body.delayMsMax ?? null,
    preSendDelayMsMin: Number.isFinite(body.preSendDelayMsMin)
      ? body.preSendDelayMsMin
      : body.preSendDelayMsMin ?? null,
    preSendDelayMsMax: Number.isFinite(body.preSendDelayMsMax)
      ? body.preSendDelayMsMax
      : body.preSendDelayMsMax ?? null,
    postSendDelayMsMin: Number.isFinite(body.postSendDelayMsMin)
      ? body.postSendDelayMsMin
      : body.postSendDelayMsMin ?? null,
    postSendDelayMsMax: Number.isFinite(body.postSendDelayMsMax)
      ? body.postSendDelayMsMax
      : body.postSendDelayMsMax ?? null,
  };
}

function statusCodeForError(serialized) {
  const message = String(serialized?.message || "").toLowerCase();
  if (message.includes("accountid is required") || message.includes("invalid accountid format")) {
    return 400;
  }
  if (message.includes("forbidden")) return 403;
  if (message.includes("job not found")) return 404;
  return 500;
}

function serializeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack || null,
      cause:
        error.cause instanceof Error
          ? {
              name: error.cause.name,
              message: error.cause.message,
              stack: error.cause.stack || null,
            }
          : error.cause ?? null,
    };
  }
  return {
    name: "NonError",
    message: String(error),
    stack: null,
    cause: null,
  };
}

function logBridge(level, requestId, message, details = null) {
  const prefix = `[${nowIso()}] [bridge] [${level}] [${requestId}] ${message}`;
  if (details === null || details === undefined) {
    console.log(prefix);
    return;
  }
  console.log(prefix, details);
}

async function checkChromeDebuggerReadiness() {
  const versionUrl = `${debuggerUrl.replace(/\/+$/, "")}/json/version`;
  try {
    const res = await fetch(versionUrl, { method: "GET" });
    const text = await res.text().catch(() => "");
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    return {
      ok: res.ok,
      status: res.status,
      webSocketDebuggerUrl:
        typeof parsed?.webSocketDebuggerUrl === "string" ? parsed.webSocketDebuggerUrl : null,
      browser:
        typeof parsed?.Browser === "string"
          ? parsed.Browser
          : typeof parsed?.browser === "string"
            ? parsed.browser
            : null,
      error: res.ok ? null : `Chrome debugger returned ${res.status}`,
    };
  } catch (error) {
    const serialized = serializeError(error);
    return {
      ok: false,
      status: null,
      webSocketDebuggerUrl: null,
      browser: null,
      error: serialized.message,
    };
  }
}

function sendJson(res, statusCode, payload, requestId = null) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Allow-Private-Network": "true",
    "Cache-Control": "no-store",
    ...(requestId ? { "X-Bridge-Request-Id": requestId } : {}),
    Vary: "Origin, Access-Control-Request-Method, Access-Control-Request-Headers, Access-Control-Request-Private-Network",
  });
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function sendPreflight(res) {
  res.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Allow-Private-Network": "true",
    "Access-Control-Max-Age": "600",
    Vary: "Origin, Access-Control-Request-Method, Access-Control-Request-Headers, Access-Control-Request-Private-Network",
    "Content-Length": "0",
  });
  res.end();
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8").trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function createJob(request, preview) {
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const job = {
    id,
    status: "queued",
    cancelRequested: false,
    cancelledAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    request,
    preview,
    progress: {
      processed: 0,
      total: Number(preview?.total_selected || 0),
      successfulSends: 0,
      lastMessage: null,
    },
    result: null,
    error: null,
    logs: [],
  };
  jobs.set(id, job);
  if (jobs.size > 20) {
    const ids = Array.from(jobs.keys());
    while (ids.length > 20) {
      const first = ids.shift();
      if (first) jobs.delete(first);
    }
  }
  return job;
}

function getRunningJob() {
  return (
    Array.from(jobs.values()).find(
      (job) => job.status === "queued" || job.status === "running" || job.status === "cancelling"
    ) || null
  );
}

async function runJob(job) {
  job.status = "running";
  job.updatedAt = new Date().toISOString();
  try {
    const result = await runUnifiedWorkflowBatch({
      ...job.request,
      shouldCancel() {
        return !!job.cancelRequested;
      },
      onEvent(event) {
        job.updatedAt = new Date().toISOString();
        if (event?.type === "log" && event?.message) {
          job.logs.push(event.message);
          if (job.logs.length > 200) job.logs.shift();
          job.progress.lastMessage = event.message;
        }
        if (event?.type === "result") {
          job.progress.processed = Array.isArray(event?.batchSummary?.results)
            ? event.batchSummary.results.length
            : job.progress.processed;
          job.progress.total = Number(event?.batchSummary?.total_selected || job.progress.total || 0);
          job.progress.successfulSends = Array.isArray(event?.batchSummary?.results)
            ? event.batchSummary.results.filter(
                (row) =>
                  row?.execution_state === "sent_followup" ||
                  row?.execution_state === "sent_followup_persist_failed"
              ).length
            : job.progress.successfulSends;
        }
      },
    });
    job.status = result?.summary?.aborted_reason === "cancelled_by_user" ? "cancelled" : "completed";
    job.result = result;
    job.updatedAt = new Date().toISOString();
  } catch (error) {
    job.status = "failed";
    job.error = error instanceof Error ? error.message : String(error);
    job.updatedAt = new Date().toISOString();
  }
}

const server = http.createServer(async (req, res) => {
  const requestId = nextRequestId();
  try {
    if (!req.url) {
      logBridge("warn", requestId, "Missing request URL");
      sendJson(res, 404, { success: false, error: "Not found", debug_id: requestId }, requestId);
      return;
    }
    const url = new URL(req.url, `http://${req.headers.host || `${host}:${port}`}`);
    logBridge("info", requestId, `${req.method || "UNKNOWN"} ${url.pathname}`, {
      origin: req.headers.origin || null,
      host: req.headers.host || null,
      userAgent: req.headers["user-agent"] || null,
    });

    if (req.method === "OPTIONS") {
      sendPreflight(res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, {
        success: true,
        host,
        port,
        running_job_id: getRunningJob()?.id || null,
      }, requestId);
      return;
    }

    if (req.method === "GET" && url.pathname === "/readiness") {
      const chromeDebugger = await checkChromeDebuggerReadiness();
      sendJson(
        res,
        200,
        {
          success: true,
          bridge: {
            ok: true,
            host,
            port,
          },
          chrome_debugger: {
            ok: !!chromeDebugger.ok,
            debugger_url: debuggerUrl,
            browser: chromeDebugger.browser,
            status: chromeDebugger.status,
            web_socket_debugger_url: chromeDebugger.webSocketDebuggerUrl,
            error: chromeDebugger.error,
          },
          running_job_id: getRunningJob()?.id || null,
          debug_id: requestId,
        },
        requestId
      );
      return;
    }

    if (req.method === "POST" && url.pathname === "/workflow/preview") {
      const body = await parseJsonBody(req);
      logBridge("info", requestId, "Preview request body", summarizeRequestBody(body));
      const preview = await previewUnifiedWorkflow(body || {});
      logBridge("info", requestId, "Preview success", {
        total_candidates: preview?.total_candidates ?? null,
        total_matching: preview?.total_matching ?? null,
        total_selected: preview?.total_selected ?? null,
      });
      sendJson(res, 200, { success: true, preview, debug_id: requestId }, requestId);
      return;
    }

    if (req.method === "POST" && url.pathname === "/workflow/start") {
      const body = await parseJsonBody(req);
      logBridge("info", requestId, "Start request body", summarizeRequestBody(body));
      const runningJob = getRunningJob();
      if (runningJob) {
        logBridge("warn", requestId, "Rejected start because a job is already active", {
          active_job_id: runningJob.id,
          active_job_status: runningJob.status,
        });
        sendJson(res, 409, {
          success: false,
          error: `A workflow job is already ${runningJob.status}.`,
          jobId: runningJob.id,
          debug_id: requestId,
        }, requestId);
        return;
      }

      const preview = await previewUnifiedWorkflow(body || {});
      const job = createJob(body || {}, preview);
      void runJob(job);
      logBridge("info", requestId, "Start accepted", {
        jobId: job.id,
        total_selected: preview?.total_selected ?? null,
      });
      sendJson(res, 200, {
        success: true,
        jobId: job.id,
        preview,
        debug_id: requestId,
      }, requestId);
      return;
    }

    if (req.method === "GET" && url.pathname === "/workflow/jobs") {
      const list = Array.from(jobs.values())
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
        .map((job) => ({
          id: job.id,
          status: job.status,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
          preview: job.preview,
          progress: job.progress,
          error: job.error,
        }));
      sendJson(res, 200, { success: true, jobs: list, debug_id: requestId }, requestId);
      return;
    }

    if (req.method === "POST" && /\/workflow\/jobs\/[^/]+\/cancel$/.test(url.pathname)) {
      const parts = url.pathname.split("/").filter(Boolean);
      const jobId = parts[2] || null;
      const job = jobId ? jobs.get(jobId) : null;
      if (!job) {
        logBridge("warn", requestId, "Cancel target job not found", { jobId });
        sendJson(res, 404, { success: false, error: "Job not found", debug_id: requestId }, requestId);
        return;
      }
      if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
        logBridge("warn", requestId, "Cancel rejected because job already finished", {
          jobId,
          status: job.status,
        });
        sendJson(
          res,
          409,
          {
            success: false,
            error: `Cannot cancel job in status ${job.status}.`,
            debug_id: requestId,
          },
          requestId
        );
        return;
      }
      job.cancelRequested = true;
      job.cancelledAt = new Date().toISOString();
      job.updatedAt = job.cancelledAt;
      job.status = "cancelling";
      job.progress.lastMessage = "Cancellation requested. Waiting for the current step to stop safely.";
      job.logs.push(`[${job.cancelledAt}] cancel requested from UI`);
      if (job.logs.length > 200) job.logs.shift();
      logBridge("info", requestId, "Cancel accepted", { jobId, status: job.status });
      sendJson(res, 200, { success: true, job, debug_id: requestId }, requestId);
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/workflow/jobs/")) {
      const jobId = url.pathname.split("/").pop();
      const job = jobId ? jobs.get(jobId) : null;
      if (!job) {
        logBridge("warn", requestId, "Job not found", { jobId: jobId || null });
        sendJson(res, 404, { success: false, error: "Job not found", debug_id: requestId }, requestId);
        return;
      }
      sendJson(res, 200, { success: true, job, debug_id: requestId }, requestId);
      return;
    }

    logBridge("warn", requestId, "Route not found", { method: req.method || null, path: url.pathname });
    sendJson(res, 404, { success: false, error: "Not found", debug_id: requestId }, requestId);
  } catch (error) {
    const serialized = serializeError(error);
    logBridge("error", requestId, "Unhandled bridge error", serialized);
    sendJson(res, statusCodeForError(serialized), {
      success: false,
      error: serialized.message,
      debug_id: requestId,
      debug: serialized,
    }, requestId);
  }
});

server.listen(port, host, () => {
  console.log(`Local outreach workflow bridge listening at http://${host}:${port}`);
});
