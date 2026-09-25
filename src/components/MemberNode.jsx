import './MemberNode.css';

export function getInitials(person) {
  return person.lastName
    ? `${person.name.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase()
    : person.name.substring(0, 2).toUpperCase();
}

export function MemberNode({ data, isSelected, onClick }) {
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(e);
    }
  };

  return (
    <div
      className={`member-node glass ${isSelected ? 'selected' : ''} ${data.gender === 'female' ? 'female' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={[data.name, data.lastName].filter(Boolean).join(' ')}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <div className="avatar-placeholder" aria-hidden="true">
        {getInitials(data)}
      </div>
      <div className="info">
        <div className="name-container">
          <span className="first-name">{data.name}</span>
          {data.lastName && <span className="last-name">{data.lastName}</span>}
        </div>
      </div>
    </div>
  );
}
