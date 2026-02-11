import { useMemo, useState } from 'react';

type Person = {
  id?: number | string;
  guid?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  status?: { name?: string } | string;
  statusId?: number | string;
  personStatus?: { id?: number | string; name?: string };
  age?: number;
  birthday?: string;
  birthdate?: string;
  householdId?: number | string;
  familyStatusId?: number | string;
  rels?: Relation[];
};

type Relation = {
  id?: number | string;
  vater_id?: number | string;
  kind_id?: number | string;
  beziehungstyp_id?: number | string;
  name?: string;
  personAId?: number | string;
  personBId?: number | string;
  personId?: number | string;
  relativeId?: number | string;
  relationshipName?: string;
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
  const getDefaultStartDate = () => {
    const now = new Date();
    const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const day = firstOfNextMonth.getDay();
    const offset = (6 - day + 7) % 7;
    firstOfNextMonth.setDate(firstOfNextMonth.getDate() + offset);
    return firstOfNextMonth;
  };

  const addMonths = (date: Date, months: number) => {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    return next;
  };

  const getLastSaturdayOfMonth = (year: number, monthIndex: number) => {
    const lastDay = new Date(year, monthIndex + 1, 0);
    const day = lastDay.getDay();
    const offset = (day - 6 + 7) % 7;
    lastDay.setDate(lastDay.getDate() - offset);
    return lastDay;
  };

  const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);

  const parseDateInput = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

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
  const [activeGroup, setActiveGroup] = useState<string>('status.member');
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState(formatDateInput(getDefaultStartDate()));
  const defaultEnd = useMemo(() => {
    const start = getDefaultStartDate();
    const target = addMonths(start, 3);
    return getLastSaturdayOfMonth(target.getFullYear(), target.getMonth());
  }, []);
  const [endDate, setEndDate] = useState(formatDateInput(defaultEnd));
  const [plan, setPlan] = useState<Array<{ date: string; members: Person[] }>>([]);

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

  const getAgeValue = (person: Person) => {
    if (typeof person.age === 'number') return person.age;
    return getAge(person.birthday ?? person.birthdate);
  };

  const getPersonKey = (person: Person, fallback: number) =>
    String(person.id ?? person.guid ?? fallback);

  const formatRels = (person: Person) => {
    if (!person.rels || person.rels.length === 0) return 'Rels: —';
    return `Rels: ${person.rels
      .map((rel) => {
        const from =
          rel.personAId ??
          rel.personBId ??
          rel.vater_id ??
          rel.parentId ??
          rel.fromId ??
          rel.from_id ??
          rel.personId ??
          rel.person_id ??
          '?';
        const to =
          rel.personBId ??
          rel.personAId ??
          rel.kind_id ??
          rel.childId ??
          rel.toId ??
          rel.to_id ??
          rel.relatedPersonId ??
          rel.related_person_id ??
          '?';
        const label = rel.relationshipName ?? rel.name ?? rel.id ?? '';
        return `${from}→${to}${label ? ` (${label})` : ''}`;
      })
      .join(', ')}`;
  };

  const householdMap = useMemo(() => {
    const parent = new Map<string, string>();

    const ensure = (value?: number | string | null) => {
      if (value === undefined || value === null) return null;
      const key = String(value);
      if (!parent.has(key)) parent.set(key, key);
      return key;
    };

    const find = (value: string) => {
      const parentValue = parent.get(value);
      if (!parentValue) return value;
      if (parentValue !== value) {
        const root = find(parentValue);
        parent.set(value, root);
      }
      return parent.get(value) ?? value;
    };

    const union = (a: string, b: string) => {
      const rootA = find(a);
      const rootB = find(b);
      if (rootA !== rootB) parent.set(rootB, rootA);
    };

    persons.forEach((person) => {
      ensure(person.id ?? null);
    });

    persons.forEach((person) => {
      (person.rels ?? []).forEach((rel) => {
        const parentId = ensure(
          rel.personAId ??
            rel.vater_id ??
            rel.parentId ??
            rel.fromId ??
            rel.from_id ??
            rel.personId ??
            rel.person_id ??
            null,
        );
        const childId = ensure(
          rel.personBId ??
            rel.kind_id ??
            rel.childId ??
            rel.toId ??
            rel.to_id ??
            rel.relatedPersonId ??
            rel.related_person_id ??
            null,
        );
        if (parentId && childId) union(parentId, childId);
      });
    });

    const map = new Map<string, string>();
    parent.forEach((_value, key) => {
      map.set(key, find(key));
    });
    return map;
  }, [persons]);

  const getHouseholdKey = (person: Person) => {
    const idKey = person.id !== undefined && person.id !== null ? String(person.id) : null;
    if (idKey && householdMap.has(idKey)) {
      return householdMap.get(idKey) ?? idKey;
    }
    return String(person.householdId ?? person.familyStatusId ?? person.lastName ?? person.id ?? '');
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
  const currentActiveGroup = groups.some((group) => group.label === activeGroup)
    ? activeGroup
    : 'Alle';
  const activeGroups =
    currentActiveGroup === 'Alle'
      ? groups
      : groups.filter((group) => group.label === currentActiveGroup);

  const selectedPersons = useMemo(() => {
    if (selectedIds.size === 0) return [];
    return persons.filter((person, index) => selectedIds.has(getPersonKey(person, index)));
  }, [persons, selectedIds]);

  const generatePlan = () => {
    const start = parseDateInput(startDate);
    const end = parseDateInput(endDate);
    if (!start || !end || start > end) {
      setError('Bitte einen gültigen Zeitraum auswählen.');
      return;
    }

    const eligible = selectedPersons.slice();
    if (eligible.length === 0) {
      setError('Keine ausgewählten Mitglieder verfügbar.');
      return;
    }

    setError(null);
    const saturdays: Date[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      if (cursor.getDay() === 6) {
        saturdays.push(new Date(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    // Build relationship graph for selected persons
    const selectedIdSet = new Set<number>();
    eligible.forEach((person, index) => {
      const key = getPersonKey(person, index);
      selectedIdSet.add(parseInt(key.split('_')[0], 10));
    });

    // Union-Find for grouping related selected persons
    interface UnionFind {
      parent: Map<number, number>;
      find(x: number): number;
      union(x: number, y: number): void;
    }
    const uf: UnionFind = {
      parent: new Map(),
      find(x: number): number {
        if (!this.parent.has(x)) {
          this.parent.set(x, x);
        }
        const px = this.parent.get(x)!;
        if (px !== x) {
          this.parent.set(x, this.find(px));
        }
        return this.parent.get(x)!;
      },
      union(x: number, y: number): void {
        const rx = this.find(x);
        const ry = this.find(y);
        if (rx !== ry) {
          this.parent.set(rx, ry);
        }
      },
    };

    // Union selected persons with their related persons
    eligible.forEach((person) => {
      const personId = typeof person.id === 'number' ? person.id : parseInt(String(person.id), 10);
      uf.find(personId);

      if (Array.isArray(person.rels)) {
        person.rels.forEach((rel: any) => {
          const relatedId = rel.personBId ?? rel.relativeId;
          if (relatedId && selectedIdSet.has(relatedId)) {
            uf.union(personId, relatedId);
          }
        });
      }
    });

    // Group persons by graph component
    interface PersonGroup {
      groupId: number;
      members: Person[];
    }
    const groupMap = new Map<number, Person[]>();
    eligible.forEach((person) => {
      const personId = typeof person.id === 'number' ? person.id : parseInt(String(person.id), 10);
      const groupId = uf.find(personId);
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, []);
      }
      groupMap.get(groupId)!.push(person);
    });

    const groups: PersonGroup[] = Array.from(groupMap.entries()).map(([groupId, members]) => ({
      groupId,
      members,
    }));

    const shuffle = (list: PersonGroup[]) => {
      const copy = list.slice();
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    let cyclePool = shuffle(groups);
    const uniqueHouseholds = new Set(
      eligible.map((person) => getHouseholdKey(person)).filter(Boolean),
    ).size;
    const canFillWithoutDuplicates = uniqueHouseholds >= 10;
    const assignments: Array<{ date: string; members: Person[] }> = [];

    for (const saturday of saturdays) {
      const selected: Person[] = [];
      const usedHouseholds = new Set<string>();

      const takeFromPool = (relaxHousehold: boolean) => {
        if (cyclePool.length === 0) {
          cyclePool = shuffle(groups);
        }

        let attempts = cyclePool.length;
        while (selected.length < 10 && attempts > 0) {
          const group = cyclePool.shift();
          if (!group) break;

          // Check if any household in this group is already used
          let canAdd = true;
          const groupHouseholds: string[] = [];
          for (const person of group.members) {
            const householdKey = getHouseholdKey(person);
            if (householdKey) {
              groupHouseholds.push(householdKey);
              if (!relaxHousehold && usedHouseholds.has(householdKey)) {
                canAdd = false;
                break;
              }
            }
          }

          if (!canAdd) {
            cyclePool.push(group);
            attempts -= 1;
            continue;
          }

          // Add all persons from this group, respecting household constraint
          let countAdded = 0;
          for (const person of group.members) {
            if (selected.length >= 10) break;
            const householdKey = getHouseholdKey(person);
            if (householdKey) {
              usedHouseholds.add(householdKey);
            }
            selected.push(person);
            countAdded += 1;
          }

          attempts -= 1;
        }
      };

      takeFromPool(false);
      if (!canFillWithoutDuplicates && selected.length < 10) {
        takeFromPool(true);
      }

      assignments.push({
        date: formatDateInput(saturday),
        members: selected,
      });
    }

    setPlan(assignments);
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setPersons([]);

    try {
      await window.putzpilot.churchtools.login({ baseUrl, username, password });
      const response = await window.putzpilot.churchtools.fetchPersons(baseUrl);

      const data = response?.data ?? response?.persons ?? response;
      const nextPersons = Array.isArray(data) ? data : [];
      const nextStatuses = Array.isArray(response?.statuses) ? response.statuses : [];
      setPersons(nextPersons);
      setStatuses(nextStatuses);

      const stored = await window.putzpilot.selection.get();
      const personKeyMap = new Map<string, Person>();
      nextPersons.forEach((person, index) => {
        personKeyMap.set(getPersonKey(person, index), person);
      });

      const withoutSeniors = (ids: string[]) =>
        ids.filter((id) => {
          const person = personKeyMap.get(id);
          const ageValue = person ? getAgeValue(person) : null;
          return ageValue === null || ageValue < 60;
        });

      if (stored.length > 0) {
        const filtered = withoutSeniors(stored);
        setSelectedIds(new Set(filtered));
        await window.putzpilot.selection.set(filtered);
      } else {
        const defaults = nextPersons
          .filter((person) => {
            const status = (() => {
              if (person.personStatus?.name) return person.personStatus.name;
              if (typeof person.status === 'string') return person.status;
              if (person.status?.name) return person.status.name;
              if (person.statusId) {
                const statusEntry = nextStatuses.find(
                  (entry) => `${entry.id}` === `${person.statusId}`,
                );
                return statusEntry?.name ?? `Status ${person.statusId}`;
              }
              return 'Unbekannt';
            })();
            const ageValue = getAgeValue(person);
            return status === 'status.member' && (ageValue === null || ageValue < 60);
          })
          .map((person, index) => getPersonKey(person, index));
        setSelectedIds(new Set(defaults));
        await window.putzpilot.selection.set(defaults);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (person: Person, index: number) => {
    const key = getPersonKey(person, index);
    const next = new Set(selectedIds);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedIds(next);
    window.putzpilot.selection.set(Array.from(next));
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
        <h2>Planung</h2>
        <div className="planning">
          <label>
            Startdatum
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label>
            Enddatum
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
          <button type="button" onClick={generatePlan}>
            Plan generieren
          </button>
          <p>{selectedPersons.length} ausgewählte Mitglieder</p>
        </div>
        {plan.length > 0 ? (
          <div className="plan-list">
            {plan.map((entry) => (
              <div key={entry.date} className="plan-entry">
                <h3>{entry.date}</h3>
                <table className="plan-table">
                  <tbody>
                    {[entry.members.slice(0, 5), entry.members.slice(5, 10)].map(
                      (row, rowIndex) => (
                        <tr key={`${entry.date}-row-${rowIndex}`}>
                          {Array.from({ length: 5 }).map((_, colIndex) => {
                            const member = row[colIndex];
                            return (
                              <td key={`${entry.date}-${rowIndex}-${colIndex}`}>
                                {member
                                  ? `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim()
                                  : ''}
                              </td>
                            );
                          })}
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ) : (
          <p>Keine Planung generiert.</p>
        )}
      </section>

      <section className="card">
        <h2>Personen ({persons.length})</h2>
        <div className="filters">
          {groupButtons.map((label) => (
            <button
              key={label}
              type="button"
              className={currentActiveGroup === label ? 'active' : ''}
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
        ) : currentActiveGroup === 'Alle' ? (
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
                      onChange={() => toggleSelection(person, index)}
                    />
                    <div className="person-info">
                      <label className="person-name" htmlFor={checkboxId}>
                        <strong>
                          {person.firstName} {person.lastName}
                        </strong>
                      </label>
                      <span>Status: {getStatus(person)}</span>
                      <span>
                        Alter: {getAgeValue(person) ?? 'Unbekannt'}
                      </span>
                      <span>{formatRels(person)}</span>
                      {person.email ? <span>{person.email}</span> : null}
                      <pre className="person-debug">
                        {JSON.stringify(person, null, 2)}
                      </pre>
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
                            onChange={() => toggleSelection(person, index)}
                          />
                          <div className="person-info">
                            <label className="person-name" htmlFor={checkboxId}>
                              <strong>
                                {person.firstName} {person.lastName}
                              </strong>
                            </label>
                            <span>Status: {getStatus(person)}</span>
                            <span>
                              Alter: {getAgeValue(person) ?? 'Unbekannt'}
                            </span>
                            <span>{formatRels(person)}</span>
                            {person.email ? <span>{person.email}</span> : null}
                            <pre className="person-debug">
                              {JSON.stringify(person, null, 2)}
                            </pre>
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
      </section>
    </div>
  );
}
