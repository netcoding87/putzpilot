export type ChurchToolsCredentials = {
  baseUrl: string;
  username: string;
  password: string;
};

export type ChurchToolsMember = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  householdId?: string;
  teamIds?: string[];
};
