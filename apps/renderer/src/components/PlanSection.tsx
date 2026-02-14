import { useEffect, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import type { Person } from '../types/people';
import type { ChronikEntry, HistoryYear } from '../types/history';
import PersonSelectorModal from './PersonSelectorModal';

type PlanSectionProps = {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onGeneratePlan: () => void;
  selectedCount: number;
  plan: Array<{ date: string; members: Person[] }>;
  allPersons: Person[]; // All available persons for editing
  onSwapPersons: (weekDate1: string, personIndex1: number, weekDate2: string, personIndex2: number) => void;
  onReplacePerson: (weekDate: string, personIndex: number, newPerson: Person) => void;
  onSavePlan: () => void;
  hasUnsavedChanges: boolean;
  mode: 'planning' | 'history' | 'chronik';
  onModeChange: (mode: 'planning' | 'history' | 'chronik') => void;
  historyYears: HistoryYear[];
  chronikEntries: ChronikEntry[];
};

function DraggablePersonCell({
  person,
  weekDate,
  personIndex,
  onEdit,
  isDuplicate,
}: {
  person: Person;
  weekDate: string;
  personIndex: number;
  onEdit: () => void;
  isDuplicate: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `person-${weekDate}-${personIndex}`,
    data: { type: 'person', weekDate, personIndex, person },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${weekDate}-${personIndex}`,
    data: { type: 'person', weekDate, personIndex },
  });

  // Combine refs
  const combinedRef = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    setDropRef(node);
  };

  return (
    <div
      ref={combinedRef}
      className={`plan-person-cell ${isDuplicate ? 'duplicate' : ''} ${isOver ? 'drop-target' : ''} ${isDragging ? 'dragging' : ''}`}
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <span className="person-name">
        {person.firstName} {person.lastName}
      </span>
      <button
        type="button"
        className="edit-person-btn"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        title="Person ändern"
      >
        ✏️
      </button>
    </div>
  );
}

export default function PlanSection({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onGeneratePlan,
  selectedCount,
  plan,
  allPersons,
  onSwapPersons,
  onReplacePerson,
  onSavePlan,
  hasUnsavedChanges,
  mode,
  onModeChange,
  historyYears,
  chronikEntries,
}: PlanSectionProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activePerson, setActivePerson] = useState<Person | null>(null);
  const [editingPosition, setEditingPosition] = useState<{ weekDate: string; personIndex: number } | null>(null);
  const [activeHistoryYear, setActiveHistoryYear] = useState<string | null>(null);
  const [historyQuery, setHistoryQuery] = useState('');
  const [chronikQuery, setChronikQuery] = useState('');

  useEffect(() => {
    if (historyYears.length === 0) return;
    const latestYear = historyYears[historyYears.length - 1].year;
    const exists = activeHistoryYear && historyYears.some((year) => year.year === activeHistoryYear);
    if (!exists) {
      setActiveHistoryYear(latestYear);
    }
  }, [activeHistoryYear, historyYears]);

  const handleDragStart = (event: DragStartEvent) => {
    const { data } = event.active;
    if (data?.current?.type === 'person') {
      setActiveId(event.active.id as string);
      setActivePerson(data.current.person as Person);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      setActivePerson(null);
      return;
    }

    const activeData = active.data?.current;
    const overData = over.data?.current;

    // Person dragged onto another person - swap them
    if (activeData?.type === 'person' && overData?.type === 'person') {
      const weekDate1 = activeData.weekDate as string;
      const personIndex1 = activeData.personIndex as number;
      const weekDate2 = overData.weekDate as string;
      const personIndex2 = overData.personIndex as number;

      if (weekDate1 !== weekDate2 || personIndex1 !== personIndex2) {
        onSwapPersons(weekDate1, personIndex1, weekDate2, personIndex2);
      }
    }

    setActiveId(null);
    setActivePerson(null);
  };

  const handleEditPerson = (weekDate: string, personIndex: number) => {
    setEditingPosition({ weekDate, personIndex });
  };

  const handleSelectPerson = (newPerson: Person) => {
    if (editingPosition) {
      onReplacePerson(editingPosition.weekDate, editingPosition.personIndex, newPerson);
      setEditingPosition(null);
    }
  };

  const handleCloseModal = () => {
    setEditingPosition(null);
  };

  // Get current editing person
  const currentEditingPerson = editingPosition
    ? plan.find((e) => e.date === editingPosition.weekDate)?.members[editingPosition.personIndex]
    : undefined;

  const getPersonIdentity = (person: Person) => {
    if (person.id !== undefined && person.id !== null) return String(person.id);
    if (person.email) return person.email;
    return `${person.firstName ?? ''}-${person.lastName ?? ''}`.trim();
  };

  // Get min date (today)
  const today = new Date().toISOString().split('T')[0];

  const headerTitle =
    mode === 'planning'
      ? 'Planung'
      : mode === 'history'
        ? 'Vergangene Planungen'
        : 'Putzchronik';

  const renderHeaderActions = () => {
    if (mode === 'planning') {
      return (
        <button
          type="button"
          className="btn-icon"
          onClick={() => onModeChange('history')}
          title="Historie anzeigen"
          aria-label="Historie anzeigen"
        >
          🗂
        </button>
      );
    }

    if (mode === 'history') {
      return (
        <>
          <button
            type="button"
            className="btn-icon"
            onClick={() => onModeChange('chronik')}
            title="Chronik anzeigen"
            aria-label="Chronik anzeigen"
          >
            📜
          </button>
          <button
            type="button"
            className="btn-icon"
            onClick={() => onModeChange('planning')}
            title="Zur Planung"
            aria-label="Zur Planung"
          >
            🗓
          </button>
        </>
      );
    }

    return (
      <>
        <button
          type="button"
          className="btn-icon"
          onClick={() => onModeChange('history')}
          title="Historie anzeigen"
          aria-label="Historie anzeigen"
        >
          🗂
        </button>
        <button
          type="button"
          className="btn-icon"
          onClick={() => onModeChange('planning')}
          title="Zur Planung"
          aria-label="Zur Planung"
        >
          🗓
        </button>
      </>
    );
  };

  const renderHistoryView = () => {
    if (historyYears.length === 0) {
      return <p>Keine Historie vorhanden.</p>;
    }

    const currentYear = historyYears.find((year) => year.year === activeHistoryYear) ?? historyYears[0];

    const normalizedQuery = historyQuery.trim().toLowerCase();
    const filteredAssignments = normalizedQuery
      ? currentYear.assignments.filter((entry) => {
          // Search in date
          const dateMatch = new Date(entry.date)
            .toLocaleDateString('de-DE', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
            .toLowerCase()
            .includes(normalizedQuery);
          
          // Search in members
          const memberMatch = entry.members.some((member) =>
            typeof member === 'string'
              ? member.toLowerCase().includes(normalizedQuery)
              : `${member.firstName ?? ''} ${member.lastName ?? ''}`.toLowerCase().includes(normalizedQuery),
          );
          
          return dateMatch || memberMatch;
        })
      : currentYear.assignments;

    return (
      <>
        <div className="history-year-tabs">
          {historyYears.map((year) => (
            <button
              key={year.year}
              type="button"
              className={`history-year-tab ${year.year === currentYear.year ? 'active' : ''}`}
              onClick={() => setActiveHistoryYear(year.year)}
            >
              {year.year}
            </button>
          ))}
        </div>

        <div className="search">
          <label>
            Suche
            <input
              className="search-input"
              type="text"
              placeholder="Nach Person oder Datum suchen..."
              value={historyQuery}
              onChange={(event) => setHistoryQuery(event.target.value)}
            />
          </label>
        </div>

        <div className="plan-list">
          {filteredAssignments.length > 0 ? (
            filteredAssignments.map((entry) => (
              <div key={entry.date} className="plan-entry">
                <h3>
                  {new Date(entry.date).toLocaleDateString('de-DE', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </h3>
                <table className="plan-table">
                  <tbody>
                    {[entry.members.slice(0, 5), entry.members.slice(5, 10)].map((row, rowIndex) => (
                      <tr key={`${entry.date}-row-${rowIndex}`}>
                        {Array.from({ length: 5 }).map((_, colIndex) => {
                          const member = row[colIndex];
                          return (
                            <td key={`${entry.date}-${rowIndex}-${colIndex}`}>
                              {member ?? ''}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          ) : (
            <p>Keine Treffer gefunden.</p>
          )}
        </div>
      </>
    );
  };

  const renderChronikView = () => {
    if (chronikEntries.length === 0) {
      return <p>Keine Chronikdaten vorhanden.</p>;
    }

    const normalizedQuery = chronikQuery.trim().toLowerCase();
    const filteredChronikEntries = normalizedQuery
      ? chronikEntries.filter((entry) => {
          const nameMatch = entry.name.toLowerCase().includes(normalizedQuery);
          const dateMatch = entry.dates.some((date) => date.toLowerCase().includes(normalizedQuery));
          return nameMatch || dateMatch;
        })
      : chronikEntries;

    return (
      <>
        <div className="search">
          <label>
            Suche
            <input
              className="search-input"
              type="text"
              placeholder="Nach Person oder Datum suchen..."
              value={chronikQuery}
              onChange={(event) => setChronikQuery(event.target.value)}
            />
          </label>
        </div>

        <div className="chronik-list">
          {filteredChronikEntries.length > 0 ? (
            filteredChronikEntries.map((entry) => (
              <div key={entry.name} className="chronik-entry">
                <div className="chronik-name">{entry.name}</div>
                <div className="chronik-dates">
                  {entry.dates.map((date, index) => (
                    <span key={`${entry.name}-${index}`} className="chronik-date">
                      {date}
                    </span>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p>Keine Treffer gefunden.</p>
          )}
        </div>
      </>
    );
  };

  const renderPlanningView = () => (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <section className="card">
        <div className="plan-header">
          <h2>{headerTitle}</h2>
          <div className="plan-header-actions">{renderHeaderActions()}</div>
        </div>
        <div className="planning">
          <label>
            Startdatum
            <input
              type="date"
              value={startDate}
              min={today}
              onChange={(event) => onStartDateChange(event.target.value)}
            />
          </label>
          <label>
            Enddatum
            <input
              type="date"
              value={endDate}
              min={startDate || today}
              onChange={(event) => onEndDateChange(event.target.value)}
            />
          </label>
          <button type="button" onClick={onGeneratePlan} disabled={selectedCount === 0}>
            Plan generieren
          </button>
          <p>{selectedCount} ausgewählte Mitglieder</p>
        </div>
        {plan.length > 0 ? (
          <>
            <div className="plan-list">
              {plan.map((entry) => (
                <div key={entry.date} className="plan-entry">
                  <h3>{new Date(entry.date).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
                  <div className="plan-members-grid">
                    {(() => {
                      const counts = entry.members.reduce<Record<string, number>>((acc, current) => {
                        const key = getPersonIdentity(current);
                        acc[key] = (acc[key] ?? 0) + 1;
                        return acc;
                      }, {});
                      return entry.members.map((member, index) => {
                        const personKey = getPersonIdentity(member);
                        const isDuplicate = (counts[personKey] ?? 0) > 1;
                        return (
                          <DraggablePersonCell
                            key={`${entry.date}-${index}`}
                            person={member}
                            weekDate={entry.date}
                            personIndex={index}
                            onEdit={() => handleEditPerson(entry.date, index)}
                            isDuplicate={isDuplicate}
                          />
                        );
                      });
                    })()}
                  </div>
                </div>
              ))}
            </div>
            <div className="plan-actions">
              <button
                type="button"
                onClick={onSavePlan}
                className="btn-primary"
                disabled={!hasUnsavedChanges}
              >
                {hasUnsavedChanges ? 'Plan speichern' : 'Gespeichert ✓'}
              </button>
            </div>
          </>
        ) : (
          <p>Keine Planung generiert.</p>
        )}
      </section>

      <DragOverlay>
        {activePerson && (
          <div className="plan-person-cell dragging-overlay">
            <span className="person-name">
              {activePerson.firstName} {activePerson.lastName}
            </span>
          </div>
        )}
      </DragOverlay>

      {editingPosition && (
        <PersonSelectorModal
          persons={allPersons}
          currentPerson={currentEditingPerson}
          onSelect={handleSelectPerson}
          onClose={handleCloseModal}
        />
      )}
    </DndContext>
  );

  if (mode === 'planning') {
    return renderPlanningView();
  }

  return (
    <section className="card">
      <div className="plan-header">
        <h2>{headerTitle}</h2>
        <div className="plan-header-actions">{renderHeaderActions()}</div>
      </div>
      {mode === 'history' ? renderHistoryView() : renderChronikView()}
    </section>
  );
}
