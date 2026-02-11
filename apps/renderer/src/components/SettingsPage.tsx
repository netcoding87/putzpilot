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
}: SettingsPageProps) {
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
    </div>
  );
}
