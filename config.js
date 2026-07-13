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
  supabaseUrl: "",      // z. B. "https://abcdefgh.supabase.co"
  supabaseAnonKey: "",  // der lange "anon public"-Schlüssel aus den Projekt-Einstellungen
};
