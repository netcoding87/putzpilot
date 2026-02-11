import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Store from 'electron-store';
import crypto from 'node:crypto';

// Encryption key (in production, should be derived from OS Keychain or similar)
const ENCRYPTION_KEY = crypto.scryptSync('putzpilot-app-secret', 'salt', 32);
const IV_LENGTH = 16;

const encryptPassword = (password: string): string => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(password, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

const decryptPassword = (encryptedPassword: string): string => {
  const parts = encryptedPassword.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(parts[1], 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');
  return decrypted;
};

const createWindow = () => {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  const preloadPath = devServerUrl
    ? fileURLToPath(new URL('../src/preload.cjs', import.meta.url))
    : fileURLToPath(new URL('./preload.cjs', import.meta.url));

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const iconPath = path.resolve(__dirname, '../../assets/icon.png');

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    webPreferences: {
      preload: preloadPath,
    },
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDesc, url) => {
    console.error('Failed to load', { errorCode, errorDesc, url });
  });

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const rendererPath = path.join(
      process.resourcesPath,
      'renderer',
      'dist',
      'index.html',
    );
    mainWindow.loadFile(rendererPath);
  }
};

type ChurchToolsCredentials = {
  baseUrl: string;
  username: string;
  password: string;
};

let sessionCookies: string | null = null;
const store = new Store<{
  selection: string[];
  settings?: {
    baseUrl: string;
    username: string;
    password: string; // encrypted
  };
}>({
  defaults: {
    selection: [],
  },
});

const normalizeBaseUrl = (url: string) => url.replace(/\/$/, '');

