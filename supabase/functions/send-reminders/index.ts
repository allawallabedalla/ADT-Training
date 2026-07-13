// Supabase Edge Function: send-reminders
// -----------------------------------------------------------------------------
// Versendet die täglichen Lern-Erinnerungen (Web Push) an alle fälligen Geräte.
// Wird stündlich per pg_cron aufgerufen (siehe README → „Lern-Erinnerungen").
//
// Benötigte Secrets (Dashboard → Edge Functions → Manage secrets):
//   VAPID_PUBLIC   – öffentlicher VAPID-Schlüssel (gleich wie in config.js)
//   VAPID_PRIVATE  – PRIVATER VAPID-Schlüssel (geheim!)
//   CRON_SECRET    – frei gewähltes Geheimnis; muss im pg_cron-Aufruf übereinstimmen
//   VAPID_SUBJECT  – optional, z. B. "mailto:du@example.com" (Default gesetzt)
//
// SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY werden automatisch bereitgestellt.
//
// Deploy: mit Supabase CLI  ->  supabase functions deploy send-reminders --no-verify-jwt
// (oder im Dashboard unter Edge Functions anlegen und diesen Code einfügen).

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:reminders@adt-trainer.app",
  Deno.env.get("VAPID_PUBLIC")!,
  Deno.env.get("VAPID_PRIVATE")!,
);

function localParts(tz: string, now: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: tz }).format(now));
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now); // YYYY-MM-DD
  return { hour: hour % 24, date };
}

Deno.serve(async (req) => {
  // Zugriffsschutz: nur mit korrektem Cron-Geheimnis
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    return new Response("forbidden", { status: 403 });
  }

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("enabled", true);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const now = new Date();
  const payload = JSON.stringify({
    title: "ADT Trainer",
    body: "Zeit für ein paar Übungsfragen! 📚",
    url: "./index.html",
    tag: "adt-reminder",
  });

  let sent = 0, removed = 0;
  for (const row of subs ?? []) {
    const { hour, date } = localParts(row.tz || "Europe/Berlin", now);
    if (hour !== row.hour) continue;          // noch nicht die eingestellte Stunde
    if (row.last_sent_date === date) continue; // heute bereits gesendet

    try {
      await webpush.sendNotification(row.sub, payload);
      await supabase.from("push_subscriptions").update({ last_sent_date: date }).eq("endpoint", row.endpoint);
      sent++;
    } catch (err: any) {
      const code = err?.statusCode;
      if (code === 404 || code === 410) {
        // Abmeldung/abgelaufen → aufräumen
        await supabase.from("push_subscriptions").delete().eq("endpoint", row.endpoint);
        removed++;
      } else {
        console.error("push error", code, err?.body || err?.message);
      }
    }
  }

  return new Response(JSON.stringify({ sent, removed }), {
    headers: { "Content-Type": "application/json" },
  });
});
