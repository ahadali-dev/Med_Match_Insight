"use client";

import { useState, type ReactNode } from "react";
import { checkConfiguredClients, testSheet, unlockAdmin, type ClientCheck, type SheetCheck, type UnlockResult } from "@/app/admin-actions";
import { INPUT } from "./edit-cells";
import { Card, Chip, cx } from "./ui";
import { todayISO } from "@/lib/dates";
import { SEED_HEADERS, buildSeedTabs } from "@/lib/seed-data";
import { slugify } from "@/lib/sheet-id";
import { TAB_NAMES } from "@/lib/types";

type Unlocked = Extract<UnlockResult, { ok: true }>;

const BTN = "min-h-10 rounded-md border border-[#c3cec9] bg-white px-4 text-sm font-semibold text-ink hover:bg-page disabled:cursor-not-allowed disabled:opacity-60";
const PRIMARY = "min-h-10 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60";

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: ReactNode }) {
  return (
    <li className="flex gap-3.5">
      <span
        aria-hidden="true"
        className={cx("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold", done ? "bg-accent text-white" : "bg-info-bg text-info-fg")}
      >
        {done ? "✓" : n}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold">
          {title}
          {done && <span className="sr-only"> (done)</span>}
        </h3>
        <div className="mt-2 flex flex-col gap-3 text-sm text-body">{children}</div>
      </div>
    </li>
  );
}

function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <button
      type="button"
      className={cx(BTN, className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("copied");
        } catch {
          setState("failed");
        }
        setTimeout(() => setState("idle"), 2500);
      }}
    >
      {state === "copied" ? "Copied ✓" : state === "failed" ? "Select and copy manually" : label}
    </button>
  );
}

function Code({ children }: { children: string }) {
  return <code className="block overflow-x-auto whitespace-pre rounded-lg bg-page px-3 py-2.5 font-mono text-[13px] text-ink">{children}</code>;
}

function CheckResult({ result }: { result: SheetCheck }) {
  if (!result.ok) {
    return (
      <div role="alert" className="rounded-xl border border-[#e4b4ae] bg-red-bg px-4 py-3 text-sm text-red-fg">
        <p className="font-semibold">Could not connect</p>
        <p className="mt-1">{result.message}</p>
      </div>
    );
  }
  return (
    <div role="status" className="rounded-xl border border-line bg-info-bg px-4 py-3 text-sm text-info-fg">
      <p className="font-semibold">Connected to “{result.title}”</p>
      <p className="mt-1">
        Client name in the sheet: <strong>{result.clientName}</strong> · target {result.targetDays} days · {result.tabCount} tabs
      </p>
      <p className="mt-1">
        Found {result.counts.providers} providers, {result.counts.credentialing} credentialing steps, {result.counts.expirations} expirations, {result.counts.roles} roles and {result.counts.onboarding} onboarding rows.
      </p>
      {result.warnings.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer font-semibold">
            {result.warnings.length} row{result.warnings.length === 1 ? "" : "s"} will be skipped
          </summary>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            {result.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Unlock({ onUnlocked }: { onUnlocked: (u: Unlocked, code: string) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        const res = await unlockAdmin(code).catch(() => null);
        setBusy(false);
        if (!res) return setMsg("Could not reach the server. Try again.");
        if (res.ok) return onUnlocked(res, code);
        setMsg(
          res.reason === "locked"
            ? "Admin tools are locked. Add an ADMIN_PASSCODE environment variable (for example in Vercel), redeploy, then enter it here."
            : "That passcode is not correct.",
        );
      }}
      className="flex max-w-md flex-col gap-3"
    >
      <p className="text-sm text-body">
        These tools check a client&apos;s Google Sheet and help you connect it. Only people who run the dashboard should use them, so they need the admin passcode.
      </p>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Admin passcode
        <input className={INPUT} type="password" autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)} />
      </label>
      <div>
        <button type="submit" className={PRIMARY} disabled={busy}>
          {busy ? "Checking…" : "Unlock admin tools"}
        </button>
      </div>
      {msg && (
        <p role="alert" className="rounded-lg bg-amber-bg px-3 py-2 text-sm text-amber-fg">
          {msg}
        </p>
      )}
    </form>
  );
}

