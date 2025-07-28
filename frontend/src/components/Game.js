import React, { useEffect, useState, useRef } from 'react';
import Card from './Card';
// Animationen für Karten
import { CSSTransition, TransitionGroup } from 'react-transition-group';
import VolumeControl from './VolumeControl';

const API_BASE = '/api';

/**
 * Haupt-Spielkomponente für das PicMe-Spiel
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
  const [playerId, setPlayerId] = useState(localStorage.getItem('playerId'));
  const [playedVoteSound, setPlayedVoteSound] = useState(false);
  const [volume, setVolume] = useState(() => {
    // Versuche den Volume-Wert aus dem localStorage zu laden oder nutze 0.7 als Standard
    const savedVolume = localStorage.getItem('gameVolume');
    return savedVolume !== null ? parseFloat(savedVolume) : 0.7;
  });
  const voteAudioRef = useRef(null);

  // Polling für Spielstatus
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

  // Karten laden
  useEffect(() => {
    fetch('/api/cards')
      .then(res => res.json())
      .then(cards => setAllCards(cards))
      .catch(() => setAllCards([]));
  }, []);

  // Hilfsfunktion: Hand aktualisieren
  const updateHand = (gameData) => {
    if (gameData && gameData.players) {
      const me = gameData.players.find(p => p.name === playerName);
      setHand(me?.hand || []);
    }
  };

  // Hilfsfunktion: Berechne die aktuelle Phase
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
        // Erzähler bekommt spezielle Voting-Phase zum Beobachten
        if (storyteller?.name === playerName) {
          newPhase = 'voteWatch'; // Neue Phase für Erzähler
        } else {
          newPhase = hasVoted ? 'waiting' : 'vote';
        }
      } else if (game.phase === 'reveal') {
        newPhase = 'reveal';
      }

      setPhase(newPhase);

      // Reveal-Infos setzen
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

  // Sound-Effekt für Voting initialisieren, wenn noch nicht abgespielt
  useEffect(() => {
    if ((phase === 'vote' || phase === 'voteWatch') && !playedVoteSound) {
      if (voteAudioRef.current) {
        voteAudioRef.current.volume = volume;
        voteAudioRef.current.play().catch(err => {
          console.log("Audio konnte nicht abgespielt werden:", err);
        });
        setPlayedVoteSound(true);
      }
    } else if (phase !== 'vote' && phase !== 'voteWatch') {
      setPlayedVoteSound(false);
    }
  }, [phase, playedVoteSound, volume]);

  // Speichern des Lautstärkewerts im localStorage
  useEffect(() => {
    localStorage.setItem('gameVolume', volume.toString());

    // Aktualisiere die Lautstärke für alle Audio-Elemente
    if (voteAudioRef.current) {
      voteAudioRef.current.volume = volume;
    }
  }, [volume]);

  // === GAME ACTIONS ===

  /**
   * Behandelt das Geben eines Hinweises durch den Erzähler
   */
  const handleGiveHint = async () => {
    if (!selectedCard || !hint.trim()) return;

    try {
      await fetch(`${API_BASE}/game`, {
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
      setSelectedCard(null);
      setHint('');
    } catch (error) {
      console.error('Error giving hint:', error);
    }
  };

  /**
   * Behandelt die Kartenauswahl
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
   * Behandelt die Stimmabgabe für eine Karte
   */
  const handleVote = async (cardId) => {
    // Prüfen, ob es sich um die eigene Karte handelt
    const mySelectedCard = game?.selectedCards?.find(sc => {
      const player = game.players.find(p => p.id === sc.playerId);
      return player?.name === playerName;
    });

    if (mySelectedCard && mySelectedCard.cardId === cardId) {
      // Eigene Karte angeklickt - nicht erlauben
      console.log("Du kannst nicht für deine eigene Karte stimmen!");
      return;
    }

    try {
      // Sound abspielen beim Voting
      if (voteAudioRef.current) {
        voteAudioRef.current.currentTime = 0;
        voteAudioRef.current.volume = volume;
        voteAudioRef.current.play().catch(err => {
          console.log("Audio konnte nicht abgespielt werden:", err);
        });
      }

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
   * Behandelt den Übergang zur nächsten Runde
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
   * Behandelt den Neustart des Spiels
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
   * Berechnet wer Punkte bekommt und warum (für Reveal-Phase)
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
   * Rendert das Scoreboard mit den Punkten aller Spieler
   */
  const renderScoreboard = () => {
    if (!game.players || game.players.length === 0) return null;

    // Sortiere Spieler nach Punkten
    const sortedPlayers = [...game.players].sort((a, b) => b.points - a.points);

    return (
      <div style={{
        background: 'rgba(255,255,255,0.15)',
        borderRadius: '12px',
        padding: '15px',
        marginBottom: '20px',
        backdropFilter: 'blur(5px)'
      }}>
        <h3 style={{
          fontSize: '18px',
          marginTop: 0,
          marginBottom: '10px',
          color: 'white',
          textAlign: 'center'
        }}>
          📊 Punktestand
        </h3>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          {sortedPlayers.map((player, index) => {
            const isCurrentPlayer = player.name === playerName;
            const isStoryteller = game.storytellerIndex !== undefined &&
                                  game.players[game.storytellerIndex]?.name === player.name;

            return (
              <div key={player.id || index} style={{
                padding: '8px 12px',
                borderRadius: '8px',
                background: isCurrentPlayer ? 'rgba(40,167,69,0.8)' : 'rgba(255,255,255,0.1)',
                color: 'white',
                fontWeight: 'bold',
                border: isStoryteller ? '2px solid #ffd700' : 'none',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                minWidth: '120px',
                textAlign: 'center',
                position: 'relative'
              }}>
                {isStoryteller && (
                  <span style={{
                    position: 'absolute',
                    top: '-10px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#ffd700',
                    color: '#333',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '10px',
                    fontWeight: 'bold'
                  }}>
                    Erzähler
                  </span>
                )}
                <div style={{ fontSize: '14px' }}>{player.name}</div>
                <div style={{ fontSize: '18px' }}>{player.points || 0} Pkt.</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /**
   * Rendert die Ergebnisphase nach einer Runde
   */
  const renderResultsPhase = () => {
    return (
      <div className="fade-in" style={{ textAlign: 'center', padding: '20px' }}>
        <h3>Runde beendet!</h3>
        <p>Die Punkte wurden verteilt. Bereit für die nächste Runde?</p>

        {/* Punkteverteilung anzeigen */}
        <div style={{
          background: '#f8f9fa',
          border: '2px solid #28a745',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px'
        }}>
          <h4 style={{color: '#28a745', textAlign: 'center', marginBottom: '16px'}}>
            💰 Punkte dieser Runde
          </h4>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            {game.players.map(player => {
              const previousPoints = player.points - (scoreChanges.find(sc => sc.playerName === player.name)?.points || 0);
              return (
                <div key={player.id} style={{
                  background: '#fff',
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  padding: '12px',
                  minWidth: '150px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '4px' }}>
                    {player.name}
                  </div>
                  <div style={{ color: '#666', fontSize: '14px' }}>
                    {previousPoints} → <span style={{ color: '#28a745', fontWeight: 'bold' }}>{player.points}</span>
                  </div>
                  <div style={{
                    color: '#28a745',
                    fontWeight: 'bold',
                    marginTop: '4px',
                    fontSize: '16px'
                  }}>
                    +{player.points - previousPoints} Punkte
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Button zur nächsten Runde */}
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
    );
  };

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
        ) : game?.phase === 'voting' && isStoryteller ? (
          <div>
            <p>Die Abstimmung läuft...</p>
            <p>Du kannst nicht abstimmen, aber beobachtest das Geschehen.</p>
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
    <div className="fade-in" style={{ padding: '20px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '16px', color: 'white', textAlign: 'center' }}>
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
      <TransitionGroup style={{
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
          <CSSTransition key={card.id} timeout={400} classNames="card-anim">
            <div style={{ position: 'relative' }}>
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
                  transform: selectedCard === card.id ? 'scale(1.08)' : 'scale(1)',
                  boxShadow: selectedCard === card.id
                    ? '0 8px 24px rgba(255,215,0,0.4)'
                    : '0 4px 12px rgba(0,0,0,0.2)',
                  transition: 'transform 0.3s cubic-bezier(.68,-0.55,.27,1.55), box-shadow 0.3s'
                }}
              />
            </div>
          </CSSTransition>
        ))}
      </TransitionGroup>
    </div>
  );

  /**
   * Rendert die Kartenauswahl-Phase
   */
  const renderChooseCardPhase = () => (
    <div className="fade-in" style={{ padding: '20px', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', borderRadius: '16px', color: 'white', textAlign: 'center' }}>
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
            onClick={async () => {
              // Triggere neuen API-Aufruf
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
          <TransitionGroup>
            {hand.map(card => (
              <CSSTransition key={card.id} timeout={400} classNames="card-anim">
                <div style={{ position: 'relative' }}>
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
                      transform: selectedCard === card.id ? 'scale(1.08)' : 'scale(1)',
                      boxShadow: selectedCard === card.id
                        ? '0 8px 24px rgba(40,167,69,0.4)'
                        : '0 4px 12px rgba(0,0,0,0.2)',
                      transition: 'transform 0.3s cubic-bezier(.68,-0.55,.27,1.55), box-shadow 0.3s'
                    }}
                  />
                </div>
              </CSSTransition>
            ))}
          </TransitionGroup>
        </div>
      )}
    </div>
  );

  /**
   * Rendert die Abstimmungs-Phase
   */
  const renderVotePhase = () => {
    const myPlayer = game?.players?.find(p => p.name === playerName);
    const mySelectedCard = game?.selectedCards?.find(sc => {
      const player = game.players.find(p => p.id === sc.playerId);
      return player?.name === playerName;
    });

    return (
      <div className="fade-in" style={{
        padding: '20px',
        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        borderRadius: '16px',
        color: 'white',
        textAlign: 'center'
      }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '24px', textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
          🗳️ Zeit zum Abstimmen!
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
        </div>

        <h4 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>
          🎯 Wähle die Karte des Erzählers:
        </h4>

        {/* Karten-Container mit verbessertem Layout */}
        <div style={{
          maxWidth: '900px',
          margin: '0 auto',
          padding: '20px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '20px',
            justifyContent: 'center',
            justifyItems: 'center',
            width: '100%',
          }}>
            {mixedCards.map(({ cardId }) => {
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
              // Prüfe ob für diese Karte bereits abgestimmt wurde
              const hasVotedForThisCard = game?.votes?.some(v => {
                const voter = game.players.find(p => p.id === v.playerId);
                return voter?.name === playerName && v.cardId === cardId;
              });

              return (
                <div key={cardId} style={{
                  position: 'relative',
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center'
                }}>
                  {/* Label für "Your Card" */}
                  {isMyCard && (
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
                      🏷️ Deine Karte
                    </div>
                  )}

                  {hasVotedForThisCard && (
                    <div style={{
                      position: 'absolute',
                      bottom: '-10px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#007bff',
                      color: 'white',
                      padding: '4px 10px',
                      borderRadius: '10px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      zIndex: 1,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}>
                      ✓ Gewählt
                    </div>
                  )}

                  <Card
                    card={card}
                    onClick={() => !isMyCard && handleVote(cardId)}
                    style={{
                      opacity: isMyCard ? 0.7 : 1,
                      border: isMyCard
                        ? '4px solid #28a745'
                        : hasVotedForThisCard
                          ? '4px solid #007bff'
                          : '2px solid rgba(255,255,255,0.3)',
                      cursor: isMyCard ? 'not-allowed' : 'pointer',
                      borderRadius: '12px',
                      transition: 'all 0.3s cubic-bezier(.68,-0.55,.27,1.55)',
                      boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                      filter: isMyCard ? 'grayscale(30%)' : 'none',
                      width: '100%',
                      maxWidth: '200px',
                      height: 'auto',
                    }}
                  />
                  {isMyCard && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%) rotate(-15deg)',
                      color: '#dc3545',
                      background: 'rgba(255,255,255,0.8)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      fontSize: '16px',
                      pointerEvents: 'none',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                    }}>
                      NICHT WÄHLBAR
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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

        {/* Audio Element für den Voting Sound */}
        <audio ref={voteAudioRef}>
          <source src="/sounds/vote.mp3" type="audio/mpeg" />
          Your browser does not support the audio element.
        </audio>
      </div>
    );
  };

  /**
   * Rendert die Erzähler-Beobachtungsphase während des Votings
   */
  const renderVoteWatchPhase = () => {
    return (
      <div style={{
        padding: '20px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '16px',
        color: 'white',
        textAlign: 'center'
      }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '24px', textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
          👁️ Beobachte die Abstimmung
        </h3>

        <div style={{
          background: 'rgba(255,255,255,0.15)',
          padding: '15px',
          borderRadius: '12px',
          marginBottom: '20px',
          backdropFilter: 'blur(10px)'
        }}>
          <p style={{ fontSize: '18px', margin: '0 0 10px 0' }}>
            Dein Hinweis war: <span style={{color:'#ffd700', fontWeight: 'bold', fontSize: '20px'}}>{game?.hint}</span>
          </p>
          <p style={{fontWeight: 'bold', fontSize: '16px', margin: 0, opacity: 0.9}}>
            🎭 Du kannst nicht abstimmen, aber siehst wer welche Karte gelegt hat!
          </p>
        </div>

        <h4 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>
          🃏 Die gelegten Karten mit Besitzern:
        </h4>

        {/* Karten-Container mit verbessertem Layout */}
        <div style={{
          maxWidth: '900px',
          margin: '0 auto',
          padding: '20px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '20px',
            justifyContent: 'center',
            justifyItems: 'center',
            width: '100%',
          }}>
            {mixedCards.map(({ cardId }) => {
              const combinedCards = [...allCards, ...(game?.players?.flatMap(p => p.hand) || [])];
              let card = combinedCards.find(c => c.id === cardId);

              if (!card) {
                card = {
                  id: cardId,
                  title: `Karte ${cardId}`,
                  image: `https://placehold.co/300x200?text=Karte+${cardId}`
                };
              }

              // Finde den Spieler der diese Karte gelegt hat
              const cardOwner = game?.selectedCards?.find(sc => sc.cardId === cardId);
              const ownerPlayer = cardOwner ? game.players.find(p => p.id === cardOwner.playerId) : null;
              const isMyCard = cardOwner && cardOwner.playerId === game?.players?.[game?.storytellerIndex]?.id;

              // Prüfe ob bereits Stimmen für diese Karte abgegeben wurden
              const votesForThisCard = game?.votes?.filter(v => v.cardId === cardId) || [];

              return (
                <div key={cardId} style={{
                  position: 'relative',
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center'
                }}>
                  {/* Label mit Spielername */}
                  {ownerPlayer && (
                    <div style={{
                      position: 'absolute',
                      top: '-12px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: isMyCard ? '#ffd700' : '#6c757d',
                      color: isMyCard ? '#333' : 'white',
                      padding: '6px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      zIndex: 1,
                      boxShadow: '0 3px 6px rgba(0,0,0,0.3)'
                    }}>
                      {isMyCard ? '👑 Deine Karte' : `👤 ${ownerPlayer.name}`}
                    </div>
                  )}

                  {/* Stimmen-Anzeige */}
                  {votesForThisCard.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      bottom: '-12px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#28a745',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      zIndex: 1,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }}>
                      🗳️ {votesForThisCard.length} Stimme{votesForThisCard.length !== 1 ? 'n' : ''}
                    </div>
                  )}

                  <Card
                    card={card}
                    style={{
                      border: isMyCard
                        ? '4px solid #ffd700'
                        : votesForThisCard.length > 0
                          ? '3px solid #28a745'
                          : '2px solid rgba(255,255,255,0.3)',
                      cursor: 'default',
                      borderRadius: '12px',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                      opacity: votesForThisCard.length > 0 ? 1 : 0.8,
                      width: '100%',
                      maxWidth: '200px',
                      height: 'auto',
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Detaillierte Voting-Status */}
        <div style={{
          marginTop: '25px',
          background: 'rgba(255,255,255,0.15)',
          padding: '15px',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)'
        }}>
          <p style={{ fontSize: '16px', margin: '0 0 10px 0', fontWeight: 'bold' }}>
            📊 Abstimmungen: {game?.votes?.length || 0} / {(game?.players?.length || 1) - 1}
          </p>

          {game?.votes?.length > 0 && (
            <div>
              <p style={{ fontSize: '14px', margin: '0 0 8px 0', opacity: 0.9 }}>Bereits abgestimmt:</p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {game.votes.map((vote, index) => {
                  const voter = game.players.find(p => p.id === vote.playerId);
                  const votedCard = game.selectedCards.find(sc => sc.cardId === vote.cardId);
                  const cardOwner = votedCard ? game.players.find(p => p.id === votedCard.playerId) : null;

                  return (
                    <span key={index} style={{
                      background: 'rgba(255,255,255,0.2)',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      ✅ {voter ? voter.name : 'Unbekannt'}
                      {cardOwner && (
                        <span style={{ color: '#ffd700' }}>
                          → {cardOwner.name === playerName ? 'Dich' : cardOwner.name}
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Audio Element für den Voting Sound */}
        <audio ref={voteAudioRef}>
          <source src="/sounds/vote.mp3" type="audio/mpeg" />
          Your browser does not support the audio element.
        </audio>
      </div>
    );
  };

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
      <div className="fade-in">
        <h3>Auflösung: Wer hat welche Karte gelegt?</h3>
        <p style={{marginBottom: '20px', fontSize: '18px'}}>
          Hinweis war: <span style={{color:'#007bff', fontWeight: 'bold'}}>{game?.hint}</span>
        </p>

        {/* Karten-Auflösung mit verbessertem Layout */}
        {revealInfo && revealInfo.length > 0 ? (
          <div style={{
            maxWidth: '900px',
            margin: '0 auto 32px auto',
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '20px',
              justifyContent: 'center',
              justifyItems: 'center',
            }}>
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
                    textAlign: 'center',
                    boxShadow: info.isStoryteller ? '0 4px 8px rgba(0,123,255,0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
                    transition: 'box-shadow 0.3s, border 0.3s',
                    width: '100%',
                  }}>
                    <div style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'center'
                    }}>
                      <Card
                        card={card}
                        style={{
                          width: '100%',
                          maxWidth: '180px',
                          height: 'auto'
                        }}
                      />
                    </div>
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
      <div className="fade-in" style={{ textAlign: 'center', padding: '20px' }}>
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
          className="pulse-btn"
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

  /**
   * Behandelt die Lautstärkeänderung
   */
  const handleVolumeChange = (newVolume) => {
    setVolume(newVolume);
  };

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
          color: 'white',
          position: 'relative'
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

          {/* Lautstärkeregler in der rechten oberen Ecke */}
          <div style={{
            position: 'absolute',
            right: '15px',
            top: '15px'
          }}>
            <VolumeControl volume={volume} onChange={handleVolumeChange} />
          </div>
        </div>

        {/* Permanentes Scoreboard */}
        {game.state === 'playing' && renderScoreboard()}

        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '20px' }}>
          {phase === 'waiting' && renderWaitingPhase()}
          {phase === 'giveHint' && renderGiveHintPhase()}
          {phase === 'chooseCard' && renderChooseCardPhase()}
          {phase === 'vote' && renderVotePhase()}
          {phase === 'voteWatch' && renderVoteWatchPhase()}
          {phase === 'reveal' && renderRevealPhase()}
          {phase === 'results' && renderResultsPhase()}
          {phase === 'gameEnd' && renderGameEndPhase()}
        </div>
      </div>

      <style>
        {`
        .fade-in {
          animation: fadeIn 0.7s cubic-bezier(.68,-0.55,.27,1.55);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px);}
          to { opacity: 1; transform: translateY(0);}
        }
        .card-anim-enter {
          opacity: 0;
          transform: scale(0.9) rotate(-2deg);
        }
        .card-anim-enter-active {
          opacity: 1;
          transform: scale(1) rotate(0deg);
          transition: opacity 400ms, transform 400ms cubic-bezier(.68,-0.55,.27,1.55);
        }
        .card-anim-exit {
          opacity: 1;
          transform: scale(1);
        }
        .card-anim-exit-active {
          opacity: 0;
          transform: scale(0.9);
          transition: opacity 400ms, transform 400ms;
        }
        .pulse-btn {
          animation: pulse 1.2s infinite;
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(0,123,255,0.4);}
          70% { box-shadow: 0 0 0 10px rgba(0,123,255,0);}
          100% { box-shadow: 0 0 0 0 rgba(0,123,255,0);}
        }
        `}
      </style>
    </div>
  );
}

export default Game;
// Die Effekte sind in den Style-Tags am Ende der Datei und in den Komponenten selbst eingebaut.
