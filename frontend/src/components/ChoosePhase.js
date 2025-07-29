import React from "react";
import Card from "./Card";

const API_BASE = '/api';

/**
 * Renders the card selection phase
 */
export function renderChooseCardPhase({
    game,
    hand,
    selectedCard,
    setSelectedCard,
    handleChooseCard,
    playerName,
    gameId,
    setGame,
    updateHand
}) {
    return (
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
                                    if (setGame) setGame(data.game);
                                    if (updateHand) updateHand(data.game);
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
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        ✅ Gewählt
                                    </div>
                                )}
                                <Card
                                    card={card}
                                    onClick={() => {
                                        if (handleChooseCard) handleChooseCard(card.id);
                                        if (setSelectedCard) setSelectedCard(card.id);
                                    }}
                                    selected={selectedCard === card.id}
                                    style={{
                                        transform: selectedCard === card.id ? 'scale(1.02)' : 'scale(1)',
                                        boxShadow: selectedCard === card.id
                                            ? '0 8px 24px rgba(40,167,69,0.4)'
                                            : '0 4px 12px rgba(0,0,0,0.2)',
                                        maxWidth: '100%',
                                        width: '100%',
                                        transition: 'all 0.3s ease'
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
