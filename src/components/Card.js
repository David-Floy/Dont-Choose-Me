import React from 'react';

function Card({ card, onClick, selected }) {
  return (
    <div
      style={{
        border: selected ? '2px solid #007bff' : '1px solid #ccc',
        padding: 10,
        margin: 10,
        cursor: 'pointer',
        display: 'inline-block',
        background: '#fff',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}
      onClick={onClick}
    >
      <img src={card.image} alt={card.title} style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 4 }} />
      <div style={{ marginTop: 8, fontWeight: 'bold' }}>{card.title}</div>
    </div>
  );
}

export default Card;

