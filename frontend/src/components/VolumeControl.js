import React, { useState, useRef, useEffect } from 'react';

/**
 * Interaktiver Lautstärkeregler mit kippbarem Balken
 * @param {number} props.volume - Aktuelle Lautstärke (0 bis 1)
 * @param {function} props.onChange - Callback für Lautstärkeänderungen
 */
function VolumeControl({ volume = 0.7, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [rotationAngle, setRotationAngle] = useState(() => volume * 90 - 45); // -45° (stumm) bis +45° (max)
  const [showEmoji, setShowEmoji] = useState(false);
  const containerRef = useRef(null);
  const barRef = useRef(null);

  // Emoji basierend auf Lautstärke auswählen
  const getVolumeEmoji = () => {
    if (volume <= 0.1) return '🔇';
    if (volume <= 0.4) return '🔈';
    if (volume <= 0.7) return '🔉';
    return '🔊';
  };

  // Animiertes Emoji bei Lautstärkeänderung zeigen
  useEffect(() => {
    if (isDragging) {
      setShowEmoji(true);
      const timeout = setTimeout(() => setShowEmoji(false), 800);
      return () => clearTimeout(timeout);
    }
  }, [volume, isDragging]);

  // Winkel in Lautstärke umwandeln und umgekehrt
  const angleToVolume = (angle) => {
    const normalized = (angle + 45) / 90; // -45° bis +45° auf 0-1 normalisieren
    return Math.max(0, Math.min(1, normalized)); // Auf 0-1 beschränken
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleMouseUp);
    e.preventDefault();
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleMouseUp);
  };

  const handleTouchMove = (e) => {
    if (isDragging && e.touches && e.touches[0]) {
      handleVolumeChange(e.touches[0].clientY);
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      handleVolumeChange(e.clientY);
    }
  };

  const handleVolumeChange = (clientY) => {
    if (!barRef.current || !containerRef.current) return;

    // Position des Balkens
    const barRect = barRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    // Y-Position der Mitte des Balkens
    const barCenterY = barRect.top + barRect.height / 2;

    // Relative Position der Maus zum Balken (negative = über dem Balken)
    const relativePosition = clientY - barCenterY;

    // Normalisieren auf Balkengröße und in Winkel umwandeln
    const sensitivity = 1.5; // Empfindlichkeit der Neigung
    const maxAngle = 45; // Maximaler Neigungswinkel
    let newAngle = relativePosition / (barRect.height / 2) * maxAngle * sensitivity;

    // Begrenze den Winkel auf -45° bis +45°
    newAngle = Math.max(-maxAngle, Math.min(maxAngle, newAngle));

    setRotationAngle(newAngle);

    // Berechne neue Lautstärke (0-1) und rufe onChange auf
    const newVolume = angleToVolume(newAngle);
    onChange(newVolume);
  };

  // Balken-Farbe basierend auf Lautstärke
  const getBarColor = () => {
    if (volume <= 0.1) return '#dc3545'; // rot bei stumm
    if (volume <= 0.4) return '#ffc107'; // gelb bei leise
    if (volume <= 0.7) return '#28a745'; // grün bei mittel
    return '#007bff'; // blau bei laut
  };

  return (
    <div style={{
      position: 'relative',
      width: '40px',
      height: '40px',
      cursor: 'pointer',
    }}>
      {/* Hauptbutton */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(255,255,255,0.2)',
          backdropFilter: 'blur(5px)',
          color: 'white',
          fontSize: '20px',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          outline: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
        onMouseOver={(e) => e.target.style.transform = 'scale(1.1)'}
        onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
      >
        {getVolumeEmoji()}
      </button>

      {/* Emoji-Popup zur Anzeige bei Änderungen */}
      {showEmoji && (
        <div style={{
          position: 'absolute',
          top: '-50px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)',
          padding: '8px',
          borderRadius: '8px',
          animation: 'fadeInOut 0.8s',
          fontSize: '24px',
          zIndex: 100,
        }}>
          {getVolumeEmoji()}
        </div>
      )}

      {/* Kippbarer Lautstärke-Slider */}
      {isOpen && (
        <div
          ref={containerRef}
          style={{
            position: 'absolute',
            bottom: '50px',
            left: 'calc(50% - 20px)',
            width: '40px',
            height: '150px',
            background: 'rgba(0,0,0,0.7)',
            borderRadius: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '10px 0',
            animation: 'fadeIn 0.3s',
            zIndex: 10,
          }}
        >
          {/* Lautstärke-Prozent Anzeige */}
          <div style={{
            color: 'white',
            fontSize: '12px',
            fontWeight: 'bold',
            position: 'absolute',
            top: '10px',
            textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
          }}>
            {Math.round(volume * 100)}%
          </div>

          {/* Anleitung */}
          <div style={{
            color: 'white',
            fontSize: '10px',
            opacity: 0.8,
            position: 'absolute',
            bottom: '8px',
            textAlign: 'center',
            padding: '0 5px',
            whiteSpace: 'nowrap',
          }}>
            Balken neigen!
          </div>

          {/* Der kippbare Balken */}
          <div
            ref={barRef}
            style={{
              width: '8px',
              height: '80px',
              background: getBarColor(),
              borderRadius: '4px',
              cursor: 'grab',
              transition: isDragging ? 'none' : 'transform 0.2s, background-color 0.2s',
              transform: `rotate(${rotationAngle}deg)`,
              transformOrigin: 'center',
              boxShadow: '0 0 10px rgba(0,0,0,0.3)',
            }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown}
          />

          {/* Markierungen */}
          <div style={{
            width: '30px',
            height: '1px',
            background: 'rgba(255,255,255,0.5)',
            position: 'absolute',
            top: '40%',
            left: '5px',
          }} />
          <div style={{
            width: '30px',
            height: '1px',
            background: 'rgba(255,255,255,0.5)',
            position: 'absolute',
            bottom: '40%',
            left: '5px',
          }} />
        </div>
      )}

      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes fadeInOut {
            0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
            20% { opacity: 1; transform: translateX(-50%) translateY(0); }
            80% { opacity: 1; transform: translateX(-50%) translateY(0); }
            100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          }
        `}
      </style>
    </div>
  );
}

export default VolumeControl;

