import type { Person, StatusGroup } from '../types/people';

type PersonsSectionProps = {
  persons: Person[];
  statuses: { id?: number | string; name?: string }[];
  selectedIds: Set<string>;
  loading: boolean;
  error: string | null;
  groupButtons: string[];
  currentActiveGroup: string;
  groupCounts: Record<string, number>;
  visiblePersons: Person[];
  activeGroups: StatusGroup[];
  query: string;
  onQueryChange: (value: string) => void;
  onLoadPersons: () => void;
  onReloadPersons: () => void;
  onToggleSelection: (person: Person, index: number) => void;
  getPersonKey: (person: Person, fallback: number) => string;
  getStatus: (person: Person) => string;
  getAgeValue: (person: Person) => number | null;
  onSetActiveGroup: (value: string) => void;
  onEditGroups: () => void;
};

export default function PersonsSection({
  persons,
  statuses,
  selectedIds,
  loading,
  error,
  groupButtons,
  currentActiveGroup,
  groupCounts,
  visiblePersons,
  activeGroups,
  query,
  onQueryChange,
  onLoadPersons,
  onReloadPersons,
  onToggleSelection,
  getPersonKey,
  getStatus,
  getAgeValue,
  onSetActiveGroup,
  onEditGroups,
}: PersonsSectionProps) {
  const statusClassFor = (status: string) => {
    const normalized = status.trim().toLowerCase();
    switch (normalized) {
      case 'ausgetreten':
        return 'status-badge--red';
      case 'kindbis16':
        return 'status-badge--yellow';
      case 'status.friend':
        return 'status-badge--blue';
      case 'status.member':
        return 'status-badge--green';
      case 'unbekannt':
        return 'status-badge--gray';
      default:
        return 'status-badge--gray';
    }
  };

  const getStatusTranslated = (statusName: string) => {
    const status = statuses.find(
      (s) => s.name?.toLowerCase() === statusName.toLowerCase()
    );
    return status?.nameTranslated || statusName;
  };

  return (
    <section className="card">
      {persons.length === 0 ? (
        <div className="empty-state">
          <h2>Willkommen bei PutzPilot</h2>
          <p>Lade Personen aus ChurchTools, um mit der Planerstellung zu beginnen.</p>
          <button 
            type="button" 
            onClick={onLoadPersons} 
            disabled={loading}
            className="btn-primary btn-large"
          >
            {loading ? 'Lade…' : 'Personen laden'}
          </button>
          {error && <p className="error" style={{ marginTop: '16px' }}>{error}</p>}
        </div>
      ) : (
        <>
          <div className="persons-header">
            <h2>Personen ({persons.length})</h2>
            <div className="persons-header-actions">
              <button
                type="button"
                onClick={onEditGroups}
                disabled={selectedIds.size === 0}
                className="btn-secondary"
              >
                Gruppen bearbeiten
              </button>
              <button 
                type="button" 
                onClick={persons.length === 0 ? onLoadPersons : onReloadPersons} 
                disabled={loading}
                className="btn-primary"
              >
                {loading ? 'Lade…' : persons.length === 0 ? 'Personen laden' : 'Neu laden'}
              </button>
            </div>
          </div>

          {error && <p className="error">{error}</p>}

          <div className="filters">
            {groupButtons.map((label) => (
              <button
                key={label}
                type="button"
                className={currentActiveGroup === label ? 'active' : ''}
                onClick={() => onSetActiveGroup(label)}
              >
                {label}
                {label === 'Alle' ? ` (${visiblePersons.length})` : ` (${groupCounts[label] ?? 0})`}
              </button>
            ))}
          </div>
          <label className="search">
            Suche
            <input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Name, E‑Mail oder Status"
            />
          </label>
          {currentActiveGroup === 'Alle' ? (
            <ul className="list">
              {visiblePersons.map((person, index) => {
                const key = getPersonKey(person, index);
                const checkboxId = `person-${key}`;
                return (
                  <li key={key}>
                    <div className="person-row">
                      <input
                        id={checkboxId}
                        type="checkbox"
                        checked={selectedIds.has(key)}
                        onChange={() => onToggleSelection(person, index)}
                      />
                      <div className="person-info">
                        <div className="person-main">
                          <label className="person-name" htmlFor={checkboxId}>
                            <strong>
                              {person.firstName} {person.lastName}
                            </strong>
                          </label>
                          <span
                            className={`status-badge ${statusClassFor(getStatus(person))}`}
                          >
                            {getStatusTranslated(getStatus(person))}
                          </span>
                        </div>
                        <span className="person-age">
                          Alter: {getAgeValue(person) ?? 'Unbekannt'}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="group-list">
              {activeGroups.map((group) => (
                <div key={group.statusKey} className="group">
                  <div className="group__header">
                    <h3>{group.labelTranslated}</h3>
                    <span>{group.persons.length} Personen</span>
                  </div>
                  <ul className="list">
                    {group.persons.map((person, index) => {
                      const key = getPersonKey(person, index);
                      const checkboxId = `person-${group.statusKey}-${key}`;
                      return (
                        <li key={key}>
                          <div className="person-row">
                            <input
                              id={checkboxId}
                              type="checkbox"
                              checked={selectedIds.has(key)}
                              onChange={() => onToggleSelection(person, index)}
                            />
                              <div className="person-info">
                                <div className="person-main">
                                  <label className="person-name" htmlFor={checkboxId}>
                                    <strong>
                                      {person.firstName} {person.lastName}
                                    </strong>
                                  </label>
                                  <span
                                    className={`status-badge ${statusClassFor(getStatus(person))}`}
                                  >
                                    {getStatusTranslated(getStatus(person))}
                                  </span>
                                </div>
                                <span className="person-age">
                                  Alter: {getAgeValue(person) ?? 'Unbekannt'}
                                </span>
                              </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
