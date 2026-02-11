import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlanSection from './PlanSection';
import type { Person } from '../types/people';

describe('PlanSection', () => {
  it('disables plan button when no members selected', () => {
    render(
      <PlanSection
        startDate="2026-02-07"
        endDate="2026-02-07"
        onStartDateChange={vi.fn()}
        onEndDateChange={vi.fn()}
        onGeneratePlan={vi.fn()}
        selectedCount={0}
        plan={[]}
      />,
    );

    expect(screen.getByRole('button', { name: /plan generieren/i })).toBeDisabled();
  });

  it('calls onGeneratePlan when button is enabled', async () => {
    const user = userEvent.setup();
    const onGeneratePlan = vi.fn();
    const plan: Array<{ date: string; members: Person[] }> = [];

    render(
      <PlanSection
        startDate="2026-02-07"
        endDate="2026-02-07"
        onStartDateChange={vi.fn()}
        onEndDateChange={vi.fn()}
        onGeneratePlan={onGeneratePlan}
        selectedCount={1}
        plan={plan}
      />,
    );

    await user.click(screen.getByRole('button', { name: /plan generieren/i }));
    expect(onGeneratePlan).toHaveBeenCalledTimes(1);
  });
});
