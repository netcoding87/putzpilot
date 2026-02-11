import type { Person, StatusGroup } from '../types/people';

type PersonsSectionProps = {
  persons: Person[];
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
  onToggleSelection: (person: Person, index: number) => void;
  getPersonKey: (person: Person, fallback: number) => string;
  getStatus: (person: Person) => string;
  getAgeValue: (person: Person) => number | null;
  onSetActiveGroup: (value: string) => void;
};

export default function PersonsSection({
  persons,
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
  onToggleSelection,
  getPersonKey,
  getStatus,
  getAgeValue,
  onSetActiveGroup,
}: PersonsSectionProps) {
  const statusClassFor = (status: string) => {
    const normalized = status.trim().toLowerCase();
    switch (normalized) {
      case 'ausgetreten':
        return 'status-badge--red';
      case 'kindbis16':
        return 'status-badge--yellow';
      case 'friend':
        return 'status-badge--blue';
      case 'status.member':
        return 'status-badge--green';
      case 'unbekannt':
        return 'status-badge--gray';
      default:
        return 'status-badge--gray';
    }
  };

  return (
    <section className="card">
      <div className="persons-header">
        <h2>Personen ({persons.length})</h2>
        <button type="button" onClick={onLoadPersons} disabled={loading}>
          {loading ? 'Lade…' : persons.length === 0 ? 'Personen laden' : 'Neu laden'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {persons.length === 0 ? null : (
        <>
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
                            {getStatus(person)}
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
                    <h3>{group.label}</h3>
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
                                    {getStatus(person)}
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
