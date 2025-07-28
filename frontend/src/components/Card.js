import React from 'react';

/**
 * Card-Komponente für das Spiel
 * @param {Object} props.card - Kartenobjekt mit id, title und image
 * @param {function} props.onClick - Klick-Handler für die Karte
 * @param {boolean} props.selected - Ob die Karte ausgewählt ist
 * @param {Object} props.style - Zusätzliche Styling-Optionen
 */
function Card({ card, onClick, selected, style = {} }) {
  const defaultStyle = {
    background: 'white',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
    cursor: onClick ? 'pointer' : 'default',
    transition: 'transform 0.2s, box-shadow 0.2s',
    position: 'relative',
    width: '100%',
    maxWidth: '200px',  // Begrenzte maximale Breite
    height: 'auto',
    display: 'flex',
    flexDirection: 'column'
  };

  const combinedStyle = { ...defaultStyle, ...style };

  const imageStyle = {
    width: '100%',
    height: '150px',  // Feste Höhe für alle Bilder
    objectFit: 'cover',
    display: 'block',
    aspectRation: '4/3'
  };

  return (
    <div
      style={combinedStyle}
      onClick={onClick}
      className={selected ? 'card-selected' : ''}
    >
      <img
        src={card.image}
        alt={card.title}
        style={imageStyle}
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = "https://placehold.co/300x200?text=Bild+nicht+gefunden";
        }}
      />
      {card.title && (
        <div style={{
          padding: '8px 12px',
          fontSize: '14px',
          textAlign: 'center',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis'
        }}>
          {card.title}
        </div>
      )}
    </div>
  );
}

export default Card;
