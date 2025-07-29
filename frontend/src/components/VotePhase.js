import Card from "./Card";
import React from "react";


/**
 * Renders the voting phase
 */
export function renderVotePhase({ game, playerName, mixedCards, allCards, handleVote }) {
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
                margin: '0 0 12px 0',
                fontSize: 'clamp(20px, 5vw, 24px)',
                textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
            }}>
                🗳️ Zeit zum Abstimmen!
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
                    Hinweis war: <span style={{color:'#ffd700', fontWeight: 'bold', fontSize: 'clamp(16px, 4vw, 20px)'}}>{game?.hint}</span>
                </p>
            </div>

            <h4 style={{
                margin: '0 0 15px 0',
                fontSize: 'clamp(16px, 3.5vw, 18px)'
            }}>
                🎯 Wähle die Karte des Erzählers:
            </h4>

            <div style={{
                display: 'grid',
                gridTemplateColumns: window.innerWidth < 480
                    ? '1fr'
                    : window.innerWidth < 768
                        ? 'repeat(2, 1fr)'
                        : 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: window.innerWidth < 768 ? '12px' : '15px',
                padding: '15px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)',
                maxWidth: '1000px',
                margin: '0 auto'
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

                    return (
                        <div key={cardId} style={{
                            position: 'relative',
                            display: 'flex',
                            justifyContent: 'center'
                        }}>
                            {/* Label für "Your Card" */}
                            {isMyCard && (
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
                                onClick={() => {
                                    if (!isMyCard) {
                                        handleVote(cardId);
                                    }
                                }}
                                style={{
                                    opacity: isMyCard ? 0.6 : 1,
                                    border: isMyCard
                                        ? '4px solid #28a745'
                                        : '2px solid rgba(255,255,255,0.3)',
                                    cursor: isMyCard ? 'not-allowed' : 'pointer',
                                    borderRadius: '12px',
                                    transition: 'all 0.3s ease',
                                    boxShadow: isMyCard
                                        ? '0 4px 8px rgba(0,0,0,0.2)'
                                        : '0 8px 16px rgba(0,0,0,0.2)',
                                    maxWidth: '100%',
                                    width: '100%',
                                    filter: isMyCard ? 'grayscale(20%)' : 'none'
                                }}
                            />

                            {/* Overlay für eigene Karte */}
                            {isMyCard && (
                                <div style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    background: 'rgba(0,0,0,0.7)',
                                    color: 'white',
                                    padding: '8px 12px',
                                    borderRadius: '20px',
                                    fontSize: 'clamp(12px, 2.5vw, 14px)',
                                    fontWeight: 'bold',
                                    pointerEvents: 'none',
                                    textAlign: 'center',
                                    whiteSpace: 'nowrap'
                                }}>
                                    �� Nicht wählbar
                                </div>
                            )}
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
                <p style={{
                    fontSize: 'clamp(14px, 3vw, 16px)',
                    margin: '0 0 8px 0',
                    fontWeight: 'bold'
                }}>
                    📊 Abstimmungen: {game?.votes?.length || 0} / {(game?.players?.length || 1) - 1}
                </p>
                {game?.votes?.length > 0 && (
                    <div>
                        <p style={{
                            fontSize: 'clamp(12px, 2.5vw, 14px)',
                            margin: '0 0 6px 0',
                            opacity: 0.9
                        }}>Bereits abgestimmt:</p>
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
            </div>
        </div>
    );
};
