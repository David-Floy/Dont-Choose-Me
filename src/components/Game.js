import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import Card from './Card';

const socket = io('http://localhost:3001', { autoConnect: true });

/**
 * Haupt-Spielkomponente für das PicMe-Spiel
 * @param {Object} props - React Props
 * @param {string} props.playerName - Name des aktuellen Spielers
 * @param {string} props.gameId - ID des Spielraums
 */
function Game({ playerName, gameId }) {
  // === STATE MANAGEMENT ===
  const [game, setGame] = useState(null);
  const [hint, setHint] = useState('');
  const [selectedCard, setSelectedCard] = useState(null);
  const [phase, setPhase] = useState('waiting');
  const [mixedCards, setMixedCards] = useState([]);
  const [hand, setHand] = useState([]);
  const [allCards, setAllCards] = useState([]);

  // === HELPER FUNCTIONS ===

  /**
   * Aktualisiert die Hand des aktuellen Spielers basierend auf den Spieldaten
   * @param {Object} gameData - Aktuelle Spieldaten vom Server
   */
  const updateHand = (gameData) => {
    console.log('=== UPDATING HAND ===');
    console.log('Player name:', playerName);
    console.log('Available players:', gameData.players?.map(p => ({
      name: p.name,
      id: p.id,
      handSize: p.hand?.length,
      handIds: p.hand?.map(c => c.id).join(', ') || 'empty'
    })));

    const me = gameData.players.find(p => p.name === playerName);

    if (me) {
      console.log(`Found player ${playerName} with:`);
      console.log(`  Socket ID: ${me.id}`);
      console.log(`  Hand size: ${me.hand?.length || 0}`);
      console.log(`  Hand IDs: ${me.hand?.map(c => c.id).join(', ') || 'empty'}`);

      setHand(me.hand || []);

      // Wenn Hand leer ist aber Spiel läuft, fordere neuen Spielzustand an
      if ((!me.hand || me.hand.length === 0) && gameData.state === 'playing' && gameData.phase !== 'voting') {
        console.warn('Hand is empty, requesting fresh game state...');
        setTimeout(() => {
          socket.emit('getGameState', gameId);
        }, 1000);
      }
    } else {
      console.warn(`Player ${playerName} not found in game data!`);
      console.log('Available player names:', gameData.players?.map(p => p.name));
      setHand([]);
    }
    console.log('=== END UPDATING HAND ===');
  };

  /**
   * Bestimmt die aktuelle Spielphase basierend auf Spielzustand
   * @param {Object} gameData - Aktuelle Spieldaten
   * @returns {string} Die berechnete Phase
   */
  const calculatePhase = (gameData) => {
    if (!gameData?.players?.length) return 'waiting';

    const storyteller = gameData.players[gameData.storytellerIndex];
    const isStoryteller = storyteller?.name === playerName;

    // Server-Phase hat Priorität
    if (gameData.phase) {
      switch (gameData.phase) {
        case 'storytelling':
          return isStoryteller ? 'giveHint' : 'waiting';
        case 'selectCards':
          const hasSelectedCard = gameData.selectedCards?.some(sc => {
            const player = gameData.players.find(p => p.id === sc.playerId);
            return player?.name === playerName;
          });
          return (isStoryteller || hasSelectedCard) ? 'waiting' : 'chooseCard';
        case 'voting':
          return isStoryteller ? 'waiting' : 'vote';
        default:
          return 'waiting';
      }
    }

    // Fallback-Logik
    if (!gameData.hint) {
      return isStoryteller ? 'giveHint' : 'waiting';
    }

    if (gameData.selectedCards?.length < gameData.players.length) {
      const hasSelectedCard = gameData.selectedCards.some(sc => {
        const player = gameData.players.find(p => p.id === sc.playerId);
        return player?.name === playerName;
      });
      return (isStoryteller || hasSelectedCard) ? 'waiting' : 'chooseCard';
    }

    if (gameData.selectedCards?.length === gameData.players.length && !gameData.votes?.length) {
      return isStoryteller ? 'waiting' : 'vote';
    }

    return gameData.votes?.length > 0 ? 'results' : 'waiting';
  };

  // === SOCKET EVENT HANDLERS ===

  /**
   * Initialisiert Socket-Event-Listener
   */
  useEffect(() => {
    // Stelle sicher, dass der Server weiß, wer wir sind
    socket.emit('joinLobby', { playerName, gameId });
    socket.emit('getGameState', gameId);

    const handleGameStarted = (gameData) => {
      console.log('Game started, received data:', gameData);
      setGame(gameData);
      updateHand(gameData);
      setSelectedCard(null);
      setMixedCards([]);
      setHint('');
    };

    const handleGameState = (gameData) => {
      console.log('Received gameState:', gameData);
      setGame(gameData);
      updateHand(gameData);
    };

    const handleCardsReady = ({ cards }) => {
      setMixedCards(cards);
    };

    const handleRoundEnded = ({ points }) => {
      setPhase('results');
    };

    // Event-Listener registrieren
    socket.on('gameStarted', handleGameStarted);
    socket.on('gameState', handleGameState);
    socket.on('cardsReady', handleCardsReady);
    socket.on('roundEnded', handleRoundEnded);

    // Cleanup
    return () => {
      socket.off('gameStarted', handleGameStarted);
      socket.off('gameState', handleGameState);
      socket.off('cardsReady', handleCardsReady);
      socket.off('roundEnded', handleRoundEnded);
    };
  }, [gameId, playerName]);

  /**
   * Überwacht Änderungen am Spielzustand und aktualisiert die Phase
   */
  useEffect(() => {
    if (game) {
      const newPhase = calculatePhase(game);
      setPhase(newPhase);

      console.log('Phase calculation:', {
        gameHint: game.hint,
        selectedCards: game.selectedCards?.length,
        totalPlayers: game.players?.length,
        votes: game.votes?.length,
        isStoryteller: game.players?.[game.storytellerIndex]?.name === playerName,
        serverPhase: game.phase,
        calculatedPhase: newPhase
      });
    }
  }, [game, playerName]);

  /**
   * Lädt alle verfügbaren Karten beim Komponenten-Mount
   */
  useEffect(() => {
    fetch('http://localhost:3001/api/cards')
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(cards => {
        console.log('Karten erfolgreich geladen:', cards.length);
        setAllCards(cards);
      })
      .catch(err => {
        console.error('Fehler beim Laden der Karten:', err);
        // Fallback: Leeres Array setzen
        setAllCards([]);
      });
  }, []);

  // === GAME ACTIONS ===

  /**
   * Behandelt das Geben eines Hinweises durch den Erzähler
   */
  const handleGiveHint = () => {
    if (!selectedCard || !hint.trim()) {
      console.log('Missing card or hint');
      return;
    }

    console.log('Giving hint:', hint, 'with card:', selectedCard, 'as player:', playerName);
    socket.emit('giveHint', { gameId, cardId: selectedCard, hint: hint.trim() });
    setSelectedCard(null);
    setHint('');
  };

  /**
   * Behandelt die Kartenauswahl durch Nicht-Erzähler
   * @param {string} cardId - ID der ausgewählten Karte
   */
  const handleChooseCard = (cardId) => {
    socket.emit('chooseCard', { gameId, cardId });
    setSelectedCard(cardId);
  };

  /**
   * Behandelt die Stimmabgabe für eine Karte
   * @param {string} cardId - ID der Karte, für die gestimmt wird
   */
  const handleVote = (cardId) => {
    socket.emit('voteCard', { gameId, cardId });
  };

  // === RENDER HELPERS ===

  /**
   * Rendert die Warte-Phase
   */
  const renderWaitingPhase = () => (
    <div>
      {game?.hint && game.selectedCards?.length < game.players?.length ? (
        <div>
          <p>Hinweis: <strong>{game.hint}</strong></p>
          <p>Warte, bis alle Spieler ihre Karten ausgewählt haben...</p>
          <p>Fortschritt: {game.selectedCards.length} / {game.players.length} Karten gewählt</p>
        </div>
      ) : (
        <div>Bitte warten...</div>
      )}
    </div>
  );

  /**
   * Rendert die Hinweis-Gabe-Phase für den Erzähler
   */
  const renderGiveHintPhase = () => (
    <div>
      <h3>Du bist Erzähler! Wähle eine Karte und gib einen Hinweis:</h3>
      <input
        value={hint}
        onChange={e => setHint(e.target.value)}
        placeholder="Hinweis..."
        style={{ padding: '8px', margin: '10px 0', width: '300px' }}
      />
      <div>
        {hand.map(card => (
          <Card
            key={card.id}
            card={card}
            onClick={() => setSelectedCard(card.id)}
            selected={selectedCard === card.id}
          />
        ))}
      </div>
      <button
        onClick={handleGiveHint}
        disabled={!selectedCard || !hint.trim()}
        style={{ padding: '10px 20px', fontSize: '16px', marginTop: '10px' }}
      >
        Hinweis geben
      </button>
    </div>
  );

  /**
   * Rendert die Kartenauswahl-Phase
   */
  const renderChooseCardPhase = () => (
    <div>
      <h3>Hinweis des Erzählers: <span style={{color:'#007bff'}}>{game?.hint}</span></h3>
      <h4>Wähle eine Karte aus deiner Hand, die zum Hinweis passt:</h4>
      <p>Spieler haben bereits gewählt: {game?.selectedCards?.length || 0} / {game?.players?.length || 0}</p>
      <p>Debug: Deine Hand hat {hand.length} Karten</p>
      {hand.length === 0 ? (
        <div>
          <p style={{color: 'red'}}>Keine Karten in der Hand gefunden!</p>
          <button
            onClick={() => {
              console.log('Manual refresh requested');
              socket.emit('getGameState', gameId);
            }}
            style={{ padding: '10px 20px', fontSize: '16px', marginTop: '10px' }}
          >
            Hand neu laden
          </button>
          <div style={{marginTop: '10px', fontSize: '12px', color: '#666'}}>
            <p>Debug Info:</p>
            <p>Socket connected: {socket.connected ? 'Yes' : 'No'}</p>
            <p>Socket ID: {socket.id}</p>
            <p>Current phase: {game?.phase}</p>
          </div>
        </div>
      ) : (
        hand.map(card => (
          <Card
            key={card.id}
            card={card}
            onClick={() => handleChooseCard(card.id)}
            selected={selectedCard === card.id}
          />
        ))
      )}
    </div>
  );

  /**
   * Rendert die Abstimmungs-Phase
   */
  const renderVotePhase = () => (
    <div>
      <h3>Stimme ab: Welche Karte ist die des Erzählers?</h3>
      <p>Hinweis war: <span style={{color:'#007bff'}}>{game?.hint}</span></p>
      {mixedCards.map(({ cardId }) => {
        // Versuche Karte in allCards zu finden, sonst in Spieler-Händen
        const combinedCards = [...allCards, ...(game?.players?.flatMap(p => p.hand) || [])];
        let card = combinedCards.find(c => c.id === cardId);

        // Fallback wenn Karte nicht gefunden wird
        if (!card) {
          console.warn(`Karte ${cardId} nicht gefunden, verwende Fallback`);
          card = {
            id: cardId,
            title: `Karte ${cardId}`,
            image: `https://placehold.co/300x200?text=Karte+${cardId}`
          };
        }

        return <Card key={cardId} card={card} onClick={() => handleVote(cardId)} />;
      })}
    </div>
  );

  /**
   * Rendert die Ergebnis-Phase
   */
  const renderResultsPhase = () => (
    <div>
      <h3>Runde beendet! Punkte:</h3>
      <ul>
        {game?.players?.map(p => (
          <li key={p.id}>{p.name}: {p.points}</li>
        ))}
      </ul>
    </div>
  );

  // === MAIN RENDER ===
  if (!game) return <div>Warte auf Spielstart...</div>;

  return (
    <div>
      <h2>Spielraum: {gameId}</h2>
      <p>Debug: Phase = {phase}, Hint = {game?.hint || 'keine'}, Selected Cards = {game?.selectedCards?.length || 0}, Server Phase = {game?.phase || 'undefined'}</p>
      <p>Current player: {playerName}, Storyteller: {game?.players?.[game?.storytellerIndex]?.name}, Socket connected: {socket.connected ? 'Yes' : 'No'}</p>
      <p>Debug: Hand size = {hand.length}, My player data = {JSON.stringify(game?.players?.find(p => p.name === playerName))}</p>

      {phase === 'waiting' && renderWaitingPhase()}
      {phase === 'giveHint' && renderGiveHintPhase()}
      {phase === 'chooseCard' && renderChooseCardPhase()}
      {phase === 'vote' && renderVotePhase()}
      {phase === 'results' && renderResultsPhase()}
    </div>
  );
}

export default Game;
