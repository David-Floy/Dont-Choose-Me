import React, { useState, useEffect } from 'react';
import Lobby from './components/Lobby';
import Game from './components/Game';
import audioManager from './utils/AudioManager';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'red', padding: '40px', background: '#fff' }}>
          <h2>Ein Fehler ist aufgetreten!</h2>
          <pre>{this.state.error && this.state.error.toString()}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [gameId, setGameId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isInGame, setIsInGame] = useState(false);
  const [volume, setVolume] = useState(0.7); // Zentraler Volume State

  // Initialisiere AudioManager beim App-Start
  useEffect(() => {
    audioManager.setVolume(volume);

    // Auto-start Lobby-Musik
    audioManager.playTrack('lobby.mp3', true, 2000);

    // Cleanup bei App-Beendigung
    return () => {
      audioManager.stopTrack(500);
    };
  }, []);

  // Volume änderungen an AudioManager weiterleiten
  useEffect(() => {
    audioManager.setVolume(volume);
  }, [volume]);

  const handleGameStart = () => {
    setIsInGame(true);
  };

  const handleLeaveGame = () => {
    setIsInGame(false);
    setGameId('');
    // Wechsel zurück zur Lobby-Musik
    audioManager.playTrack('lobby.mp3', true, 1000);
  };

  return (
    <ErrorBoundary>
      <div className="App">
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '20px'
        }}>
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            {/* App Header */}
            <div style={{
              textAlign: 'center',
              marginBottom: '40px',
              background: 'rgba(255,255,255,0.1)',
              padding: '30px',
              borderRadius: '20px',
              backdropFilter: 'blur(10px)',
              color: 'white',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
            }}>
              <h1 style={{
                margin: '0 0 15px 0',
                fontSize: '42px',
                fontWeight: 'bold',
                textShadow: '3px 3px 6px rgba(0,0,0,0.3)',
                background: 'linear-gradient(45deg, #ffd700, #ffed4e)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                🎨 Don't Choose Me
              </h1>
              <p style={{
                margin: 0,
                fontSize: '18px',
                opacity: 0.9,
                fontWeight: '300'
              }}>
                Das kreative Ratespiel für Freunde und Familie
              </p>
            </div>

            {/* Main Content */}
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '20px',
              padding: '30px',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              {isInGame ? (
                <Game
                  gameId={gameId}
                  playerName={playerName}
                  onLeaveGame={handleLeaveGame}
                  volume={volume}
                  setVolume={setVolume}
                />
              ) : (
                <Lobby
                  gameId={gameId}
                  setGameId={setGameId}
                  playerName={playerName}
                  setPlayerName={setPlayerName}
                  onGameStart={handleGameStart}
                  volume={volume}
                  setVolume={setVolume}
                />
              )}
            </div>

            {/* Footer */}
            <div style={{
              textAlign: 'center',
              marginTop: '30px',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '14px'
            }}>
              <p style={{ margin: 0 }}>
                🎵 Mit Musik und Lautstärkeregelung • Viel Spaß beim Spielen!
              </p>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;
