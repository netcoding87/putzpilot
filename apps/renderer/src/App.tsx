import { useEffect, useMemo, useState } from 'react';
import MainHeader from './components/MainHeader';
import PersonsSection from './components/PersonsSection';
import PlanSection from './components/PlanSection';
import SettingsPage from './components/SettingsPage';
import { buildPlan } from './lib/planning';
import type { Person, PersonStatus, StatusGroup } from './types/people';

export default function App() {
  const [currentPage, setCurrentPage] = useState<'main' | 'settings'>('main');
  const [baseUrl, setBaseUrl] = useState('https://cgpb.church.tools');
  const [username, setUsername] = useState('nick.wittland@gmx.de');
  const [password, setPassword] = useState('');

  const [settingsDraft, setSettingsDraft] = useState({
    baseUrl: 'https://cgpb.church.tools',
    username: '',
    password: '',
  });
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsTestResult, setSettingsTestResult] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [persons, setPersons] = useState<Person[]>([]);
  const [statuses, setStatuses] = useState<PersonStatus[]>([]);
  const [activeGroup, setActiveGroup] = useState<string>('status.member');
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const [startDate, setStartDate] = useState(formatDateInput(getDefaultStartDate()));
  const defaultEnd = useMemo(() => {
    const start = getDefaultStartDate();
    const target = addMonths(start, 3);
    return getLastSaturdayOfMonth(target.getFullYear(), target.getMonth());
  }, []);
  const [endDate, setEndDate] = useState(formatDateInput(defaultEnd));
  const [plan, setPlan] = useState<Array<{ date: string; members: Person[] }>>([]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const stored = await window.putzpilot.settings.get();
        if (stored) {
          setBaseUrl(stored.baseUrl);
          setUsername(stored.username);
          setPassword(stored.password);
          setSettingsDraft({
            baseUrl: stored.baseUrl,
            username: stored.username,
            password: stored.password,
          });
        } else {
          setSettingsDraft({
            baseUrl,
            username,
            password,
          });
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    };
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return `Rels: ${person.rels
      .map((rel: any) => {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    persons.forEach((person) => {
      (person.rels ?? []).forEach((rel: any) => {
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
        const haystack = [person.firstName, person.lastName, person.email, getStatus(person)]
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
    const result = buildPlan({
      startDate,
      endDate,
      selectedPersons,
      getHouseholdKey,
      getPersonKey,
    });

    if (result.error) {
      setError(result.error);
      return;
    }

    setError(null);
    setPlan(result.assignments);
  };

  const handleLoadPersons = async () => {
    if (!baseUrl || !username || !password) {
      setError('Bitte zuerst die ChurchTools-Verbindung in den Einstellungen speichern.');
      return;
    }

    setLoading(true);
    setError(null);

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
                  (entry: PersonStatus) => `${entry.id}` === `${person.statusId}`,
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

  const handleSettingsChange = (field: 'baseUrl' | 'username' | 'password', value: string) => {
    setSettingsDraft((prev) => ({ ...prev, [field]: value }));
    setSettingsDirty(true);
    setSettingsTestResult(null);
  };

  const handleTestConnection = async () => {
    setSettingsLoading(true);
    setSettingsTestResult(null);
    try {
      await window.putzpilot.churchtools.login({
        baseUrl: settingsDraft.baseUrl,
        username: settingsDraft.username,
        password: settingsDraft.password,
      });
      setSettingsTestResult({
        ok: true,
        msg: 'Verbindung erfolgreich getestet!',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Verbindung fehlgeschlagen';
      setSettingsTestResult({ ok: false, msg });
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await window.putzpilot.settings.set({
        baseUrl: settingsDraft.baseUrl,
        username: settingsDraft.username,
        password: settingsDraft.password,
      });
      setBaseUrl(settingsDraft.baseUrl);
      setUsername(settingsDraft.username);
      setPassword(settingsDraft.password);
      setSettingsDirty(false);
      setSettingsTestResult({
        ok: true,
        msg: 'Einstellungen gespeichert!',
      });
      setTimeout(() => setSettingsTestResult(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Fehler beim Speichern';
      setSettingsTestResult({ ok: false, msg });
    }
  };

  return (
    <>
      {currentPage === 'settings' ? (
        <SettingsPage
          settingsDraft={settingsDraft}
          settingsDirty={settingsDirty}
          settingsLoading={settingsLoading}
          settingsTestResult={settingsTestResult}
          onChange={handleSettingsChange}
          onTest={handleTestConnection}
          onSave={handleSaveSettings}
          onBack={() => setCurrentPage('main')}
        />
      ) : (
        <div className="app">
          <MainHeader onOpenSettings={() => setCurrentPage('settings')} />
          <PlanSection
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onGeneratePlan={generatePlan}
            selectedCount={selectedPersons.length}
            plan={plan}
          />
          <PersonsSection
            persons={persons}
            selectedIds={selectedIds}
            loading={loading}
            error={error}
            groupButtons={groupButtons}
            currentActiveGroup={currentActiveGroup}
            groupCounts={groupCounts}
            visiblePersons={visiblePersons}
            activeGroups={activeGroups}
            query={query}
            onQueryChange={setQuery}
            onLoadPersons={handleLoadPersons}
            onToggleSelection={toggleSelection}
            getPersonKey={getPersonKey}
            getStatus={getStatus}
            getAgeValue={getAgeValue}
            formatRels={formatRels}
            onSetActiveGroup={setActiveGroup}
          />
        </div>
      )}
    </>
  );
}
