import type { Person } from '../types/people';

type PlanSectionProps = {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onGeneratePlan: () => void;
  selectedCount: number;
  plan: Array<{ date: string; members: Person[] }>;
};

export default function PlanSection({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onGeneratePlan,
  selectedCount,
  plan,
}: PlanSectionProps) {
  return (
    <section className="card">
      <h2>Planung</h2>
      <div className="planning">
        <label>
          Startdatum
          <input
            type="date"
            value={startDate}
            onChange={(event) => onStartDateChange(event.target.value)}
          />
        </label>
        <label>
          Enddatum
          <input
            type="date"
            value={endDate}
            onChange={(event) => onEndDateChange(event.target.value)}
          />
        </label>
        <button type="button" onClick={onGeneratePlan} disabled={selectedCount === 0}>
          Plan generieren
        </button>
        <p>{selectedCount} ausgewählte Mitglieder</p>
      </div>
      {plan.length > 0 ? (
        <div className="plan-list">
          {plan.map((entry) => (
            <div key={entry.date} className="plan-entry">
              <h3>{entry.date}</h3>
              <table className="plan-table">
                <tbody>
                  {[entry.members.slice(0, 5), entry.members.slice(5, 10)].map((row, rowIndex) => (
                    <tr key={`${entry.date}-row-${rowIndex}`}>
                      {Array.from({ length: 5 }).map((_, colIndex) => {
                        const member = row[colIndex];
                        return (
                          <td key={`${entry.date}-${rowIndex}-${colIndex}`}>
                            {member ? `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim() : ''}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ) : (
        <p>Keine Planung generiert.</p>
      )}
    </section>
  );
}
