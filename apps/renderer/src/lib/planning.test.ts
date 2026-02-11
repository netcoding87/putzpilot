import { buildPlan } from './planning';
import type { Person } from '../types/people';

describe('buildPlan', () => {
  const getHouseholdKey = () => null;
  const getPersonKey = (person: Person) => String(person.id ?? '');

  it('groups related persons into the same assignment', () => {
    const anna: Person = {
      id: 1,
      firstName: 'Anna',
      lastName: 'Meyer',
      rels: [{ personAId: 1, personBId: 2 }],
    };
    const ben: Person = {
      id: 2,
      firstName: 'Ben',
      lastName: 'Meyer',
      rels: [{ personAId: 1, personBId: 2 }],
    };

    const { assignments, error } = buildPlan({
      startDate: '2026-02-07',
      endDate: '2026-02-07',
      selectedPersons: [anna, ben],
      getHouseholdKey,
      getPersonKey,
      random: () => 0.1,
    });

    expect(error).toBeUndefined();
    expect(assignments).toHaveLength(1);
    const members = assignments[0].members;
    expect(members).toEqual(expect.arrayContaining([anna, ben]));
  });

  it('returns error when no members are selected', () => {
    const { assignments, error } = buildPlan({
      startDate: '2026-02-07',
      endDate: '2026-02-07',
      selectedPersons: [],
      getHouseholdKey,
      getPersonKey,
    });

    expect(assignments).toHaveLength(0);
    expect(error).toBe('Keine ausgewählten Mitglieder verfügbar.');
  });
});
