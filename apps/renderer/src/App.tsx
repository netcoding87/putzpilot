import { useEffect, useMemo, useRef, useState } from 'react';
import MainHeader from './components/MainHeader';
import PersonsSection from './components/PersonsSection';
import GroupEditor from './components/GroupEditor';
import PlanSection from './components/PlanSection';
import SettingsPage from './components/SettingsPage';
import { buildPlan } from './lib/planning';
import type { Person, PersonStatus, StatusGroup } from './types/people';
import type { ManualGroup } from './types/groups';
import type { PlanHistory, SavedPlan } from './types/planning';
import type { HistoryYear, ChronikEntry } from './types/history';
import planHistorySeed from './data/planHistorySeed.json';
import chronikSeed from './data/chronikSeed.json';
import nameAliases from './data/nameAliases.json';
import {
  convertPersonsToGroups,
  movePerson,
  mergeGroups,
  createGroupWithPerson,
  createGroupAfterSource,
  cleanupGroups,
  mergeStoredWithHouseholdGroups,
} from './lib/groupManagement';

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
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
  const [viewMode, setViewMode] = useState<'persons' | 'groups'>('persons');
  const [manualGroups, setManualGroups] = useState<ManualGroup[]>([]);
  const [groupsDraft, setGroupsDraft] = useState<ManualGroup[]>([]);

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

  const getFirstSaturdayAfter = (date: Date) => {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    while (next.getDay() !== 6) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  };

  const formatDateInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

  const [startDate, setStartDate] = useState(formatDateInput(getDefaultStartDate()));
  const defaultEnd = useMemo(() => {
    const start = getDefaultStartDate();
    const target = addMonths(start, 3);
    return getLastSaturdayOfMonth(target.getFullYear(), target.getMonth());
  }, []);
  const [endDate, setEndDate] = useState(formatDateInput(defaultEnd));
  const [plan, setPlan] = useState<Array<{ date: string; members: Person[] }>>([]);
  const [planHistory, setPlanHistory] = useState<PlanHistory>({ plans: [] });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [planView, setPlanView] = useState<'planning' | 'history' | 'chronik'>('planning');
  const [aliases, setAliases] = useState<Array<{ canonical: string; aliases: string[] }>>([]);
  const hasUserAdjustedDatesRef = useRef(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('putzpilot-theme') as 'dark' | 'light' | null;
    const initialTheme = savedTheme || 'dark';
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);

    // Load plan history
    window.putzpilot.plans.get().then((savedPlans) => {
      setPlanHistory({ plans: savedPlans });
    }).catch(console.error);

    // Load aliases (seed from JSON if empty)
    window.putzpilot.aliases.get().then((storedAliases) => {
      if (storedAliases && storedAliases.length > 0) {
        setAliases(storedAliases);
      } else {
        // Seed from JSON on first run
        const seedAliases = Array.isArray(nameAliases)
          ? (nameAliases as Array<{ canonical: string; aliases: string[] }>)
          : [];
        setAliases(seedAliases);
        if (seedAliases.length > 0) {
          window.putzpilot.aliases.set(seedAliases).catch(console.error);
        }
      }
    }).catch(console.error);
  }, []);

  const lastHistoryDate = useMemo(() => {
    const parseHistoryDate = (value: string) => {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return null;
      parsed.setHours(0, 0, 0, 0);
      return parsed;
    };

    let latest: Date | null = null;
    (planHistorySeed as HistoryYear[]).forEach((year) => {
      year.assignments.forEach((assignment) => {
        const parsed = parseHistoryDate(assignment.date);
        if (!parsed) return;
        if (!latest || parsed > latest) latest = parsed;
      });
    });

    planHistory.plans.forEach((plan) => {
      plan.assignments.forEach((assignment) => {
        const parsed = parseHistoryDate(assignment.date);
        if (!parsed) return;
        if (!latest || parsed > latest) latest = parsed;
      });
    });

    return latest;
  }, [planHistory.plans]);

  const initialDates = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let start = getDefaultStartDate();
    if (lastHistoryDate && lastHistoryDate >= today) {
      start = getFirstSaturdayAfter(lastHistoryDate);
    }
    const endTarget = addMonths(start, 3);
    const end = getLastSaturdayOfMonth(endTarget.getFullYear(), endTarget.getMonth());

    return { start, end };
  }, [lastHistoryDate]);

  useEffect(() => {
    if (hasUserAdjustedDatesRef.current) return;
    setStartDate(formatDateInput(initialDates.start));
    setEndDate(formatDateInput(initialDates.end));
  }, [initialDates]);

  const handleThemeChange = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    localStorage.setItem('putzpilot-theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

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

  useEffect(() => {
    const loadGroups = async () => {
      try {
        const stored = await window.putzpilot.groups.get();
        setManualGroups(stored);
      } catch (err) {
        console.error('Failed to load groups:', err);
      }
    };
    loadGroups();
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

  const getStatusTranslated = (statusKey: string) => {
    const status = statuses.find(
      (s) => s.name?.toLowerCase() === statusKey.toLowerCase()
    );
    return status?.nameTranslated || statusKey;
  };

  const grouped = visiblePersons.reduce<Record<string, Person[]>>((acc, person) => {
    const key = statusKeyFor(person);
    if (!acc[key]) acc[key] = [];
    acc[key].push(person);
    return acc;
  }, {});

  const groups: StatusGroup[] = Object.entries(grouped)
    .map(([statusKey, groupPersons]) => ({
      label: statusKey,
      labelTranslated: getStatusTranslated(statusKey),
      statusKey,
      persons: groupPersons,
    }))
    .sort((a, b) => a.labelTranslated.localeCompare(b.labelTranslated));

  const groupButtons = ['Alle', ...groups.map((group) => group.labelTranslated)];
  const groupCounts = groups.reduce<Record<string, number>>((acc, group) => {
    acc[group.labelTranslated] = group.persons.length;
    return acc;
  }, {});
  const currentActiveGroup = groups.some((group) => group.labelTranslated === activeGroup)
    ? activeGroup
    : 'Alle';
  const activeGroups =
    currentActiveGroup === 'Alle'
      ? groups
      : groups.filter((group) => group.labelTranslated === currentActiveGroup);

  const selectedPersons = useMemo(() => {
    if (selectedIds.size === 0) return [];
    return persons.filter((person, index) => selectedIds.has(getPersonKey(person, index)));
  }, [persons, selectedIds]);

  const personNameMap = useMemo(() => {
    const map = new Map<string, string>();
    persons.forEach((person, index) => {
      const key = getPersonKey(person, index);
      const name = `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim();
      map.set(key, name || key);
    });
    return map;
  }, [persons]);

  const normalizeName = (value: string) =>
    value
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

  const nameToIdMap = useMemo(() => {
    const counts = new Map<string, number>();
    const idByKey = new Map<string, string>();

    const addKey = (key: string, id: string) => {
      if (!key) return;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!idByKey.has(key)) {
        idByKey.set(key, id);
      }
    };

    const getNameVariants = (firstName: string, lastName: string) => {
      const first = normalizeName(firstName);
      const last = normalizeName(lastName);
      const tokens = first.split(' ').filter(Boolean);
      const firstToken = tokens[0] ?? '';
      const variants = [
        normalizeName(`${first} ${last}`),
        normalizeName(`${last} ${first}`),
      ];
      if (firstToken && firstToken !== first) {
        variants.push(normalizeName(`${firstToken} ${last}`));
        variants.push(normalizeName(`${last} ${firstToken}`));
      }
      return variants.filter(Boolean);
    };

    persons.forEach((person, index) => {
      const id = getPersonKey(person, index);
      const first = person.firstName ?? '';
      const last = person.lastName ?? '';
      getNameVariants(first, last).forEach((variant) => addKey(variant, id));
    });

    const uniqueMap = new Map<string, string>();
    idByKey.forEach((id, key) => {
      if (counts.get(key) === 1) {
        uniqueMap.set(key, id);
      }
    });

    aliases.forEach((entry) => {
      const canonicalKey = normalizeName(entry.canonical ?? '');
      if (!canonicalKey) return;
      const canonicalId = uniqueMap.get(canonicalKey);
      if (!canonicalId) return;

      (entry.aliases ?? []).forEach((alias) => {
        const aliasKey = normalizeName(alias ?? '');
        if (!aliasKey) return;
        const existing = uniqueMap.get(aliasKey);
        if (existing && existing !== canonicalId) return;
        uniqueMap.set(aliasKey, canonicalId);
      });
    });

    return uniqueMap;
  }, [persons, aliases]);

  const seedHistoryForPlanning = useMemo<PlanHistory>(() => {
    const getNameCandidates = (name: string) => {
      const cleaned = name.replace(/\s*\([^)]*\)/g, '').trim();
      const candidates = [cleaned];
      if (cleaned.includes(',')) {
        const [last, first] = cleaned.split(',').map((part) => part.trim());
        if (first && last) {
          candidates.push(`${first} ${last}`);
        }
      }
      const tokens = cleaned.split(' ').filter(Boolean);
      if (tokens.length >= 3) {
        candidates.push(`${tokens[0]} ${tokens[tokens.length - 1]}`);
      }
      return candidates.map((candidate) => normalizeName(candidate)).filter(Boolean);
    };

    const plans: PlanHistory['plans'] = [];

    (planHistorySeed as HistoryYear[]).forEach((year) => {
      const assignments = year.assignments
        .map((assignment) => {
          const personIds = assignment.members
            .flatMap((name) => {
              const candidates = getNameCandidates(name);
              const match = candidates.find((candidate) => nameToIdMap.has(candidate));
              return match ? [nameToIdMap.get(match)!] : [];
            })
            .filter(Boolean);

          return personIds.length > 0
            ? { date: assignment.date, personIds }
            : null;
        })
        .filter((assignment): assignment is { date: string; personIds: string[] } =>
          assignment !== null,
        )
        .sort((a, b) => a.date.localeCompare(b.date));

      if (assignments.length === 0) return;

      plans.push({
        id: `seed-${year.year}`,
        startDate: assignments[0].date,
        endDate: assignments[assignments.length - 1].date,
        assignments,
        savedAt: 0,
      });
    });

    return { plans };
  }, [nameToIdMap]);

  const combinedPlanningHistory = useMemo<PlanHistory>(
    () => ({ plans: [...seedHistoryForPlanning.plans, ...planHistory.plans] }),
    [seedHistoryForPlanning.plans, planHistory.plans],
  );

  const savedHistoryYears = useMemo<HistoryYear[]>(() => {
    const byYear = new Map<string, HistoryYear>();
    planHistory.plans.forEach((plan) => {
      plan.assignments.forEach((assignment) => {
        const year = assignment.date.slice(0, 4);
        const members = assignment.personIds.map((id) => personNameMap.get(id) ?? id);
        const existing = byYear.get(year) ?? { year, assignments: [] };
        existing.assignments.push({ date: assignment.date, members });
        byYear.set(year, existing);
      });
    });

    return Array.from(byYear.values()).map((yearData) => ({
      year: yearData.year,
      assignments: yearData.assignments.sort((a, b) => a.date.localeCompare(b.date)),
    }));
  }, [planHistory.plans, personNameMap]);

  const historyYears = useMemo<HistoryYear[]>(() => {
    const seedYears = (planHistorySeed as HistoryYear[]).map((year) => ({
      year: year.year,
      assignments: [...year.assignments],
    }));

    const merged = new Map<string, HistoryYear>();
    seedYears.forEach((year) => merged.set(year.year, year));

    savedHistoryYears.forEach((year) => {
      const existing = merged.get(year.year);
      if (!existing) {
        merged.set(year.year, year);
        return;
      }

      const assignmentsByDate = new Map(existing.assignments.map((a) => [a.date, a]));
      year.assignments.forEach((assignment) => {
        assignmentsByDate.set(assignment.date, assignment);
      });

      existing.assignments = Array.from(assignmentsByDate.values()).sort((a, b) =>
        a.date.localeCompare(b.date),
      );
      merged.set(year.year, existing);
    });

    return Array.from(merged.values()).sort((a, b) => a.year.localeCompare(b.year));
  }, [savedHistoryYears]);

  const chronikEntries = useMemo<ChronikEntry[]>(
    () => chronikSeed as ChronikEntry[],
    [],
  );

  const generatePlan = () => {
    const result = buildPlan({
      startDate,
      endDate,
      selectedPersons,
      manualGroups,
      history: combinedPlanningHistory,
      getHouseholdKey,
      getPersonKey,
    });

    if (result.error) {
      setError(result.error);
      return;
    }

    setError(null);
    setPlan(result.assignments);
    setHasUnsavedChanges(true);
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

      let selectedPersonList: string[];
      if (stored.length > 0) {
        selectedPersonList = withoutSeniors(stored);
      } else {
        selectedPersonList = nextPersons
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
      }
      
      setSelectedIds(new Set(selectedPersonList));
      await window.putzpilot.selection.set(selectedPersonList);

      // Automatically transition to group editor
      const selectedPersonObjects = selectedPersonList
        .map((id) => nextPersons.find((p, i) => getPersonKey(p, i) === id))
        .filter(Boolean) as Person[];

      const householdGroups = convertPersonsToGroups(
        selectedPersonObjects,
        (person) => {
          const idKey = person.id !== undefined && person.id !== null ? String(person.id) : null;
          if (idKey && householdMap.has(idKey)) {
            return householdMap.get(idKey) ?? idKey;
          }
          return String(person.householdId ?? person.familyStatusId ?? person.lastName ?? person.id ?? '');
        },
        getPersonKey
      );

      const validPersonIds = new Set(selectedPersonList);
      const merged = mergeStoredWithHouseholdGroups(manualGroups, householdGroups, validPersonIds);

      setGroupsDraft(merged);
      setViewMode('groups');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  const handleReloadPersons = async () => {
    // Run full workflow: reload persons, apply filters, merge with stored groups, show group editor
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

      // Save/update selected persons
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

      let selectedPersonList: string[];
      if (stored.length > 0) {
        selectedPersonList = withoutSeniors(stored);
      } else {
        selectedPersonList = nextPersons
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
      }
      
      setSelectedIds(new Set(selectedPersonList));
      await window.putzpilot.selection.set(selectedPersonList);

      // Now automatically transition to group editor
      const selectedPersonObjects = selectedPersonList
        .map((id) => nextPersons.find((p, i) => getPersonKey(p, i) === id))
        .filter(Boolean) as Person[];

      const householdGroups = convertPersonsToGroups(
        selectedPersonObjects,
        (person) => {
          const idKey = person.id !== undefined && person.id !== null ? String(person.id) : null;
          if (idKey && householdMap.has(idKey)) {
            return householdMap.get(idKey) ?? idKey;
          }
          return String(person.householdId ?? person.familyStatusId ?? person.lastName ?? person.id ?? '');
        },
        getPersonKey
      );

      const validPersonIds = new Set(selectedPersonList);
      const merged = mergeStoredWithHouseholdGroups(manualGroups, householdGroups, validPersonIds);

      setGroupsDraft(merged);
      setViewMode('groups');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  const handleEditGroups = () => {
    // Build household groups from selectedPersons
    const householdGroups = convertPersonsToGroups(selectedPersons, getHouseholdKey, getPersonKey);
    
    // Merge with stored manual groups
    const validPersonIds = new Set(selectedPersons.map((p, i) => getPersonKey(p, i)));
    const merged = mergeStoredWithHouseholdGroups(manualGroups, householdGroups, validPersonIds);
    
    setGroupsDraft(merged);
    setViewMode('groups');
  };

  const handleGroupMovePerson = async (personId: string, targetGroupId: string) => {
    setGroupsDraft((current) => {
      const moved = movePerson(current, personId, targetGroupId);
      const cleaned = cleanupGroups(moved, new Set(selectedPersons.map((p, i) => getPersonKey(p, i))));
      // Auto-save to storage AND state
      window.putzpilot.groups.set(cleaned);
      setManualGroups(cleaned);
      return cleaned;
    });
  };

  const handleGroupMerge = async (sourceGroupId: string, targetGroupId: string) => {
    setGroupsDraft((current) => {
      const merged = mergeGroups(current, sourceGroupId, targetGroupId);
      const cleaned = cleanupGroups(merged, new Set(selectedPersons.map((p, i) => getPersonKey(p, i))));
      // Auto-save to storage AND state
      window.putzpilot.groups.set(cleaned);
      setManualGroups(cleaned);
      return cleaned;
    });
  };

  const handleGroupCreate = async (personId: string) => {
    setGroupsDraft((current) => {
      const created = createGroupWithPerson(current, personId);
      const cleaned = cleanupGroups(created, new Set(selectedPersons.map((p, i) => getPersonKey(p, i))));
      // Auto-save to storage AND state
      window.putzpilot.groups.set(cleaned);
      setManualGroups(cleaned);
      return cleaned;
    });
  };

  const handleGroupCreateFromGroup = async (personId: string, afterGroupId: string) => {
    setGroupsDraft((current) => {
      const created = createGroupAfterSource(current, personId, afterGroupId);
      const cleaned = cleanupGroups(created, new Set(selectedPersons.map((p, i) => getPersonKey(p, i))));
      // Auto-save to storage AND state
      window.putzpilot.groups.set(cleaned);
      setManualGroups(cleaned);
      return cleaned;
    });
  };

  const handleGroupCancel = () => {
    // Update manualGroups from the draft (which already auto-saved to storage)
    setManualGroups(groupsDraft);
    setViewMode('persons');
  };

  const handleSwapPersons = (
    weekDate1: string,
    personIndex1: number,
    weekDate2: string,
    personIndex2: number,
  ) => {
    setPlan((current) => {
      const next = current.map((entry) => ({ ...entry, members: [...entry.members] }));
      const entry1 = next.find((e) => e.date === weekDate1);
      const entry2 = next.find((e) => e.date === weekDate2);

      if (!entry1 || !entry2) return current;

      const person1 = entry1.members[personIndex1];
      const person2 = entry2.members[personIndex2];

      if (!person1 || !person2) return current;

      // Swap
      entry1.members[personIndex1] = person2;
      entry2.members[personIndex2] = person1;

      setHasUnsavedChanges(true);
      return next;
    });
  };

  const handleReplacePerson = (weekDate: string, personIndex: number, newPerson: Person) => {
    setPlan((current) => {
      const next = current.map((entry) => ({ ...entry, members: [...entry.members] }));
      const entry = next.find((e) => e.date === weekDate);

      if (!entry) return current;

      entry.members[personIndex] = newPerson;

      setHasUnsavedChanges(true);
      return next;
    });
  };

  const handleSavePlan = async () => {
    if (plan.length === 0) return;

    // Check if plan already exists for this date range
    const existingPlanIndex = planHistory.plans.findIndex((p) => {
      const overlaps = 
        (p.startDate <= endDate && p.endDate >= startDate) ||
        (startDate <= p.endDate && endDate >= p.startDate);
      return overlaps;
    });

    let shouldSave = true;
    if (existingPlanIndex >= 0) {
      const confirmOverwrite = window.confirm(
        `Es existiert bereits eine Planung für diesen Zeitraum (${planHistory.plans[existingPlanIndex].startDate} - ${planHistory.plans[existingPlanIndex].endDate}).\n\nBeim Speichern wird diese überschrieben. Fortfahren?`
      );
      shouldSave = confirmOverwrite;
    }

    if (!shouldSave) return;

    const newPlan: SavedPlan = {
      id: `plan-${Date.now()}`,
      startDate,
      endDate,
      assignments: plan.map((entry) => ({
        date: entry.date,
        personIds: entry.members.map((member, index) => getPersonKey(member, index)),
      })),
      savedAt: Date.now(),
    };

    // Remove overlapping plans and add new one
    const updatedPlans = planHistory.plans.filter((p, i) => i !== existingPlanIndex);
    updatedPlans.push(newPlan);

    await window.putzpilot.plans.set(updatedPlans);
    setPlanHistory({ plans: updatedPlans });
    setHasUnsavedChanges(false);
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

  const handleStartDateChange = (value: string) => {
    hasUserAdjustedDatesRef.current = true;
    setStartDate(value);
  };

  const handleEndDateChange = (value: string) => {
    hasUserAdjustedDatesRef.current = true;
    setEndDate(value);
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

  const handleAliasesChange = async (updatedAliases: Array<{ canonical: string; aliases: string[] }>) => {
    setAliases(updatedAliases);
    try {
      await window.putzpilot.aliases.set(updatedAliases);
    } catch (err) {
      console.error('Failed to save aliases:', err);
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
          aliases={aliases}
          onAliasesChange={handleAliasesChange}
        />
      ) : (
        <div className="app">
          <MainHeader
            onOpenSettings={() => setCurrentPage('settings')}
            theme={theme}
            onThemeChange={handleThemeChange}
          />
          <PlanSection
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={handleStartDateChange}
            onEndDateChange={handleEndDateChange}
            onGeneratePlan={generatePlan}
            selectedCount={selectedPersons.length}
            plan={plan}
            allPersons={selectedPersons}
            onSwapPersons={handleSwapPersons}
            onReplacePerson={handleReplacePerson}
            onSavePlan={handleSavePlan}
            hasUnsavedChanges={hasUnsavedChanges}
            mode={planView}
            onModeChange={setPlanView}
            historyYears={historyYears}
            chronikEntries={chronikEntries}
          />
          {viewMode === 'groups' ? (
            <GroupEditor
              groups={groupsDraft}
              persons={selectedPersons}
              getPersonKey={getPersonKey}
              onMovePerson={handleGroupMovePerson}
              onMergeGroups={handleGroupMerge}
              onCreateGroup={handleGroupCreate}
              onCreateGroupFromGroup={handleGroupCreateFromGroup}
              onCancel={handleGroupCancel}
              onReload={handleReloadPersons}
              isLoading={loading}
            />
          ) : (
            <PersonsSection
              persons={persons}
              statuses={statuses}
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
              onReloadPersons={handleReloadPersons}
              onToggleSelection={toggleSelection}
              getPersonKey={getPersonKey}
              getStatus={getStatus}
              getAgeValue={getAgeValue}
              onSetActiveGroup={setActiveGroup}
              onEditGroups={handleEditGroups}
            />
          )}
        </div>
      )}
    </>
  );
}
