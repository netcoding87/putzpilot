# Agents.MD

## Zweck
Dieses Dokument ist ein lebendes Arbeits‑ und Kontextdokument für KI‑gestützte Mitarbeit am Projekt **PutzPilot**. Es darf und soll kontinuierlich erweitert werden, sobald neue Entscheidungen, Regeln oder Konventionen hinzukommen.

## Projektüberblick
- Produkt: Desktop‑fähige Web‑App (React + Electron) für wöchentliche Putzpläne.
- Datenquelle: ChurchTools v3.128.3 (Online‑Pflicht, keine Offline‑Fähigkeit).
- Kernfunktionen:
  - Sync von Gemeindemitgliedern aus ChurchTools.
  - Putzplan‑Generierung mit Regeln: **Haushalte**, **Fairness**, **Teams**.
  - White‑Listing/Exclusions: Personen dauerhaft ausschließen können.
  - Persistenz der App‑Einstellungen inkl. sicherer Speicherung von Zugangsdaten.

## Architektur (geplant)
- Renderer (UI): React + TypeScript.
- Main (Electron): Prozess‑Logik, lokale Persistenz, ChurchTools‑Client.
- Pakete/Module:
  - `core`: Putzplan‑Regeln und Scheduling‑Engine.
  - `churchtools`: API‑Client inkl. Auth.
  - `storage`: lokale Datenhaltung (z. B. SQLite) + Migrationen.

## Sicherheitsanforderungen
- ChurchTools‑Login via Benutzername/Passwort.
- Passwort darf **niemals** im Klartext gespeichert werden.
- Speicherung über OS‑Keychain/Keytar oder gleichwertigen Secret‑Store.

## Entscheidungen (fixiert)
- ChurchTools‑Version: v3.128.3.
- Online‑Pflicht: Keine Offline‑Fähigkeit.
- Authentifizierung: Benutzername/Passwort im UI, sichere Speicherung via OS‑Keychain.
- Plan‑Regeln: Haushalte, Fairness, Teams.

## Datenmodell (vorläufig)
- `members`: Personen aus ChurchTools
- `households`: Haushalts‑Zuordnung
- `teams`: Team‑Zugehörigkeiten
- `exclusions`: White‑Listing / Ausschlüsse
- `plans`: Wochenpläne
- `assignments`: konkrete Zuordnungen
- `sync_meta`: Sync‑Status/Letzter Stand

## KI‑Arbeitsregeln
- Bevor Änderungen gemacht werden: aktuellen Stand prüfen, vorhandene Konventionen respektieren.
- Keine Breaking Changes ohne Begründung und Migrationspfad.
- Dokumentiere neue Entscheidungen hier in Agents.MD.
- Sicherheit und Datenschutz haben Priorität.

## Offene Punkte / Entscheidungen
- Wahl der Persistenz (SQLite + ORM oder eigenes SQL‑Layer).
- Auth‑Flow für ChurchTools (Token‑Handling, Refresh, Fehlerstrategie).
- Konkreter Algorithmus für Fairness & Team‑Rotation.

## Änderungslog
- 2026‑02‑08: Initiale Agents.MD erstellt.
- 2026‑02‑09: Projekt‑Scaffold (Monorepo, Electron + React) initialisiert.
