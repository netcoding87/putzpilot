type MainHeaderProps = {
  onOpenSettings: () => void;
  theme: 'dark' | 'light';
  onThemeChange: (theme: 'dark' | 'light') => void;
};

export default function MainHeader({ onOpenSettings, theme, onThemeChange }: MainHeaderProps) {
  return (
    <header className="app__header">
      <div className="header-main">
        <div className="header-top">
          <img src="/icon.svg" alt="PutzPilot" className="header-icon" />
          <h1>Putz Pilot</h1>
        </div>
        <p className="header-subtitle">Wochenplanung für den Putzdienst.</p>
      </div>
      <div className="header-actions">
        <button
          type="button"
          onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
          className="btn-theme"
          title={theme === 'dark' ? 'Zum Light Mode' : 'Zum Dark Mode'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="btn-settings"
          title="Einstellungen"
        >
          ⚙️
        </button>
      </div>
    </header>
  );
}
