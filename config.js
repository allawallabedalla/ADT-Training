/*
 * Cloud-Sync-Konfiguration
 * ------------------------------------------------------------------
 * Damit der Lernfortschritt geräteübergreifend synchronisiert, hier die
 * zwei Werte deines kostenlosen Supabase-Projekts eintragen. Anleitung:
 * siehe README.md → Abschnitt „Geräteübergreifende Synchronisation".
 *
 * Beide Werte sind für den Client bestimmt und dürfen öffentlich sein
 * (der „anon public key" ist genau dafür gedacht; die Daten schützt der
 * geheime Sync-Code + die serverseitigen Funktionen).
 *
 * Solange die Felder leer sind, funktioniert die App ganz normal – nur
 * eben lokal ohne Cloud-Sync.
 */
window.ADT_CONFIG = {
  supabaseUrl: "https://ayozhjbfhreqauyimsjy.supabase.co",
  // öffentlicher Schlüssel (neues Supabase-Format "sb_publishable_…" = Ersatz für den anon-Key)
  supabaseAnonKey: "sb_publishable_ey4LlOV5CftCc_YnGJpfjg__aXt__jB",
  // Öffentlicher VAPID-Schlüssel für Web-Push-Erinnerungen (darf öffentlich sein).
  // Der PRIVATE Schlüssel gehört NUR in die Supabase Edge Function (Secret) – nie hierher!
  // Server-Teil steht (Tabelle + Edge Function + stündlicher Zeitplan) → aktiv.
  // Leer lassen = Erinnerungen deaktiviert. Einrichtung: README → „Lern-Erinnerungen".
  vapidPublicKey: "BPKKeZOQjP2lCBpX-zDcUO1E5pvpTw9DkrIJn-apU2LYXYmRBqePd0wRdv-S-F50uHWZaFYgSE1WcvshMERzj20",

  // Zugangsschutz für die Lerninhalte.
  //  false = öffentliche Beispiel-Fragen (aktueller Stand, kein Code nötig).
  //  true  = Inhalte sind geschützt: die App verlangt einen Zugangscode und lädt die
  //          Fragen serverseitig geprüft aus Supabase (get_content). Erst umstellen,
  //          wenn das echte Material in Supabase liegt (siehe supabase/content-gate.sql).
  contentGated: false,
};
