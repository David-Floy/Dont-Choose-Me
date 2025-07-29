import React, { useState, useEffect } from 'react';
import audioManager from '../utils/AudioManager';

/**
 * Einfacher Lautstärkeregler mit horizontalem Slider und AudioManager Integration
 * @param {number} props.volume - Aktuelle Lautstärke (0 bis 1)
 * @param {function} props.onChange - Callback für Lautstärkeänderungen
 */
function VolumeControl({ volume = 0.03, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [audioStatus, setAudioStatus] = useState(audioManager.getStatus());

  // Synchronisiere mit AudioManager
  useEffect(() => {
    audioManager.setVolume(volume);
  }, [volume]);

  // Aktualisiere Audio-Status periodisch
  useEffect(() => {
    const interval = setInterval(() => {
      setAudioStatus(audioManager.getStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Emoji basierend auf Lautstärke auswählen
  const getVolumeEmoji = () => {
    if (volume <= 0.001) return '🔇';
    if (volume <= 0.4) return '🔈';
    if (volume <= 0.7) return '🔉';
    return '🔊';
  };

  // Lautstärke als Prozentwert für den Slider
  const sliderValue = Math.round(volume * 100);

  const handleSliderChange = (e) => {
    const newVolume = parseInt(e.target.value, 10) / 100;
    onChange(newVolume);
    audioManager.setVolume(newVolume);
  };

  const handleMuteToggle = () => {
    const newVolume = volume > 0 ? 0 : 0.03;
    onChange(newVolume);
    audioManager.setVolume(newVolume);
  };

  const handlePlayPauseToggle = () => {
    audioManager.togglePlayPause();
    setAudioStatus(audioManager.getStatus());
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: window.innerWidth < 768 ? '15px' : '20px',
      right: window.innerWidth < 768 ? '15px' : '20px',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: window.innerWidth < 768 ? '8px' : '10px'
    }}>
      {/* Slider Container */}
      {isOpen && (
        <div style={{
          background: 'rgba(0,0,0,0.9)',
          borderRadius: '25px',
          padding: window.innerWidth < 768 ? '12px 16px' : '15px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: window.innerWidth < 768 ? '12px' : '15px',
          animation: 'slideIn 0.3s ease-out',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          minWidth: window.innerWidth < 768 ? '160px' : '200px',
          maxWidth: window.innerWidth < 480 ? '140px' : 'none'
        }}>
          {/* Audio Status */}
          {audioStatus.currentTrack && (
            <div style={{
              color: 'white',
              fontSize: window.innerWidth < 768 ? '10px' : '12px',
              textAlign: 'center',
              opacity: 0.8,
              marginBottom: '5px'
            }}>
              🎵 {audioStatus.currentTrack.replace('.mp3', '')}
              <br/>
              {audioStatus.isPlaying ? '▶️ Spielt' : '⏸️ Pausiert'}
            </div>
          )}

          {/* Volume Control */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: window.innerWidth < 768 ? '8px' : '12px',
            width: '100%'
          }}>
            <button
              onClick={handleMuteToggle}
              style={{
                background: 'none',
                border: 'none',
                fontSize: window.innerWidth < 768 ? '14px' : '16px',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              {volume > 0 ? '🔊' : '🔇'}
            </button>

            <span style={{
              color: 'white',
              fontSize: window.innerWidth < 768 ? '12px' : '14px',
              fontWeight: 'bold',
              minWidth: window.innerWidth < 768 ? '30px' : '35px'
            }}>
              {sliderValue}%
            </span>

            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={sliderValue}
              onChange={handleSliderChange}
              style={{
                flex: 1,
                height: '6px',
                borderRadius: '3px',
                background: `linear-gradient(to right, #007bff 0%, #007bff ${sliderValue}%, #ddd ${sliderValue}%, #ddd 100%)`,
                outline: 'none',
                cursor: 'pointer',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                minWidth: window.innerWidth < 480 ? '60px' : '80px'
              }}
            />
          </div>

          {/* Music Controls */}
          {audioStatus.currentTrack && (
            <div style={{
              display: 'flex',
              gap: '8px',
              justifyContent: 'center'
            }}>
              <button
                onClick={handlePlayPauseToggle}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '20px',
                  padding: window.innerWidth < 768 ? '4px 8px' : '6px 12px',
                  color: 'white',
                  fontSize: window.innerWidth < 768 ? '10px' : '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.3)';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.2)';
                }}
              >
                {audioStatus.isPlaying ? '⏸️ Pause' : '▶️ Play'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Volume Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: window.innerWidth < 768 ? '45px' : '50px',
          height: window.innerWidth < 768 ? '45px' : '50px',
          borderRadius: '50%',
          border: 'none',
          background: audioStatus.isPlaying
            ? 'rgba(0, 123, 255, 0.8)'
            : 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(5px)',
          color: 'white',
          fontSize: window.innerWidth < 768 ? '18px' : '20px',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          outline: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          position: 'relative'
        }}
        onMouseOver={(e) => {
          e.target.style.transform = 'scale(1.1)';
          e.target.style.background = audioStatus.isPlaying
            ? 'rgba(0, 123, 255, 1)'
            : 'rgba(0,0,0,0.9)';
        }}
        onMouseOut={(e) => {
          e.target.style.transform = 'scale(1)';
          e.target.style.background = audioStatus.isPlaying
            ? 'rgba(0, 123, 255, 0.8)'
            : 'rgba(0,0,0,0.7)';
        }}
      >
        {getVolumeEmoji()}

        {/* Music indicator */}
        {audioStatus.isPlaying && (
          <div style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            width: window.innerWidth < 768 ? '10px' : '12px',
            height: window.innerWidth < 768 ? '10px' : '12px',
            background: '#00c851',
            borderRadius: '50%',
            border: '2px solid white',
            animation: 'pulse 2s infinite'
          }}></div>
        )}
      </button>

      <style>
        {`
          @keyframes slideIn {
            from { opacity: 0; transform: translateX(20px); }
            to { opacity: 1; transform: translateX(0); }
          }
          
          @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.2); opacity: 0.7; }
            100% { transform: scale(1); opacity: 1; }
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
