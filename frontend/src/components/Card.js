import React from 'react';

/**
 * Card component for displaying game cards with interactive features
 * @param {Object} card - Card object with id, title, and image properties
 * @param {Function} onClick - Click handler function
 * @param {boolean} selected - Whether the card is currently selected
 * @param {Object} style - Additional styling overrides
 */
function Card({ card, onClick, selected, style = {} }) {
  return (
    <div
      onClick={onClick}
      style={{
        border: selected ? '4px solid #007bff' : '2px solid rgba(255,255,255,0.3)',
        borderRadius: '16px',
        padding: '8px',
        margin: '8px',
        cursor: onClick ? 'pointer' : 'default',
        background: selected ? 'linear-gradient(135deg, #e3f2fd, #bbdefb)' : 'rgba(255,255,255,0.95)',
        transition: 'all 0.3s ease',
        boxShadow: selected
          ? '0 12px 24px rgba(0,123,255,0.3)'
          : '0 8px 16px rgba(0,0,0,0.15)',
        backdropFilter: 'blur(10px)',
        ...style
      }}
      onMouseOver={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'scale(1.08) translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 16px 32px rgba(0,0,0,0.25)';
        }
      }}
      onMouseOut={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = selected ? 'scale(1.05)' : 'scale(1)';
          e.currentTarget.style.boxShadow = selected
            ? '0 12px 24px rgba(0,123,255,0.3)'
            : '0 8px 16px rgba(0,0,0,0.15)';
        }
      }}
    >
      <img
        src={`/${card.image}`}
        alt={card.title || `Card ${card.id}`}
        style={{
          width: '250px',
          height: '200px',
          objectFit: 'cover',
          borderRadius: '12px',
          display: 'block',
          filter: selected ? 'brightness(1.1) contrast(1.1)' : 'brightness(1)',
          transition: 'filter 0.3s ease'
        }}
        onError={(e) => {
          // Fallback image if card image fails to load
          e.target.src = `https://placehold.co/250x200/cccccc/666666?text=Card+${card.id}`;
        }}
      />
    </div>
  );
}

export default Card;
