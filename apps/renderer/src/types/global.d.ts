export {};

declare global {
  interface Window {
    putzpilot: {
      version: string;
      churchtools: {
        login: (payload: {
          baseUrl: string;
          username: string;
          password: string;
        }) => Promise<{ success: boolean }>;
        fetchPersons: (baseUrl: string) => Promise<any>;
      };
      selection: {
        get: () => Promise<string[]>;
        set: (selection: string[]) => Promise<{ success: boolean }>;
      };
      settings: {
        get: () => Promise<{
          baseUrl: string;
          username: string;
          password: string;
        } | null>;
        set: (settings: {
          baseUrl: string;
          username: string;
          password: string;
        }) => Promise<{ success: boolean }>;
      };
      groups: {
        get: () => Promise<Array<{
          id: string;
          personIds: string[];
          createdAt: number;
        }>>;
        set: (groups: Array<{
          id: string;
          personIds: string[];
          createdAt: number;
        }>) => Promise<{ success: boolean }>;
      };
      plans: {
        get: () => Promise<Array<{
          id: string;
          startDate: string;
          endDate: string;
          assignments: Array<{
            date: string;
            personIds: string[];
          }>;
          savedAt: number;
        }>>;
        set: (plans: Array<{
          id: string;
          startDate: string;
          endDate: string;
          assignments: Array<{
            date: string;
            personIds: string[];
          }>;
          savedAt: number;
        }>) => Promise<{ success: boolean }>;
      };
    };
  }
}
