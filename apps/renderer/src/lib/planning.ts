import type { Person } from '../types/people';
import type { ManualGroup } from '../types/groups';
import type { BuildPlanParams, BuildPlanResult, PlanHistory } from '../types/planning';

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

  const saturdays: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    if (cursor.getDay() === 6) {
      saturdays.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

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

  // Sort groups by priority (based on history) instead of shuffling
  // Groups with members who haven't been assigned recently get priority
  const referenceDate = formatDateInput(saturdays[0] || start);
  const sortedGroups = [...groups].sort((a, b) => {
    const priorityA = getGroupPriority(a, lastAssignmentMap, getPersonKey, referenceDate);
    const priorityB = getGroupPriority(b, lastAssignmentMap, getPersonKey, referenceDate);
    // Higher priority (more days since assignment) should come first
    return priorityB - priorityA;
  });

  // For groups with equal priority (e.g., all never assigned), shuffle them
  // This ensures some randomness while maintaining fairness
  const groupsByPriority = new Map<number, typeof groups>();
  sortedGroups.forEach(group => {
    const priority = Math.floor(getGroupPriority(group, lastAssignmentMap, getPersonKey, referenceDate));
    if (!groupsByPriority.has(priority)) {
      groupsByPriority.set(priority, []);
    }
    groupsByPriority.get(priority)!.push(group);
  });

  const finalSortedGroups: typeof groups = [];
  Array.from(groupsByPriority.entries())
    .sort((a, b) => b[0] - a[0]) // Sort by priority descending
    .forEach(([, groupsAtPriority]) => {
      finalSortedGroups.push(...shuffle(groupsAtPriority));
    });

  let cyclePool = [...finalSortedGroups];
  const originalOrder = [...finalSortedGroups]; // Keep original order for cycle repetition
  
  const uniqueHouseholds = new Set(
    selectedPersons.map((person) => getHouseholdKey(person)).filter(Boolean),
  ).size;
  const canFillWithoutDuplicates = uniqueHouseholds >= 10;
  const assignments: Array<{ date: string; members: Person[] }> = [];

  for (const saturday of saturdays) {
    const selected: Person[] = [];
    const usedHouseholds = new Set<string>();

    const takeFromPool = (relaxHousehold: boolean) => {
      let refillCount = 0;
      const MAX_REFILLS = 3; // Prevent infinite loops

      while (selected.length < 10 && refillCount < MAX_REFILLS) {
        if (cyclePool.length === 0) {
          // Repeat original order instead of shuffling
          cyclePool = [...originalOrder];
          refillCount++;
        }

        let attempts = cyclePool.length;
        let madeProgress = false;

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
            madeProgress = true;
          }

          attempts -= 1;
        }

        // If we didn't make progress and haven't reached 10, we need to refill
        if (!madeProgress && selected.length < 10) {
          break; // Exit to allow relaxed household rules
        }
      }
    };

    // First pass: try to fill with household rules
    takeFromPool(false);
    
    // Second pass: if not full and we can't fill without duplicates, relax household rules
    if (selected.length < 10 && !canFillWithoutDuplicates) {
      takeFromPool(true);
    }

    // Third pass: if STILL not full (end of cycle), force fill by relaxing all rules
    if (selected.length < 10) {
      takeFromPool(true);
    }

    assignments.push({
      date: formatDateInput(saturday),
      members: selected,
    });
  }

  return { assignments };
};
