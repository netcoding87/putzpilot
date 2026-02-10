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
    };
  }
}
