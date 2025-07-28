const http = require('http');
const express = require('express');
const fs = require('fs');
const path = require('path');
const GameManager = require('./server/gameManager');

/**
 * PicMe Game Server
 * Manages games via REST API and serves static files
 */

// === SERVER SETUP ===
const app = express();
const server = http.createServer(app);

// Production vs Development environment
const isProduction = process.env.NODE_ENV === 'production';

// CORS Middleware for all origins in production
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// JSON Body Parser
app.use(express.json());

const PORT = process.env.PORT || 3001;

// === GAME STATE ===
let cards = [];
const gameManager = new GameManager();

// === INITIALIZATION ===

/**
 * Loads cards from the JSON file
 */
function loadCards() {
  const cardsPath = path.join(__dirname, 'cards.json');
  if (fs.existsSync(cardsPath)) {
    try {
      const data = fs.readFileSync(cardsPath, 'utf8');
      cards = JSON.parse(data);
      console.log(`${cards.length} Karten geladen`);
    } catch (error) {
      console.error('Fehler beim Laden der Karten:', error);
      cards = [];
    }
  } else {
    console.warn('cards.json nicht gefunden - erstelle Beispielkarten');
    cards = [
      { id: 1, title: 'Beispielkarte 1', image: '/images/example1.jpg' },
      { id: 2, title: 'Beispielkarte 2', image: '/images/example2.jpg' }
    ];
  }
}

// === EXPRESS ROUTES ===

// API route for cards
app.get('/api/cards', (req, res) => {
  res.json(cards);
});

