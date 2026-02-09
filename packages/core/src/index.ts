export type WeeklyPlan = {
  week: string;
  assignments: Array<{ memberId: string; teamId?: string; householdId?: string }>;
};

export type PlanningRules = {
  fairnessWeight: number;
  householdWeight: number;
  teamWeight: number;
};

export const defaultPlanningRules: PlanningRules = {
  fairnessWeight: 1,
  householdWeight: 1,
  teamWeight: 1,
};
