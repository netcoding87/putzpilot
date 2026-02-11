import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MainHeader from './MainHeader';

describe('MainHeader', () => {
  it('calls onOpenSettings when settings button is clicked', async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();

    render(<MainHeader onOpenSettings={onOpenSettings} />);

    expect(screen.getByRole('heading', { name: 'PutzPilot' })).toBeInTheDocument();
    expect(screen.getByText('Wochenplanung für den Putzdienst.')).toBeInTheDocument();

    await user.click(screen.getByTitle('Einstellungen'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