function Wizard({ admin, code }: { admin: Unlocked; code: string }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SheetCheck | null>(null);
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [statuses, setStatuses] = useState<ClientCheck[] | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const connected = admin.clients.filter((c) => c.hasSheet);
  const ok = result?.ok ? result : null;

  const clientsJson = (() => {
    if (!ok) return "";
    const entry = { name: name.trim() || ok.clientName, id: slugify(id || name || ok.clientName), sheetId: ok.sheetId };
    const others = connected.filter((c) => c.sheetId !== ok.sheetId).map((c) => ({ name: c.name, id: c.id, sheetId: c.sheetId }));
    return JSON.stringify([...others, entry]);
  })();

  const template = (tab: (typeof TAB_NAMES)[number], withExample: boolean) => {
    const rows: string[][] = [[...SEED_HEADERS[tab]]];
    if (withExample) {
      const example = buildSeedTabs(todayISO())[tab][1];
      if (example) rows.push(example.map(String));
    }
    return rows.map((r) => r.join("\t")).join("\n");
  };

  return (
    <ol className="flex flex-col gap-6">
      <Step n={1} title="One-time setup: Google service account" done={admin.credentials}>
        {admin.credentials ? (
          <p>The server has its Google credentials. Nothing to do here.</p>
        ) : (
          <>
            <p>The dashboard reads sheets through a Google “service account”, a robot login that only has the access you give it. Create it once:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>In Google Cloud Console, create a project and turn on the <strong>Google Sheets API</strong>.</li>
              <li>Open <em>IAM &amp; Admin → Service accounts</em>, create one, then <em>Keys → Add key → JSON</em>.</li>
              <li>
                In your hosting settings (for Vercel: <em>Settings → Environment Variables</em>) add <code className="rounded bg-page px-1">GOOGLE_SERVICE_ACCOUNT_EMAIL</code> (the <code className="rounded bg-page px-1">client_email</code> from the file) and <code className="rounded bg-page px-1">GOOGLE_PRIVATE_KEY</code> (the <code className="rounded bg-page px-1">private_key</code>, in quotes), then redeploy.
              </li>
            </ol>
          </>
        )}
      </Step>

      <Step n={2} title="Share the client's Google Sheet with the dashboard" done={Boolean(admin.serviceAccount) && Boolean(ok)}>
        {admin.serviceAccount ? (
          <>
            <p>
              Open the client&apos;s sheet, click <strong>Share</strong>, paste this email, and choose <strong>Viewer</strong>. Viewer is enough, and the dashboard can never change the sheet.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 break-all rounded-lg bg-page px-3 py-2 font-mono text-[13px] text-ink">{admin.serviceAccount}</code>
              <CopyButton text={admin.serviceAccount} label="Copy email" />
            </div>
          </>
        ) : (
          <p className="rounded-lg bg-amber-bg px-3 py-2 text-amber-fg">Finish step 1 first. The email to share with appears here once the credentials are set.</p>
        )}
      </Step>

      <Step n={3} title="Check the sheet" done={Boolean(ok)}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setResult(null);
            const res = await testSheet(code, input).catch(() => ({ ok: false as const, message: "Could not reach the server. Try again." }));
            setBusy(false);
            setResult(res);
            if (res.ok) {
              setName(res.clientName);
              setId(slugify(res.clientName));
            }
          }}
          className="flex flex-col gap-3"
        >
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Paste the sheet&apos;s link (or its ID)
            <input className={INPUT} value={input} onChange={(e) => setInput(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…/edit" />
          </label>
          <div>
            <button type="submit" className={PRIMARY} disabled={busy || !input.trim()}>
              {busy ? "Checking…" : "Check connection"}
            </button>
          </div>
        </form>
        {result && <CheckResult result={result} />}
        <details>
          <summary className="cursor-pointer font-semibold text-ink">The sheet needs these 6 tabs (show the columns, copy them into a new sheet)</summary>
          <div className="mt-3 flex flex-col gap-3">
            <p>Tab names must match exactly. Paste each header row into cell A1 of its tab; it splits into columns automatically.</p>
            {TAB_NAMES.map((tab) => (
              <div key={tab} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-ink">{tab}</strong>
                  <span className="flex gap-2">
                    <CopyButton text={template(tab, false)} label="Copy headers" className="min-h-9 px-3 text-xs" />
                    <CopyButton text={template(tab, true)} label="Copy with example row" className="min-h-9 px-3 text-xs" />
                  </span>
                </div>
                <p className="mt-1.5 font-mono text-xs text-muted">{SEED_HEADERS[tab].join(", ")}</p>
              </div>
            ))}
            <p className="text-xs text-muted">
              Or let the seed script build a complete sample sheet: <code className="rounded bg-page px-1">npm run seed</code>.
            </p>
          </div>
        </details>
      </Step>

      <Step n={4} title="Add it to the dashboard" done={false}>
        {!ok ? (
          <p className="text-muted">Complete step 3 and this fills in for you.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                Name shown in the dashboard
                <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                Web address part (letters, numbers, dashes)
                <input className={INPUT} value={id} onChange={(e) => setId(slugify(e.target.value))} />
              </label>
            </div>
            <p>
              The dashboard will be at <code className="rounded bg-page px-1">/{slugify(id || name) || "client"}</code>. Copy this line into the <code className="rounded bg-page px-1">CLIENTS</code> environment variable{connected.length > 0 ? " (it keeps the clients you already have)" : ""}:
            </p>
            <Code>{clientsJson}</Code>
            <div>
              <CopyButton text={clientsJson} label="Copy CLIENTS value" />
            </div>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Vercel: <em>Settings → Environment Variables → CLIENTS</em> → paste → Save. Locally: put <code className="rounded bg-page px-1">CLIENTS=…</code> in <code className="rounded bg-page px-1">.env.local</code>.
              </li>
              <li>Redeploy (Vercel only reads new values on the next build) or restart the local server.</li>
              <li>Open the dashboard. It starts on the live sheet automatically.</li>
            </ol>
          </>
        )}
      </Step>

      <li className="border-t border-line pt-5">
        <h3 className="text-[15px] font-semibold">Clients connected right now</h3>
        <div className="mt-2 flex flex-col gap-3 text-sm text-body">
          {admin.clientsError && <p className="rounded-lg bg-amber-bg px-3 py-2 text-amber-fg">{admin.clientsError}</p>}
          {connected.length === 0 ? (
            <p>No Google Sheets are connected yet. The dashboard is running on the demo workspace.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-1.5">
                {connected.map((c) => {
                  const r = statuses?.find((s) => s.id === c.id)?.result;
                  return (
                    <li key={c.id} className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink">{c.name}</span>
                      <span className="text-xs text-muted">/{c.id}</span>
                      {r && (r.ok ? <Chip tone="good">Connected · {r.counts.providers} providers</Chip> : <Chip tone="bad">{r.message.slice(0, 80)}</Chip>)}
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className={BTN}
                  disabled={statusBusy}
                  onClick={async () => {
                    setStatusBusy(true);
                    setStatusMsg(null);
                    const res = await checkConfiguredClients(code).catch(() => ({ ok: false as const, message: "Could not reach the server." }));
                    setStatusBusy(false);
                    if (res.ok) setStatuses(res.results);
                    else setStatusMsg(res.message);
                  }}
                >
                  {statusBusy ? "Checking…" : "Check all connections"}
                </button>
                {statusMsg && <span className="text-red">{statusMsg}</span>}
              </div>
            </>
          )}
        </div>
      </li>
    </ol>
  );
}

/** Admin-only: connect and check Google Sheets without digging through settings files. */
export function AdminTools() {
  const [state, setState] = useState<{ admin: Unlocked; code: string } | null>(null);
  return (
    <Card title="Admin tools: connect a Google Sheet" headingId="admin-heading" className="lg:col-span-2" aside={state ? <button type="button" className="text-[13px] font-semibold text-accent underline" onClick={() => setState(null)}>Lock</button> : "Passcode required"}>
      {state ? <Wizard admin={state.admin} code={state.code} /> : <Unlock onUnlocked={(admin, code) => setState({ admin, code })} />}
    </Card>
  );
}
