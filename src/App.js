import React, { useState } from 'react';
import Lobby from './components/Lobby';
import Game from './components/Game';

function App() {
  const [gameId, setGameId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [gameStarted, setGameStarted] = useState(false);

  // Funktion um zurück zur Lobby zu gehen
  const handleBackToLobby = () => {
    setGameStarted(false);
  };

  if (gameStarted) {
    return <Game
      playerName={playerName}
      gameId={gameId}
      onBackToLobby={handleBackToLobby}
    />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '24px',
        padding: '40px',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        border: '1px solid rgba(255,255,255,0.2)',
        maxWidth: '600px',
        width: '100%'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            fontSize: '72px',
            marginBottom: '16px',
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
          }}>
            🎨
          </div>
          <h1 style={{
            color: 'white',
            fontSize: '48px',
            margin: '0 0 16px 0',
            textShadow: '2px 2px 8px rgba(0,0,0,0.3)',
            fontWeight: 'bold'
          }}>
            Don't Choose Me
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: '18px',
            margin: 0,
            lineHeight: '1.6'
          }}>
            Das ultimative Kartenspiel der Kreativität und Täuschung
          </p>
        </div>

        <Lobby
          gameId={gameId}
          setGameId={setGameId}
          playerName={playerName}
          setPlayerName={setPlayerName}
          onGameStart={() => setGameStarted(true)}
        />

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: '40px',
          padding: '20px 0',
          borderTop: '1px solid rgba(255,255,255,0.2)',
          color: 'rgba(255,255,255,0.7)',
          fontSize: '14px'
        }}>
          <p style={{ margin: '0 0 8px 0' }}>
            Wie wird gespielt?
          </p>
          <p style={{ margin: 0, lineHeight: '1.4' }}>
            🎭 Ein Erzähler gibt einen Hinweis zu seiner Karte<br/>
            🃏 Andere wählen passende Karten aus ihrer Hand<br/>
            🗳️ Alle raten, welche Karte vom Erzähler stammt<br/>
            🏆 Erste Person mit 30 Punkten gewinnt!
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
