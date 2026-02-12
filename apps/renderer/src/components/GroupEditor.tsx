import { useMemo, useState } from 'react';
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
import type { ManualGroup } from '../types/groups';
import { validateAllGroups, validateGroup } from '../lib/groupManagement';

type GroupEditorProps = {
  groups: ManualGroup[];
  persons: Person[];
  getPersonKey: (person: Person, index: number) => string;
  onMovePerson: (personId: string, targetGroupId: string) => void;
  onMergeGroups: (sourceGroupId: string, targetGroupId: string) => void;
  onCreateGroup: (personId: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

function DraggablePersonChip({ personId, person }: { personId: string; person: Person }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `person-${personId}`,
    data: { type: 'person', personId },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`person-chip ${isDragging ? 'dragging' : ''}`}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      {person.firstName} {person.lastName}
    </div>
  );
}

function DraggableGroupCard({
  group,
  personMap,
}: {
  group: ManualGroup;
  personMap: Map<string, Person>;
}) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `group-${group.id}`,
    data: { type: 'group', groupId: group.id },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-group-${group.id}`,
    data: { type: 'group', groupId: group.id },
  });

  // Combine refs
  const combinedRef = (node: HTMLDivElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  const validation = validateGroup(group);
  const isOverfull = group.personIds.length > 10;

  return (
    <div
      ref={combinedRef}
      className={`group-card ${isOver ? 'drop-target' : ''} ${isDragging ? 'dragging' : ''} ${isOverfull ? 'overfull' : ''}`}
    >
      <div className="group-card-header" {...listeners} {...attributes}>
        <div className="drag-handle">⋮⋮</div>
        <span className={`group-count ${isOverfull ? 'overfull' : ''}`}>{group.personIds.length}/10</span>
      </div>

      <div className="group-members">
        {group.personIds.map((personId) => {
          const person = personMap.get(personId);
          if (!person) return null;
          return <DraggablePersonChip key={personId} personId={personId} person={person} />;
        })}
      </div>

      {!validation.isValid && (
        <div className="group-validation-error">
          <span>⚠️</span>
          <span>Zu viele Mitglieder! Bitte einige Personen in andere Gruppen verschieben.</span>
        </div>
      )}
    </div>
  );
}

function EmptyGroupCard() {
  const { setNodeRef, isOver } = useDroppable({
    id: 'drop-new-group',
    data: { type: 'new-group' },
  });

  return (
    <div
      ref={setNodeRef}
      className={`group-card empty-group ${isOver ? 'drop-target' : ''}`}
    >
      <div className="empty-group-content">
        <span>+</span>
        <p>Person hierher ziehen<br />um neue Gruppe zu erstellen</p>
      </div>
    </div>
  );
}

export default function GroupEditor({
  groups,
  persons,
  getPersonKey,
  onMovePerson,
  onMergeGroups,
  onCreateGroup,
  onSave,
  onCancel,
}: GroupEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'person' | 'group' | null>(null);

  const personMap = useMemo(() => {
    const map = new Map<string, Person>();
    persons.forEach((person, index) => {
      map.set(getPersonKey(person, index), person);
    });
    return map;
  }, [persons, getPersonKey]);

  const validation = validateAllGroups(groups);

  const handleDragStart = (event: DragStartEvent) => {
    const { data } = event.active;
    if (data?.current?.type === 'person') {
      setActiveId(data.current.personId as string);
      setActiveType('person');
    } else if (data?.current?.type === 'group') {
      setActiveId(data.current.groupId as string);
      setActiveType('group');
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      setActiveType(null);
      return;
    }

    const activeData = active.data?.current;
    const overData = over.data?.current;

    // Person dragged onto group
    if (activeData?.type === 'person' && overData?.type === 'group') {
      onMovePerson(activeData.personId as string, overData.groupId as string);
    }
    
    // Person dragged onto new group area
    else if (activeData?.type === 'person' && overData?.type === 'new-group') {
      onCreateGroup(activeData.personId as string);
    }
    
    // Group dragged onto another group
    else if (activeData?.type === 'group' && overData?.type === 'group') {
      const sourceGroupId = activeData.groupId as string;
      const targetGroupId = overData.groupId as string;
      if (sourceGroupId !== targetGroupId) {
        onMergeGroups(sourceGroupId, targetGroupId);
      }
    }

    setActiveId(null);
    setActiveType(null);
  };

  const activePersonObject = activeType === 'person' && activeId ? personMap.get(activeId) : null;
  const activeGroupObject = activeType === 'group' && activeId ? groups.find((g) => g.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <section className="card">
        <div className="group-editor-header">
          <h2>Gruppen bearbeiten</h2>
          <div className="group-editor-actions">
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!validation.isValid}
              className="btn-primary"
            >
              Speichern
            </button>
          </div>
        </div>

        {!validation.isValid && (
          <div className="validation-errors">
            {validation.errors.map((error, index) => (
              <p key={index} className="error">
                ❌ {error}
              </p>
            ))}
          </div>
        )}

        {validation.warnings.length > 0 && (
          <div className="validation-warnings">
            {validation.warnings.map((warning, index) => (
              <p key={index} className="warning">
                ⚠️ {warning}
              </p>
            ))}
          </div>
        )}

        <div className="groups-grid">
          {groups.map((group) => (
            <DraggableGroupCard
              key={group.id}
              group={group}
              personMap={personMap}
            />
          ))}
          <EmptyGroupCard />
        </div>
      </section>

      <DragOverlay>
        {activeType === 'person' && activePersonObject && (
          <div className="person-chip">
            {activePersonObject.firstName} {activePersonObject.lastName}
          </div>
        )}
        {activeType === 'group' && activeGroupObject && (
          <div className="group-card dragging-overlay">
            <div className="group-card-header">
              <div className="drag-handle">⋮⋮</div>
              <span className="group-count">{activeGroupObject.personIds.length}/10</span>
            </div>
            <div className="group-members">
              {activeGroupObject.personIds.map((personId) => {
                const person = personMap.get(personId);
                if (!person) return null;
                return (
                  <div key={personId} className="person-chip">
                    {person.firstName} {person.lastName}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
