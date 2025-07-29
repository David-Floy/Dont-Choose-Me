import React from "react";
import Card from "./Card";

/**
 * Renders the hint-giving phase for the storyteller
 * Übergibt alle benötigten Props als Parameter!
 */
export function renderGiveHintPhase({
    hand,
    selectedCard,
    setSelectedCard,
    hint,
    setHint,
    handleGiveHint
}) {
    return (
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
                display: 'flex',
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
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        ✨ Ausgewählt
                                    </div>
                                )}
                                <Card
                                    card={card}
                                    onClick={() => setSelectedCard(card.id)}
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
}
