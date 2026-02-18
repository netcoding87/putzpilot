import { useEffect, useMemo, useState } from 'react';
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
  const [printStartDate, setPrintStartDate] = useState('');
  const [printEndDate, setPrintEndDate] = useState('');

  useEffect(() => {
    if (historyYears.length === 0) return;
    const latestYear = historyYears[historyYears.length - 1].year;
    const exists = activeHistoryYear && historyYears.some((year) => year.year === activeHistoryYear);
    if (!exists) {
      setActiveHistoryYear(latestYear);
    }
  }, [activeHistoryYear, historyYears]);

  const formatDateInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const addMonths = (value: string, months: number) => {
    if (!value) return '';
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    date.setMonth(date.getMonth() + months);
    return formatDateInput(date);
  };

  const allHistoryAssignments = useMemo(
    () =>
      historyYears
        .flatMap((year) => year.assignments)
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date)),
    [historyYears],
  );

  useEffect(() => {
    if (!activeHistoryYear) return;
    const selectedYear = historyYears.find((year) => year.year === activeHistoryYear);
    const yearAssignments = selectedYear?.assignments ?? [];
    if (yearAssignments.length === 0) return;

    const startDate = yearAssignments[0].date;
    const yearEndDate = yearAssignments[yearAssignments.length - 1].date;
    const maxEnd = addMonths(startDate, 4);
    const endDate = maxEnd && yearEndDate > maxEnd ? maxEnd : yearEndDate;

    setPrintStartDate(startDate);
    setPrintEndDate(endDate);
  }, [activeHistoryYear, historyYears]);

  const maxPrintEndDate = useMemo(() => {
    if (allHistoryAssignments.length === 0) return '';
    const lastAvailable = allHistoryAssignments[allHistoryAssignments.length - 1].date;
    if (!printStartDate) return lastAvailable;
    const limit = addMonths(printStartDate, 4);
    if (!limit) return lastAvailable;
    return limit < lastAvailable ? limit : lastAvailable;
  }, [allHistoryAssignments, printStartDate]);

  useEffect(() => {
    if (!printEndDate || !maxPrintEndDate) return;
    if (printEndDate > maxPrintEndDate) {
      setPrintEndDate(maxPrintEndDate);
    }
  }, [maxPrintEndDate, printEndDate]);

  const printAssignments = useMemo(
    () =>
      allHistoryAssignments.filter((assignment) => {
        if (printStartDate && assignment.date < printStartDate) return false;
        if (printEndDate && assignment.date > printEndDate) return false;
        return true;
      }),
    [allHistoryAssignments, printEndDate, printStartDate],
  );

  const formatMonthYear = (value: string) => {
    if (!value) return '';
    const date = new Date(`${value}T00:00:00`);
    return date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  };

  const formatShortDate = (value: string) => {
    if (!value) return '';
    const date = new Date(`${value}T00:00:00`);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  };

  const openPrintPreview = () => {
    if (printAssignments.length === 0) return;
    const startYear = printStartDate ? printStartDate.slice(0, 4) : '';
    const endYear = printEndDate ? printEndDate.slice(0, 4) : '';
    const titleYear = startYear && endYear && startYear !== endYear
      ? `${startYear}-${endYear}`
      : startYear || endYear;
    const title = titleYear ? `Putzplan ${titleYear}` : 'Putzplan';

    const monthGroups: Array<{ key: string; label: string; entries: typeof printAssignments }> = [];
    printAssignments.forEach((entry) => {
      const date = new Date(`${entry.date}T00:00:00`);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('de-DE', { month: 'long' });
      const existing = monthGroups.find((group) => group.key === key);
      if (existing) {
        existing.entries.push(entry);
      } else {
        monthGroups.push({ key, label, entries: [entry] });
      }
    });

    const rowsHtml = monthGroups
      .map((group) => {
        const rows = group.entries
          .map((entry) => {
            const dateLabel = formatShortDate(entry.date);
            const firstRowCells = Array.from({ length: 5 })
              .map((_, colIndex) => {
                const member = entry.members[colIndex];
                const text = member ? String(member) : '';
                return `<td class="name-cell">${text}</td>`;
              })
              .join('');
            const secondRowCells = Array.from({ length: 5 })
              .map((_, colIndex) => {
                const member = entry.members[colIndex + 5];
                const text = member ? String(member) : '';
                return `<td class="name-cell">${text}</td>`;
              })
              .join('');
            return `
              <tbody class="week-group">
                <tr>
                  <td class="date-cell" rowspan="2">${dateLabel}</td>
                  ${firstRowCells}
                </tr>
                <tr>
                  ${secondRowCells}
                </tr>
              </tbody>
            `;
          })
          .join('');
        return `
          <table class="month-table">
            <colgroup>
              <col class="date-col" />
              <col class="name-col" />
              <col class="name-col" />
              <col class="name-col" />
              <col class="name-col" />
              <col class="name-col" />
            </colgroup>
            <thead>
              <tr class="month-header"><th colspan="6">${group.label}</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        `;
      })
      .join('');

    const html = `
      <!DOCTYPE html>
      <html lang="de">
        <head>
          <meta charset="UTF-8" />
          <title>${title}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 24px;
              color: #000;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            h1 { margin: 0 0 16px; font-size: 20px; text-align: center; }
            .toolbar { margin: 0 0 16px; }
            .toolbar button { padding: 8px 12px; font-size: 14px; }
            .month-table { width: 100%; border-collapse: collapse; margin: 0 0 12px; table-layout: fixed; }
            .month-header th {
              background: #f5df90;
              text-align: left;
              padding: 6px 8px;
              border: 1px solid #000;
              font-size: 14px;
            }
            td { border: 1px solid #000; padding: 4px 6px; font-size: 12px; }
            .week-group { break-inside: avoid; page-break-inside: avoid; }
            .week-group tr { break-inside: avoid; page-break-inside: avoid; }
            .date-col { width: 80px; }
            .name-col { width: calc((100% - 80px) / 5); }
            .date-cell {
              width: 80px;
              min-width: 80px;
              max-width: 80px;
              text-align: center;
              font-weight: 600;
              white-space: nowrap;
            }
            .name-cell { width: calc((100% - 80px) / 5); }
            @media print {
              .toolbar { display: none; }
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <div class="toolbar">
            <button onclick="window.print()">Als PDF speichern</button>
          </div>
          <h1>${title}</h1>
          ${rowsHtml}
        </body>
      </html>
    `;

    const preview = window.open('', '_blank', 'width=900,height=800');
    if (!preview) return;
    preview.document.write(html);
    preview.document.close();
  };

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

        <div className="print-controls">
          <label>
            Von
            <input
              type="date"
              value={printStartDate}
              min={allHistoryAssignments[0]?.date}
              max={maxPrintEndDate || undefined}
              onChange={(event) => setPrintStartDate(event.target.value)}
            />
          </label>
          <label>
            Bis
            <input
              type="date"
              value={printEndDate}
              min={printStartDate || undefined}
              max={maxPrintEndDate || undefined}
              onChange={(event) => setPrintEndDate(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn-primary"
            onClick={openPrintPreview}
            disabled={printAssignments.length === 0}
          >
            Export to PDF
          </button>
        </div>

        <div className="print-area">
          <div className="print-header">
            <h1>
              Putzplan ({formatMonthYear(printStartDate)} - {formatMonthYear(printEndDate)})
            </h1>
          </div>
          <div className="print-list">
            {printAssignments.map((entry) => (
              <div key={`print-${entry.date}`} className="print-entry">
                <h3>
                  {new Date(`${entry.date}T00:00:00`).toLocaleDateString('de-DE', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </h3>
                <table className="plan-table">
                  <tbody>
                    {[entry.members.slice(0, 5), entry.members.slice(5, 10)].map((row, rowIndex) => (
                      <tr key={`print-${entry.date}-row-${rowIndex}`}>
                        {Array.from({ length: 5 }).map((_, colIndex) => {
                          const member = row[colIndex];
                          return (
                            <td key={`print-${entry.date}-${rowIndex}-${colIndex}`}>
                              {member ?? ''}
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
