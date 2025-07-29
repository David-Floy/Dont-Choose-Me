import React from "react";

/**
 * Renders the game end screen
 * Übergibt gameWinner, game und handleRestartGame als Props!
 */
export function renderGameEndPhase({ gameWinner, game, handleRestartGame }) {
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
}
