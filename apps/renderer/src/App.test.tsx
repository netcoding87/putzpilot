import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('App', () => {
  it('disables plan generation before selection', async () => {
    render(<App />);

    await waitFor(() => {
      const planButton = screen.getByRole('button', { name: /plan generieren/i });
      expect(planButton).toBeDisabled();
    });
  });

  it('shows load button and reveals filters after loading persons', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      const loadButton = screen.getByRole('button', { name: /personen laden/i });
      expect(loadButton).toBeEnabled();
      expect(screen.queryByText('Suche')).toBeNull();
    });

    await user.click(screen.getByRole('button', { name: /personen laden/i }));

    await waitFor(() => {
      expect(screen.getByText('Anna Meyer')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /neu laden/i })).toBeInTheDocument();
    expect(screen.getByText('Suche')).toBeInTheDocument();
  });

  it('renders group buttons after loading persons', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /personen laden/i }));

    await waitFor(() => {
      expect(screen.getByText('Anna Meyer')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /alle/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /status.member/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /status.guest/i })).toBeInTheDocument();
  });

  it('filters persons by search query', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /personen laden/i }));

    await waitFor(() => {
      expect(screen.getByText('Anna Meyer')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /alle/i }));
    await user.type(screen.getByRole('searchbox'), 'clara');

    expect(screen.getByText('Clara Schmidt')).toBeInTheDocument();
    expect(screen.queryByText('Anna Meyer')).toBeNull();
  });

  it('shows settings page and handles connection test error', async () => {
    const user = userEvent.setup();
    (globalThis as any).putzpilot = {
      ...(globalThis as any).putzpilot,
      churchtools: {
        login: async () => {
          throw new Error('Login failed');
        },
        fetchPersons: async () => ({ data: [], statuses: [] }),
      },
    };

    render(<App />);

    await user.click(screen.getByTitle('Einstellungen'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /verbindung testen/i })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: /verbindung testen/i }));

    await waitFor(() => {
      expect(screen.getByText('Login failed')).toBeInTheDocument();
    });
  });

  it('shows error when loading persons without saved settings', async () => {
    const user = userEvent.setup();
    (globalThis as any).putzpilot = {
      ...(globalThis as any).putzpilot,
      settings: {
        get: async () => null,
        set: async () => ({ success: true }),
      },
    };

    render(<App />);

    await user.click(screen.getByRole('button', { name: /personen laden/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Bitte zuerst die ChurchTools-Verbindung in den Einstellungen speichern.'),
      ).toBeInTheDocument();
    });
  });

  it('shows error when fetching persons fails', async () => {
    const user = userEvent.setup();
    (globalThis as any).putzpilot = {
      ...(globalThis as any).putzpilot,
      churchtools: {
        login: async () => ({ success: true }),
        fetchPersons: async () => {
          throw new Error('Fetch failed');
        },
      },
    };

    render(<App />);

    await user.click(screen.getByRole('button', { name: /personen laden/i }));

    await waitFor(() => {
      expect(screen.getByText('Fetch failed')).toBeInTheDocument();
    });
  });
});
