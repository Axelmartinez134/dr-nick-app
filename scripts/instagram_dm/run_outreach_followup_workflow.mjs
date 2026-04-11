import { previewUnifiedWorkflow, runUnifiedWorkflowBatch, WORKFLOW_BUCKETS } from "./outreach_followup_workflow_lib.mjs";

function printHelp() {
  console.log(`
Usage:
  node scripts/instagram_dm/run_outreach_followup_workflow.mjs --account-id <uuid> [options]

Options:
  --account-id <uuid>              Required Supabase account id
  --bucket <name>                  actionable | missing_thread | ready_followup | manual_review | wait_window_not_met | all
  --limit <n>                      Max selected leads (default: 25)
  --offset <n>                     Skip first matching leads (default: 0)
  --min-days <n>                   Wait window in full days (default: 4)
  --duplicate-guard-hours <n>      Prevent duplicate sends for same follow-up (default: 72)
  --max-sends <n>                  Successful sends cap for live mode (default: 10)
  --stop-after-failures <n>        Consecutive failure stop threshold (default: 3)
  --delay-ms-min <n>               Inter-lead delay min (default: 2000)
  --delay-ms-max <n>               Inter-lead delay max (default: 5000)
  --pre-send-delay-ms-min <n>      Pre-send delay min (default: 1000)
  --pre-send-delay-ms-max <n>      Pre-send delay max (default: 2500)
  --post-send-delay-ms-min <n>     Post-send delay min (default: 1000)
  --post-send-delay-ms-max <n>     Post-send delay max (default: 2000)
  --send-live                      Actually send follow-ups
  --preview-only                   Print preview only and exit
  --debugger-url <url>             Chrome remote debugger URL (default: http://127.0.0.1:9222)
  --run-label <label>              Optional suffix for artifact folders
  --username <handle>              Optional exact username filter (repeatable)
  --help                           Show this help
`);
}

function readValue(argv, idx) {
  if (idx + 1 >= argv.length) throw new Error(`Missing value for ${argv[idx]}`);
  return argv[idx + 1];
}

function parseArgs(argv) {
  const args = {
    accountId: "",
    bucket: WORKFLOW_BUCKETS.actionable,
    limit: 25,
    offset: 0,
    minDaysSinceLastContact: 4,
    duplicateGuardHours: 72,
    maxSends: 10,
    stopAfterFailures: 3,
    delayMsMin: 2000,
    delayMsMax: 5000,
    preSendDelayMsMin: 1000,
    preSendDelayMsMax: 2500,
    postSendDelayMsMin: 1000,
    postSendDelayMsMax: 2000,
    sendLive: false,
    previewOnly: false,
    debuggerUrl: "http://127.0.0.1:9222",
    runLabel: "",
    usernames: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    if (arg === "--send-live") {
      args.sendLive = true;
      continue;
    }
    if (arg === "--preview-only") {
      args.previewOnly = true;
      continue;
    }
    if (arg === "--account-id") {
      args.accountId = readValue(argv, i);
      i += 1;
      continue;
    }
    if (arg === "--bucket") {
      args.bucket = readValue(argv, i);
      i += 1;
      continue;
    }
    if (arg === "--limit") {
      args.limit = Number(readValue(argv, i));
      i += 1;
      continue;
    }
    if (arg === "--offset") {
      args.offset = Number(readValue(argv, i));
      i += 1;
      continue;
    }
    if (arg === "--min-days") {
      args.minDaysSinceLastContact = Number(readValue(argv, i));
      i += 1;
      continue;
    }
    if (arg === "--duplicate-guard-hours") {
      args.duplicateGuardHours = Number(readValue(argv, i));
      i += 1;
      continue;
    }
    if (arg === "--max-sends") {
      args.maxSends = Number(readValue(argv, i));
      i += 1;
      continue;
    }
    if (arg === "--stop-after-failures") {
      args.stopAfterFailures = Number(readValue(argv, i));
      i += 1;
      continue;
    }
    if (arg === "--delay-ms-min") {
      args.delayMsMin = Number(readValue(argv, i));
      i += 1;
      continue;
    }
    if (arg === "--delay-ms-max") {
      args.delayMsMax = Number(readValue(argv, i));
      i += 1;
      continue;
    }
    if (arg === "--pre-send-delay-ms-min") {
      args.preSendDelayMsMin = Number(readValue(argv, i));
      i += 1;
      continue;
    }
    if (arg === "--pre-send-delay-ms-max") {
      args.preSendDelayMsMax = Number(readValue(argv, i));
      i += 1;
      continue;
    }
    if (arg === "--post-send-delay-ms-min") {
      args.postSendDelayMsMin = Number(readValue(argv, i));
      i += 1;
      continue;
    }
    if (arg === "--post-send-delay-ms-max") {
      args.postSendDelayMsMax = Number(readValue(argv, i));
      i += 1;
      continue;
    }
    if (arg === "--debugger-url") {
      args.debuggerUrl = readValue(argv, i);
      i += 1;
      continue;
    }
    if (arg === "--run-label") {
      args.runLabel = readValue(argv, i);
      i += 1;
      continue;
    }
    if (arg === "--username") {
      args.usernames.push(readValue(argv, i));
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }
  if (!args.accountId) {
    printHelp();
    throw new Error("--account-id is required");
  }

  const preview = await previewUnifiedWorkflow(args);
  console.log(JSON.stringify(preview, null, 2));

  if (args.previewOnly || !args.sendLive) {
    if (args.previewOnly) return;
  }

  const result = await runUnifiedWorkflowBatch({
    ...args,
    onEvent(event) {
      if (event?.type === "log" && event?.message) console.log(event.message);
    },
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
