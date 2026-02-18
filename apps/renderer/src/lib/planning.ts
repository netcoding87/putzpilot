import type { Person } from '../types/people';
import type { ManualGroup } from '../types/groups';
import type { BuildPlanParams, BuildPlanResult, PlanHistory } from '../types/planning';

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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

/**
 * Extract last assignment date for each person from plan history
 */
const getLastAssignmentMap = (
  history: PlanHistory | undefined,
  getPersonKey: (person: Person, fallback: number) => string,
): Map<string, string> => {
  const lastAssignment = new Map<string, string>();
  
  if (!history || !history.plans || history.plans.length === 0) {
    return lastAssignment;
  }

  // Sort plans by date to process chronologically
  const sortedPlans = [...history.plans].sort((a, b) => 
    new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  // Iterate through all assignments chronologically
  for (const plan of sortedPlans) {
    for (const assignment of plan.assignments) {
      for (const personId of assignment.personIds) {
        // Update last assignment date for this person
        lastAssignment.set(personId, assignment.date);
      }
    }
  }

  return lastAssignment;
};

/**
 * Calculate average "days since last assignment" for a group
 * Lower number = more recently assigned = should wait longer
 */
const getGroupPriority = (
  group: { members: Person[] },
  lastAssignmentMap: Map<string, string>,
  getPersonKey: (person: Person, fallback: number) => string,
  referenceDate: string,
): number => {
  const refTime = new Date(referenceDate).getTime();
  const memberPriorities: number[] = [];

  group.members.forEach((person, index) => {
    const personId = getPersonKey(person, index);
    const lastDate = lastAssignmentMap.get(personId);
    
    if (!lastDate) {
      // Never assigned - highest priority (large number)
      memberPriorities.push(Infinity);
    } else {
      const lastTime = new Date(lastDate).getTime();
      const daysSince = (refTime - lastTime) / (1000 * 60 * 60 * 24);
      memberPriorities.push(daysSince);
    }
  });

  // Return average days since last assignment
  // Groups with members who haven't been assigned recently get higher priority
  if (memberPriorities.length === 0) return 0;
  const sum = memberPriorities.reduce((a, b) => a === Infinity || b === Infinity ? Infinity : a + b, 0);
  return sum === Infinity ? Infinity : sum / memberPriorities.length;
};


export const buildPlan = ({
  startDate,
  endDate,
  selectedPersons,
  manualGroups,
  history,
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

  const isWithinRange = (date: Date) => date >= start && date <= end;

  const getEasterSunday = (year: number) => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  };

  const getSpecialDates = (rangeStart: Date, rangeEnd: Date) => {
    const dates: Date[] = [];
    for (let year = rangeStart.getFullYear(); year <= rangeEnd.getFullYear(); year += 1) {
      const easterSunday = getEasterSunday(year);
      const maundyThursday = new Date(easterSunday);
      maundyThursday.setDate(maundyThursday.getDate() - 3);
      if (isWithinRange(maundyThursday)) {
        dates.push(maundyThursday);
      }

      const dec23 = new Date(year, 11, 23);
      if (dec23.getDay() !== 6 && isWithinRange(dec23)) {
        dates.push(dec23);
      }
    }
    return dates;
  };

  const saturdays: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    if (cursor.getDay() === 6) {
      saturdays.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const specialDates = getSpecialDates(start, end);
  const assignmentDates = Array.from(
    new Map(
      [...saturdays, ...specialDates].map((date) => [formatDateInput(date), date]),
    ).values(),
  ).sort((a, b) => a.getTime() - b.getTime());

  // Extract last assignment info from history
  const lastAssignmentMap = getLastAssignmentMap(history, getPersonKey);

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

  // Create a person lookup map
  const personMap = new Map<string, Person>();
  selectedPersons.forEach((person, index) => {
    personMap.set(getPersonKey(person, index), person);
  });

  interface PersonGroup {
    groupId: number | string;
    members: Person[];
  }
  const groups: PersonGroup[] = [];

  // If manual groups are provided, use them
  if (manualGroups && manualGroups.length > 0) {
    manualGroups.forEach((manualGroup, index) => {
      const members = manualGroup.personIds
        .map((personId) => personMap.get(personId))
        .filter(Boolean) as Person[];
      if (members.length > 0) {
        groups.push({
          groupId: manualGroup.id || `manual-${index}`,
          members,
        });
      }
    });
  }

  // If no manual groups or they don't cover everyone, fall back to household grouping
  if (groups.length === 0) {
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

    const groupMap = new Map<number, Person[]>();
    selectedPersons.forEach((person, index) => {
      const personId = getPersonNumericId(person, index, getPersonKey);
      const groupId = uf.find(personId);
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, []);
      }
      groupMap.get(groupId)!.push(person);
    });

    Array.from(groupMap.entries()).forEach(([groupId, members]) => {
      groups.push({ groupId, members });
    });
  }

  const buildGroupOrder = (referenceDate: string) => {
    const groupsByPriority = new Map<number, typeof groups>();
    groups.forEach((group) => {
      const priority = getGroupPriority(group, lastAssignmentMap, getPersonKey, referenceDate);
      const priorityKey = Number.isFinite(priority) ? Math.floor(priority) : Number.MAX_SAFE_INTEGER;
      if (!groupsByPriority.has(priorityKey)) {
        groupsByPriority.set(priorityKey, []);
      }
      groupsByPriority.get(priorityKey)!.push(group);
    });

    const ordered: typeof groups = [];
    Array.from(groupsByPriority.entries())
      .sort((a, b) => b[0] - a[0])
      .forEach(([, groupsAtPriority]) => {
        ordered.push(...shuffle(groupsAtPriority));
      });

    return ordered;
  };

  const fillSelection = (
    orderedGroups: typeof groups,
    relaxHousehold: boolean,
  ) => {
    const selected: Person[] = [];
    const usedHouseholds = new Set<string>();
    const usedGroupIds = new Set<PersonGroup['groupId']>();

    let madeProgress = true;
    let passes = 0;
    while (selected.length < 10 && madeProgress && passes < 2) {
      madeProgress = false;
      for (const group of orderedGroups) {
        if (selected.length >= 10) break;
        if (usedGroupIds.has(group.groupId)) continue;

        const remainingSlots = 10 - selected.length;
        if (group.members.length > remainingSlots) continue;

        if (!relaxHousehold) {
          let householdConflict = false;
          for (const person of group.members) {
            const householdKey = getHouseholdKey(person);
            if (householdKey && usedHouseholds.has(householdKey)) {
              householdConflict = true;
              break;
            }
          }
          if (householdConflict) continue;
        }

        group.members.forEach((person) => {
          if (selected.length >= 10) return;
          const householdKey = getHouseholdKey(person);
          if (householdKey) {
            usedHouseholds.add(householdKey);
          }
          selected.push(person);
        });
        usedGroupIds.add(group.groupId);
        madeProgress = true;
      }
      passes += 1;
    }

    return selected;
  };

  const pickSelection = (referenceDate: string, relaxHousehold: boolean) => {
    let bestSelection: Person[] = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const orderedGroups = buildGroupOrder(referenceDate);
      const selection = fillSelection(orderedGroups, relaxHousehold);
      if (selection.length > bestSelection.length) {
        bestSelection = selection;
      }
      if (bestSelection.length === 10) break;
    }
    return bestSelection;
  };

  
  const assignments: Array<{ date: string; members: Person[] }> = [];

  for (const assignmentDate of assignmentDates) {
    const referenceDate = formatDateInput(assignmentDate);
    let selected = pickSelection(referenceDate, false);

    if (selected.length < 10) {
      const relaxedSelection = pickSelection(referenceDate, true);
      if (relaxedSelection.length > selected.length) {
        selected = relaxedSelection;
      }
    }

    selected.forEach((person, index) => {
      const personId = getPersonKey(person, index);
      lastAssignmentMap.set(personId, referenceDate);
    });

    assignments.push({
      date: referenceDate,
      members: selected,
    });
  }

  return { assignments };
};
