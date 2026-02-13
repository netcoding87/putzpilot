export type HistoryAssignment = {
  date: string; // ISO date string
  members: string[]; // display names
};

export type HistoryYear = {
  year: string;
  assignments: HistoryAssignment[];
};

export type ChronikEntry = {
  name: string;
  dates: string[];
};
