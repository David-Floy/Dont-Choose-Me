import React from "react";
import Card from "./Card";

/**
 * Wartet auf die anderen Spieler und zeigt ggf. Hand und gelegte Karten.
 * Erwartet Props: { game, playerName, hand, allCards }
 */
export function renderWaitingPhase({ game, playerName, hand, allCards }) {
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
                    {hand && hand.length > 0 && (
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
                    {hand && hand.length > 0 && (
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
}
