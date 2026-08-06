// Supabase Edge Function: create-issue
// -----------------------------------------------------------------------------
// Legt für eine in der App gemeldete Frage DIREKT ein GitHub-Issue an – ohne dass
// die Nutzerin zu GitHub wechseln oder dort angemeldet sein muss.
//
// Warum überhaupt ein Serverteil? Ein GitHub-Token darf NIEMALS in eine öffentlich
// ausgelieferte Web-App. Diese Funktion hält ihn als Secret; die App schickt nur die
// Meldung her und bekommt die Issue-Nummer zurück.
//
// Schutz vor Missbrauch (der Endpunkt ist wie alle anon-Endpunkte offen erreichbar):
//   1. Zugangscode – derselbe, mit dem die Lerninhalte freigeschaltet werden. Ohne
//      korrekten Code passiert nichts (Prüfung gegen content_gate, wie get_content).
//   2. Dedupe – je Frage-ID höchstens EIN Issue. Ein zweiter Aufruf liefert das
//      vorhandene zurück, statt ein weiteres anzulegen.
//   3. Mengenbegrenzung – höchstens ISSUE_RATE_MAX neue Issues pro Stunde.
//   4. Größenbegrenzung des Textes.
//
// Benötigte Secrets (Dashboard → Edge Functions → Manage secrets):
//   GITHUB_TOKEN – Fine-grained PAT, NUR für das Ziel-Repo, Berechtigung
//                  "Issues: Read and write". Sonst nichts.
//   GITHUB_REPO  – "owner/repo" des ZIEL-Repos (privat halten – der Issue-Text
//                  enthält geschützte Fragetexte).
//
// SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY stellt Supabase automatisch bereit.
//
// Vorbereitung in der Datenbank: supabase/feedback-issues.sql ausführen.
// Deploy:  supabase functions deploy create-issue --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const ISSUE_RATE_MAX = 30;          // neue Issues je Stunde
const BODY_MAX = 20000;             // Zeichen
const TITLE_MAX = 200;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Zugangscode gegen die Gate-Tabelle prüfen (gleiche Quelle wie get_content).
async function codeOk(code: string): Promise<boolean> {
  if (!code || code.length < 4) return false;
  const { data, error } = await supabase.from("content_gate").select("code_hash").eq("id", 1).maybeSingle();
  if (error || !data?.code_hash) return false;
  const a = new TextEncoder().encode(String(data.code_hash));
  const b = new TextEncoder().encode(code);
  if (a.length !== b.length) return false;
  let diff = 0;                       // konstante Laufzeit – kein Zeichen-für-Zeichen-Abbruch
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const repo = Deno.env.get("GITHUB_REPO");
  const token = Deno.env.get("GITHUB_TOKEN");
  if (!repo || !token) return json({ error: "not-configured" }, 501);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "bad-json" }, 400); }

  const code = String(payload?.code ?? "");
  const questionId = String(payload?.id ?? "").slice(0, 80);
  const title = String(payload?.title ?? "").slice(0, TITLE_MAX);
  const body = String(payload?.body ?? "").slice(0, BODY_MAX);
  if (!questionId || !title) return json({ error: "bad-request" }, 400);
  if (!(await codeOk(code))) return json({ error: "unauthorized" }, 401);

  // Schon ein Issue zu dieser Frage? Dann dieses zurückgeben (keine Dubletten).
  const { data: known } = await supabase
    .from("feedback_issues").select("issue_number, issue_url").eq("question_id", questionId).maybeSingle();
  if (known?.issue_number) {
    return json({ ok: true, existing: true, number: known.issue_number, url: known.issue_url });
  }

  // Mengenbegrenzung: nicht mehr als ISSUE_RATE_MAX in der letzten Stunde.
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await supabase
    .from("feedback_issues").select("question_id", { count: "exact", head: true }).gte("created_at", since);
  if ((count ?? 0) >= ISSUE_RATE_MAX) return json({ error: "rate-limited" }, 429);

  const res = await fetch("https://api.github.com/repos/" + repo + "/issues", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + token,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "adt-trainer",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, body, labels: ["frage-feedback"] }),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error("GitHub", res.status, detail.slice(0, 500));
    // Label fehlt im Repo? Einmal ohne Label wiederholen, statt die Meldung zu verlieren.
    if (res.status === 422) {
      const retry = await fetch("https://api.github.com/repos/" + repo + "/issues", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "adt-trainer",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, body }),
      });
      if (retry.ok) {
        const issue = await retry.json();
        await supabase.from("feedback_issues").insert({
          question_id: questionId, issue_number: issue.number, issue_url: issue.html_url,
        });
        return json({ ok: true, number: issue.number, url: issue.html_url });
      }
    }
    return json({ error: "github", status: res.status }, 502);
  }

  const issue = await res.json();
  await supabase.from("feedback_issues").insert({
    question_id: questionId, issue_number: issue.number, issue_url: issue.html_url,
  });
  return json({ ok: true, number: issue.number, url: issue.html_url });
});
