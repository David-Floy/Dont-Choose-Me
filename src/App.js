import React, { useState } from 'react';
import Lobby from './components/Lobby';
import Game from './components/Game';

function App() {
  const [inGame, setInGame] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [gameId, setGameId] = useState('');

  return (
    <div>
      <h1>Pic-Me Online</h1>
      {!inGame ? (
        <Lobby setInGame={setInGame} setPlayerName={setPlayerName} setGameId={setGameId} />
      ) : (
        <Game playerName={playerName} gameId={gameId} />
      )}
    </div>
  );
}

export default App;

