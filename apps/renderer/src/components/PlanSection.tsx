import { useState } from 'react';
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
  getPersonKey: (person: Person, fallback: number) => string;
};

function DraggablePersonCell({
  person,
  weekDate,
  personIndex,
  onEdit,
}: {
  person: Person;
  weekDate: string;
  personIndex: number;
  onEdit: () => void;
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
      className={`plan-person-cell ${isOver ? 'drop-target' : ''} ${isDragging ? 'dragging' : ''}`}
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
  getPersonKey,
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

  // Get min date (today)
  const today = new Date().toISOString().split('T')[0];

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <section className="card">
        <h2>Planung</h2>
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
                    {entry.members.map((member, index) => (
                      <DraggablePersonCell
                        key={`${entry.date}-${index}`}
                        person={member}
                        weekDate={entry.date}
                        personIndex={index}
                        onEdit={() => handleEditPerson(entry.date, index)}
                      />
                    ))}
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
}
