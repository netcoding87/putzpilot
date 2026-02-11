import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PersonsSection from './PersonsSection';
import type { Person } from '../types/people';

describe('PersonsSection', () => {
  const person: Person = { id: 1, firstName: 'Anna', lastName: 'Meyer' };

  it('shows load button when no persons are loaded', async () => {
    const user = userEvent.setup();
    const onLoadPersons = vi.fn();

    render(
      <PersonsSection
        persons={[]}
        statuses={[]}
        selectedIds={new Set()}
        loading={false}
        error={null}
        groupButtons={['Alle']}
        currentActiveGroup="Alle"
        groupCounts={{}}
        visiblePersons={[]}
        activeGroups={[]}
        query=""
        onQueryChange={vi.fn()}
        onLoadPersons={onLoadPersons}
        onToggleSelection={vi.fn()}
        getPersonKey={(value) => String(value.id ?? '0')}
        getStatus={() => 'status.member'}
        getAgeValue={() => 30}
        onSetActiveGroup={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /personen laden/i }));
    expect(onLoadPersons).toHaveBeenCalledTimes(1);
  });

  it('renders checkboxes based on selection state', () => {
    render(
      <PersonsSection
        persons={[person]}
        statuses={[]}
        selectedIds={new Set(['1'])}
        loading={false}
        error={null}
        groupButtons={['Alle']}
        currentActiveGroup="Alle"
        groupCounts={{ Alle: 1 }}
        visiblePersons={[person]}
        activeGroups={[]}
        query=""
        onQueryChange={vi.fn()}
        onLoadPersons={vi.fn()}
        onToggleSelection={vi.fn()}
        getPersonKey={(value) => String(value.id ?? '0')}
        getStatus={() => 'status.member'}
        getAgeValue={() => 30}
        onSetActiveGroup={vi.fn()}
      />,
    );

    expect(screen.getByRole('checkbox')).toBeChecked();
  });
});
