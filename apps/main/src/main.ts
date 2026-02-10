import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const createWindow = () => {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  const preloadPath = devServerUrl
    ? fileURLToPath(new URL('../src/preload.cjs', import.meta.url))
    : fileURLToPath(new URL('./preload.cjs', import.meta.url));

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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
    url.searchParams.set('with', 'personStatus');

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

  const statusDebug: Array<{ endpoint: string; keys: string[]; count: number; error?: string }> = [];

  for (const endpoint of statusEndpoints) {
    try {
      const statusPayload = await fetchWithSession(
        `${normalizeBaseUrl(baseUrl)}${endpoint}`,
      );
      statuses = extractStatuses(statusPayload);
      statusDebug.push({
        endpoint,
        keys: statusPayload && typeof statusPayload === 'object' ? Object.keys(statusPayload) : [],
        count: statuses.length,
      });
      if (statuses.length > 0) break;
    } catch (err) {
      statusDebug.push({
        endpoint,
        keys: [],
        count: 0,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      // try next endpoint
    }
  }

  return { data: allPersons, statuses };
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
