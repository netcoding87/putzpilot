import { useState, useMemo } from 'react';
import type { Person } from '../types/people';

type PersonSelectorModalProps = {
  persons: Person[];
  onSelect: (person: Person) => void;
  onClose: () => void;
  currentPerson?: Person;
};

export default function PersonSelectorModal({
  persons,
  onSelect,
  onClose,
  currentPerson,
}: PersonSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPersons = useMemo(() => {
    if (!searchQuery.trim()) {
      return persons;
    }

    const query = searchQuery.toLowerCase();
    return persons.filter((person) => {
      const fullName = `${person.firstName ?? ''} ${person.lastName ?? ''}`.toLowerCase();
      const email = (person.email ?? '').toLowerCase();
      return fullName.includes(query) || email.includes(query);
    });
  }, [persons, searchQuery]);

  const handlePersonClick = (person: Person) => {
    onSelect(person);
    onClose();
  };

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Close on Escape key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div 
      className="modal-backdrop" 
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="modal-content">
        <div className="modal-header">
          <h2 id="modal-title">Person auswählen</h2>
          <button 
            type="button" 
            className="modal-close" 
            onClick={onClose}
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-search">
            <input
              type="text"
              placeholder="Nach Name oder E-Mail suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              autoFocus
            />
          </div>

          {currentPerson && (
            <div className="current-person-info">
              <span className="label">Aktuell:</span>
              <span className="name">{currentPerson.firstName} {currentPerson.lastName}</span>
            </div>
          )}

          <div className="person-list">
            {filteredPersons.length > 0 ? (
              filteredPersons.map((person, index) => (
                <button
                  key={`${person.id}-${index}`}
                  type="button"
                  className="person-list-item"
                  onClick={() => handlePersonClick(person)}
                >
                  <span className="person-name">
                    {person.firstName} {person.lastName}
                  </span>
                  {person.email && (
                    <span className="person-email">{person.email}</span>
                  )}
                </button>
              ))
            ) : (
              <div className="no-results">
                <p>Keine Personen gefunden.</p>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
