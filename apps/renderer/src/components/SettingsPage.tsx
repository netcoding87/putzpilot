import { useState } from 'react';

type SettingsDraft = {
  baseUrl: string;
  username: string;
  password: string;
};

type SettingsPageProps = {
  settingsDraft: SettingsDraft;
  settingsDirty: boolean;
  settingsLoading: boolean;
  settingsTestResult: { ok: boolean; msg: string } | null;
  onChange: (field: 'baseUrl' | 'username' | 'password', value: string) => void;
  onTest: () => void;
  onSave: () => void;
  onBack: () => void;
  aliases: Array<{ canonical: string; aliases: string[] }>;
  onAliasesChange: (aliases: Array<{ canonical: string; aliases: string[] }>) => void;
};

export default function SettingsPage({
  settingsDraft,
  settingsDirty,
  settingsLoading,
  settingsTestResult,
  onChange,
  onTest,
  onSave,
  onBack,
  aliases,
  onAliasesChange,
}: SettingsPageProps) {
  const [newCanonical, setNewCanonical] = useState('');
  const [newAliases, setNewAliases] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editCanonical, setEditCanonical] = useState('');
  const [editAliases, setEditAliases] = useState('');
  const [sortMode, setSortMode] = useState<'first' | 'last'>('first');

  const getSortKey = (value: string) => {
    const parts = value.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return '';
    return sortMode === 'last' ? parts[parts.length - 1] : parts[0];
  };

  const sortedAliases = aliases
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) =>
      getSortKey(a.entry.canonical).localeCompare(getSortKey(b.entry.canonical), 'de', {
        sensitivity: 'base',
      }),
    );

  const handleAddAlias = () => {
    if (!newCanonical.trim()) return;
    
    const aliasArray = newAliases
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
    
    if (aliasArray.length === 0) return;

    const updated = [
      ...aliases,
      { canonical: newCanonical.trim(), aliases: aliasArray },
    ];
    
    onAliasesChange(updated);
    setNewCanonical('');
    setNewAliases('');
  };

  const handleDeleteAlias = (index: number) => {
    const updated = aliases.filter((_, i) => i !== index);
    onAliasesChange(updated);
  };

  const handleEditStart = (index: number) => {
    const entry = aliases[index];
    if (!entry) return;
    setEditingIndex(index);
    setEditCanonical(entry.canonical);
    setEditAliases(entry.aliases.join(', '));
  };

  const handleEditCancel = () => {
    setEditingIndex(null);
    setEditCanonical('');
    setEditAliases('');
  };

  const handleEditSave = () => {
    if (editingIndex === null) return;
    const canonicalValue = editCanonical.trim();
    const aliasArray = editAliases
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
    if (!canonicalValue || aliasArray.length === 0) return;

    const updated = aliases.map((entry, index) =>
      index === editingIndex ? { canonical: canonicalValue, aliases: aliasArray } : entry,
    );
    onAliasesChange(updated);
    handleEditCancel();
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1>PutzPilot</h1>
        <p>ChurchTools‑Verbindungs‑Einstellungen</p>
      </header>

      <section className="card">
        <button type="button" onClick={onBack} className="btn-back">
          ← Zurück
        </button>
        <h2>ChurchTools‑Einstellungen</h2>
        <form className="form">
          <label>
            Base‑URL
            <input
              type="url"
              value={settingsDraft.baseUrl}
              onChange={(e) => onChange('baseUrl', e.target.value)}
              placeholder="https://deine-gemeinde.church.tools"
            />
          </label>
          <label>
            Benutzername
            <input
              type="text"
              value={settingsDraft.username}
              onChange={(e) => onChange('username', e.target.value)}
              placeholder="dein.benutzername"
            />
          </label>
          <label>
            Passwort
            <input
              type="password"
              value={settingsDraft.password}
              onChange={(e) => onChange('password', e.target.value)}
              placeholder="••••••••"
            />
          </label>

          {settingsTestResult && (
            <div className={`test-result ${settingsTestResult.ok ? 'ok' : 'error'}`}>
              {settingsTestResult.msg}
            </div>
          )}

          <div className="form__buttons">
            <button
              type="button"
              onClick={onTest}
              disabled={
                settingsLoading ||
                !settingsDraft.baseUrl ||
                !settingsDraft.username ||
                !settingsDraft.password
              }
            >
              {settingsLoading ? 'Wird getestet...' : 'Verbindung testen'}
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!settingsDirty}
              className="btn-primary"
            >
              Speichern
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <h2>Namen-Aliase</h2>
        <p className="help-text">
          Verknüpfe alternative Schreibweisen aus der Historie mit aktuellen Personennamen.
        </p>

        <div className="alias-sort">
          <span>Sortierung:</span>
          <button
            type="button"
            className={`btn-toggle ${sortMode === 'first' ? 'active' : ''}`}
            onClick={() => setSortMode('first')}
          >
            Vorname
          </button>
          <button
            type="button"
            className={`btn-toggle ${sortMode === 'last' ? 'active' : ''}`}
            onClick={() => setSortMode('last')}
          >
            Nachname
          </button>
        </div>
        
        <div className="alias-list">
          {aliases.length === 0 ? (
            <p className="empty-message">Keine Aliase definiert</p>
          ) : (
            sortedAliases.map(({ entry, index }) => (
              <div key={`${entry.canonical}-${index}`} className="alias-entry">
                {editingIndex === index ? (
                  <div className="alias-edit">
                    <label>
                      Kanonischer Name
                      <input
                        type="text"
                        value={editCanonical}
                        onChange={(e) => setEditCanonical(e.target.value)}
                      />
                    </label>
                    <label>
                      Aliase (komma-getrennt)
                      <input
                        type="text"
                        value={editAliases}
                        onChange={(e) => setEditAliases(e.target.value)}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="alias-info">
                    <strong>{entry.canonical}</strong>
                    <span className="alias-items">→ {entry.aliases.join(', ')}</span>
                  </div>
                )}
                <div className="alias-actions">
                  {editingIndex === index ? (
                    <>
                      <button
                        type="button"
                        onClick={handleEditSave}
                        className="btn-edit"
                        disabled={!editCanonical.trim() || !editAliases.trim()}
                        title="Speichern"
                      >
                        💾
                      </button>
                      <button
                        type="button"
                        onClick={handleEditCancel}
                        className="btn-edit"
                        title="Abbrechen"
                      >
                        ✖
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleEditStart(index)}
                      className="btn-edit"
                      title="Bearbeiten"
                    >
                      ✏️
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteAlias(index)}
                    className="btn-delete"
                    title="Löschen"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="alias-form">
          <label>
            Kanonischer Name (aus ChurchTools)
            <input
              type="text"
              value={newCanonical}
              onChange={(e) => setNewCanonical(e.target.value)}
              placeholder="z.B. Kevin-Angelo Galvez"
            />
          </label>
          <label>
            Aliase (komma-getrennt)
            <input
              type="text"
              value={newAliases}
              onChange={(e) => setNewAliases(e.target.value)}
              placeholder="z.B. Kevin Galvez, K. Galvez"
            />
          </label>
          <button
            type="button"
            onClick={handleAddAlias}
            disabled={!newCanonical.trim() || !newAliases.trim()}
          >
            Alias hinzufügen
          </button>
        </div>
      </section>
    </div>
  );
}
