import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MainHeader from './MainHeader';

describe('MainHeader', () => {
  it('calls onOpenSettings when settings button is clicked', async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();
    const onThemeChange = vi.fn();

    render(
      <MainHeader
        onOpenSettings={onOpenSettings}
        theme="dark"
        onThemeChange={onThemeChange}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Putz Pilot' })).toBeInTheDocument();
    expect(screen.getByText('Wochenplanung für den Putzdienst.')).toBeInTheDocument();

    await user.click(screen.getByTitle('Einstellungen'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
