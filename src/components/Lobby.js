import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:3001', { autoConnect: true });

function Lobby({ gameId, setGameId, playerName, setPlayerName, onGameStart }) {
  const [players, setPlayers] = useState([]);
  const [isInLobby, setIsInLobby] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleLobbyUpdate = (playerList) => {
      setPlayers(playerList);
    };

    const handleGameStarted = () => {
      onGameStart();
    };

    socket.on('lobbyUpdate', handleLobbyUpdate);
    socket.on('gameStarted', handleGameStarted);

    return () => {
      socket.off('lobbyUpdate', handleLobbyUpdate);
      socket.off('gameStarted', handleGameStarted);
    };
  }, [onGameStart]);

  const handleJoinLobby = () => {
    if (!playerName.trim()) {
      setError('Bitte gib einen Spielernamen ein!');
      return;
    }
    if (!gameId.trim()) {
      setError('Bitte gib eine Raum-ID ein!');
      return;
    }

    setError('');
    socket.emit('joinLobby', { playerName: playerName.trim(), gameId: gameId.trim() });
    setIsInLobby(true);
  };

  const handleStartGame = () => {
    if (players.length < 3) {
      setError('Mindestens 3 Spieler werden benötigt!');
      return;
    }
    socket.emit('startGame', gameId);
  };

  const handleLeaveLobby = () => {
    setIsInLobby(false);
    setPlayers([]);
    setError('');
  };

  if (!isInLobby) {
    return (
      <div>
        {/* Join Form */}
        <div style={{ marginBottom: '30px' }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              color: 'white',
              fontSize: '16px',
              fontWeight: 'bold',
              marginBottom: '8px',
              textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
            }}>
              👤 Dein Spielername
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Wie heißt du?"
              style={{
                width: '100%',
                padding: '16px 20px',
                fontSize: '16px',
                border: 'none',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.95)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                outline: 'none',
                transition: 'all 0.3s ease'
              }}
              onFocus={(e) => {
                e.target.style.transform = 'scale(1.02)';
                e.target.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)';
              }}
              onBlur={(e) => {
                e.target.style.transform = 'scale(1)';
                e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
              }}
              onKeyPress={(e) => e.key === 'Enter' && handleJoinLobby()}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              color: 'white',
              fontSize: '16px',
              fontWeight: 'bold',
              marginBottom: '8px',
              textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
            }}>
              🏠 Raum-ID
            </label>
            <input
              type="text"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              placeholder="z.B. 'freunde123' oder 'test'"
              style={{
                width: '100%',
                padding: '16px 20px',
                fontSize: '16px',
                border: 'none',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.95)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                outline: 'none',
                transition: 'all 0.3s ease'
              }}
              onFocus={(e) => {
                e.target.style.transform = 'scale(1.02)';
                e.target.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)';
              }}
              onBlur={(e) => {
                e.target.style.transform = 'scale(1)';
                e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
              }}
              onKeyPress={(e) => e.key === 'Enter' && handleJoinLobby()}
            />
          </div>

          {error && (
            <div style={{
              background: 'linear-gradient(135deg, #ff6b6b, #ee5a52)',
              color: 'white',
              padding: '12px 20px',
              borderRadius: '12px',
              marginBottom: '20px',
              textAlign: 'center',
              fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(255,107,107,0.3)'
            }}>
              ⚠️ {error}
            </div>
          )}

          <button
            onClick={handleJoinLobby}
            style={{
              width: '100%',
              padding: '16px 24px',
              fontSize: '18px',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #00c6ff, #0072ff)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(0,114,255,0.3)',
              transition: 'all 0.3s ease',
              textShadow: '1px 1px 2px rgba(0,0,0,0.2)'
            }}
            onMouseOver={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 8px 25px rgba(0,114,255,0.4)';
            }}
            onMouseOut={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 6px 20px rgba(0,114,255,0.3)';
            }}
          >
            🚀 Raum beitreten
          </button>
        </div>

        {/* Quick Join Options */}
        <div style={{
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          <h3 style={{
            color: 'white',
            fontSize: '16px',
            margin: '0 0 12px 0',
            textAlign: 'center',
            opacity: 0.9
          }}>
            ⚡ Schnell beitreten
          </h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {['test', 'freunde', 'familie', 'party'].map(roomId => (
              <button
                key={roomId}
                onClick={() => setGameId(roomId)}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.3)';
                  e.target.style.transform = 'scale(1.05)';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.2)';
                  e.target.style.transform = 'scale(1)';
                }}
              >
                {roomId}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Lobby Header */}
      <div style={{
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '24px',
        border: '1px solid rgba(255,255,255,0.2)',
        textAlign: 'center'
      }}>
        <h2 style={{
          color: 'white',
          fontSize: '24px',
          margin: '0 0 8px 0',
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
        }}>
          🏠 Raum: {gameId}
        </h2>
        <p style={{
          color: 'rgba(255,255,255,0.8)',
          margin: 0,
          fontSize: '16px'
        }}>
          Warte auf weitere Spieler...
        </p>
      </div>

      {/* Players List */}
      <div style={{
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        border: '1px solid rgba(255,255,255,0.2)'
      }}>
        <h3 style={{
          color: 'white',
          fontSize: '20px',
          margin: '0 0 20px 0',
          textAlign: 'center',
          textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
        }}>
          👥 Spieler ({players.length})
        </h3>

        <div style={{
          display: 'grid',
          gap: '12px',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'
        }}>
          {players.map((player, index) => (
            <div key={player.id} style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.1))',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.3)',
              textAlign: 'center',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{
                fontSize: '24px',
                marginBottom: '8px'
              }}>
                {index === 0 ? '👑' : '🎮'}
              </div>
              <div style={{
                color: 'white',
                fontWeight: 'bold',
                fontSize: '16px',
                textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
              }}>
                {player.name}
              </div>
              {index === 0 && (
                <div style={{
                  color: 'rgba(255,215,0,0.9)',
                  fontSize: '12px',
                  marginTop: '4px',
                  fontWeight: 'bold'
                }}>
                  Raumleiter
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Minimum Players Notice */}
        {players.length < 3 && (
          <div style={{
            background: 'rgba(255,193,7,0.2)',
            border: '1px solid rgba(255,193,7,0.4)',
            borderRadius: '12px',
            padding: '16px',
            marginTop: '20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
            <div style={{
              color: 'rgba(255,255,255,0.9)',
              fontSize: '14px',
              lineHeight: '1.4'
            }}>
              Mindestens 3 Spieler werden benötigt<br/>
              <strong>{3 - players.length} weitere Spieler erforderlich</strong>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{
          background: 'linear-gradient(135deg, #ff6b6b, #ee5a52)',
          color: 'white',
          padding: '16px 20px',
          borderRadius: '12px',
          marginBottom: '20px',
          textAlign: 'center',
          fontWeight: 'bold',
          boxShadow: '0 4px 12px rgba(255,107,107,0.3)'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={handleStartGame}
          disabled={players.length < 3}
          style={{
            flex: '1',
            minWidth: '200px',
            padding: '16px 24px',
            fontSize: '18px',
            fontWeight: 'bold',
            background: players.length >= 3
              ? 'linear-gradient(135deg, #00c851, #00a845)'
              : 'linear-gradient(135deg, #6c757d, #5a6268)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: players.length >= 3 ? 'pointer' : 'not-allowed',
            boxShadow: players.length >= 3
              ? '0 6px 20px rgba(0,200,81,0.3)'
              : '0 4px 12px rgba(108,117,125,0.3)',
            transition: 'all 0.3s ease',
            textShadow: '1px 1px 2px rgba(0,0,0,0.2)'
          }}
          onMouseOver={(e) => {
            if (players.length >= 3) {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 8px 25px rgba(0,200,81,0.4)';
            }
          }}
          onMouseOut={(e) => {
            if (players.length >= 3) {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 6px 20px rgba(0,200,81,0.3)';
            }
          }}
        >
          {players.length >= 3 ? '🎮 Spiel starten!' : `⏳ ${3 - players.length} Spieler fehlen`}
        </button>

        <button
          onClick={handleLeaveLobby}
          style={{
            padding: '16px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            background: 'rgba(255,255,255,0.1)',
            color: 'white',
            border: '2px solid rgba(255,255,255,0.3)',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            backdropFilter: 'blur(10px)'
          }}
          onMouseOver={(e) => {
            e.target.style.background = 'rgba(255,255,255,0.2)';
            e.target.style.transform = 'translateY(-1px)';
          }}
          onMouseOut={(e) => {
            e.target.style.background = 'rgba(255,255,255,0.1)';
            e.target.style.transform = 'translateY(0)';
          }}
        >
          🚪 Verlassen
        </button>
      </div>

      {/* Share Room Code */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '12px',
        padding: '16px',
        marginTop: '20px',
        border: '1px solid rgba(255,255,255,0.1)',
        textAlign: 'center'
      }}>
        <div style={{
          color: 'rgba(255,255,255,0.8)',
          fontSize: '14px',
          marginBottom: '8px'
        }}>
          📤 Lade Freunde ein
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.1)',
          padding: '8px 16px',
          borderRadius: '8px',
          color: 'white',
          fontFamily: 'monospace',
          fontSize: '16px',
          fontWeight: 'bold',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          Raum-Code: {gameId}
        </div>
      </div>
    </div>
  );
}

export default Lobby;
