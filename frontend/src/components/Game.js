import React, { useEffect, useState, useRef } from 'react';
import Card from './Card';
import VolumeControl from './VolumeControl';
import audioManager from '../utils/AudioManager';

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
    <div style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      border: 'none',
      borderRadius: '16px',
      padding: window.innerWidth < 768 ? '15px' : '20px',
      marginBottom: '20px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
      color: 'white'
    }}>
      <h4 style={{
        margin: '0 0 15px 0',
        textAlign: 'center',
        fontSize: 'clamp(18px, 4vw, 22px)',
        textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
      }}>
        🏆 Aktuelle Punkte
      </h4>
      <div style={{
        display: 'grid',
        gridTemplateColumns: window.innerWidth < 480
          ? '1fr'
          : window.innerWidth < 768
            ? 'repeat(2, 1fr)'
            : 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: window.innerWidth < 768 ? '8px' : '12px'
      }}>
        {game?.players?.map(p => {
          const isCurrentPlayer = p.name === playerName;
          const isStoryteller = p.name === game?.players?.[game?.storytellerIndex]?.name;

          return (
          <div key={p.id} style={{
            textAlign: 'center',
            padding: window.innerWidth < 768 ? '12px' : '16px',
            background: isStoryteller
              ? 'linear-gradient(135deg, #ffd700, #ffed4a)'
              : isCurrentPlayer
                ? 'linear-gradient(135deg, #4facfe, #00f2fe)'
                : 'rgba(255,255,255,0.2)',
            borderRadius: '12px',
            border: isCurrentPlayer
              ? '3px solid #00f2fe'
              : isStoryteller
                ? '3px solid #ffd700'
                : '2px solid rgba(255,255,255,0.3)',
            color: (isStoryteller || isCurrentPlayer) ? '#333' : 'white',
            backdropFilter: 'blur(10px)',
            boxShadow: isCurrentPlayer
              ? '0 4px 16px rgba(0,242,254,0.4)'
              : '0 4px 12px rgba(0,0,0,0.2)',
            transition: 'all 0.3s ease',
            position: 'relative',
            overflow: 'visible'
          }}>
            {/* Fancy Umrandung für den aktuellen Spieler */}
            {isCurrentPlayer && (
              <div style={{
                position: 'absolute',
                top: '-12px',
                left: '0',
                right: '0',
                textAlign: 'center',
                fontSize: 'clamp(12px, 2.5vw, 14px)',
                fontWeight: 'bold',
                color: '#333',
                background: '#4facfe',
                padding: '4px 10px',
                borderRadius: '20px',
                margin: '0 auto',
                width: 'fit-content',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                border: '2px solid white',
                whiteSpace: 'nowrap',
                zIndex: 2
              }}>
                🫵 You 🫵
              </div>
            )}
            <div style={{
              fontWeight: 'bold',
              fontSize: 'clamp(12px, 3vw, 16px)',
              marginBottom: '6px',
              wordBreak: 'break-word',
              marginTop: isCurrentPlayer ? '8px' : '0'
            }}>{p.name}</div>
            <div style={{
              fontSize: 'clamp(18px, 5vw, 24px)',
              fontWeight: 'bold',
              marginBottom: '4px'
            }}>{p.points}</div>
            {isStoryteller && (
              <div style={{
                fontSize: 'clamp(10px, 2vw, 12px)',
                fontWeight: 'bold'
              }}>🎭 Erzähler</div>
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
    <div style={{
      padding: '15px',
      background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      borderRadius: '16px',
      color: 'white',
      textAlign: 'center'
    }}>
      <h3 style={{
        margin: '0 0 10px 0',
        fontSize: 'clamp(20px, 5vw, 24px)',
        textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
      }}>
        💭 Wähle deine Karte
      </h3>
      <div style={{
        background: 'rgba(255,255,255,0.15)',
        padding: '12px',
        borderRadius: '12px',
        marginBottom: '15px',
        backdropFilter: 'blur(10px)'
      }}>
        <p style={{
          fontSize: 'clamp(14px, 3.5vw, 18px)',
          margin: '0 0 8px 0',
          wordBreak: 'break-word'
        }}>
          Hinweis des Erzählers: <span style={{color:'#ffd700', fontWeight: 'bold', fontSize: 'clamp(16px, 4vw, 20px)'}}>{game?.hint}</span>
        </p>
        <p style={{
          fontSize: 'clamp(12px, 2.5vw, 14px)',
          opacity: 0.9,
          margin: 0
        }}>
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
          <p style={{color: 'white', fontSize: 'clamp(16px, 4vw, 18px)', margin: '0 0 15px 0'}}>
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
            style={{
              padding: '10px 20px',
              fontSize: 'clamp(14px, 3vw, 16px)',
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
          padding: '15px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)'
        }}>
          {/* Responsive Grid Layout für Kartenauswahl */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: window.innerWidth < 480
              ? '1fr'
              : window.innerWidth < 768
                ? 'repeat(2, 1fr)'
                : 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: window.innerWidth < 768 ? '15px' : '20px',
            maxWidth: '1000px',
            margin: '0 auto'
          }}>
            {hand.map(card => (
              <div key={card.id} style={{
                position: 'relative',
                display: 'flex',
                justifyContent: 'center'
              }}>
                {selectedCard === card.id && (
                  <div style={{
                    position: 'absolute',
                    top: '-8px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#28a745',
                    color: 'white',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: 'clamp(10px, 2vw, 12px)',
                    fontWeight: 'bold',
                    zIndex: 1,
                    boxShadow: '0 3px 6px rgba(0,0,0,0.3)',
                    whiteSpace: 'nowrap'
                  }}>
                    ✅ Gewählt
                  </div>
                )}
                <Card
                  card={card}
                  onClick={() => handleChooseCard(card.id)}
                  selected={selectedCard === card.id}
                  style={{
                    transform: selectedCard === card.id ? 'scale(1.02)' : 'scale(1)',
                    boxShadow: selectedCard === card.id
                      ? '0 8px 24px rgba(40,167,69,0.4)'
                      : '0 4px 12px rgba(0,0,0,0.2)',
                    border: selectedCard === card.id ? '3px solid #28a745' : '2px solid rgba(255,255,255,0.3)',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    maxWidth: '100%',
                    width: '100%'
                  }}
                />
                {/* Bestätigungsbutton für gewählte Karte */}
                {selectedCard === card.id && (
                  <div style={{
                    position: 'absolute',
                    bottom: '-15px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginTop: '10px'
                  }}>
                    <button
                      onClick={() => handleChooseCard(card.id)}
                      style={{
                        padding: '5px 15px',
                        background: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        fontSize: 'clamp(10px, 2vw, 12px)',
                        fontWeight: 'bold',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <span>Bestätigen</span> ✓
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
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
      <div>
        {game?.hint && game.selectedCards?.length < game.players?.length ? (
          <div>
            <div style={{
              background: 'rgba(255,255,255,0.15)',
              padding: '15px',
              borderRadius: '12px',
              marginBottom: '20px',
              backdropFilter: 'blur(10px)',
              textAlign: 'center'
            }}>
              <p style={{ fontSize: '18px', margin: '0 0 10px 0' }}>
                Hinweis: <span style={{color:'#ffd700', fontWeight: 'bold', fontSize: '20px'}}>{game.hint}</span>
              </p>
              <p style={{ fontSize: '14px', opacity: 0.9, margin: 0 }}>
                Warte, bis alle Spieler ihre Karten ausgewählt haben...
              </p>
              <p style={{ fontSize: '14px', fontWeight: 'bold', margin: '5px 0 0 0' }}>
                Fortschritt: {game.selectedCards.length} / {game.players.length} Karten gewählt
              </p>
            </div>

            {/* Storyteller sees already placed cards */}
            {isStoryteller && game.selectedCards.length > 1 && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ textAlign: 'center', marginBottom: '15px' }}>Von anderen Spielern gelegte Karten:</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center' }}>
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

            {/* Show player's hand during waiting */}
            {hand.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <h4 style={{ textAlign: 'center', marginBottom: '15px', color: 'white' }}>
                  📋 Deine verbleibenden Karten:
                </h4>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  justifyContent: 'center',
                  padding: '15px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  backdropFilter: 'blur(10px)'
                }}>
                  {hand.map(card => (
                    <div key={card.id} style={{ opacity: 0.8 }}>
                      <Card
                        card={card}
                        style={{
                          transform: 'scale(0.9)',
                          border: '2px solid rgba(255,255,255,0.3)',
                          borderRadius: '8px'
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : game?.phase === 'voting' && isStoryteller ? (
          <div>
            <p>Die Abstimmung läuft...</p>
            <p>Du kannst nicht abstimmen, aber beobachtest das Geschehen.</p>
          </div>
        ) : (
          <div>
            <p style={{ textAlign: 'center', fontSize: '18px', marginBottom: '20px' }}>
              Bitte warten...
            </p>

            {/* Show player's hand during initial waiting */}
            {hand.length > 0 && (
              <div>
                <h4 style={{ textAlign: 'center', marginBottom: '15px', color: 'white' }}>
                  📋 Deine Karten:
                </h4>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  justifyContent: 'center',
                  padding: '15px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  backdropFilter: 'blur(10px)'
                }}>
                  {hand.map(card => (
                    <div key={card.id} style={{ opacity: 0.8 }}>
                      <Card
                        card={card}
                        style={{
                          transform: 'scale(0.9)',
                          border: '2px solid rgba(255,255,255,0.3)',
                          borderRadius: '8px'
                        }}
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
    <div style={{
      padding: '15px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: '16px',
      color: 'white',
      textAlign: 'center'
    }}>
      <h3 style={{
        margin: '0 0 15px 0',
        fontSize: 'clamp(20px, 5vw, 28px)',
        textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
      }}>
        🎭 Du bist der Erzähler!
      </h3>
      <p style={{
        fontSize: 'clamp(14px, 3vw, 18px)',
        marginBottom: '20px',
        opacity: 0.9,
        padding: '0 10px'
      }}>
        Wähle eine Karte aus deiner Hand und gib einen kreativen Hinweis
      </p>

      {/* Validation Status */}
      <div style={{
        background: 'rgba(255,255,255,0.1)',
        padding: '12px',
        borderRadius: '12px',
        marginBottom: '15px',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '15px',
          flexWrap: 'wrap',
          fontSize: 'clamp(12px, 2.5vw, 14px)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: selectedCard ? '#28a745' : '#ffc107'
          }}>
            {selectedCard ? '✅' : '⚠️'} Karte: {selectedCard ? 'Ausgewählt' : 'Keine ausgewählt'}
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: hint.trim().length >= 2 ? '#28a745' : '#ffc107'
          }}>
            {hint.trim().length >= 2 ? '✅' : '⚠️'} Hinweis: {hint.trim().length}/100 Zeichen
          </div>
        </div>
      </div>

      {/* Hinweis-Eingabe mit Button - Mobile optimiert */}
      <div style={{
        display: 'flex',//
        justifyContent: 'center',
        gap: '10px',
        marginBottom: '20px',
        flexDirection: window.innerWidth < 768 ? 'column' : 'row',
        alignItems: window.innerWidth < 768 ? 'stretch' : 'center'
      }}>
        <input
          value={hint}
          onChange={e => setHint(e.target.value)}
          placeholder="Gib deinen Hinweis ein... (min. 2 Zeichen)"
          maxLength="100"
          style={{
            padding: '12px 16px',
            fontSize: 'clamp(14px, 3vw, 16px)',
            border: 'none',
            borderRadius: '25px',
            width: window.innerWidth < 768 ? '100%' : '280px',
            maxWidth: '100%',
            outline: 'none',
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
            textAlign: 'center',
            background: hint.trim().length >= 2 ? '#e8f5e8' : '#fff3cd',
            boxSizing: 'border-box'
          }}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && selectedCard && hint.trim().length >= 2) {
              handleGiveHint();
            }
          }}
        />
        <button
          onClick={handleGiveHint}
          disabled={!selectedCard || hint.trim().length < 2}
          style={{
            padding: '12px 20px',
            fontSize: 'clamp(14px, 3vw, 16px)',
            fontWeight: 'bold',
            backgroundColor: (!selectedCard || hint.trim().length < 2) ? '#6c757d' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '25px',
            cursor: (!selectedCard || hint.trim().length < 2) ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            transition: 'all 0.3s ease',
            minWidth: window.innerWidth < 768 ? 'auto' : '120px',
            opacity: (!selectedCard || hint.trim().length < 2) ? 0.6 : 1,
            whiteSpace: 'nowrap'
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
          {!selectedCard ? 'Karte wählen' : hint.trim().length < 2 ? 'Hinweis eingeben' : 'Hinweis geben'}
        </button>
      </div>

      {/* Informationstext */}
      <div style={{
        background: 'rgba(255,255,255,0.15)',
        padding: '10px',
        borderRadius: '12px',
        marginBottom: '15px',
        backdropFilter: 'blur(10px)',
        fontSize: 'clamp(12px, 2.5vw, 14px)',
        opacity: 0.9
      }}>
        💡 <strong>Tipp:</strong> Gib einen kreativen Hinweis, der nicht zu offensichtlich, aber auch nicht zu schwer ist.
        Andere Spieler müssen deine Karte unter allen eingereichten Karten erraten!
      </div>

      {/* Kartenauswahl - Responsive Grid Layout */}
      <div style={{
        padding: '15px',
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '12px',
        backdropFilter: 'blur(10px)'
      }}>
        {hand.length === 0 ? (
          <div style={{
            color: '#ffc107',
            fontSize: 'clamp(16px, 4vw, 18px)',
            padding: '20px',
            textAlign: 'center'
          }}>
            ⚠️ Keine Karten in der Hand! Lade die Seite neu.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: window.innerWidth < 480
              ? '1fr'
              : window.innerWidth < 768
                ? 'repeat(2, 1fr)'
                : 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: window.innerWidth < 768 ? '15px' : '20px',
            maxWidth: '1000px',
            margin: '0 auto'
          }}>
            {hand.map(card => (
              <div key={card.id} style={{
                position: 'relative',
                display: 'flex',
                justifyContent: 'center'
              }}>
                {selectedCard === card.id && (
                  <div style={{
                    position: 'absolute',
                    top: '-8px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#ffd700',
                    color: '#333',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: 'clamp(10px, 2vw, 12px)',
                    fontWeight: 'bold',
                    zIndex: 1,
                    boxShadow: '0 3px 6px rgba(0,0,0,0.3)',
                    whiteSpace: 'nowrap'
                  }}>
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
                  style={{
                    transform: selectedCard === card.id ? 'scale(1.02)' : 'scale(1)',
                    boxShadow: selectedCard === card.id
                      ? '0 8px 24px rgba(255,215,0,0.4)'
                      : '0 4px 12px rgba(0,0,0,0.2)',
                    border: selectedCard === card.id ? '3px solid #ffd700' : '2px solid rgba(255,255,255,0.3)',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    maxWidth: '100%',
                    width: '100%'
                  }}
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
      <div style={{
        padding: '15px',
        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        borderRadius: '16px',
        color: 'white',
        textAlign: 'center'
      }}>
        <h3 style={{
          margin: '0 0 15px 0',
          fontSize: 'clamp(20px, 5vw, 24px)',
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
        }}>
          🗳️ Wähle die Karte des Erzählers
        </h3>

        <div style={{
          background: 'rgba(255,255,255,0.15)',
          padding: '15px',
          borderRadius: '12px',
          marginBottom: '20px',
          backdropFilter: 'blur(10px)'
        }}>
          <p style={{ fontSize: 'clamp(14px, 3.5vw, 18px)', margin: '0 0 10px 0' }}>
            Hinweis: <span style={{color:'#ffd700', fontWeight: 'bold', fontSize: 'clamp(16px, 4vw, 20px)'}}>{game?.hint}</span>
          </p>
          <p style={{ fontSize: 'clamp(12px, 3vw, 14px)', opacity: 0.9, margin: 0 }}>
            Stimme für die Karte ab, von der du glaubst, dass sie vom Erzähler stammt.
          </p>
          <p style={{ fontSize: 'clamp(12px, 3vw, 14px)', opacity: 0.8, marginTop: '8px' }}>
            <strong>Achtung:</strong> Du kannst nicht für deine eigene Karte stimmen!
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: window.innerWidth < 480
            ? '1fr'
            : 'repeat(2, 1fr)', // Immer 2 Karten pro Zeile
          gap: '12px',
          padding: '15px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)',
          maxWidth: '900px', // Begrenzte Breite für bessere Lesbarkeit
          margin: '0 auto'
        }}>
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
              <div key={cardId} style={{
                position: 'relative',
                width: '100%', // Sicherstellen, dass jede Karte die volle Breite des Grid-Elements einnimmt
                boxSizing: 'border-box',
                padding: '8px'
              }}>
                {isMyCard && (
                  <div style={{
                    position: 'absolute',
                    top: '0px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#28a745',
                    color: 'white',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: 'clamp(10px, 2vw, 12px)',
                    fontWeight: 'bold',
                    zIndex: 1,
                    boxShadow: '0 3px 6px rgba(0,0,0,0.3)',
                    whiteSpace: 'nowrap'
                  }}>
                    🏷️ Deine Karte
                  </div>
                )}
                <Card
                  card={card}
                  onClick={() => !isMyCard && handleVote(cardId)}
                  style={{
                    cursor: isMyCard ? 'not-allowed' : 'pointer',
                    opacity: isMyCard ? 0.7 : 1,
                    border: isMyCard ? '3px solid #28a745' : '2px solid rgba(255,255,255,0.3)',
                    borderRadius: '12px',
                    transition: 'all 0.3s ease',
                    width: '100%', // Volle Breite nutzen
                    maxWidth: '350px', // Maximale Breite begrenzen
                    margin: '0 auto' // Zentrieren innerhalb des Containers
                  }}
                />
              </div>
            );
          }) : (
            <div style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: '30px',
              color: 'white',
              fontSize: '18px'
            }}>
              <p>Keine Karten zum Abstimmen verfügbar!</p>
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
                      setMixedCards(data.game.mixedCards || []);
                    }
                  } catch (error) {
                    console.error('Error refreshing game state:', error);
                  }
                }}
                style={{
                  padding: '8px 16px',
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: 'pointer',
                  marginTop: '10px'
                }}
              >
                🔄 Spieldaten aktualisieren
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  /**
   * Renders the vote watch phase for the storyteller
   */
  const renderVoteWatchPhase = () => {
    return (
      <div style={{
        padding: '15px',
        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        borderRadius: '16px',
        color: 'white',
        textAlign: 'center'
      }}>
        <h3 style={{
          margin: '0 0 15px 0',
          fontSize: 'clamp(20px, 5vw, 24px)',
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
        }}>
          🎭 Als Erzähler siehst du zu
        </h3>

        <div style={{
          background: 'rgba(255,255,255,0.15)',
          padding: '15px',
          borderRadius: '12px',
          marginBottom: '20px',
          backdropFilter: 'blur(10px)'
        }}>
          <p style={{ fontSize: 'clamp(14px, 3.5vw, 18px)', margin: '0 0 10px 0' }}>
            Dein Hinweis: <span style={{color:'#ffd700', fontWeight: 'bold', fontSize: 'clamp(16px, 4vw, 20px)'}}>{game?.hint}</span>
          </p>
          <p style={{ fontSize: 'clamp(14px, 3vw, 16px)', opacity: 0.9, margin: '0' }}>
            Die anderen Spieler stimmen jetzt ab, welche Karte deine sein könnte.
          </p>
        </div>

        {/* Fortschritts-Anzeige */}
        <div style={{
          background: 'rgba(255,255,255,0.1)',
          padding: '12px 16px',
          borderRadius: '12px',
          marginBottom: '20px'
        }}>
          <p style={{
            fontSize: 'clamp(14px, 3vw, 16px)',
            fontWeight: 'bold',
            margin: '0 0 10px 0'
          }}>
            🗳️ Abstimmungs-Fortschritt:
          </p>
          <div style={{
            position: 'relative',
            height: '24px',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '12px',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${Math.round((game?.votes?.length / (game?.players?.length - 1)) * 100) || 0}%`,
              background: 'linear-gradient(to right, #28a745, #34ce57)',
              transition: 'width 0.5s ease'
            }}/>
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'clamp(12px, 2.5vw, 14px)',
              fontWeight: 'bold',
              color: 'white',
              textShadow: '0 0 2px rgba(0,0,0,0.5)'
            }}>
              {game?.votes?.length || 0} / {(game?.players?.length || 1) - 1} Stimmen
            </div>
          </div>
        </div>

        {/* Kartenansicht */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          padding: '15px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)',
          maxWidth: '900px',
          margin: '0 auto'
        }}>
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
              <div key={cardId} style={{
                position: 'relative',
                display: 'flex',
                justifyContent: 'center'
              }}>
                {isMyCard && (
                  <div style={{
                    position: 'absolute',
                    top: '-8px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#ffd700',
                    color: '#333',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: 'clamp(10px, 2vw, 12px)',
                    fontWeight: 'bold',
                    zIndex: 1,
                    boxShadow: '0 3px 6px rgba(0,0,0,0.3)',
                    whiteSpace: 'nowrap'
                  }}>
                    🎭 Deine Karte
                  </div>
                )}

                <Card
                  card={card}
                  style={{
                    transform: isMyCard ? 'scale(1.02)' : 'scale(1)',
                    opacity: 1,
                    border: isMyCard
                      ? '3px solid #ffd700'
                      : '2px solid rgba(255,255,255,0.3)',
                    borderRadius: '12px',
                    transition: 'all 0.3s ease',
                    boxShadow: isMyCard
                      ? '0 8px 24px rgba(255,215,0,0.4)'
                      : '0 4px 8px rgba(0,0,0,0.2)',
                    maxWidth: '100%',
                    width: '100%'
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Liste der abstimmenden Spieler */}
        {game?.votes?.length > 0 && (
          <div style={{
            marginTop: '20px',
            background: 'rgba(255,255,255,0.15)',
            padding: '12px',
            borderRadius: '12px',
            backdropFilter: 'blur(10px)'
          }}>
            <p style={{
              fontSize: 'clamp(14px, 3vw, 16px)',
              margin: '0 0 8px 0',
              fontWeight: 'bold'
            }}>
              📊 Bereits abgestimmt:
            </p>
            <div style={{
              display: 'flex',
              gap: '6px',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              {game.votes.map((vote, index) => {
                const voter = game.players.find(p => p.id === vote.playerId);
                return (
                  <span key={index} style={{
                    background: 'rgba(255,255,255,0.2)',
                    padding: '3px 8px',
                    borderRadius: '8px',
                    fontSize: 'clamp(10px, 2vw, 12px)',
                    fontWeight: 'bold'
                  }}>
                    ✅ {voter ? voter.name : 'Unbekannt'}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Spielanweisungen für den Erzähler */}
        <div style={{
          marginTop: '20px',
          background: 'rgba(255,255,255,0.05)',
          padding: '12px',
          borderRadius: '12px'
        }}>
          <p style={{
            fontSize: 'clamp(12px, 2.5vw, 14px)',
            opacity: 0.9,
            fontStyle: 'italic',
            margin: 0
          }}>
            Als Erzähler kannst du nur zusehen. Warte, bis alle abgestimmt haben...
          </p>
        </div>
      </div>
    );
  };

  /**
   * Renders the waiting phase after voting
   */
  const renderWaitingAfterVotePhase = () => {
    return (
      <div style={{
        padding: '15px',
        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        borderRadius: '16px',
        color: 'white',
        textAlign: 'center'
      }}>
        <h3 style={{
          margin: '0 0 15px 0',
          fontSize: 'clamp(20px, 5vw, 24px)',
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
        }}>
          ✅ Abstimmung abgeschlossen
        </h3>

        <div style={{
          background: 'rgba(255,255,255,0.15)',
          padding: '15px',
          borderRadius: '12px',
          marginBottom: '20px',
          backdropFilter: 'blur(10px)'
        }}>
          <p style={{ fontSize: 'clamp(14px, 3.5vw, 18px)', margin: '0 0 10px 0' }}>
            Hinweis war: <span style={{color:'#ffd700', fontWeight: 'bold', fontSize: 'clamp(16px, 4vw, 20px)'}}>{game?.hint}</span>
          </p>
          <p style={{ fontSize: 'clamp(14px, 3vw, 16px)', opacity: 0.9, margin: '0' }}>
            Warte, bis alle anderen Spieler abgestimmt haben...
          </p>
          <p style={{ fontSize: 'clamp(14px, 3vw, 16px)', fontWeight: 'bold', marginTop: '10px' }}>
            Fortschritt: {game?.votes?.length || 0} / {(game?.players?.length || 1) - 1} Stimmen
          </p>
        </div>

        {/* Zeigt die abgegebenen Karten an */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          padding: '15px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)',
          maxWidth: '900px',
          margin: '0 auto'
        }}>
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
              <div key={cardId} style={{
                position: 'relative',
                display: 'flex',
                justifyContent: 'center'
              }}>
                {mySelectedCard && (
                  <div style={{
                    position: 'absolute',
                    top: '-8px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#28a745',
                    color: 'white',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: 'clamp(10px, 2vw, 12px)',
                    fontWeight: 'bold',
                    zIndex: 1,
                    boxShadow: '0 3px 6px rgba(0,0,0,0.3)',
                    whiteSpace: 'nowrap'
                  }}>
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
        <div style={{
          marginTop: '20px',
          background: 'rgba(255,255,255,0.15)',
          padding: '12px',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)'
        }}>
          <p style={{ fontSize: 'clamp(14px, 3vw, 16px)', margin: '0 0 8px 0', fontWeight: 'bold' }}>
            📊 Bereits abgestimmt:
          </p>
          <div style={{
            display: 'flex',
            gap: '6px',
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            {game?.votes?.map((vote, index) => {
              const voter = game.players.find(p => p.id === vote.playerId);
              return (
                <span key={index} style={{
                  background: 'rgba(255,255,255,0.2)',
                  padding: '3px 8px',
                  borderRadius: '8px',
                  fontSize: 'clamp(10px, 2vw, 12px)',
                  fontWeight: 'bold'
                }}>
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
        <div style={{
          textAlign: 'center',
          padding: '30px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '12px',
          color: 'white'
        }}>
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
            style={{
              padding: '8px 16px',
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              marginTop: '20px'
            }}
          >
            🔄 Daten aktualisieren
          </button>
        </div>
      );
    }

    return (
      <div style={{
        padding: '20px',
        background: 'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)',
        borderRadius: '16px',
        color: 'white',
        textAlign: 'center'
      }}>
        <h3 style={{
          fontSize: 'clamp(20px, 5vw, 24px)',
          marginBottom: '15px',
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
        }}>
          🎯 Auflösung: Wer hat welche Karte gelegt?
        </h3>

        <div style={{
          background: 'rgba(255,255,255,0.15)',
          padding: '15px',
          borderRadius: '12px',
          marginBottom: '20px',
          backdropFilter: 'blur(10px)'
        }}>
          <p style={{
            fontSize: 'clamp(16px, 4vw, 18px)',
            marginBottom: '10px'
          }}>
            Hinweis war: <span style={{color:'#ffd700', fontWeight: 'bold', fontSize: 'clamp(18px, 4.5vw, 20px)'}}>{game?.hint}</span>
          </p>
        </div>

        {/* Karten-Auflösung */}
        {revealInfo && revealInfo.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
            padding: '20px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '12px',
            backdropFilter: 'blur(10px)',
            maxWidth: '1000px',
            margin: '0 auto 24px auto'
          }}>
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
                <div key={info.cardId} style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}>
                  {info.isStoryteller && (
                    <div style={{
                      position: 'absolute',
                      top: '-10px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#ffd700',
                      color: '#333',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: 'clamp(12px, 2.5vw, 14px)',
                      fontWeight: 'bold',
                      zIndex: 1,
                      boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                      whiteSpace: 'nowrap'
                    }}>
                      🎭 Erzähler-Karte
                    </div>
                  )}

                  <Card
                    card={card}
                    style={{
                      border: info.isStoryteller
                        ? '3px solid #ffd700'
                        : info.votes > 0
                          ? '3px solid #28a745'
                          : '2px solid rgba(255,255,255,0.2)',
                      borderRadius: '12px',
                      transition: 'all 0.3s ease',
                      transform: info.isStoryteller ? 'scale(1.03)' : 'scale(1)',
                      boxShadow: info.isStoryteller
                        ? '0 8px 24px rgba(255,215,0,0.4)'
                        : info.votes > 0
                          ? '0 8px 24px rgba(40,167,69,0.2)'
                          : '0 4px 12px rgba(0,0,0,0.15)',
                      maxWidth: '100%',
                      width: '100%'
                    }}
                  />

                  <div style={{
                    marginTop: '12px',
                    background: 'rgba(255,255,255,0.15)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}>
                    <p style={{
                      margin: '0 0 8px 0',
                      fontWeight: 'bold',
                      fontSize: 'clamp(14px, 3vw, 16px)',
                      wordBreak: 'break-word'
                    }}>
                      {info.playerName}
                    </p>
                    {info.votes > 0 && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        fontSize: 'clamp(12px, 2.5vw, 14px)'
                      }}>
                        <span style={{ fontWeight: 'bold', color: '#28a745' }}>{info.votes}</span>
                        <span>{info.votes === 1 ? 'Stimme' : 'Stimmen'}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '30px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '12px',
            marginBottom: '24px'
          }}>
            <p style={{color: 'white', marginBottom: '15px'}}>Lade Kartendaten...</p>
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
              style={{
                padding: '8px 16px',
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              🔄 Ergebnisse laden
            </button>
          </div>
        )}

        {/* Punkteverteilung */}
        {pointsEarned && pointsEarned.length > 0 && (
          <div style={{
            background: 'rgba(255,255,255,0.15)',
            padding: '15px',
            borderRadius: '12px',
            marginBottom: '20px',
            backdropFilter: 'blur(10px)'
          }}>
            <h4 style={{
              margin: '0 0 15px 0',
              fontSize: 'clamp(18px, 4vw, 22px)',
              color: '#ffd700'
            }}>
              🏆 Punkte in dieser Runde
            </h4>

            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '10px'
            }}>
              {pointsEarned.map((item, index) => (
                <div key={index} style={{
                  background: 'rgba(255,255,255,0.1)',
                  padding: '10px 15px',
                  borderRadius: '10px',
                  minWidth: '140px'
                }}>
                  <p style={{ fontWeight: 'bold', margin: '0 0 5px 0' }}>{item.playerName}</p>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px'
                  }}>
                    <span style={{ fontWeight: 'bold', fontSize: '18px', color: '#28a745' }}>+{item.points}</span>
                    <span style={{ fontSize: '12px', opacity: 0.8 }}>{item.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Countdown-Timer */}
        {revealTimer && (
          <div style={{
            marginTop: '20px'
          }}>
            <button
              onClick={handleContinueToNextRound}
              style={{
                padding: '12px 24px',
                fontSize: '18px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '30px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                transition: 'all 0.3s ease',
                fontWeight: 'bold',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseOver={(e) => {
                e.target.style.transform = 'scale(1.05)';
                e.target.style.backgroundColor = '#218838';
              }}
              onMouseOut={(e) => {
                e.target.style.transform = 'scale(1)';
                e.target.style.backgroundColor = '#28a745';
              }}
            >
              <span>Nächste Runde</span>
              <span style={{ fontSize: '14px' }}>(automatisch in 15s)</span>
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
      <div style={{
        padding: '20px',
        background: 'linear-gradient(135deg, #ffd34f 0%, #ffb199 100%)',
        borderRadius: '16px',
        color: '#333',
        textAlign: 'center'
      }}>
        <h2 style={{
          margin: '0 0 20px 0',
          fontSize: 'clamp(24px, 6vw, 32px)',
          color: '#333'
        }}>
          🎉 Spiel beendet!
        </h2>

        <div style={{
          background: 'rgba(255,255,255,0.4)',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '30px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{
            margin: '0 0 10px 0',
            fontSize: 'clamp(20px, 5vw, 26px)'
          }}>
            {gameWinner.winner} gewinnt! 🏆
          </h3>

          {/* Final Scores */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '15px',
            marginTop: '20px'
          }}>
            {gameWinner.finalScores.sort((a, b) => b.points - a.points).map(player => (
              <div key={player.id} style={{
                padding: '12px',
                background: player.name === gameWinner.winner
                  ? 'linear-gradient(135deg, #ffd700, #ffc107)'
                  : 'rgba(255,255,255,0.3)',
                borderRadius: '10px',
                boxShadow: player.name === gameWinner.winner
                  ? '0 6px 18px rgba(255,215,0,0.4)'
                  : '0 4px 8px rgba(0,0,0,0.1)',
                transform: player.name === gameWinner.winner ? 'scale(1.05)' : 'scale(1)',
                transition: 'all 0.3s ease',
                border: player.name === gameWinner.winner ? '2px solid #ff6f00' : 'none'
              }}>
                <div style={{
                  fontWeight: 'bold',
                  fontSize: 'clamp(14px, 3vw, 16px)',
                  marginBottom: '5px',
                  wordBreak: 'break-word'
                }}>
                  {player.name === gameWinner.winner && '👑 '}
                  {player.name}
                </div>
                <div style={{
                  fontSize: 'clamp(18px, 4vw, 24px)',
                  fontWeight: 'bold'
                }}>
                  {player.points}
                </div>
                {player.name === gameWinner.winner && (
                  <div style={{ marginTop: '5px', fontSize: '14px', fontWeight: 'bold', color: '#ff6f00' }}>
                    Gewinner!
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleRestartGame}
          style={{
            padding: '15px 30px',
            fontSize: '18px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '30px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            transition: 'all 0.3s ease',
            fontWeight: 'bold',
            margin: '0 auto',
            display: 'block'
          }}
          onMouseOver={(e) => {
            e.target.style.backgroundColor = '#0069d9';
            e.target.style.transform = 'translateY(-2px)';
          }}
          onMouseOut={(e) => {
            e.target.style.backgroundColor = '#007bff';
            e.target.style.transform = 'translateY(0)';
          }}
        >
          🔄 Neues Spiel starten
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

  const handleVolumeChange = (newVolume) => {
    setVolume(newVolume);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: window.innerWidth < 768 ? '10px' : '20px',
      position: 'relative'
    }}>
      {/* VolumeControl positioniert sich selbst */}
      <VolumeControl volume={volume} onChange={handleVolumeChange} />

      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: window.innerWidth < 768 ? '0 5px' : '0'
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: window.innerWidth < 768 ? '15px' : '25px',
          background: 'rgba(255,255,255,0.1)',
          padding: window.innerWidth < 768 ? '15px' : '20px',
          borderRadius: '16px',
          backdropFilter: 'blur(10px)',
          color: 'white',
          position: 'relative'
        }}>
          <h1 style={{
            margin: '0 0 8px 0',
            fontSize: 'clamp(20px, 6vw, 32px)',
            textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
            wordBreak: 'break-word'
          }}>
            🎨 Don't Choose Me - {gameId}
          </h1>
          <p style={{
            margin: 0,
            opacity: 0.9,
            fontSize: 'clamp(12px, 3vw, 16px)',
            wordBreak: 'break-word'
          }}>
            Spieler: <strong>{playerName}</strong> |
            Erzähler: <strong>{game?.players?.[game?.storytellerIndex]?.name}</strong>
          </p>

          {/* Audio Indicator - nur auf größeren Bildschirmen */}
          {window.innerWidth >= 768 && (
            <div style={{
              position: 'absolute',
              top: '10px',
              right: '15px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255,255,255,0.1)',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              opacity: 0.7
            }}>
              🎵 {game?.phase === 'voting' ? 'Voting Music' :
                  game?.phase === 'storytelling' ? 'Storyteller Music' : 'Lobby Music'}
            </div>
          )}
        </div>

        {/* Permanent scoreboard */}
        {game && game.state === 'playing' && renderScoreboard()}

        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '16px',
          padding: window.innerWidth < 768 ? '10px' : '20px'
        }}>
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
