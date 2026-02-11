import '@testing-library/jest-dom/vitest';
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

const server = setupServer(...handlers);

let settingsStore: { baseUrl: string; username: string; password: string } | null = {
  baseUrl: 'https://cgpb.church.tools',
  username: 'test.user@example.com',
  password: 'secret',
};

let selectionStore: string[] = [];

const buildApi = () => ({
  version: 'test',
  churchtools: {
    login: async (payload: { baseUrl: string; username: string; password: string }) => {
      const response = await fetch(`${payload.baseUrl}/api/login`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Login failed');
      }
      return { success: true };
    },
    fetchPersons: async (baseUrl: string) => {
      const response = await fetch(`${baseUrl}/api/persons`);
      if (!response.ok) {
        throw new Error('Failed to fetch persons');
      }
      return response.json();
    },
  },
  selection: {
    get: async () => selectionStore,
    set: async (selection: string[]) => {
      selectionStore = selection;
      return { success: true };
    },
  },
  settings: {
    get: async () => settingsStore,
    set: async (settings: { baseUrl: string; username: string; password: string }) => {
      settingsStore = settings;
      return { success: true };
    },
  },
});

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

beforeEach(() => {
  selectionStore = [];
  settingsStore = {
    baseUrl: 'https://cgpb.church.tools',
    username: 'test.user@example.com',
    password: 'secret',
  };
  (globalThis as any).putzpilot = buildApi();
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
