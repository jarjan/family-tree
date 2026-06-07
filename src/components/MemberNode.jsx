import './MemberNode.css';

export function MemberNode({ data, isSelected, onClick }) {
  // Simple initials generation for placeholder avatar
  const initials = data.lastName 
    ? `${data.name.charAt(0)}${data.lastName.charAt(0)}`.toUpperCase() 
    : data.name.substring(0, 2).toUpperCase();

  return (
    <div 
      className={`member-node glass ${isSelected ? 'selected' : ''} ${data.gender === 'female' ? 'female' : ''}`}
      onClick={onClick}
    >
      <div className="avatar-placeholder">
        {initials}
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
