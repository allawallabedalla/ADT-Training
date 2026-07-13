/*
 * Cloud-Sync für den ADT Trainer
 * ------------------------------------------------------------------
 * Offline-first: Die lokale Speicherung (localStorage) bleibt maßgeblich.
 * Diese Schicht gleicht den Fortschritt zusätzlich mit einem Supabase-
 * Backend ab – identifiziert über einen geheimen „Sync-Code".
 *
 * Merge-Strategie (robust, verlustarm für eine Person auf mehreren
 * Geräten): Werte wachsen monoton → wir nehmen jeweils das Maximum bzw.
 * die Vereinigung. Gesamtzähler werden nach dem Merge aus den
 * Einzelfragen neu berechnet, damit alles konsistent bleibt.
 *
 * Alle Netzwerkfehler werden abgefangen – die App funktioniert immer
 * weiter, auch ohne Cloud/Netz.
 */
(function () {
  "use strict";

  const CODE_KEY = "adt_sync_code";
  const LAST_KEY = "adt_sync_last";
  const PENDING_KEY = "adt_sync_pending";   // ausstehender Abgleich (offline/Fehler)

  const cfg = () => (window.ADT_CONFIG || {});
  function isConfigured() {
    const c = cfg();
    return !!(c.supabaseUrl && c.supabaseAnonKey && /^https:\/\/.+\.supabase\.co/.test(c.supabaseUrl));
  }

  function getCode() { try { return localStorage.getItem(CODE_KEY) || null; } catch { return null; } }
  function setCode(code) { try { code ? localStorage.setItem(CODE_KEY, code) : localStorage.removeItem(CODE_KEY); } catch {} }
  function getLastSynced() { try { return localStorage.getItem(LAST_KEY); } catch { return null; } }
  function setLastSynced(iso) { try { localStorage.setItem(LAST_KEY, iso); } catch {} }
  function hasPending() { try { return localStorage.getItem(PENDING_KEY) === "1"; } catch { return false; } }
  function setPending(on) { try { on ? localStorage.setItem(PENDING_KEY, "1") : localStorage.removeItem(PENDING_KEY); } catch {} }

  // Menschlich lesbaren, kryptografisch zufälligen Code erzeugen: ADT-XXXXX-XXXXX-XXXXX
  function generateCode() {
    const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // ohne I,L,O,0,1 (Verwechslungsgefahr)
    const bytes = new Uint8Array(15);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    let out = "";
    for (let i = 0; i < 15; i++) {
      if (i > 0 && i % 5 === 0) out += "-";
      out += alphabet[bytes[i] % alphabet.length];
    }
    return "ADT-" + out;
  }

  function normalizeCode(raw) {
    if (!raw) return "";
    let s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (s.startsWith("ADT")) s = s.slice(3);
    // in Gruppen zu 5 formatieren
    const groups = s.match(/.{1,5}/g) || [];
    return "ADT-" + groups.join("-");
  }

  // ---- Merge zweier Zustände (monoton, verlustarm) ----
  function mergeStates(a, b) {
    a = a || {}; b = b || {};
    const out = {};
    const maxNum = (x, y) => Math.max(Number(x) || 0, Number(y) || 0);
    // Schema-Version mitführen: sonst hielte der gemergte Stand keine Version und
    // eine erneute Migration würde die Spaced-Repetition-Planung überschreiben.
    out.schemaVersion = maxNum(a.schemaVersion || 1, b.schemaVersion || 1);
    out.xp = maxNum(a.xp, b.xp);
    out.streak = maxNum(a.streak, b.streak);
    out.examsPassed = maxNum(a.examsPassed, b.examsPassed);
    out.bestExamPct = maxNum(a.bestExamPct, b.bestExamPct);

    // späteres lastActiveDay behalten
    const days = [a.lastActiveDay, b.lastActiveDay].filter(Boolean).sort();
    out.lastActiveDay = days.length ? days[days.length - 1] : null;

    // perQuestion: pro Frage das Maximum je Feld
    const pq = {};
    const ids = new Set([...Object.keys(a.perQuestion || {}), ...Object.keys(b.perQuestion || {})]);
    for (const id of ids) {
      const pa = (a.perQuestion || {})[id] || {};
      const pb = (b.perQuestion || {})[id] || {};
      const seen = maxNum(pa.seen, pb.seen);
      const correct = maxNum(pa.correct, pb.correct);
      const wrong = maxNum(pa.wrong, pb.wrong);
      // lastResult vom „aktiveren" Datensatz (mehr seen); bei Gleichstand „correct" bevorzugen
      let lastResult = null;
      if ((pa.seen || 0) > (pb.seen || 0)) lastResult = pa.lastResult || null;
      else if ((pb.seen || 0) > (pa.seen || 0)) lastResult = pb.lastResult || null;
      else lastResult = (pa.lastResult === "correct" || pb.lastResult === "correct") ? "correct" : (pa.lastResult || pb.lastResult || null);
      // Spaced Repetition: die weiter fortgeschrittene Box gewinnt (monotoner Lernfortschritt);
      // bei gleicher Box das spätere Fälligkeitsdatum (zuletzt wiederholt → nicht erneut nerven).
      const boxA = Number(pa.box) || 0, boxB = Number(pb.box) || 0;
      let box, due;
      if (boxA > boxB) { box = boxA; due = pa.due || null; }
      else if (boxB > boxA) { box = boxB; due = pb.due || null; }
      else { box = boxA; const da = pa.due || "", db = pb.due || ""; due = (da >= db ? da : db) || null; }
      pq[id] = { seen, correct, wrong, lastResult, box, due };
    }
    out.perQuestion = pq;

    // Gesamtzähler konsistent aus perQuestion ableiten
    let ta = 0, tc = 0;
    for (const id in pq) { ta += pq[id].seen; tc += pq[id].correct; }
    out.totalAnswered = ta;
    out.totalCorrect = tc;

    // badges: Vereinigung, frühestes Datum behalten
    const badges = {};
    for (const src of [a.badges || {}, b.badges || {}]) {
      for (const k in src) {
        if (!badges[k] || String(src[k]) < String(badges[k])) badges[k] = src[k];
      }
    }
    out.badges = badges;
    return out;
  }

  // ---- Supabase-RPC-Aufrufe ----
  async function rpcOnce(fn, body) {
    const c = cfg();
    const key = c.supabaseAnonKey;
    const headers = { "Content-Type": "application/json", "apikey": key };
    // Neue Supabase-Schlüssel (sb_publishable_… / sb_secret_…) sind KEINE JWTs und
    // dürfen NICHT im Authorization-Header stehen (sonst 401). Nur klassische
    // JWT-Keys (beginnen mit "eyJ") gehören dorthin – für Abwärtskompatibilität.
    if (/^eyJ/.test(key)) headers["Authorization"] = "Bearer " + key;
    const res = await fetch(c.supabaseUrl.replace(/\/+$/, "") + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("RPC " + fn + " HTTP " + res.status);
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  }

  // Mit Wiederholung + Backoff: transiente Fehler (Netz/5xx/429) werden erneut versucht,
  // dauerhafte 4xx-Fehler (z. B. 401/404) nicht – die würden ohnehin wieder scheitern.
  async function rpc(fn, body) {
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt - 1))); // 400ms, 800ms
      try { return await rpcOnce(fn, body); }
      catch (e) {
        lastErr = e;
        const m = /HTTP (\d+)/.exec((e && e.message) || "");
        const code = m ? +m[1] : 0;
        if (code >= 400 && code < 500 && code !== 429) break; // nicht transient
      }
    }
    throw lastErr;
  }

  async function pull(code) { return rpc("sync_pull", { p_code: code }); }
  async function push(code, data) { return rpc("sync_push", { p_code: code, p_data: data }); }

  // Cloud-Datensatz direkt überschreiben (ohne Merge) – für „überall zurücksetzen".
  async function overwriteRemote(data) {
    const code = getCode();
    if (!isConfigured() || !code) return { ok: false, reason: "not-configured" };
    if (!navigator.onLine) { setPending(true); notify("offline"); return { ok: false, reason: "offline" }; }
    try {
      await push(code, data);
      setLastSynced(new Date().toISOString()); setPending(false);
      notify("ok"); return { ok: true };
    } catch (e) {
      setPending(true); notify("error", { message: e && e.message });
      return { ok: false, error: e };
    }
  }

  let syncing = false;
  let onChange = null; // Callback: (status) => void

  function notify(status, extra) { if (typeof onChange === "function") onChange(Object.assign({ status: status }, extra || {})); }

  /*
   * Vollständiger Abgleich:
   *   getLocal()  -> liefert aktuellen lokalen Zustand
   *   setLocal(s) -> schreibt gemergten Zustand lokal (ohne erneuten Sync-Trigger)
   */
  async function syncNow(getLocal, setLocal, opts) {
    opts = opts || {};
    const code = getCode();
    if (!isConfigured()) { notify("disabled"); return { ok: false, reason: "not-configured" }; }
    if (!code) { notify("no-code"); return { ok: false, reason: "no-code" }; }
    if (!navigator.onLine) { setPending(true); notify("offline"); return { ok: false, reason: "offline" }; }
    if (syncing) return { ok: false, reason: "busy" };
    syncing = true; notify("syncing");
    try {
      const local = getLocal();
      let remote = null;
      try { remote = await pull(code); } catch (e) { if (!opts.pushOnly) throw e; }
      const merged = remote ? mergeStates(local, remote) : local;
      if (remote) setLocal(merged);
      await push(code, merged);
      const now = new Date().toISOString();
      setLastSynced(now); setPending(false);
      notify("ok", { at: now });
      return { ok: true, merged: !!remote };
    } catch (e) {
      console.warn("Sync fehlgeschlagen:", e && e.message);
      setPending(true);
      notify("error", { message: e && e.message });
      return { ok: false, reason: "error", error: e };
    } finally {
      syncing = false;
    }
  }

  // ---- Web-Push: Anmeldung speichern/löschen ----
  async function savePush(sub, hour, tz) {
    if (!isConfigured()) return false;
    try { await rpc("push_save", { p_endpoint: sub.endpoint, p_sub: sub, p_hour: hour, p_tz: tz }); return true; }
    catch (e) { console.warn("push_save fehlgeschlagen", e && e.message); return false; }
  }
  async function removePush(endpoint) {
    if (!isConfigured()) return false;
    try { await rpc("push_remove", { p_endpoint: endpoint }); return true; }
    catch (e) { console.warn("push_remove fehlgeschlagen", e && e.message); return false; }
  }

  window.ADTSync = {
    isConfigured, getCode, setCode, getLastSynced,
    generateCode, normalizeCode, mergeStates,
    syncNow, overwriteRemote,
    savePush, removePush,
    hasPending,
    isSyncing: () => syncing,
    onChange: (fn) => { onChange = fn; },
  };
})();
