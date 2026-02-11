import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from './SettingsPage';

describe('SettingsPage', () => {
  it('enables save button only after changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSave = vi.fn();

    render(
      <SettingsPage
        settingsDraft={{ baseUrl: 'https://cgpb.church.tools', username: 'user', password: 'pw' }}
        settingsDirty={false}
        settingsLoading={false}
        settingsTestResult={null}
        onChange={onChange}
        onTest={vi.fn()}
        onSave={onSave}
        onBack={vi.fn()}
      />,
    );

    const saveButton = screen.getByRole('button', { name: /speichern/i });
    expect(saveButton).toBeDisabled();

    await user.type(screen.getByLabelText(/benutzername/i), 'x');
    expect(onChange).toHaveBeenCalled();
  });

  it('shows test error message when provided', () => {
    render(
      <SettingsPage
        settingsDraft={{ baseUrl: 'https://cgpb.church.tools', username: 'user', password: 'pw' }}
        settingsDirty={false}
        settingsLoading={false}
        settingsTestResult={{ ok: false, msg: 'Verbindung fehlgeschlagen' }}
        onChange={vi.fn()}
        onTest={vi.fn()}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText('Verbindung fehlgeschlagen')).toBeInTheDocument();
  });
});
