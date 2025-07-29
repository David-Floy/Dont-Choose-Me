import React, { useEffect, useState, useRef } from 'react';
import Card from './Card';
import VolumeControl from './VolumeControl';
import audioManager from '../utils/AudioManager';
import './Game.css'; // CSS-Import

const API_BASE = '/api';

/**
 * Main game component for the PicMe game
 * @param {string} props.gameId - ID of the game room
 */
function Game({ playerName, gameId, onLeaveGame, volume, setVolume }) {
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
  const [playerId, setPlayerId] = useState(localStorage.getItem('playerId'));
  const [lastPhase, setLastPhase] = useState(null); // Referenz für den letzten Phasenstatus
  const phaseNotificationSound = useRef(new Audio('/sounds/phase-change.mp3'));

  // Polling for game status
  useEffect(() => {
    let interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/game`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId, action: 'getState', playerName })
        });
        if (response.ok) {
          const data = await response.json();
          setGame(data.game);
          updateHand(data.game);
          setMixedCards(data.game.mixedCards || []);
        }
      } catch (error) {
        console.error('Error polling game state:', error);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [gameId, playerName]);

  // Load cards
  useEffect(() => {
    fetch('/api/cards')
      .then(res => res.json())
      .then(cards => setAllCards(cards))
      .catch(() => setAllCards([]));
  }, []);

  // Helper function: Update hand
  const updateHand = (gameData) => {
    if (gameData && gameData.players) {
      const me = gameData.players.find(p => p.name === playerName);
      setHand(me?.hand || []);
    }
  };

  /**
   * Renders the permanent scoreboard
   */
  const renderScoreboard = () => (
    <div className="scoreboard-container">
      <h4 className="scoreboard-title">
        🏆 Aktuelle Punkte
      </h4>
      <div className="scoreboard-grid">
        {game?.players?.map(p => {
          const isCurrentPlayer = p.name === playerName;
          const isStoryteller = p.name === game?.players?.[game?.storytellerIndex]?.name;

          return (
          <div key={p.id} className={`scoreboard-player ${isCurrentPlayer ? 'current-player' : ''} ${isStoryteller ? 'storyteller' : ''}`}>
            {/* Fancy Umrandung für den aktuellen Spieler */}
            {isCurrentPlayer && (
              <div className="current-player-badge">
                🫵 You 🫵
              </div>
            )}
            <div className="player-name">{p.name}</div>
            <div className="player-points">{p.points}</div>
            {isStoryteller && (
              <div className="storyteller-indicator">🎭 Erzähler</div>
            )}
          </div>
        )})}
      </div>
    </div>
  );

  /**
   * Handles card selection
   */
  const handleChooseCard = async (cardId) => {
    try {
      // Setze selectedCard zuerst, um die UI sofort zu aktualisieren
      setSelectedCard(cardId);

      const response = await fetch(`${API_BASE}/game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          action: 'chooseCard',
          cardId,
          playerName
        })
      });

      if (!response.ok) {
        console.error('Fehler beim Wählen der Karte:', await response.text());
        // Rollback, falls fehlgeschlagen
        setSelectedCard(null);
      }
    } catch (error) {
      console.error('Error choosing card:', error);
      // Rollback bei Netzwerkfehler
      setSelectedCard(null);
    }
  };

  /**
   * Renders the card selection phase
   */
  const renderChooseCardPhase = () => (
    <div className="choose-card-phase">
      <h3 className="choose-card-title">
        💭 Wähle deine Karte
      </h3>
      <div className="choose-card-info">
        <p className="hint-text">
          Hinweis des Erzählers: <span className="hint-highlight">{game?.hint}</span>
        </p>
        <p className="selection-progress">
          Spieler haben bereits gewählt: {game?.selectedCards?.length || 0} / {game?.players?.length || 0}
        </p>
      </div>

      {hand.length === 0 ? (
        <div className="no-cards-warning">
          <p className="no-cards-text">
            ❌ Keine Karten in der Hand gefunden!
          </p>
          <button
            onClick={async () => {
              try {
                const response = await fetch(`${API_BASE}/game`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ gameId, action: 'getState', playerName })
                });
                if (response.ok) {
                  const data = await response.json();
                  setGame(data.game);
                  updateHand(data.game);
                }
              } catch (error) {
                console.error('Error refreshing game state:', error);
              }
            }}
            className="refresh-hand-button"
          >
            🔄 Hand neu laden
          </button>
        </div>
      ) : (
        <div className="card-selection-grid">
          {hand.map(card => (
            <div key={card.id} className="card-selection-item">
              {selectedCard === card.id && (
                <div className="card-selected-indicator">
                  ✅ Gewählt
                </div>
              )}
              <Card
                card={card}
                onClick={() => handleChooseCard(card.id)}
                selected={selectedCard === card.id}
                className="selectable-card"
              />
              {/* Bestätigungsbutton für gewählte Karte */}
              {selectedCard === card.id && (
                <div className="confirm-selection-button-container">
                  <button
                    onClick={() => handleChooseCard(card.id)}
                    className="confirm-selection-button"
                  >
                    <span>Bestätigen</span> ✓
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Helper function: Calculate current phase
  useEffect(() => {
    if (game) {
      let newPhase = 'waiting';

      if (game.phase === 'gameEnd' || game.winner) {
        newPhase = 'gameEnd';
        setGameWinner({ winner: game.winner, finalScores: game.players });
      } else if (game.phase === 'storytelling') {
        const storyteller = game.players?.[game.storytellerIndex];
        newPhase = storyteller?.name === playerName ? 'giveHint' : 'waiting';

        // Reset selectedCard ONLY when entering a new storytelling phase
        // AND when there is no storyteller card set yet
        if (storyteller?.name === playerName && game.storytellerCard === undefined) {
          setSelectedCard(null);
          setHint('');
        }
      } else if (game.phase === 'selectCards') {
        // Prüfe, ob der Spieler bereits eine Karte ausgewählt hat
        const hasSelectedCard = game.selectedCards?.some(sc => {
          const player = game.players.find(p => p.id === sc.playerId);
          return player?.name === playerName;
        });

        // Wenn der Spieler bereits eine Karte ausgewählt hat, setze selectedCard
        // damit der UI-Zustand korrekt ist
        if (hasSelectedCard && !selectedCard) {
          const mySelectedCardInfo = game.selectedCards?.find(sc => {
            const player = game.players.find(p => p.id === sc.playerId);
            return player?.name === playerName;
          });
          if (mySelectedCardInfo) {
            setSelectedCard(mySelectedCardInfo.cardId);
          }
        }

        const storyteller = game.players?.[game.storytellerIndex];
        newPhase = (storyteller?.name === playerName || hasSelectedCard) ? 'waiting' : 'chooseCard';
      } else if (game.phase === 'voting') {
        const storyteller = game.players?.[game.storytellerIndex];
        const hasVoted = game.votes?.some(v => {
          const player = game.players.find(p => p.id === v.playerId);
          return player?.name === playerName;
        });
        // FIX: Verbesserte Bedingungsprüfung für die Voting-Phase
        if (storyteller?.name === playerName) {
          newPhase = 'voteWatch'; // Phase für den Erzähler
        } else if (hasVoted) {
          newPhase = 'waitingAfterVote'; // Phase für Spieler, die bereits abgestimmt haben
        } else {
          newPhase = 'vote'; // Standard Voting-Phase
        }
      } else if (game.phase === 'reveal') {
        newPhase = 'reveal';

        // FIX: Stellen Sie sicher, dass RevealInfo korrekt gesetzt ist
        if (!revealInfo && game.votes && game.selectedCards) {
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

          setRevealInfo(revealData);
        }
      }

      // Wenn sich die Phase geändert hat, spiele den Hinweiston ab
      if (lastPhase && newPhase !== lastPhase) {
        try {
          phaseNotificationSound.current.volume = volume * 0.3; // Reduzierte Lautstärke auf 30%
          phaseNotificationSound.current.currentTime = 0;
          phaseNotificationSound.current.play().catch(err => console.log('Konnte Phasenton nicht abspielen:', err));
        } catch (err) {
          console.log('Fehler beim Abspielen des Phasentons:', err);
        }
      }

      setPhase(newPhase);
      setLastPhase(newPhase);

      // Set reveal info
      if (newPhase === 'reveal' && game.votes && game.selectedCards && game.votes.length > 0 && game.selectedCards.length > 0) {
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
        setRevealInfo(revealData);
      } else if (newPhase !== 'reveal') {
        setRevealInfo(null);
        setRevealTimer(null);
      }
    }
  }, [game, playerName, lastPhase, volume]);

  // Aktualisiere die Lautstärke des Notifikationstons, wenn sich die globale Lautstärke ändert
  useEffect(() => {
    if (phaseNotificationSound.current) {
      phaseNotificationSound.current.volume = volume * 0.3; // Reduzierte Lautstärke auf 30%
    }
  }, [volume]);

  // Musik-Management basierend auf Spielphase
  useEffect(() => {
    if (game && game.phase) {
      if (game.phase === 'voting') {
        // Wechsel zu Voting-Musik
        audioManager.playTrack('vote.mp3', true, 1000);
      } else if (game.phase === 'storytelling') {
        // Wechsel zu Storyteller-Musik während der Erzählerphase
        audioManager.playTrack('storyteller.mp3', true, 1000);
      } else {
        // Verwende Lobby-Musik für alle anderen Phasen
        audioManager.playTrack('lobby.mp3', true, 1000);
      }
    }

    return () => {
      // Cleanup beim Verlassen
      audioManager.stopTrack(1000);
    };
  }, [game?.phase]);

  // Set countdown for next round
  useEffect(() => {
    if (phase === 'reveal' && !revealTimer && game?.phase === 'reveal') {
      // Start timer for auto-next-round after 15 seconds
      const timer = setTimeout(() => {
        handleContinueToNextRound();
      }, 15000);
      setRevealTimer(timer);
      return () => clearTimeout(timer);
    }
  }, [phase, revealTimer, game?.phase]);

  // Calculate points distribution
  useEffect(() => {
    if (phase === 'reveal' && !pointsEarned && game?.phase === 'reveal') {
      const points = calculatePointsDistribution(game);
      setPointsEarned(points);
    }
  }, [phase, pointsEarned, game]);

  // Calculate score changes
  useEffect(() => {
    if (game && game.phase === 'reveal' && scoreChanges.length === 0) {
      const playerScores = {};

      // Initialize scores
      game.players.forEach(player => {
        playerScores[player.name] = {
          before: player.points - (player.pointsEarned || 0),
          after: player.points,
          change: player.pointsEarned || 0
        };
      });

      setScoreChanges(Object.entries(playerScores).map(([name, scores]) => ({
        name,
        ...scores
      })));
    }
  }, [game, scoreChanges]);

  // === GAME ACTIONS ===

  /**
   * Handles giving a hint by the storyteller
   */
  const handleGiveHint = async () => {
    // FIX: Verbesserte Validierung im Frontend
    if (!selectedCard) {
      alert('Bitte wähle zuerst eine Karte aus!');
      return;
    }

    // Prüfe, ob die ausgewählte Karte tatsächlich in der Hand ist
    const cardInHand = hand.some(card => card.id === selectedCard);
    if (!cardInHand) {
      alert('Die ausgewählte Karte ist nicht in deiner Hand!');
      setSelectedCard(null);
      return;
    }

    if (!hint.trim()) {
      alert('Bitte gib einen Hinweis ein!');
      return;
    }

    if (hint.trim().length < 2) {
      alert('Der Hinweis muss mindestens 2 Zeichen lang sein!');
      return;
    }

    if (hint.trim().length > 100) {
      alert('Der Hinweis darf maximal 100 Zeichen lang sein!');
      return;
    }

    console.log(`=== GIVING HINT ===`);
    console.log(`Selected card: ${selectedCard}`);
    console.log(`Hint: "${hint.trim()}"`);
    console.log(`Hand cards: ${hand.map(c => c.id).join(', ')}`);

    try {
      const response = await fetch(`${API_BASE}/game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          action: 'giveHint',
          cardId: selectedCard,
          hint: hint.trim(),
          playerName
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Hint successfully given');
        setSelectedCard(null);
        setHint('');
      } else {
        const errorData = await response.json();
        console.error('❌ Error giving hint:', errorData.error);
        alert(`Fehler: ${errorData.error}`);
      }
    } catch (error) {
      console.error('❌ Network error giving hint:', error);
      alert('Verbindungsfehler beim Senden des Hinweises');
    }
  };


  /**
   * Handles voting for a card
   */
  const handleVote = async (cardId) => {
    // FIX: Verhindere Abstimmung für eigene Karte
    const myPlayer = game?.players?.find(p => p.name === playerName);
    const mySelectedCard = game?.selectedCards?.find(sc => {
      const player = game.players.find(p => p.id === sc.playerId);
      return player?.name === playerName;
    });

    if (mySelectedCard && mySelectedCard.cardId === cardId) {
      alert('Du kannst nicht für deine eigene Karte stimmen!');
      return;
    }

    try {
      await fetch(`${API_BASE}/game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          action: 'vote',
          cardId,
          playerName
        })
      });
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  /**
   * Handles transition to next round
   */
  const handleContinueToNextRound = async () => {
    try {
      // Spiele einen Ton ab, wenn eine neue Runde beginnt
      phaseNotificationSound.current.volume = volume * 0.4; // Etwas lauter für Rundenwechsel, aber immer noch leiser (40%)
      phaseNotificationSound.current.currentTime = 0;
      phaseNotificationSound.current.play().catch(err => console.log('Konnte Rundenton nicht abspielen:', err));

      await fetch(`${API_BASE}/game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          action: 'nextRound',
          playerName
        })
      });
    } catch (error) {
      console.error('Error continuing to next round:', error);
    }
  };

  /**
   * Handles game restart
   */
  const handleRestartGame = async () => {
    try {
      await fetch(`${API_BASE}/game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          action: 'restart',
          playerName
        })
      });
      setGameWinner(null);
      setRevealInfo(null);
      setRevealTimer(null);
      setScoreChanges([]);
      setPointsEarned(null);
      setGame(null);
      setPhase('waiting');
      setHand([]);
      setSelectedCard(null);
      setHint('');
      setMixedCards([]);
    } catch (error) {
      console.error('Error restarting game:', error);
    }
  };

  /**
   * Calculates who gets points and why (for reveal phase)
   */
  const calculatePointsDistribution = (game) => {
    if (!game || !game.votes || !Array.isArray(game.votes) || !game.selectedCards || !Array.isArray(game.selectedCards) || game.selectedCards.length === 0) {
      return [];
    }

    if (!game.selectedCards[0] || !game.selectedCards[0].playerId) {
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
   * Renders the waiting phase
   */
  const renderWaitingPhase = () => {
    const isStoryteller = game?.players?.[game?.storytellerIndex]?.name === playerName;

    return (
      <div className="waiting-phase">
        {game?.hint && game.selectedCards?.length < game.players?.length ? (
          <div className="hint-progress-container">
            <div className="hint-progress">
              <p className="hint-text">
                Hinweis: <span className="hint-highlight">{game.hint}</span>
              </p>
              <p className="selection-progress">
                Warte, bis alle Spieler ihre Karten ausgewählt haben...
              </p>
              <p className="selection-progress">
                Fortschritt: {game.selectedCards.length} / {game.players.length} Karten gewählt
              </p>
            </div>

            {/* Storyteller sees already placed cards */}
            {isStoryteller && game.selectedCards.length > 1 && (
              <div className="placed-cards-preview">
                <h4 className="preview-title">Von anderen Spielern gelegte Karten:</h4>
                <div className="preview-grid">
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
                      <div key={`${selectedCard.cardId}-${index}`} className="preview-card">
                        <Card card={card} />
                        <div className="player-name-overlay">
                          {player ? player.name : 'Unbekannt'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Show player's hand during waiting */}
            {hand.length > 0 && (
              <div className="player-hand-preview">
                <h4 className="hand-preview-title">
                  📋 Deine verbleibenden Karten:
                </h4>
                <div className="hand-preview-grid">
                  {hand.map(card => (
                    <div key={card.id} className="hand-card">
                      <Card
                        card={card}
                        className="hand-card-inner"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : game?.phase === 'voting' && isStoryteller ? (
          <div className="voting-info">
            <p>Die Abstimmung läuft...</p>
            <p>Du kannst nicht abstimmen, aber beobachtest das Geschehen.</p>
          </div>
        ) : (
          <div className="waiting-message">
            <p>
              Bitte warten...
            </p>

            {/* Show player's hand during initial waiting */}
            {hand.length > 0 && (
              <div className="player-hand-preview">
                <h4 className="hand-preview-title">
                  📋 Deine Karten:
                </h4>
                <div className="hand-preview-grid">
                  {hand.map(card => (
                    <div key={card.id} className="hand-card">
                      <Card
                        card={card}
                        className="hand-card-inner"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  /**
   * Renders the hint-giving phase for the storyteller
   */
  const renderGiveHintPhase = () => (
    <div className="give-hint-phase">
      <h3 className="give-hint-title">
        🎭 Du bist der Erzähler!
      </h3>
      <p className="give-hint-description">
        Wähle eine Karte aus deiner Hand und gib einen kreativen Hinweis
      </p>

      {/* Validation Status */}
      <div className="validation-status">
        <div className={`status-item ${selectedCard ? 'valid' : 'invalid'}`}>
          {selectedCard ? '✅' : '⚠️'} Karte: {selectedCard ? 'Ausgewählt' : 'Keine ausgewählt'}
        </div>
        <div className={`status-item ${hint.trim().length >= 2 ? 'valid' : 'invalid'}`}>
          {hint.trim().length >= 2 ? '✅' : '⚠️'} Hinweis: {hint.trim().length}/100 Zeichen
        </div>
      </div>

      {/* Hinweis-Eingabe mit Button - Mobile optimiert */}
      <div className="hint-input-container">
        <input
          value={hint}
          onChange={e => setHint(e.target.value)}
          placeholder="Gib deinen Hinweis ein... (min. 2 Zeichen)"
          maxLength="100"
          className="hint-input"
          onKeyPress={(e) => {
            if (e.key === 'Enter' && selectedCard && hint.trim().length >= 2) {
              handleGiveHint();
            }
          }}
        />
        <button
          onClick={handleGiveHint}
          disabled={!selectedCard || hint.trim().length < 2}
          className="give-hint-button"
        >
          {!selectedCard ? 'Karte wählen' : hint.trim().length < 2 ? 'Hinweis eingeben' : 'Hinweis geben'}
        </button>
      </div>

      {/* Informationstext */}
      <div className="hint-tip">
        💡 <strong>Tipp:</strong> Gib einen kreativen Hinweis, der nicht zu offensichtlich, aber auch nicht zu schwer ist.
        Andere Spieler müssen deine Karte unter allen eingereichten Karten erraten!
      </div>

      {/* Kartenauswahl - Responsive Grid Layout */}
      <div className="hand-card-selection">
        {hand.length === 0 ? (
          <div className="no-cards-warning">
            ⚠️ Keine Karten in der Hand! Lade die Seite neu.
          </div>
        ) : (
          <div className="card-selection-grid">
            {hand.map(card => (
              <div key={card.id} className="card-selection-item">
                {selectedCard === card.id && (
                  <div className="card-selected-indicator">
                    ✨ Ausgewählt
                  </div>
                )}
                <Card
                  card={card}
                  onClick={() => {
                    setSelectedCard(card.id);
                    console.log(`Selected card: ${card.id} (${card.title})`);
                  }}
                  selected={selectedCard === card.id}
                  className="selectable-card"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  /**
   * Renders the voting phase
   */
  const renderVotePhase = () => {
    const myPlayer = game?.players?.find(p => p.name === playerName);
    const mySelectedCard = game?.selectedCards?.find(sc => {
      const player = game.players.find(p => p.id === sc.playerId);
      return player?.name === playerName;
    });

    return (
      <div className="vote-phase">
        <h3 className="vote-title">
          🗳️ Wähle die Karte des Erzählers
        </h3>

        <div className="vote-info">
          <p className="hint-text">
            Hinweis: <span className="hint-highlight">{game?.hint}</span>
          </p>
          <p className="vote-description">
            Stimme für die Karte ab, von der du glaubst, dass sie vom Erzähler stammt.
          </p>
          <p className="vote-warning">
            <strong>Achtung:</strong> Du kannst nicht für deine eigene Karte stimmen!
          </p>
        </div>

        <div className="card-selection-grid">
          {mixedCards && mixedCards.length > 0 ? mixedCards.map(({ cardId }) => {
            const combinedCards = [...allCards, ...(game?.players?.flatMap(p => p.hand) || [])];
            let card = combinedCards.find(c => c.id === cardId);

            if (!card) {
              card = {
                id: cardId,
                title: `Karte ${cardId}`,
                image: `https://placehold.co/300x200?text=Karte+${cardId}`
              };
            }

            // Prüfe ob das die eigene Karte ist
            const isMyCard = mySelectedCard && mySelectedCard.cardId === cardId;

            return (
              <div key={cardId} className="card-selection-item">
                {isMyCard && (
                  <div className="my-card-indicator">
                    🏷️ Deine Karte
                  </div>
                )}
                <Card
                  card={card}
                  onClick={() => !isMyCard && handleVote(cardId)}
                  className={`votable-card${isMyCard ? ' my-selected-card' : ''}`}
                />
              </div>
            );
          }) : null}
        </div>
      </div>
    );
  };

  /**
   * Renders the vote watch phase for the storyteller
   */
  const renderVoteWatchPhase = () => {
    // mySelectedCard analog zu renderVotePhase definieren
    const mySelectedCard = game?.selectedCards?.find(sc => {
      const player = game.players.find(p => p.id === sc.playerId);
      return player?.name === playerName;
    });

    return (
      <div className="vote-watch-phase">
        <h3 className="vote-watch-title">
          🎭 Als Erzähler siehst du zu
        </h3>

        <div className="vote-watch-info">
          <p className="hint-text">
            Dein Hinweis: <span className="hint-highlight">{game?.hint}</span>
          </p>
          <p className="vote-watch-description">
            Die anderen Spieler stimmen jetzt ab, welche Karte deine sein könnte.
          </p>
        </div>

        {/* Fortschritts-Anzeige */}
        <div className="progress-container">
          <p className="progress-title">
            🗳️ Abstimmungs-Fortschritt:
          </p>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${Math.round((game?.votes?.length / (game?.players?.length - 1)) * 100) || 0}%` }} />
            <div className="progress-text">
              {game?.votes?.length || 0} / {(game?.players?.length || 1) - 1} Stimmen
            </div>
          </div>
        </div>

        {/* Kartenansicht */}
        <div className="card-reveal-grid">
          {mixedCards && mixedCards.map(({ cardId }) => {
            const combinedCards = [...allCards, ...(game?.players?.flatMap(p => p.hand) || [])];
            let card = combinedCards.find(c => c.id === cardId);

            if (!card) {
              card = {
                id: cardId,
                title: `Karte ${cardId}`,
                image: `https://placehold.co/300x200?text=Karte+${cardId}`
              };
            }

            // Prüfe ob das die Erzähler-Karte ist
            const isMyCard = cardId === game.storytellerCard;

            return (
              <div key={cardId} className="card-reveal-item">
                {isMyCard && (
                  <div className="my-card-indicator">
                    🏷️ Deine Karte
                  </div>
                )}
                <Card
                  card={card}
                  onClick={() => !isMyCard && handleVote(cardId)}
                  className={`votable-card${mySelectedCard && mySelectedCard.cardId === cardId ? ' my-selected-card' : ''}`}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /**
   * Renders the waiting phase after voting
   */
  const renderWaitingAfterVotePhase = () => {
    return (
      <div className="waiting-after-vote-phase">
        <h3 className="waiting-after-vote-title">
          ✅ Abstimmung abgeschlossen
        </h3>

        <div className="waiting-after-vote-info">
          <p className="hint-text">
            Hinweis war: <span className="hint-highlight">{game?.hint}</span>
          </p>
          <p className="waiting-description">
            Warte, bis alle anderen Spieler abgestimmt haben...
          </p>
          <p className="selection-progress">
            Fortschritt: {game?.votes?.length || 0} / {(game?.players?.length || 1) - 1} Stimmen
          </p>
        </div>

        {/* Zeigt die abgegebenen Karten an */}
        <div className="card-reveal-grid">
          {mixedCards && mixedCards.map(({ cardId }) => {
            const combinedCards = [...allCards, ...(game?.players?.flatMap(p => p.hand) || [])];
            let card = combinedCards.find(c => c.id === cardId);

            if (!card) {
              card = {
                id: cardId,
                title: `Karte ${cardId}`,
                image: `https://placehold.co/300x200?text=Karte+${cardId}`
              };
            }

            // Prüfe ob das die eigene Karte ist
            const mySelectedCard = game?.selectedCards?.find(sc => {
              const player = game.players.find(p => p.id === sc.playerId);
              return player?.name === playerName && sc.cardId === cardId;
            });

            return (
              <div key={cardId} className="card-reveal-item">
                {mySelectedCard && (
                  <div className="my-card-indicator">
                    🏷️ Deine Karte
                  </div>
                )}

                <Card
                  card={card}
                  style={{
                    opacity: 0.9,
                    border: mySelectedCard
                      ? '3px solid #28a745'
                      : '2px solid rgba(255,255,255,0.3)',
                    borderRadius: '12px',
                    transition: 'all 0.3s ease',
                    maxWidth: '100%',
                    width: '100%'
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Voting-Status */}
        <div className="voting-status">
          <p className="voting-status-title">
            📊 Bereits abgestimmt:
          </p>
          <div className="voting-status-list">
            {game?.votes?.map((vote, index) => {
              const voter = game.players.find(p => p.id === vote.playerId);
              return (
                <span key={index} className="voter-indicator">
                  ✅ {voter ? voter.name : 'Unbekannt'}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  /**
   * Renders the reveal phase after voting
   */
  const renderRevealPhase = () => {
    if (!game) {
      return (
        <div className="loading-reveal">
          <h3>Lade Auflösung...</h3>
          <p>Spiel wird geladen...</p>
          <button
            onClick={async () => {
              try {
                const response = await fetch(`${API_BASE}/game`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ gameId, action: 'getState', playerName })
                });
                if (response.ok) {
                  const data = await response.json();
                  setGame(data.game);
                }
              } catch (error) {
                console.error('Error refreshing game state:', error);
              }
            }}
            className="refresh-game-data-button"
          >
            🔄 Daten aktualisieren
          </button>
        </div>
      );
    }

    return (
      <div className="reveal-phase">
        <h3 className="reveal-title">
          🎯 Auflösung: Wer hat welche Karte gelegt?
        </h3>

        <div className="reveal-info">
          <p className="hint-text">
            Hinweis war: <span className="hint-highlight">{game?.hint}</span>
          </p>
        </div>

        {/* Karten-Auflösung */}
        {revealInfo && revealInfo.length > 0 ? (
          <div className="reveal-cards-grid">
            {revealInfo.map(info => {
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
                <div key={info.cardId} className="reveal-card-item">
                  {info.isStoryteller && (
                    <div className="storyteller-card-indicator">
                      🎭 Erzähler-Karte
                    </div>
                  )}

                  <Card
                    card={card}
                    className={`reveal-card ${info.isStoryteller ? 'storyteller-card' : ''}`}
                  />

                  <div className="reveal-card-info">
                    <p className="player-name">
                      {info.playerName}
                    </p>
                    {info.votes > 0 && (
                      <div className="votes-info">
                        <span className="votes-count">{info.votes}</span>
                        <span className="votes-label">{info.votes === 1 ? 'Stimme' : 'Stimmen'}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="loading-reveal-message">
            <p>Lade Kartendaten...</p>
            <button
              onClick={async () => {
                try {
                  // Manuelle Neuberechnung der RevealInfo
                  if (game && game.votes && game.selectedCards) {
                    const votesPerCard = {};
                    game.votes.forEach(v => {
                      votesPerCard[v.cardId] = (votesPerCard[v.cardId] || 0) + 1;
                    });

                    const newRevealData = game.selectedCards.map(sc => {
                      const player = game.players.find(p => p.id === sc.playerId);
                      return {
                        cardId: sc.cardId,
                        playerName: player ? player.name : 'Unbekannt',
                        isStoryteller: sc.cardId === game.storytellerCard,
                        votes: votesPerCard[sc.cardId] || 0
                      };
                    });

                    setRevealInfo(newRevealData);
                  }
                } catch (error) {
                  console.error('Error recalculating reveal data:', error);
                }
              }}
              className="refresh-reveal-data-button"
            >
              🔄 Ergebnisse laden
            </button>
          </div>
        )}

        {/* Punkteverteilung */}
        {pointsEarned && pointsEarned.length > 0 && (
          <div className="points-distribution">
            <h4 className="points-title">
              🏆 Punkte in dieser Runde
            </h4>

            <div className="points-list">
              {pointsEarned.map((item, index) => (
                <div key={index} className="points-item">
                  <p className="player-name">{item.playerName}</p>
                  <div className="points-details">
                    <span className="points-change">+{item.points}</span>
                    <span className="points-reason">{item.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Countdown-Timer */}
        {revealTimer && (
          <div className="countdown-timer">
            <button
              onClick={handleContinueToNextRound}
              className="continue-next-round-button"
            >
              <span>Nächste Runde</span>
              <span className="countdown-timer-label">(automatisch in 15s)</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  /**
   * Renders the results phase
   */
  const renderResultsPhase = () => {
    // Weiterleitungsfunktion zur Reveal-Phase, da sie im Wesentlichen gleich sind
    return renderRevealPhase();
  };

  /**
   * Renders the game end phase
   */
  const renderGameEndPhase = () => {
    if (!gameWinner) return <div>Lade Spielergebnis...</div>;

    return (
      <div className="game-end-phase">
        <h2 className="game-end-title">
          🎉 Spiel beendet!
        </h2>

        <div className="game-end-content">
          <h3 className="winner-announcement">
            {gameWinner.winner} gewinnt! 🏆
          </h3>

          {/* Final Scores */}
          <div className="final-scores-grid">
            {gameWinner.finalScores.sort((a, b) => b.points - a.points).map(player => (
              <div key={player.id} className={`final-score-item ${player.name === gameWinner.winner ? 'winner' : ''}`}>
                <div className="player-name">
                  {player.name === gameWinner.winner && '👑 '}
                  {player.name}
                </div>
                <div className="player-points">
                  {player.points}
                </div>
                {player.name === gameWinner.winner && (
                  <div className="winner-badge">
                    Gewinner!
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleRestartGame}
          className="restart-game-button"
        >
          🔄 Neues Spiel starten
        </button>
      </div>
    );
  };

  // === MAIN RENDER ===
  if (!game) return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-icon">🎮</div>
        <h2 className="loading-title">Warte auf Spielstart...</h2>
      </div>
    </div>
  );

  const handleVolumeChange = (newVolume) => {
    setVolume(newVolume);
  };

  return (
    <div className="game-container">
      {/* VolumeControl positioniert sich selbst */}
      <VolumeControl volume={volume} onChange={handleVolumeChange} />

      <div className="game-content">
        <div className="game-header">
          <h1 className="game-title">
            🎨 Don't Choose Me - {gameId}
          </h1>
          <p className="game-info">
            Spieler: <strong>{playerName}</strong> |
            Erzähler: <strong>{game?.players?.[game?.storytellerIndex]?.name}</strong>
          </p>

          {/* Audio Indicator - nur auf größeren Bildschirmen */}
          {window.innerWidth >= 768 && (
            <div className="audio-indicator">
              🎵 {game?.phase === 'voting' ? 'Voting Music' :
                  game?.phase === 'storytelling' ? 'Storyteller Music' : 'Lobby Music'}
            </div>
          )}
        </div>

        {/* Permanent scoreboard */}
        {game && game.state === 'playing' && renderScoreboard()}

        <div className="game-main">
          {phase === 'waiting' && renderWaitingPhase()}
          {phase === 'giveHint' && renderGiveHintPhase()}
          {phase === 'chooseCard' && renderChooseCardPhase()}
          {phase === 'vote' && renderVotePhase()}
          {phase === 'voteWatch' && renderVoteWatchPhase()}
          {phase === 'waitingAfterVote' && renderWaitingAfterVotePhase()}
          {phase === 'reveal' && renderRevealPhase()}
          {phase === 'results' && renderResultsPhase()}
          {phase === 'gameEnd' && renderGameEndPhase()}
        </div>
      </div>
    </div>
  );
}

export default Game;
