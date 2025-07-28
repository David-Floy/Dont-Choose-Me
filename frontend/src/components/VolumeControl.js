import React, { useState } from 'react';

/**
 * Einfacher Lautstärkeregler mit horizontalem Slider
 * @param {number} props.volume - Aktuelle Lautstärke (0 bis 1)
 * @param {function} props.onChange - Callback für Lautstärkeänderungen
 */
function VolumeControl({ volume = 0.7, onChange }) {
  const [isOpen, setIsOpen] = useState(false);

  // Emoji basierend auf Lautstärke auswählen
  const getVolumeEmoji = () => {
    if (volume <= 0.001) return '🔇';
    if (volume <= 0.4) return '🔈';
    if (volume <= 0.7) return '🔉';
    return '🔊';
  };

  const handleSliderChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    onChange(newVolume);
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: '10px'
    }}>
      {/* Horizontaler Slider */}
      {isOpen && (
        <div style={{
          background: 'rgba(0,0,0,0.8)',
          borderRadius: '25px',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          animation: 'slideIn 0.3s ease-out',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          <span style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>
            {Math.round(volume * 100)}%
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={handleSliderChange}
            style={{
              width: '120px',
              height: '6px',
              borderRadius: '3px',
              background: `linear-gradient(to right, #007bff 0%, #007bff ${volume * 100}%, #ddd ${volume * 100}%, #ddd 100%)`,
              outline: 'none',
              cursor: 'pointer',
              WebkitAppearance: 'none',
              MozAppearance: 'none'
            }}
          />
        </div>
      )}

      {/* Volume Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(5px)',
          color: 'white',
          fontSize: '20px',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          outline: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}
        onMouseOver={(e) => {
          e.target.style.transform = 'scale(1.1)';
          e.target.style.background = 'rgba(0,0,0,0.9)';
        }}
        onMouseOut={(e) => {
          e.target.style.transform = 'scale(1)';
          e.target.style.background = 'rgba(0,0,0,0.7)';
        }}
      >
        {getVolumeEmoji()}
      </button>

      <style>
        {`
          @keyframes slideIn {
            from { opacity: 0; transform: translateX(20px); }
            to { opacity: 1; transform: translateX(0); }
          }
          
          input[type="range"]::-webkit-slider-thumb {
            appearance: none;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #007bff;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }
          
          input[type="range"]::-moz-range-thumb {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #007bff;
            cursor: pointer;
            border: none;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }
        `}
      </style>
    </div>
  );
}

export default VolumeControl;