// Main game API endpoint
app.post('/api/game', (req, res) => {
  const { gameId, action, playerName, cardId, hint } = req.body;

  console.log(`API Request: ${action} from ${playerName} in game ${gameId}`);

  try {
    switch (action) {
      case 'joinLobby':
        const game = gameManager.addPlayer(gameId, `player_${Date.now()}_${Math.random()}`, playerName);
        res.json({ success: true, game: game });
        break;

      case 'startGame':
        const startedGame = gameManager.startGame(gameId, cards);
        if (startedGame) {
          res.json({ success: true, game: startedGame });
        } else {
          res.status(400).json({ error: 'Spiel konnte nicht gestartet werden' });
        }
        break;

      case 'getState':
        const currentGame = gameManager.getGame(gameId);
        if (currentGame) {
          res.json({ success: true, game: currentGame });
        } else {
          res.status(404).json({ error: 'Spiel nicht gefunden' });
        }
        break;

      case 'giveHint':
        const hintGame = gameManager.getGame(gameId);
        if (hintGame) {
          const player = hintGame.players.find(p => p.name === playerName);
          if (player && hintGame.players[hintGame.storytellerIndex].name === playerName) {

            // FIX: Verbesserte Validierung
            if (!hint || typeof hint !== 'string' || hint.trim().length === 0) {
              res.status(400).json({ error: 'Hinweis ist erforderlich' });
              break;
            }

            if (!cardId) {
              res.status(400).json({ error: 'Karte muss ausgewählt werden' });
              break;
            }

            // Prüfe ob der Spieler die Karte tatsächlich besitzt
            const hasCard = player.hand.some(card => card.id == cardId);
            if (!hasCard) {
              res.status(400).json({ error: 'Gewählte Karte nicht in deiner Hand' });
              break;
            }

            console.log(`=== HINT GIVEN ===`);
            console.log(`Player: ${playerName}`);
            console.log(`Hint: "${hint.trim()}"`);
            console.log(`Selected card ID: ${cardId}`);
            console.log(`Player hand before: ${player.hand.map(c => c.id).join(', ')}`);

            hintGame.hint = hint.trim();
            hintGame.storytellerCard = cardId;
            hintGame.selectedCards = [{ cardId, playerId: player.id }];
            hintGame.phase = 'selectCards';

            // Remove card from hand
            const cardIndex = player.hand.findIndex(card => card.id == cardId);
            if (cardIndex !== -1) {
              const removedCard = player.hand.splice(cardIndex, 1)[0];
              console.log(`Removed card: ${removedCard.id} (${removedCard.title})`);
            } else {
              console.error(`ERROR: Could not find card ${cardId} in player hand`);
            }

            console.log(`Player hand after: ${player.hand.map(c => c.id).join(', ')}`);
            console.log(`Game phase changed to: ${hintGame.phase}`);

            res.json({ success: true, game: hintGame });
          } else {
            res.status(403).json({ error: 'Nicht berechtigt oder nicht der aktuelle Erzähler' });
          }
        } else {
          res.status(404).json({ error: 'Spiel nicht gefunden' });
        }
        break;

      case 'chooseCard':
        const chooseGame = gameManager.getGame(gameId);
        if (chooseGame) {
          const player = chooseGame.players.find(p => p.name === playerName);
          if (player) {
            // Check if player has already selected a card
            const hasSelected = chooseGame.selectedCards.find(sc => sc.playerId === player.id);
            if (!hasSelected) {
              chooseGame.selectedCards.push({ cardId, playerId: player.id });
              player.hand = player.hand.filter(card => card.id != cardId);

              // All cards selected?
              if (chooseGame.selectedCards.length === chooseGame.players.length) {
                chooseGame.mixedCards = shuffle([...chooseGame.selectedCards]);
                chooseGame.phase = 'voting';
              }
            }
            res.json({ success: true, game: chooseGame });
          } else {
            res.status(404).json({ error: 'Spieler nicht gefunden' });
          }
        } else {
          res.status(404).json({ error: 'Spiel nicht gefunden' });
        }
        break;

      case 'vote':
        const voteGame = gameManager.getGame(gameId);
        if (voteGame) {
          const player = voteGame.players.find(p => p.name === playerName);
          if (player) {
            if (!voteGame.votes) voteGame.votes = [];

            // Check if already voted
            const hasVoted = voteGame.votes.find(v => v.playerId === player.id);
            if (!hasVoted) {
              voteGame.votes.push({ cardId, playerId: player.id });

              // All votes cast?
              if (voteGame.votes.length === voteGame.players.length - 1) {
                const results = calculatePoints(voteGame);

                // Check for game end
                const winner = voteGame.players.find(p => p.points >= 30);
                if (winner) {
                  voteGame.phase = 'gameEnd';
                  voteGame.winner = winner.name;
                } else {
                  voteGame.phase = 'reveal';
                }
              }
            }
            res.json({ success: true, game: voteGame });
          } else {
            res.status(404).json({ error: 'Spieler nicht gefunden' });
          }
        } else {
          res.status(404).json({ error: 'Spiel nicht gefunden' });
        }
        break;

      case 'nextRound':
        gameManager.prepareNextRound(gameId);
        const nextGame = gameManager.getGame(gameId);
        res.json({ success: true, game: nextGame });
        break;

      case 'restart':
        const restartedGame = gameManager.restartGame(gameId, cards);
        res.json({ success: true, game: restartedGame });
        break;

      default:
        res.status(400).json({ error: 'Unbekannte Aktion' });
    }
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve static files for images
app.use('/images', express.static(path.join(__dirname, 'images')));

// Serve static files - only in production
if (isProduction) {
  const buildPath = path.join(__dirname, 'build');
  console.log(`🔍 Suche Build-Ordner in: ${buildPath}`);
  
  if (fs.existsSync(buildPath)) {
    app.use(express.static(buildPath));
    console.log(`✅ Serving static files from: ${buildPath}`);
    
    // Fallback route for SPA
    app.get('*', (req, res) => {
      const indexPath = path.join(buildPath, 'index.html');
      console.log(`📄 Serving index.html from: ${indexPath}`);
      res.sendFile(indexPath);
    });
  } else {
    console.error('❌ Build-Ordner nicht gefunden!');
    console.error('💡 Führe "npm run build:all" aus oder stelle sicher, dass der Build-Prozess erfolgreich war.');
    
    // Fallback for missing build
    app.get('*', (req, res) => {
      res.status(503).send(`
        <h1>🚧 Service wird aufgebaut...</h1>
        <p>Der Build-Prozess ist noch nicht abgeschlossen.</p>
        <p>Versuche es in wenigen Minuten erneut.</p>
        <hr>
        <p><small>Build-Pfad: ${buildPath}</small></p>
      `);
    });
  }
} else {
  // Development environment - show info page
  app.get('/', (req, res) => {
    res.send(`
      <h1>PicMe Server läuft!</h1>
      <p>Port: ${PORT}</p>
      <p>Entwicklungsmodus - Frontend läuft separat auf Port 3000</p>
      <p>Karten geladen: ${cards.length}</p>
    `);
  });
}

// Health check route for deployment
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    cardsLoaded: cards.length,
    activeGames: Object.keys(gameManager.games || {}).length
  });
});

