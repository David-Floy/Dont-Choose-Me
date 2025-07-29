import React, { useEffect, useState } from 'react';
import Card from './Card';
import VolumeControl from './VolumeControl';
import audioManager from '../utils/AudioManager';
import { renderVotePhase } from './VotePhase';
import { renderGameEndPhase } from './FinishPhase';
import { renderVoteWatchPhase } from './VoteWatchPhase';
import { renderWaitingAfterVotePhase } from './WaitingAfterVote';
import { renderGiveHintPhase } from './ErzaehlerPhase';
import { renderChooseCardPhase } from './ChoosePhase';
import { renderWaitingPhase } from './WaitingPhase';
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
      } else if (game.phase === 'selectCards') {
        const hasSelectedCard = game.selectedCards?.some(sc => {
          const player = game.players.find(p => p.id === sc.playerId);
          return player?.name === playerName;
        });
        const storyteller = game.players?.[game.storytellerIndex];
        newPhase = (storyteller?.name === playerName || hasSelectedCard) ? 'waiting' : 'chooseCard';
      } else if (game.phase === 'voting') {
        const storyteller = game.players?.[game.storytellerIndex];
        const hasVoted = game.votes?.some(v => {
          const player = game.players.find(p => p.id === v.playerId);
          return player?.name === playerName;
        });
        // Storyteller gets special voting phase for observation
        if (storyteller?.name === playerName) {
          newPhase = 'voteWatch'; // New phase for storyteller
        } else if (hasVoted) {
          newPhase = 'waitingAfterVote'; // New phase for players who voted
        } else {
          newPhase = 'vote';
        }
      } else if (game.phase === 'reveal') {
        newPhase = 'reveal';
      }

      setPhase(newPhase);

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
  }, [game, playerName]);

  // Musik-Management basierend auf Spielphase
  useEffect(() => {
    if (game && game.phase) {
      if (game.phase === 'voting') {
        // Wechsel zu Voting-Musik
        audioManager.playTrack('vote.mp3', true, 1000);
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
   * Handles card selection
   */
  const handleChooseCard = async (cardId) => {
    try {
      await fetch(`${API_BASE}/game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          action: 'chooseCard',
          cardId,
          playerName
        })
      });
      setSelectedCard(cardId);
    } catch (error) {
      console.error('Error choosing card:', error);
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
        {game?.players?.map(p => (
          <div key={p.id} style={{
            textAlign: 'center',
            padding: window.innerWidth < 768 ? '12px' : '16px',
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
            <div style={{
              fontWeight: 'bold',
              fontSize: 'clamp(12px, 3vw, 16px)',
              marginBottom: '6px',
              wordBreak: 'break-word'
            }}>{p.name}</div>
            <div style={{
              fontSize: 'clamp(18px, 5vw, 24px)',
              fontWeight: 'bold',
              marginBottom: '4px'
            }}>{p.points}</div>
            {p.name === game?.players?.[game?.storytellerIndex]?.name && (
              <div style={{
                fontSize: 'clamp(10px, 2vw, 12px)',
                fontWeight: 'bold'
              }}>🎭 Erzähler</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  /**
   * Renders the results phase including scoreboard
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
   * Renders the reveal phase after voting
   */
  const renderRevealPhase = () => {
    // Extended safety checks
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
   * Renders the game end screen
   */


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
              🎵 {game?.phase === 'voting' ? 'Voting Music' : 'Lobby Music'}
            </div>
          )}
        </div>

        {/* Permanent scoreboard */}
        {game.state === 'playing' && renderScoreboard()}

        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '16px',
          padding: window.innerWidth < 768 ? '10px' : '20px'
        }}>
          {phase === 'waiting' && renderWaitingPhase({ game, playerName, hand, allCards })}
          {phase === 'giveHint' && renderGiveHintPhase({ game, playerName, hand, selectedCard, setSelectedCard, hint, setHint, handleGiveHint })}
          {phase === 'chooseCard' && renderChooseCardPhase({ game, playerName, hand, selectedCard, setSelectedCard, handleChooseCard })}
          {phase === 'vote' && renderVotePhase({ game, playerName, mixedCards, allCards, handleVote })}
          {phase === 'voteWatch' && renderVoteWatchPhase({ game, playerName, mixedCards, allCards })}
          {phase === 'waitingAfterVote' && renderWaitingAfterVotePhase({ game, playerName, mixedCards, allCards })}
          {phase === 'reveal' && renderRevealPhase()}
          {phase === 'results' && renderResultsPhase()}
          {phase === 'gameEnd' && renderGameEndPhase({ gameWinner, handleRestartGame })}
        </div>
      </div>
    </div>
  );
}

export default Game;