ipcMain.handle('churchtools:login', async (_event, creds: ChurchToolsCredentials) => {
  const baseUrl = normalizeBaseUrl(creds.baseUrl);
  const loginUrl = `${baseUrl}/api/login`;
  const body = new URLSearchParams({
    username: creds.username,
    password: creds.password,
  });

  const doLogin = async (url: string) =>
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      redirect: 'manual',
    });

  let response = await doLogin(loginUrl);
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get('location');
    if (location) {
      const redirected = new URL(location, loginUrl).toString();
      response = await doLogin(redirected);
    }
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Login failed: ${response.status} ${text}`);
  }

  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('Login succeeded, but no session cookie was returned.');
  }

  sessionCookies = setCookie;
  return { success: true };
});

ipcMain.handle('churchtools:persons', async (_event, baseUrl: string) => {
  if (!sessionCookies) {
    throw new Error('Not authenticated');
  }

  const fetchWithSession = async (url: string) => {
    if (!sessionCookies) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(url, {
      headers: {
        Cookie: sessionCookies,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Request failed: ${response.status} ${text}`);
    }

    return response.json();
  };

  const allPersons: any[] = [];
  const limit = 200;
  let page = 1;

  while (true) {
    const url = new URL(`${normalizeBaseUrl(baseUrl)}/api/persons`);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('page', String(page));
    url.searchParams.set('with', 'personStatus,rels');

    const payload = await fetchWithSession(url.toString());
    const chunk = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.persons)
        ? payload.persons
        : Array.isArray(payload)
          ? payload
          : [];

    allPersons.push(...chunk);

    if (chunk.length < limit) {
      break;
    }

    page += 1;
  }

  const extractStatuses = (payload: any) => {
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.statuses)) return payload.statuses;
    if (Array.isArray(payload?.personStatuses)) return payload.personStatuses;
    if (Array.isArray(payload?.data?.personStatuses)) return payload.data.personStatuses;
    if (Array.isArray(payload?.data?.personStatus)) return payload.data.personStatus;
    if (Array.isArray(payload?.data?.statuses)) return payload.data.statuses;
    if (Array.isArray(payload)) return payload;
    return [];
  };

  let statuses: any[] = [];
  const statusEndpoints = ['/api/person/masterdata'];

  for (const endpoint of statusEndpoints) {
    try {
      const statusPayload = await fetchWithSession(
        `${normalizeBaseUrl(baseUrl)}${endpoint}`,
      );
      statuses = extractStatuses(statusPayload);
      if (statuses.length > 0) break;
    } catch {
      // try next endpoint
    }
  }

  const extractRelations = (payload: any) => {
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.relationships)) return payload.relationships;
    if (Array.isArray(payload?.relations)) return payload.relations;
    if (Array.isArray(payload?.data?.data)) return payload.data.data;
    if (Array.isArray(payload)) return payload;
    return [];
  };

  const relationshipEndpoints = [
    '/api/persons/relationships',
    '/api/persons/relations',
    '/api/relationships',
    '/api/relations',
  ];

  let relations: any[] = [];
  for (const endpoint of relationshipEndpoints) {
    try {
      const relPayload = await fetchWithSession(
        `${normalizeBaseUrl(baseUrl)}${endpoint}`,
      );
      relations = extractRelations(relPayload);
      if (relations.length > 0) break;
    } catch {
      // try next endpoint
    }
  }

  if (relations.length > 0) {
    const relsByPerson = new Map<string, any[]>();
    const addRel = (id: string | number | null | undefined, rel: any) => {
      if (id === undefined || id === null) return;
      const key = String(id);
      const existing = relsByPerson.get(key) ?? [];
      relsByPerson.set(key, [...existing, rel]);
    };

    const dedupeKeyForRel = (rel: any) => {
      const id = rel?.id ?? '';
      const a = rel?.personAId ?? rel?.personId ?? rel?.person_id ?? '';
      const b = rel?.personBId ?? rel?.relativeId ?? rel?.related_person_id ?? rel?.relatedPersonId ?? '';
      const type = rel?.relationshipTypeId ?? rel?.relationshipType?.id ?? '';
      return `${id}|${a}|${b}|${type}`;
    };

    const uniqueRelations = new Map<string, any>();
    relations.forEach((rel) => {
      const key = dedupeKeyForRel(rel);
      if (!uniqueRelations.has(key)) {
        uniqueRelations.set(key, rel);
      }
    });

    Array.from(uniqueRelations.values()).forEach((rel) => {
      addRel(rel.personAId, rel);
      addRel(rel.personBId, rel);
      addRel(rel.personId, rel);
      addRel(rel.relativeId, rel);
      addRel(rel.vater_id, rel);
      addRel(rel.kind_id, rel);
      addRel(rel.parentId, rel);
      addRel(rel.childId, rel);
      addRel(rel.fromId, rel);
      addRel(rel.toId, rel);
      addRel(rel.from_id, rel);
      addRel(rel.to_id, rel);
      addRel(rel.person_id, rel);
      addRel(rel.related_person_id, rel);
      addRel(rel.relatedPersonId, rel);
    });

    allPersons.forEach((person) => {
      const personId = person?.id;
      if (personId === undefined || personId === null) return;
      const currentRels = person?.rels;
      if (Array.isArray(currentRels) && currentRels.length > 0) return;
      const rels = relsByPerson.get(String(personId)) ?? [];
      if (rels.length > 0) {
        const deduped = new Map<string, any>();
        rels.forEach((rel) => {
          const key = dedupeKeyForRel(rel);
          if (!deduped.has(key)) {
            deduped.set(key, rel);
          }
        });
        person.rels = Array.from(deduped.values());
      }
    });
  }

  return { data: allPersons, statuses };
});

ipcMain.handle('selection:get', () => {
  return store.get('selection', []);
});

ipcMain.handle('selection:set', (_event, selection: string[]) => {
  store.set('selection', selection);
  return { success: true };
});

ipcMain.handle('settings:get', () => {
  const stored = store.get('settings');
  if (!stored) {
    return null;
  }
  // Decrypt password on retrieval
  return {
    baseUrl: stored.baseUrl,
    username: stored.username,
    password: stored.password ? decryptPassword(stored.password) : '',
  };
});

ipcMain.handle('settings:set', (_event, settings: { baseUrl: string; username: string; password: string }) => {
  const normalizedUrl = normalizeBaseUrl(settings.baseUrl);
  store.set('settings', {
    baseUrl: normalizedUrl,
    username: settings.username,
    password: settings.password ? encryptPassword(settings.password) : '',
  });
  return { success: true };
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
