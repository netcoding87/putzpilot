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
- Testing-Stack (Renderer): Vitest + React Testing Library + user-event + MSW (Mock Service Worker).

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
- 2026‑02‑11: Renderer-Test-Stack mit Vitest, RTL, user-event und MSW eingeführt.
- 2026‑02‑11: Gruppen-Editor mit Drag-&-Drop implementiert (@dnd-kit), inklusive:
  - Manuelle Bearbeitung von Haushalts-Gruppen
  - Drag-&-Drop zum Verschieben von Personen zwischen Gruppen
  - Zusammenführen mehrerer Gruppen (Join)
  - Auflösen zusammengeführter Gruppen (Unjoin)
  - Validierung (max. 10 Personen pro Gruppe)
  - Persistente Speicherung in electron-store
  - Auto-Cleanup bei Personen-Aktualisierung
- 2026‑02‑11: Gruppen-Editor überarbeitet mit vereinfachtem Design:
  - Gruppen ohne Namen, nur Mitgliederzahl (z.B. "3/10")
  - Drag-&-Drop für ganze Gruppen (Gruppe auf Gruppe ziehen zum Zusammenführen)
  - Neue Gruppe erstellen durch Ziehen einer Person auf "Neue Gruppe"-Karte
  - Gruppen nicht selektierbar/checkbar
  - Automatisches Haushalts-Grouping als initialer Zustand
  - Zusammenführung von gespeicherten und neuen Gruppen bei Daten-Reload- 2026‑02‑12: Workflow für Personenladen und Gruppierung implementiert
- 2026‑02‑13: Fairness-Planung berücksichtigt Seed-Historie (ODS), gemappt über Namen auf Personen-IDs.
- 2026‑02‑13: Fairness-Planung dynamisiert:
   - Keine feste Tage-Schwelle; Auswahl basiert auf ältesten letzten Zuweisungen
   - Historie wird nach jeder geplanten Woche aktualisiert
   - Gruppen werden als atomar behandelt (keine Aufteilung in der Planung)
   - Suchfunktion zu History-Seite hinzugefügt (komplementär zu Chronik-Suche)
- 2026‑02‑13: Alias-Mapping fuer manuelle Namensvarianten eingefuehrt (nameAliases.json).
- 2026‑02‑14: Alias-Management in UI integriert (Settings-Seite):
  - Aliase werden in electron-store persistiert
  - JSON-Seed beim ersten Start
  - Hinzufügen/Löschen von Aliasen ohne App-Neustart
  - Automatische Anwendung auf Seed-Historie-Mapping
- 2026‑02‑18: Sondertermine in der Planung:
   - Gruendonnerstag (Donnerstag vor Karfreitag)
   - 23.12. (falls kein Samstag)
   - Nur innerhalb des gewaehlten Start/Ende-Zeitraums

## Core Workflow: Personenladen & Gruppierung

### Überblick
Der folgende Workflow wird bei "Personen laden" (`handleLoadPersons`) und "Personen neu laden" (`handleReloadPersons`) durchlaufen:

### Schritte

1. **Login zu ChurchTools**
   - Authentifizierung mit gespeicherten Credentials (baseUrl, username, password)

2. **Personen und Status vom ChurchTools laden**
   - API-Call: `fetchPersons(baseUrl)`
   - Liefert: Array aller Personen + Array aller Status-Definitionen

3. **Filter: Mitgliederstatus**
   - Nur Personen mit `status.member` (oder matching status name) werden als defaults berücksichtigt
   - Personen mit anderen Status bleiben sichtbar, sind aber nicht vorselektiert

4. **Filter: Alter < 60 Jahre**
   - Personen älter als 60 werden ausgeschlossen (Berechnung: `getAge(dateOfBirth)`)
   - Dies gilt für Default-Auswahl UND für jeden Reload

5. **Sync mit gespeicherter Auswahl (Master)**
   - Falls Auswahl in Storage vorhanden: Diese als Master nutzen
   - Filter: Entfernen aller Personen aus Storage-Auswahl, die:
     - Nicht mehr in ChurchTools existieren
     - Älter als 60 sind
   - Neu hinzugefügte Personen: Nur wenn sie Criteria erfüllen
   - **Prinzip**: Gespeicherte Auswahl (manuel edits) werden bevorzugt, gekürzt aber nie kompletes Reset
   
6. **Falls keine Auswahl in Storage**
   - Default-Auswahl erstellen aus allen Personen mit:
     - Status = `status.member` UND
     - Alter < 60
   - In Storage speichern

7. **Gruppen-Automatismus basierend auf Haushalte**
   - `convertPersonsToGroups()`: Group selectedPersons nach `householdId` oder `familyStatusId`
   - Jeder Haushalt = eine Gruppe (max 10 Personen/Gruppe)

8. **Sync mit gespeicherten manuellen Gruppen**
   - `mergeStoredWithHouseholdGroups()`:
     - Gespeicherte manuelle Gruppen: Behalten ihre Person-Zuordnung
     - Neue Personen: In neue Gruppen (nach Haushalt) organisieren
     - Gelöschte Personen: Aus allen Gruppen entfernen
   - **Prinzip**: Manuelle Editierungen bleiben persistent über Reloads hinweg

9. **Anzeige: Gruppierungs-Seite**
   - GroupEditor-Komponente anzeigen mit den merged groups
   - Personen in dieser Ansicht sortiert-anzeigbar (search functionality)

### Search auf Gruppierungs-Seite

- User können nach Personen suchen (Name, E-Mail, etc.)
- Such-Ergebnisse sind **draggable** in andere Gruppen
- Nicht-getroffene Personen bleiben sichtbar für Drag-Drop-Operationen

### Speicherung von Änderungen

- **Auto-Save**: Jede Drag-Operation (move person, merge groups, create group) speichert **sofort**
- Keine separates "Speichern" nötig
- Speicherung via `window.putzpilot.groups.set(groupsDraft)`

### Reload-Button ("Personen neu laden")

- Repräsentiert einen Durchlauf von Schritt 1-9 (s.o.)
- Erhält manuelle Gruppen-Editierungen bei neuen/veränderten ChurchTools-Daten
- Reduziert Auswahl auf Current/Valid Persons (s. Schritt 5)

### Planerstellung

- Basiert auf `selectedPersons` UND gespeicherten `manualGroups`
- `buildPlan()` nutzt manuelle Gruppen statt Haushalt-Automatismen
- Falls keine manuellen Gruppen: Fallback auf Haushalt-Grouping

### Datenfluss (Diagramm)

```
┌─ Personen laden / Personen neu laden
├─ Login ChurchTools
├─ Personen + Status laden
├─ Filter: status.member
├─ Filter: age < 60
├─ Sync mit Storage-Auswahl (Master)
├─ Auswahl speichern
├─ Haushalt-Grouping generieren
├─ Sync mit Storage-Gruppen (Master)
├─ Gruppierungs-Seite anzeigen
│
└─ User-Interaktionen
   ├─ Drag person ↔ group  → Auto-save
   ├─ Drag group ↔ group  → Auto-save
   ├─ Search + Drag        → Auto-save
   ├─ Personen neu laden   → Repeat workflow (erhält Editierungen)
   │
   └─ Planen generieren
      └─ Basiert auf manualGroups
```