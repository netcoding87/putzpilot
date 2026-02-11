type MainHeaderProps = {
  onOpenSettings: () => void;
};

export default function MainHeader({ onOpenSettings }: MainHeaderProps) {
  return (
    <header className="app__header">
      <div className="header-title">
        <h1>PutzPilot</h1>
        <p>Wochenplanung für den Putzdienst.</p>
      </div>
      <button
        type="button"
        onClick={onOpenSettings}
        className="btn-settings"
        title="Einstellungen"
      >
        ⚙️
      </button>
    </header>
  );
}
