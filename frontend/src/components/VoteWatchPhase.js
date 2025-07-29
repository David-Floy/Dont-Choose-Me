import React from "react";
import Card from "./Card";

/**
 * Renders the storyteller observation phase during voting
 * Übergibt game, playerName, mixedCards, allCards als Props!
 */
export function renderVoteWatchPhase({ game, playerName, mixedCards, allCards }) {
    return (
        <div style={{
            padding: window.innerWidth < 768 ? '15px' : '20px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '16px',
            color: 'white',
            textAlign: 'center'
        }}>
            <h3 style={{
                margin: '0 0 15px 0',
                fontSize: 'clamp(20px, 5vw, 24px)',
                textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
            }}>
                👁️ Beobachte die Abstimmung
            </h3>

            <div style={{
                background: 'rgba(255,255,255,0.15)',
                padding: '15px',
                borderRadius: '12px',
                marginBottom: '20px',
                backdropFilter: 'blur(10px)'
            }}>
                <p style={{ fontSize: 'clamp(14px, 3.5vw, 18px)', margin: '0 0 10px 0' }}>
                    Dein Hinweis war: <span style={{color:'#ffd700', fontWeight: 'bold', fontSize: 'clamp(16px, 4vw, 20px)'}}>{game?.hint}</span>
                </p>
                <p style={{fontWeight: 'bold', fontSize: 'clamp(14px, 3vw, 16px)', margin: '0', opacity: 0.9}}>
                    🎭 Du kannst nicht abstimmen, aber siehst wer welche Karte gelegt hat!
                </p>
            </div>

            <h4 style={{ margin: '0 0 20px 0', fontSize: 'clamp(16px, 3.5vw, 18px)' }}>
                🃏 Die gelegten Karten mit Besitzern:
            </h4>

            <div style={{
                display: 'grid',
                gridTemplateColumns: window.innerWidth < 480
                    ? '1fr'
                    : window.innerWidth < 768
                        ? 'repeat(2, 1fr)'
                        : 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: window.innerWidth < 768 ? '15px' : '20px',
                justifyContent: 'center',
                padding: '20px',
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

                    // Finde den Spieler der diese Karte gelegt hat
                    const cardOwner = game?.selectedCards?.find(sc => sc.cardId === cardId);
                    const ownerPlayer = cardOwner ? game.players.find(p => p.id === cardOwner.playerId) : null;
                    const isMyCard = cardOwner && cardOwner.playerId === game?.players?.[game?.storytellerIndex]?.id;

                    // Prüfe ob bereits Stimmen für diese Karte abgegeben wurden
                    const votesForThisCard = game?.votes?.filter(v => v.cardId === cardId) || [];

                    return (
                        <div key={cardId} style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
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
                                    fontSize: 'clamp(10px, 2vw, 12px)',
                                    fontWeight: 'bold',
                                    zIndex: 1,
                                    boxShadow: '0 3px 6px rgba(0,0,0,0.3)',
                                    whiteSpace: 'nowrap'
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
                                    fontSize: 'clamp(10px, 2vw, 11px)',
                                    fontWeight: 'bold',
                                    zIndex: 1,
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                    whiteSpace: 'nowrap'
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
                                    maxWidth: '100%',
                                    width: '100%'
                                }}
                            />
                        </div>
                    );
                })}
            </div>

            {/* Detaillierte Voting-Status */}
            <div style={{
                marginTop: '25px',
                background: 'rgba(255,255,255,0.15)',
                padding: '15px',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)'
            }}>
                <p style={{ fontSize: 'clamp(14px, 3vw, 16px)', margin: '0 0 10px 0', fontWeight: 'bold' }}>
                    📊 Abstimmungen: {game?.votes?.length || 0} / {(game?.players?.length || 1) - 1}
                </p>

                {game?.votes?.length > 0 && (
                    <div>
                        <p style={{ fontSize: 'clamp(12px, 2.5vw, 14px)', margin: '0 0 8px 0', opacity: 0.9 }}>Bereits abgestimmt:</p>
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
                                        fontSize: 'clamp(10px, 2vw, 12px)',
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
        </div>
    );
}