// === UTILITY FUNCTIONS ===

/**
 * Shuffles an array randomly using Fisher-Yates shuffle algorithm
 * @param {Array} array - Array to shuffle
 * @returns {Array} - New shuffled array
 */
function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Calculates points at the end of a round based on game rules
 * @param {Object} game - Game object containing players, votes, and selected cards
 * @returns {Object} - Result object with scoring details
 */
function calculatePoints(game) {
  const storytellerId = game.selectedCards[0].playerId;
  const correctCardId = game.storytellerCard;
  const votes = game.votes;

  const correctVotes = votes.filter(v => v.cardId === correctCardId).length;
  const allCorrect = correctVotes === votes.length;
  const noneCorrect = correctVotes === 0;

  // Points for the storyteller
  for (const player of game.players) {
    if (player.id === storytellerId) {
      if (!noneCorrect && !allCorrect) {
        player.points += 3;
      }
    }
  }

  // Points for correct votes
  for (const vote of votes) {
    if (vote.cardId === correctCardId) {
      const player = game.players.find(p => p.id === vote.playerId);
      if (player) {
        player.points += 3;
      }
    }
  }

  // Points for own cards that received votes
  for (const vote of votes) {
    if (vote.cardId !== correctCardId) {
      const cardOwner = game.selectedCards.find(sc => sc.cardId === vote.cardId);
      if (cardOwner && cardOwner.playerId !== storytellerId) {
        const player = game.players.find(p => p.id === cardOwner.playerId);
        if (player) {
          player.points += 1;
        }
      }
    }
  }

  // All others get points if nobody or everyone guessed correctly
  if (noneCorrect || allCorrect) {
    for (const player of game.players) {
      if (player.id !== storytellerId) {
        player.points += 2;
      }
    }
  }

  return {
    storytellerId,
    correctCardId,
    votes,
    correctVotes,
    allCorrect,
    noneCorrect,
    players: game.players.map(p => ({
      id: p.id,
      name: p.name,
      points: p.points
    }))
  };
}

// === SERVER START ===
loadCards();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 PicMe Server läuft auf Port ${PORT}`);
  console.log(`📁 Umgebung: ${isProduction ? 'Produktion' : 'Entwicklung'}`);
  console.log(`🃏 Karten geladen: ${cards.length}`);
  console.log(`🌐 Server bound to: 0.0.0.0:${PORT}`);

  if (isProduction) {
    console.log(`🚀 Production server ready!`);
    console.log(`🏥 Health check: /health`);
  }
});

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('📝 SIGTERM empfangen, starte graceful shutdown...');
  server.close(() => {
    console.log('✅ Server erfolgreich beendet');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📝 SIGINT empfangen, starte graceful shutdown...');
  server.close(() => {
    console.log('✅ Server erfolgreich beendet');
    process.exit(0);
  });
});
