import type { Person } from '../types/people';
import type { ManualGroup, GroupValidationResult } from '../types/groups';

const MAX_GROUP_SIZE = 10;

/**
 * Validates a single group
 */
export function validateGroup(group: ManualGroup): GroupValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (group.personIds.length === 0) {
    warnings.push('Gruppe ist leer');
  }

  if (group.personIds.length > MAX_GROUP_SIZE) {
    errors.push(`Gruppe hat zu viele Mitglieder (${group.personIds.length}/${MAX_GROUP_SIZE})`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates all groups - checks for duplicates and individual group validity
 */
export function validateAllGroups(groups: ManualGroup[]): GroupValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seenPersonIds = new Set<string>();

  for (const group of groups) {
    const groupValidation = validateGroup(group);
    errors.push(...groupValidation.errors);
    warnings.push(...groupValidation.warnings);

    // Check for duplicate person IDs across groups
    for (const personId of group.personIds) {
      if (seenPersonIds.has(personId)) {
        errors.push(`Person ${personId} existiert in mehreren Gruppen`);
      }
      seenPersonIds.add(personId);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Merges one group into another (drag group onto group)
 */
export function mergeGroups(
  groups: ManualGroup[],
  sourceGroupId: string,
  targetGroupId: string,
): ManualGroup[] {
  const sourceGroup = groups.find((g) => g.id === sourceGroupId);
  const targetGroup = groups.find((g) => g.id === targetGroupId);

  if (!sourceGroup || !targetGroup || sourceGroupId === targetGroupId) {
    return groups;
  }

  // Merge all persons from source into target
  const mergedPersonIds = [...new Set([...targetGroup.personIds, ...sourceGroup.personIds])];

  return groups
    .filter((g) => g.id !== sourceGroupId) // Remove source group
    .map((g) =>
      g.id === targetGroupId
        ? { ...g, personIds: mergedPersonIds }
        : g
    );
}

/**
 * Moves a single person between groups
 */
export function movePerson(
  groups: ManualGroup[],
  personId: string,
  targetGroupId: string,
): ManualGroup[] {
  // Remove person from all groups
  const withoutPerson = groups.map((g) => ({
    ...g,
    personIds: g.personIds.filter((id) => id !== personId),
  }));

  // Add person to target group
  return withoutPerson.map((g) =>
    g.id === targetGroupId
      ? { ...g, personIds: [...g.personIds, personId] }
      : g
  );
}

/**
 * Creates a new group with a single person (drag person to empty area)
 */
export function createGroupWithPerson(
  groups: ManualGroup[],
  personId: string,
): ManualGroup[] {
  // Remove person from all existing groups
  const withoutPerson = groups.map((g) => ({
    ...g,
    personIds: g.personIds.filter((id) => id !== personId),
  }));

  // Create new group with this person
  const newGroup: ManualGroup = {
    id: `group-${Date.now()}`,
    personIds: [personId],
    createdAt: Date.now(),
  };

  return [...withoutPerson, newGroup];
}

/**
 * Create a new group with a person, placing it directly after the source group
 */
export function createGroupAfterSource(
  groups: ManualGroup[],
  personId: string,
  afterGroupId: string,
): ManualGroup[] {
  // Remove person from all existing groups
  const withoutPerson = groups.map((g) => ({
    ...g,
    personIds: g.personIds.filter((id) => id !== personId),
  }));

  // Create new group with this person
  const newGroup: ManualGroup = {
    id: `group-${Date.now()}`,
    personIds: [personId],
    createdAt: Date.now(),
  };

  // Find the index of the source group
  const sourceIndex = withoutPerson.findIndex((g) => g.id === afterGroupId);
  
  if (sourceIndex === -1) {
    // Source group not found, append at end
    return [...withoutPerson, newGroup];
  }

  // Insert new group right after the source group
  const result = [
    ...withoutPerson.slice(0, sourceIndex + 1),
    newGroup,
    ...withoutPerson.slice(sourceIndex + 1),
  ];

  return result;
}

/**
 * Removes empty groups
 */
export function cleanupEmptyGroups(groups: ManualGroup[]): ManualGroup[] {
  return groups.filter((g) => g.personIds.length > 0);
}

/**
 * Removes person IDs that no longer exist in the person list
 */
export function cleanupGroups(
  groups: ManualGroup[],
  validPersonIds: Set<string>,
): ManualGroup[] {
  const cleaned = groups.map((group) => ({
    ...group,
    personIds: group.personIds.filter((id) => validPersonIds.has(id)),
  }));

  return cleanupEmptyGroups(cleaned);
}

/**
 * Converts persons into initial household-based groups
 */
export function convertPersonsToGroups(
  persons: Person[],
  getHouseholdKey: (person: Person) => string,
  getPersonKey: (person: Person, index: number) => string,
): ManualGroup[] {
  const householdMap = new Map<string, string[]>();

  persons.forEach((person, index) => {
    const householdKey = getHouseholdKey(person);
    const personKey = getPersonKey(person, index);

    if (!householdMap.has(householdKey)) {
      householdMap.set(householdKey, []);
    }
    householdMap.get(householdKey)!.push(personKey);
  });

  return Array.from(householdMap.entries()).map(([householdKey, personIds], index) => ({
    id: `household-${householdKey}-${index}`,
    personIds,
    createdAt: Date.now(),
  }));
}

/**
 * Merges stored groups with new household groups
 * - Preserves manually edited groups
 * - Adds new persons from household groups
 * - Removes persons that no longer exist
 */
export function mergeStoredWithHouseholdGroups(
  storedGroups: ManualGroup[],
  householdGroups: ManualGroup[],
  validPersonIds: Set<string>,
): ManualGroup[] {
  // If no stored groups, just use household groups
  if (storedGroups.length === 0) {
    return householdGroups;
  }

  // Clean up stored groups first
  const cleanedStored = cleanupGroups(storedGroups, validPersonIds);

  // Find persons that are in household groups but not in any stored group
  const personsInStored = new Set<string>();
  cleanedStored.forEach((g) => g.personIds.forEach((id) => personsInStored.add(id)));

  const newPersons: string[] = [];
  householdGroups.forEach((g) => {
    g.personIds.forEach((id) => {
      if (validPersonIds.has(id) && !personsInStored.has(id)) {
        newPersons.push(id);
      }
    });
  });

  // If there are no new persons, return cleaned stored groups
  if (newPersons.length === 0) {
    return cleanedStored;
  }

  // For each new person, try to find their household group in householdGroups
  // and check if any member of that household is already in a stored group
  const result = [...cleanedStored];
  const assignedNewPersons = new Set<string>();

  newPersons.forEach((newPersonId) => {
    // Find which household group this person belongs to
    const householdGroup = householdGroups.find((hg) => hg.personIds.includes(newPersonId));
    if (!householdGroup) return;

    // Check if any member of this household is in a stored group
    let foundGroup: ManualGroup | null = null;
    for (const storedGroup of result) {
      const hasHouseholdMember = householdGroup.personIds.some((id) =>
        storedGroup.personIds.includes(id)
      );
      if (hasHouseholdMember) {
        foundGroup = storedGroup;
        break;
      }
    }

    if (foundGroup) {
      // Add the new person to the existing group if not already there
      if (!foundGroup.personIds.includes(newPersonId)) {
        foundGroup.personIds.push(newPersonId);
        assignedNewPersons.add(newPersonId);
      }
    }
  });

  // Create new groups for any remaining unassigned persons
  const unassignedPersons = newPersons.filter((id) => !assignedNewPersons.has(id));
  if (unassignedPersons.length > 0) {
    // Group unassigned persons by household
    const newPersonsByHousehold = new Map<string, string[]>();
    householdGroups.forEach((hg) => {
      const relevantPersons = hg.personIds.filter((id) => unassignedPersons.includes(id));
      if (relevantPersons.length > 0) {
        newPersonsByHousehold.set(hg.id, relevantPersons);
      }
    });

    // Add new groups
    const newGroups: ManualGroup[] = Array.from(newPersonsByHousehold.values()).map((personIds) => ({
      id: `group-${Date.now()}-${Math.random()}`,
      personIds,
      createdAt: Date.now(),
    }));

    result.push(...newGroups);
  }

  return result;
}
