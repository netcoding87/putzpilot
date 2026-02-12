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
    };
  }
}

export {};
