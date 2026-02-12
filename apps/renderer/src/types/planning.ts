import type { Person } from './people';

/**
 * A single week assignment in a plan
 */
export type WeekAssignment = {
  date: string; // ISO date string (YYYY-MM-DD) - Saturday of the week
  personIds: string[]; // IDs of assigned persons (max 10)
};

/**
 * A saved plan covering a date range
 */
export type SavedPlan = {
  id: string; // Unique plan ID
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  assignments: WeekAssignment[];
  savedAt: number; // Timestamp
};

/**
 * Plan history - collection of saved plans
 */
export type PlanHistory = {
  plans: SavedPlan[];
};

/**
 * Assignment entry with full person objects (for UI display)
 */
export type PlanEntry = {
  date: string;
  members: Person[];
};

/**
 * Result of building a plan
 */
export type BuildPlanResult = {
  assignments: PlanEntry[];
  error?: string;
};

/**
 * Parameters for building a plan
 */
export type BuildPlanParams = {
  startDate: string;
  endDate: string;
  selectedPersons: Person[];
  manualGroups?: import('./groups').ManualGroup[];
  history?: PlanHistory; // Plan history for fair distribution
  getHouseholdKey: (person: Person) => string | null;
  getPersonKey: (person: Person, fallback: number) => string;
  random?: () => number;
};
