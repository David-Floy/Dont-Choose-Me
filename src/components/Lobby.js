import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:3001', { autoConnect: true });

function Lobby({ setInGame, setPlayerName, setGameId }) {
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');
  const [players, setPlayers] = useState([]);
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    socket.on('lobbyUpdate', (players) => {
      setPlayers(players);
      setIsHost(players.length > 0 && players[0].id === socket.id);
    });
    socket.on('gameStarted', () => {
      setInGame(true);
    });
    return () => {
      socket.off('lobbyUpdate');
      socket.off('gameStarted');
    };
  }, []);

  const joinLobby = () => {
    if (!name || !room) return;
    setPlayerName(name);
    setGameId(room);
    socket.emit('joinLobby', { playerName: name, gameId: room });
  };

  return (
    <div>
      <h2>Lobby</h2>
      <input placeholder="Dein Name" value={name} onChange={e => setName(e.target.value)} />
      <input placeholder="Raum-ID" value={room} onChange={e => setRoom(e.target.value)} />
      <button onClick={joinLobby} disabled={!name || !room}>Beitreten</button>
      <div>
        <h3>Spieler im Raum:</h3>
        <ul>
          {players.map(p => <li key={p.id}>{p.name}</li>)}
        </ul>
        {isHost && players.length > 1 && (
          <button onClick={() => socket.emit('startGame', room)}>Spiel starten</button>
        )}
      </div>
    </div>
  );
}

export default Lobby;
