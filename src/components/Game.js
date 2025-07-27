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
  const [scoreChanges, setScoreChanges] = useState([]);
  const [revealInfo, setRevealInfo] = useState(null);
  const [pointsEarned, setPointsEarned] = useState(null);
  const [revealTimer, setRevealTimer] = useState(null);
  const [gameWinner, setGameWinner] = useState(null);

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

    // Prüfe auf Spielende
    if (gameData.phase === 'gameEnd' || gameData.winner) {
      return 'gameEnd';
    }

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
          return 'vote'; // Beide Erzähler und andere gehen in vote-Phase
        case 'reveal':
          return 'reveal';
        case 'gameEnd':
          return 'gameEnd';
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
      return 'vote'; // Beide Erzähler und andere gehen in vote-Phase
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

    /**
     * Event-Handler für Rundenende - NICHT mehr die Phase überschreiben
     */
    const handleRoundEnded = ({ points }) => {
      console.log('Round ended, received points:', points);
      // Nur die Punkteänderungen berechnen, Phase wird durch gameState gesetzt
      if (game && game.players) {
        const changes = calculateScoreChanges(game.players, points.map(p => ({
          name: p.id,
          points: p.points
        })));
        setScoreChanges(changes);
        setPointsEarned(changes);
      }
    };

    const handleGameEnded = ({ winner, finalScores }) => {
      console.log('Game ended, winner:', winner);
      setGameWinner({ winner, finalScores });
      setPhase('gameEnd');
    };

    // Event-Listener registrieren
    socket.on('gameStarted', handleGameStarted);
    socket.on('gameState', handleGameState);
    socket.on('cardsReady', handleCardsReady);
    socket.on('roundEnded', handleRoundEnded);
    socket.on('gameEnded', handleGameEnded);

    // Cleanup
    return () => {
      socket.off('gameStarted', handleGameStarted);
      socket.off('gameState', handleGameState);
      socket.off('cardsReady', handleCardsReady);
      socket.off('roundEnded', handleRoundEnded);
      socket.off('gameEnded', handleGameEnded);
    };
  }, [gameId, playerName]);

  /**
   * Überwacht Änderungen am Spielzustand und aktualisiert die Phase
   */
  useEffect(() => {
    if (game) {
      const newPhase = calculatePhase(game);
      setPhase(newPhase);

      // Bei Reveal-Phase: Reveal-Infos setzen (ohne Timer)
      if (newPhase === 'reveal' && game.votes && game.selectedCards && game.votes.length > 0 && game.selectedCards.length > 0) {
        // Sammle Reveal-Infos
        const votesPerCard = {};
        game.votes.forEach(v => {
          votesPerCard[v.cardId] = (votesPerCard[v.cardId] || 0) + 1;
        });

        const revealData = game.selectedCards.map(sc => {
          const player = game.players.find(p => p.id === sc.playerId);
          return {
            cardId: sc.cardId,
            playerName: player ? player.name : 'Unbekannt',
            isStoryteller: sc.cardId === game.storytellerCard,
            votes: votesPerCard[sc.cardId] || 0
          };
        });

        console.log('Setting reveal info:', revealData);
        setRevealInfo(revealData);
      } else if (newPhase !== 'reveal') {
        setRevealInfo(null);
        setRevealTimer(null);
      }

      console.log('Phase calculation:', {
        gameHint: game.hint,
        selectedCards: game.selectedCards?.length,
        totalPlayers: game.players?.length,
        votes: game.votes?.length,
        isStoryteller: game.players?.[game.storytellerIndex]?.name === playerName,
        serverPhase: game.phase,
        calculatedPhase: newPhase,
        hasRevealInfo: !!revealInfo
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

  /**
   * Behandelt den Übergang zur nächsten Runde
   */
  const handleContinueToNextRound = () => {
    console.log('Requesting continue to next round');
    setRevealInfo(null); // Reset reveal info beim Übergang
    setRevealTimer(null); // Reset timer
    socket.emit('continueToNextRound', gameId);
  };

  /**
   * Behandelt den Neustart des Spiels
   */
  const handleRestartGame = () => {
    console.log('Requesting game restart');
    setGameWinner(null);
    setRevealInfo(null);
    setRevealTimer(null);
    setScoreChanges([]);
    setPointsEarned(null);
    socket.emit('restartGame', gameId);
  };

  /**
   * Berechnet die Punkteänderungen nach einer Runde
   * @param {Object} prevPlayers - Spieler vor der Runde
   * @param {Object} newPlayers - Spieler nach der Runde
   * @returns {Array} Array mit {name, oldPoints, newPoints, diff}
   */
  const calculateScoreChanges = (prevPlayers, newPlayers) => {
    if (!prevPlayers || !newPlayers) return [];
    return newPlayers.map(np => {
      const old = prevPlayers.find(p => p.name === np.name);
      const oldPoints = old ? old.points : 0;
      const diff = np.points - oldPoints;
      return {
        name: np.name,
        oldPoints,
        newPoints: np.points,
        diff
      };
    });
  };

  /**
   * Berechnet wer Punkte bekommt und warum (für Reveal-Phase)
   * @param {Object} game - Aktueller Spielzustand
   * @returns {Array} Array mit Punkteverteilungs-Details
   */
  const calculatePointsDistribution = (game) => {
    // Erweiterte Sicherheitschecks
    if (!game) {
      console.warn('calculatePointsDistribution: game is null/undefined');
      return [];
    }

    if (!game.votes || !Array.isArray(game.votes)) {
      console.warn('calculatePointsDistribution: game.votes is invalid', game.votes);
      return [];
    }

    if (!game.selectedCards || !Array.isArray(game.selectedCards) || game.selectedCards.length === 0) {
      console.warn('calculatePointsDistribution: game.selectedCards is invalid', game.selectedCards);
      return [];
    }

    // Zusätzliche Überprüfung für selectedCards[0]
    if (!game.selectedCards[0] || !game.selectedCards[0].playerId) {
      console.warn('calculatePointsDistribution: first selected card is invalid', game.selectedCards[0]);
      return [];
    }

    const storytellerId = game.selectedCards[0].playerId;
    const correctCardId = game.storytellerCard;
    const votes = game.votes;

    const correctVotes = votes.filter(v => v.cardId === correctCardId).length;
    const allCorrect = correctVotes === votes.length;
    const noneCorrect = correctVotes === 0;

    const distribution = [];

    // Punkte für den Erzähler
    const storyteller = game.players.find(p => p.id === storytellerId);
    if (storyteller) {
      if (!noneCorrect && !allCorrect) {
        distribution.push({
          playerName: storyteller.name,
          points: 3,
          reason: 'Erzähler: Perfekte Balance!'
        });
      } else if (allCorrect) {
        distribution.push({
          playerName: storyteller.name,
          points: 0,
          reason: 'Erzähler: Zu offensichtlich'
        });
      } else if (noneCorrect) {
        distribution.push({
          playerName: storyteller.name,
          points: 0,
          reason: 'Erzähler: Zu schwer'
        });
      }
    }

    // Punkte für richtige Stimmen
    for (const vote of votes) {
      if (vote.cardId === correctCardId) {
        const player = game.players.find(p => p.id === vote.playerId);
        if (player) {
          distribution.push({
            playerName: player.name,
            points: 3,
            reason: 'Richtig geraten!'
          });
        }
      }
    }

    // Punkte für andere Spieler, die Stimmen für ihre Karten erhalten haben
    for (const selectedCard of game.selectedCards) {
      if (selectedCard.playerId !== storytellerId) {
        const votesForCard = votes.filter(v => v.cardId === selectedCard.cardId).length;
        if (votesForCard > 0) {
          const player = game.players.find(p => p.id === selectedCard.playerId);
          if (player) {
            distribution.push({
              playerName: player.name,
              points: votesForCard,
              reason: `${votesForCard} Spieler getäuscht`
            });
          }
        }
      }
    }

    return distribution;
  };

  // === RENDER HELPERS ===

  /**
   * Rendert die Warte-Phase
   */
  const renderWaitingPhase = () => {
    const isStoryteller = game?.players?.[game?.storytellerIndex]?.name === playerName;

    return (
      <div>
        {game?.hint && game.selectedCards?.length < game.players?.length ? (
          <div>
            <p>Hinweis: <strong>{game.hint}</strong></p>
            <p>Warte, bis alle Spieler ihre Karten ausgewählt haben...</p>
            <p>Fortschritt: {game.selectedCards.length} / {game.players.length} Karten gewählt</p>

            {/* Erzähler sieht die bereits gelegten Karten */}
            {isStoryteller && game.selectedCards.length > 1 && (
              <div style={{ marginTop: '20px' }}>
                <h4>Von anderen Spielern gelegte Karten:</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                  {game.selectedCards.slice(1).map((selectedCard, index) => {
                    const player = game.players.find(p => p.id === selectedCard.playerId);
                    const combinedCards = [...allCards, ...(game?.players?.flatMap(p => p.hand) || [])];
                    let card = combinedCards.find(c => c.id === selectedCard.cardId);

                    if (!card) {
                      card = {
                        id: selectedCard.cardId,
                        title: `Karte ${selectedCard.cardId}`,
                        image: `https://placehold.co/300x200?text=Karte+${selectedCard.cardId}`
                      };
                    }

                    return (
                      <div key={`${selectedCard.cardId}-${index}`} style={{
                        border: '2px solid #28a745',
                        padding: '8px',
                        borderRadius: '8px',
                        background: '#f8f9fa',
                        textAlign: 'center',
                        minWidth: '180px'
                      }}>
                        <Card card={card} />
                        <div style={{ marginTop: '8px', fontSize: '14px', fontWeight: 'bold' }}>
                          {player ? player.name : 'Unbekannt'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>Bitte warten...</div>
        )}
      </div>
    );
  };

  /**
   * Rendert die Hinweis-Gabe-Phase für den Erzähler
   */
  const renderGiveHintPhase = () => (
    <div style={{ padding: '20px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '16px', color: 'white', textAlign: 'center' }}>
      <h3 style={{ margin: '0 0 20px 0', fontSize: '28px', textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
        🎭 Du bist der Erzähler!
      </h3>
      <p style={{ fontSize: '18px', marginBottom: '30px', opacity: 0.9 }}>
        Wähle eine Karte aus deiner Hand und gib einen kreativen Hinweis
      </p>

      {/* Hinweis-Eingabe mit Button */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '30px',
        flexWrap: 'wrap'
      }}>
        <input
          value={hint}
          onChange={e => setHint(e.target.value)}
          placeholder="Gib deinen Hinweis ein..."
          style={{
            padding: '12px 20px',
            fontSize: '16px',
            border: 'none',
            borderRadius: '25px',
            width: '300px',
            outline: 'none',
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}
        />
        <button
          onClick={handleGiveHint}
          disabled={!selectedCard || !hint.trim()}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            backgroundColor: !selectedCard || !hint.trim() ? '#cccccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '25px',
            cursor: !selectedCard || !hint.trim() ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            transition: 'all 0.3s ease',
            minWidth: '120px'
          }}
          onMouseOver={(e) => {
            if (!e.target.disabled) {
              e.target.style.backgroundColor = '#218838';
              e.target.style.transform = 'translateY(-2px)';
            }
          }}
          onMouseOut={(e) => {
            if (!e.target.disabled) {
              e.target.style.backgroundColor = '#28a745';
              e.target.style.transform = 'translateY(0)';
            }
          }}
        >
          Hinweis geben
        </button>
      </div>

      {/* Kartenauswahl */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        justifyContent: 'center',
        padding: '20px',
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '12px',
        backdropFilter: 'blur(10px)'
      }}>
        {hand.map(card => (
          <div key={card.id} style={{ position: 'relative' }}>
            {selectedCard === card.id && (
              <div style={{
                position: 'absolute',
                top: '-10px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#ffd700',
                color: '#333',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 'bold',
                zIndex: 1,
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}>
                ✨ Ausgewählt
              </div>
            )}
            <Card
              card={card}
              onClick={() => setSelectedCard(card.id)}
              selected={selectedCard === card.id}
              style={{
                transform: selectedCard === card.id ? 'scale(1.05)' : 'scale(1)',
                boxShadow: selectedCard === card.id
                  ? '0 8px 24px rgba(255,215,0,0.4)'
                  : '0 4px 12px rgba(0,0,0,0.2)'
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );

  /**
   * Rendert die Kartenauswahl-Phase
   */
  const renderChooseCardPhase = () => (
    <div style={{ padding: '20px', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', borderRadius: '16px', color: 'white', textAlign: 'center' }}>
      <h3 style={{ margin: '0 0 10px 0', fontSize: '24px', textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
        💭 Wähle deine Karte
      </h3>
      <div style={{
        background: 'rgba(255,255,255,0.15)',
        padding: '15px',
        borderRadius: '12px',
        marginBottom: '20px',
        backdropFilter: 'blur(10px)'
      }}>
        <p style={{ fontSize: '18px', margin: '0 0 10px 0' }}>
          Hinweis des Erzählers: <span style={{color:'#ffd700', fontWeight: 'bold', fontSize: '20px'}}>{game?.hint}</span>
        </p>
        <p style={{ fontSize: '14px', opacity: 0.9, margin: 0 }}>
          Spieler haben bereits gewählt: {game?.selectedCards?.length || 0} / {game?.players?.length || 0}
        </p>
      </div>

      {hand.length === 0 ? (
        <div style={{
          background: 'rgba(220,53,69,0.9)',
          padding: '20px',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <p style={{color: 'white', fontSize: '18px', margin: '0 0 15px 0'}}>
            ❌ Keine Karten in der Hand gefunden!
          </p>
          <button
            onClick={() => socket.emit('getGameState', gameId)}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#fff',
              color: '#dc3545',
              border: 'none',
              borderRadius: '25px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            🔄 Hand neu laden
          </button>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          justifyContent: 'center',
          padding: '20px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)'
        }}>
          {hand.map(card => (
            <div key={card.id} style={{ position: 'relative' }}>
              {selectedCard === card.id && (
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#28a745',
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  zIndex: 1,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }}>
                  ✅ Gewählt
                </div>
              )}
              <Card
                card={card}
                onClick={() => handleChooseCard(card.id)}
                selected={selectedCard === card.id}
                style={{
                  transform: selectedCard === card.id ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: selectedCard === card.id
                    ? '0 8px 24px rgba(40,167,69,0.4)'
                    : '0 4px 12px rgba(0,0,0,0.2)'
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  /**
   * Rendert die Abstimmungs-Phase
   */
  const renderVotePhase = () => {
    const isStoryteller = game?.players?.[game?.storytellerIndex]?.name === playerName;
    const myPlayer = game?.players?.find(p => p.name === playerName);
    const mySelectedCard = game?.selectedCards?.find(sc => {
      const player = game.players.find(p => p.id === sc.playerId);
      return player?.name === playerName;
    });

    return (
      <div style={{
        padding: '20px',
        background: isStoryteller
          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        borderRadius: '16px',
        color: 'white',
        textAlign: 'center'
      }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '24px', textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
          {isStoryteller ? '👁️ Beobachte die Abstimmung' : '🗳️ Zeit zum Abstimmen!'}
        </h3>

        <div style={{
          background: 'rgba(255,255,255,0.15)',
          padding: '15px',
          borderRadius: '12px',
          marginBottom: '20px',
          backdropFilter: 'blur(10px)'
        }}>
          <p style={{ fontSize: '18px', margin: '0 0 10px 0' }}>
            Hinweis war: <span style={{color:'#ffd700', fontWeight: 'bold', fontSize: '20px'}}>{game?.hint}</span>
          </p>
          {isStoryteller && (
            <p style={{fontWeight: 'bold', fontSize: '16px', margin: 0, opacity: 0.9}}>
              🎭 Du kannst nicht abstimmen, aber siehst wer welche Karte gelegt hat!
            </p>
          )}
        </div>

        <h4 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>
          {isStoryteller ? '🃏 Die gelegten Karten:' : '🎯 Wähle die Karte des Erzählers:'}
        </h4>

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '20px',
          justifyContent: 'center',
          padding: '20px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)'
        }}>
          {mixedCards.map(({ cardId }) => {
            // Versuche Karte in allCards zu finden, sonst in Spieler-Händen
            const combinedCards = [...allCards, ...(game?.players?.flatMap(p => p.hand) || [])];
            let card = combinedCards.find(c => c.id === cardId);

            if (!card) {
              card = {
                id: cardId,
                title: `Karte ${cardId}`,
                image: `https://placehold.co/300x200?text=Karte+${cardId}`
              };
            }

            // Prüfe ob das die eigene Karte ist (für Nicht-Erzähler)
            const isMyCard = !isStoryteller && mySelectedCard && mySelectedCard.cardId === cardId;

            // Finde den Spieler der diese Karte gelegt hat (für Erzähler)
            const cardOwner = game?.selectedCards?.find(sc => sc.cardId === cardId);
            const ownerPlayer = cardOwner ? game.players.find(p => p.id === cardOwner.playerId) : null;
            const isMyCardAsStoryteller = isStoryteller && cardOwner && cardOwner.playerId === game?.players?.[game?.storytellerIndex]?.id;

            return (
              <div key={cardId} style={{ position: 'relative' }}>
                {/* Label für Nicht-Erzähler: "Your Card" */}
                {!isStoryteller && isMyCard && (
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#28a745',
                    color: 'white',
                    padding: '6px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    zIndex: 1,
                    boxShadow: '0 3px 6px rgba(0,0,0,0.3)'
                  }}>
                    🏷️ Your Card
                  </div>
                )}

                {/* Label für Erzähler: Spielername */}
                {isStoryteller && ownerPlayer && (
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: isMyCardAsStoryteller ? '#ffd700' : '#6c757d',
                    color: isMyCardAsStoryteller ? '#333' : 'white',
                    padding: '6px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    zIndex: 1,
                    boxShadow: '0 3px 6px rgba(0,0,0,0.3)'
                  }}>
                    {isMyCardAsStoryteller ? '👑 Deine Karte' : `👤 ${ownerPlayer.name}`}
                  </div>
                )}

                <Card
                  card={card}
                  onClick={isStoryteller ? undefined : () => handleVote(cardId)}
                  style={{
                    opacity: (!isStoryteller && isMyCard) ? 0.8 : 1,
                    border: (!isStoryteller && isMyCard)
                      ? '4px solid #28a745'
                      : (isStoryteller && isMyCardAsStoryteller)
                        ? '4px solid #ffd700'
                        : '2px solid rgba(255,255,255,0.3)',
                    cursor: isStoryteller ? 'default' : 'pointer',
                    borderRadius: '12px',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Voting-Status */}
        <div style={{
          marginTop: '25px',
          background: 'rgba(255,255,255,0.15)',
          padding: '15px',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)'
        }}>
          <p style={{ fontSize: '16px', margin: '0 0 10px 0', fontWeight: 'bold' }}>
            📊 Abstimmungen: {game?.votes?.length || 0} / {(game?.players?.length || 1) - 1}
            {isStoryteller && ' (Du stimmst nicht ab)'}
          </p>
          {game?.votes?.length > 0 && (
            <div>
              <p style={{ fontSize: '14px', margin: '0 0 8px 0', opacity: 0.9 }}>Bereits abgestimmt:</p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {game.votes.map((vote, index) => {
                  const voter = game.players.find(p => p.id === vote.playerId);
                  return (
                    <span key={index} style={{
                      background: 'rgba(255,255,255,0.2)',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      ✅ {voter ? voter.name : 'Unbekannt'}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  /**
   * Rendert das permanente Scoreboard
   */
  const renderScoreboard = () => (
    <div style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      border: 'none',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '25px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
      color: 'white'
    }}>
      <h4 style={{margin: '0 0 20px 0', textAlign: 'center', fontSize: '22px', textShadow: '2px 2px 4px rgba(0,0,0,0.3)'}}>
        🏆 Aktuelle Punkte
      </h4>
      <div style={{display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '12px'}}>
        {game?.players?.map(p => (
          <div key={p.id} style={{
            textAlign: 'center',
            padding: '16px',
            minWidth: '120px',
            background: p.name === game?.players?.[game?.storytellerIndex]?.name
              ? 'linear-gradient(135deg, #ffd700, #ffed4a)'
              : 'rgba(255,255,255,0.2)',
            borderRadius: '12px',
            border: p.name === game?.players?.[game?.storytellerIndex]?.name ? '3px solid #ffd700' : '2px solid rgba(255,255,255,0.3)',
            color: p.name === game?.players?.[game?.storytellerIndex]?.name ? '#333' : 'white',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            transition: 'all 0.3s ease'
          }}>
            <div style={{fontWeight: 'bold', fontSize: '16px', marginBottom: '8px'}}>{p.name}</div>
            <div style={{fontSize: '24px', fontWeight: 'bold', marginBottom: '4px'}}>{p.points}</div>
            {p.name === game?.players?.[game?.storytellerIndex]?.name && (
              <div style={{fontSize: '12px', fontWeight: 'bold'}}>🎭 Erzähler</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  /**
   * Rendert die Ergebnis-Phase inkl. Scoreboard
   */
  const renderResultsPhase = () => (
    <div>
      <h3>Runde beendet! Punkte:</h3>
      <table style={{borderCollapse: 'collapse', marginBottom: '1em'}}>
        <thead>
          <tr>
            <th style={{border: '1px solid #ccc', padding: '4px'}}>Spieler</th>
            <th style={{border: '1px solid #ccc', padding: '4px'}}>Punkte</th>
            <th style={{border: '1px solid #ccc', padding: '4px'}}>Änderung</th>
          </tr>
        </thead>
        <tbody>
          {game?.players?.map(p => {
            const change = scoreChanges.find(s => s.name === p.name);
            return (
              <tr key={p.id}>
                <td style={{border: '1px solid #ccc', padding: '4px'}}>{p.name}</td>
                <td style={{border: '1px solid #ccc', padding: '4px'}}>{p.points}</td>
                <td style={{border: '1px solid #ccc', padding: '4px', color: change?.diff > 0 ? 'green' : change?.diff < 0 ? 'red' : '#333'}}>
                  {change ? (change.diff > 0 ? `+${change.diff}` : change.diff) : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ul>
        {game?.players?.map(p => (
          <li key={p.id}>{p.name}: {p.points}</li>
        ))}
      </ul>
    </div>
  );

  /**
   * Rendert die Reveal-Phase nach dem Voting
   */
  const renderRevealPhase = () => {
    // Erweiterte Sicherheitschecks
    if (!game) {
      return (
        <div>
          <h3>Lade Auflösung...</h3>
          <p>Spiel wird geladen...</p>
        </div>
      );
    }

    if (!game.selectedCards || game.selectedCards.length === 0) {
      return (
        <div>
          <h3>Lade Auflösung...</h3>
          <p>Warte auf Kartendaten...</p>
        </div>
      );
    }

    if (!game.votes) {
      return (
        <div>
          <h3>Lade Auflösung...</h3>
          <p>Warte auf Abstimmungsergebnisse...</p>
        </div>
      );
    }

    // Versuche Punkteverteilung zu berechnen, mit Fallback
    let pointsDistribution = [];
    try {
      pointsDistribution = calculatePointsDistribution(game);
    } catch (error) {
      console.error('Error calculating points distribution:', error);
      pointsDistribution = [];
    }

    return (
      <div>
        <h3>Auflösung: Wer hat welche Karte gelegt?</h3>
        <p style={{marginBottom: '20px', fontSize: '18px'}}>
          Hinweis war: <span style={{color:'#007bff', fontWeight: 'bold'}}>{game?.hint}</span>
        </p>

        {/* Karten-Auflösung */}
        {revealInfo && revealInfo.length > 0 ? (
          <div style={{display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center', marginBottom: '32px'}}>
            {revealInfo.map(info => {
              // Karte suchen
              const combinedCards = [...allCards, ...(game?.players?.flatMap(p => p.hand) || [])];
              let card = combinedCards.find(c => c.id === info.cardId);
              if (!card) {
                card = {
                  id: info.cardId,
                  title: `Karte ${info.cardId}`,
                  image: `https://placehold.co/300x200?text=Karte+${info.cardId}`
                };
              }
              return (
                <div key={info.cardId} style={{
                  border: info.isStoryteller ? '4px solid #007bff' : '2px solid #ccc',
                  padding: '12px',
                  borderRadius: '12px',
                  background: info.isStoryteller ? '#e3f2fd' : '#fff',
                  minWidth: '220px',
                  textAlign: 'center',
                  boxShadow: info.isStoryteller ? '0 4px 8px rgba(0,123,255,0.3)' : '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  <Card card={card} />
                  <div style={{marginTop: '12px', fontSize: '16px'}}>
                    <strong>{info.playerName}</strong>
                    {info.isStoryteller && (
                      <div style={{
                        color:'#007bff',
                        fontWeight: 'bold',
                        marginTop: '4px',
                        padding: '4px 8px',
                        background: '#fff',
                        borderRadius: '8px',
                        border: '1px solid #007bff'
                      }}>
                        🎭 Erzähler
                      </div>
                    )}
                  </div>
                  <div style={{
                    marginTop: '8px',
                    padding: '4px 8px',
                    background: info.votes > 0 ? '#28a745' : '#6c757d',
                    color: 'white',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}>
                    {info.votes} Stimme{info.votes !== 1 ? 'n' : ''}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{textAlign: 'center', marginBottom: '32px'}}>
            <p>Lade Kartendaten...</p>
          </div>
        )}

        {/* Punkteverteilung */}
        <div style={{
          background: '#f8f9fa',
          border: '2px solid #28a745',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px'
        }}>
          <h4 style={{color: '#28a745', textAlign: 'center', marginBottom: '16px'}}>
            💰 Punkteverteilung dieser Runde
          </h4>
          {pointsDistribution.length > 0 ? (
            <div style={{display: 'grid', gap: '8px'}}>
              {pointsDistribution.map((dist, index) => (
                <div key={index} style={{
                  background: '#fff',
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <strong>{dist.playerName}</strong>
                    <div style={{fontSize: '14px', color: '#666'}}>{dist.reason}</div>
                  </div>
                  <div style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: dist.points > 0 ? '#28a745' : '#6c757d',
                    minWidth: '60px',
                    textAlign: 'center'
                  }}>
                    {dist.points > 0 ? `+${dist.points}` : dist.points}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{textAlign: 'center', color: '#666'}}>
              Berechne Punkteverteilung...
            </div>
          )}
        </div>

        {/* Button zur nächsten Runde */}
        <div style={{textAlign: 'center'}}>
          <button
            style={{
              padding: '12px 24px',
              fontSize: '18px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
            onClick={handleContinueToNextRound}
            onMouseOver={(e) => e.target.style.backgroundColor = '#0056b3'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#007bff'}
          >
            Nächste Runde starten →
          </button>
        </div>
      </div>
    );
  };

  /**
   * Rendert den Spielende-Bildschirm
   */
  const renderGameEndPhase = () => {
    const winner = gameWinner?.winner || game?.winner;
    const finalScores = gameWinner?.finalScores || game?.players;

    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <h1 style={{
          color: '#28a745',
          fontSize: '48px',
          marginBottom: '20px',
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
        }}>
          🎉 Spiel beendet! 🎉
        </h1>

        <h2 style={{
          color: '#007bff',
          fontSize: '36px',
          marginBottom: '30px'
        }}>
          🏆 {winner} hat gewonnen! 🏆
        </h2>

        {/* Finales Scoreboard */}
        <div style={{
          background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
          border: '3px solid #28a745',
          borderRadius: '16px',
          padding: '30px',
          marginBottom: '30px',
          maxWidth: '600px',
          margin: '0 auto 30px auto',
          boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{
            color: '#28a745',
            marginBottom: '20px',
            fontSize: '24px'
          }}>
            🏅 Endstand
          </h3>

          {/* Sortiere Spieler nach Punkten */}
          {finalScores && [...finalScores]
            .sort((a, b) => b.points - a.points)
            .map((player, index) => (
              <div key={player.id || player.name} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 20px',
                margin: '8px 0',
                background: player.name === winner
                  ? 'linear-gradient(90deg, #28a745, #34ce57)'
                  : index === 1
                    ? 'linear-gradient(90deg, #ffc107, #ffcd39)'
                    : index === 2
                      ? 'linear-gradient(90deg, #6c757d, #868e96)'
                      : '#fff',
                color: index < 3 ? 'white' : '#333',
                borderRadius: '12px',
                border: player.name === winner ? '2px solid #28a745' : '1px solid #dee2e6',
                fontSize: '18px',
                fontWeight: 'bold'
              }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ marginRight: '12px', fontSize: '20px' }}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                  </span>
                  <span>{player.name}</span>
                </div>
                <span style={{ fontSize: '24px' }}>{player.points} Punkte</span>
              </div>
            ))}
        </div>

        {/* Restart Button */}
        <button
          onClick={handleRestartGame}
          style={{
            padding: '15px 30px',
            fontSize: '20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontWeight: 'bold',
            boxShadow: '0 4px 8px rgba(0,123,255,0.3)',
            transition: 'all 0.3s ease'
          }}
          onMouseOver={(e) => {
            e.target.style.backgroundColor = '#0056b3';
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 6px 12px rgba(0,123,255,0.4)';
          }}
          onMouseOut={(e) => {
            e.target.style.backgroundColor = '#007bff';
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 8px rgba(0,123,255,0.3)';
          }}
        >
          🎮 Neues Spiel starten
        </button>
      </div>
    );
  };

  // === MAIN RENDER ===
  if (!game) return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>🎮</div>
        <h2>Warte auf Spielstart...</h2>
      </div>
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '25px',
          background: 'rgba(255,255,255,0.1)',
          padding: '20px',
          borderRadius: '16px',
          backdropFilter: 'blur(10px)',
          color: 'white'
        }}>
          <h1 style={{
            margin: '0 0 10px 0',
            fontSize: '32px',
            textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
          }}>
            🎨 Don't Choose Me - Spielraum: {gameId}
          </h1>
          <p style={{ margin: 0, opacity: 0.9, fontSize: '16px' }}>
            Aktueller Spieler: <strong>{playerName}</strong> |
            Erzähler: <strong>{game?.players?.[game?.storytellerIndex]?.name}</strong>
          </p>
        </div>

        {/* Permanentes Scoreboard */}
        {game.state === 'playing' && renderScoreboard()}

        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '20px' }}>
          {phase === 'waiting' && renderWaitingPhase()}
          {phase === 'giveHint' && renderGiveHintPhase()}
          {phase === 'chooseCard' && renderChooseCardPhase()}
          {phase === 'vote' && renderVotePhase()}
          {phase === 'reveal' && renderRevealPhase()}
          {phase === 'results' && renderResultsPhase()}
          {phase === 'gameEnd' && renderGameEndPhase()}
        </div>
      </div>
    </div>
  );
}

export default Game;
