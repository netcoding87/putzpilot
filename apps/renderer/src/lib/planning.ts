import type { Person } from '../types/people';

type PlanEntry = { date: string; members: Person[] };

type BuildPlanParams = {
  startDate: string;
  endDate: string;
  selectedPersons: Person[];
  getHouseholdKey: (person: Person) => string | null;
  getPersonKey: (person: Person, fallback: number) => string;
  random?: () => number;
};

type BuildPlanResult = {
  assignments: PlanEntry[];
  error?: string;
};

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);

const parseDateInput = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getPersonNumericId = (
  person: Person,
  index: number,
  getPersonKey: (person: Person, fallback: number) => string,
) => {
  if (typeof person.id === 'number') return person.id;
  const raw = person.id ?? getPersonKey(person, index);
  const parsed = parseInt(String(raw), 10);
  return Number.isNaN(parsed) ? index : parsed;
};

export const buildPlan = ({
  startDate,
  endDate,
  selectedPersons,
  getHouseholdKey,
  getPersonKey,
  random,
}: BuildPlanParams): BuildPlanResult => {
  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);
  if (!start || !end || start > end) {
    return { assignments: [], error: 'Bitte einen gültigen Zeitraum auswählen.' };
  }

  if (selectedPersons.length === 0) {
    return { assignments: [], error: 'Keine ausgewählten Mitglieder verfügbar.' };
  }

  const saturdays: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    if (cursor.getDay() === 6) {
      saturdays.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const rng = random ?? Math.random;
  const shuffle = <T,>(list: T[]) => {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const selectedIdSet = new Set<number>();
  selectedPersons.forEach((person, index) => {
    selectedIdSet.add(getPersonNumericId(person, index, getPersonKey));
  });

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

  selectedPersons.forEach((person, index) => {
    const personId = getPersonNumericId(person, index, getPersonKey);
    uf.find(personId);

    if (Array.isArray(person.rels)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      person.rels.forEach((rel: any) => {
        const relatedId = rel.personBId ?? rel.relativeId;
        if (relatedId && selectedIdSet.has(relatedId)) {
          uf.union(personId, relatedId);
        }
      });
    }
  });

  interface PersonGroup {
    groupId: number;
    members: Person[];
  }
  const groupMap = new Map<number, Person[]>();
  selectedPersons.forEach((person, index) => {
    const personId = getPersonNumericId(person, index, getPersonKey);
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

  let cyclePool = shuffle(groups);
  const uniqueHouseholds = new Set(
    selectedPersons.map((person) => getHouseholdKey(person)).filter(Boolean),
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

        let canAdd = true;
        for (const person of group.members) {
          const householdKey = getHouseholdKey(person);
          if (householdKey && !relaxHousehold && usedHouseholds.has(householdKey)) {
            canAdd = false;
            break;
          }
        }

        if (!canAdd) {
          cyclePool.push(group);
          attempts -= 1;
          continue;
        }

        for (const person of group.members) {
          if (selected.length >= 10) break;
          const householdKey = getHouseholdKey(person);
          if (householdKey) {
            usedHouseholds.add(householdKey);
          }
          selected.push(person);
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

  return { assignments };
};
