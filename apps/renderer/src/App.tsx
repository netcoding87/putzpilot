import { useState } from 'react';

type Person = {
  id?: number | string;
  firstName?: string;
  lastName?: string;
  email?: string;
  status?: { name?: string } | string;
  statusId?: number | string;
  personStatus?: { id?: number | string; name?: string };
  birthday?: string;
  birthdate?: string;
};

type PersonStatus = {
  id?: number | string;
  name?: string;
};

type StatusGroup = {
  label: string;
  statusKey: string;
  persons: Person[];
};


export default function App() {
  const getAge = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
      age -= 1;
    }
    return age;
  };
  const [baseUrl, setBaseUrl] = useState('https://cgpb.church.tools');
  const [username, setUsername] = useState('nick.wittland@gmx.de');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [persons, setPersons] = useState<Person[]>([]);
  const [statuses, setStatuses] = useState<PersonStatus[]>([]);
  const [activeGroup, setActiveGroup] = useState<string>('Alle');
  const [query, setQuery] = useState('');

  const getStatus = (person: Person) => {
    if (person.personStatus?.name) return person.personStatus.name;
    if (typeof person.status === 'string') return person.status;
    if (person.status?.name) return person.status.name;
    if (person.statusId) {
      const status = statuses.find((entry) => `${entry.id}` === `${person.statusId}`);
      return status?.name ?? `Status ${person.statusId}`;
    }
    return 'Unbekannt';
  };

  const statusKeyFor = (person: Person) => {
    const status = getStatus(person);
    return status || 'Unbekannt';
  };

  const normalizedQuery = query.trim().toLowerCase();
  const visiblePersons = normalizedQuery
    ? persons.filter((person) => {
        const haystack = [
          person.firstName,
          person.lastName,
          person.email,
          getStatus(person),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
    : persons;

  const grouped = visiblePersons.reduce<Record<string, Person[]>>((acc, person) => {
    const key = statusKeyFor(person);
    if (!acc[key]) acc[key] = [];
    acc[key].push(person);
    return acc;
  }, {});

  const groups: StatusGroup[] = Object.entries(grouped)
    .map(([statusKey, groupPersons]) => ({
      label: statusKey,
      statusKey,
      persons: groupPersons,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const groupButtons = ['Alle', ...groups.map((group) => group.label)];
  const groupCounts = groups.reduce<Record<string, number>>((acc, group) => {
    acc[group.label] = group.persons.length;
    return acc;
  }, {});
  const activeGroups =
    activeGroup === 'Alle'
      ? groups
      : groups.filter((group) => group.label === activeGroup);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setPersons([]);

    try {
      await window.putzpilot.churchtools.login({ baseUrl, username, password });
      const response = await window.putzpilot.churchtools.fetchPersons(baseUrl);

      const data = response?.data ?? response?.persons ?? response;
      setPersons(Array.isArray(data) ? data : []);
      setStatuses(Array.isArray(response?.statuses) ? response.statuses : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1>PutzPilot</h1>
        <p>ChurchTools‑Login und erster Personen‑Sync.</p>
      </header>

      <section className="card">
        <h2>ChurchTools Login</h2>
        <form className="form" onSubmit={handleLogin}>
          <label>
            Base‑URL
            <input
              type="url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://deine-gemeinde.church.tools"
              required
            />
          </label>
          <label>
            Benutzername
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>
          <label>
            Passwort
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? 'Verbinden…' : 'Login & Personen laden'}
          </button>
        </form>

        {error && <p className="error">{error}</p>}
      </section>

      <section className="card">
        <h2>Personen ({persons.length})</h2>
        <div className="filters">
          {groupButtons.map((label) => (
            <button
              key={label}
              type="button"
              className={activeGroup === label ? 'active' : ''}
              onClick={() => setActiveGroup(label)}
            >
              {label}
              {label === 'Alle'
                ? ` (${visiblePersons.length})`
                : ` (${groupCounts[label] ?? 0})`}
            </button>
          ))}
        </div>
        <label className="search">
          Suche
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, E‑Mail oder Status"
          />
        </label>
        {persons.length === 0 ? (
          <p>Noch keine Daten geladen.</p>
        ) : activeGroup === 'Alle' ? (
          <ul className="list">
            {visiblePersons.map((person, index) => (
              <li key={person.id ?? index}>
                <strong>
                  {person.firstName} {person.lastName}
                </strong>
                <span>Status: {getStatus(person)}</span>
                <span>
                  Alter: {getAge(person.birthday ?? person.birthdate) ?? 'Unbekannt'}
                </span>
                {person.email ? <span>{person.email}</span> : null}
              </li>
            ))}
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
                  {group.persons.map((person, index) => (
                    <li key={person.id ?? `${group.statusKey}-${index}`}>
                      <strong>
                        {person.firstName} {person.lastName}
                      </strong>
                      <span>Status: {getStatus(person)}</span>
                      <span>
                        Alter: {getAge(person.birthday ?? person.birthdate) ?? 'Unbekannt'}
                      </span>
                      {person.email ? <span>{person.email}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
