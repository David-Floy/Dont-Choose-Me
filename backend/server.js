const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const GameManager = require('./server/gameManager');

/**
 * PicMe Game Server
 * Verwaltet Spiele, Socket-Verbindungen und statische Dateien
 */

// === SERVER SETUP ===
const app = express();
const server = http.createServer(app);

// Produktions- vs Entwicklungsumgebung
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = isProduction
  ? ['https://dont-choose-me.vercel.app', 'https://dein-domain.com'] // Füge deine Domain hinzu
  : ['http://localhost:3000', 'https://dont-choose-me.vercel.app'];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3001;

// === GAME STATE ===
let cards = [];
const gameManager = new GameManager();

// === INITIALIZATION ===

/**
 * Lädt die Karten aus der JSON-Datei
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

// API-Route für Karten
app.get('/api/cards', (req, res) => {
  res.json(cards);
});

// Statische Dateien für Bilder servieren
app.use('/images', express.static(path.join(__dirname, 'images')));

// Statische Dateien servieren - nur in Produktion
if (isProduction) {
  const buildPath = path.join(__dirname, 'build');
  if (fs.existsSync(buildPath)) {
    app.use(express.static(buildPath));

    // Fallback-Route für SPA
    app.get('*', (req, res) => {
      res.sendFile(path.join(buildPath, 'index.html'));
    });
  } else {
    console.error('Build-Ordner nicht gefunden! Führe "npm run build" aus.');
  }
} else {
  // Entwicklungsumgebung - zeige Infoseite
  app.get('/', (req, res) => {
    res.send(`
      <h1>PicMe Server läuft!</h1>
      <p>Port: ${PORT}</p>
      <p>Entwicklungsmodus - Frontend läuft separat auf Port 3000</p>
      <p>Karten geladen: ${cards.length}</p>
    `);
  });
}

// Health-Check Route für Deployment
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    cardsLoaded: cards.length,
    activeGames: Object.keys(gameManager.games || {}).length
  });
});

// === SOCKET EVENT HANDLERS ===

/**
 * Behandelt neue Socket-Verbindungen
 */
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  /**
   * Spieler tritt Lobby bei
   */
  socket.on('joinLobby', ({ playerName, gameId }) => {
    console.log(`Join lobby request: ${playerName} -> ${gameId} (${socket.id})`);

    // Validiere Spielername
    const playerValidation = validatePlayerName(playerName);
    if (!playerValidation.isValid) {
      console.log(`Invalid player name from ${socket.id}: ${playerValidation.error}`);
      socket.emit('joinError', { error: playerValidation.error });
      return;
    }

    // Validiere Raum-ID
    const gameValidation = validateGameId(gameId);
    if (!gameValidation.isValid) {
      console.log(`Invalid game ID from ${socket.id}: ${gameValidation.error}`);
      socket.emit('joinError', { error: gameValidation.error });
      return;
    }

    const validatedPlayerName = playerValidation.playerName;
    const validatedGameId = gameValidation.gameId;

    // Prüfe ob Spielername bereits vergeben ist
    const existingGame = gameManager.getGame(validatedGameId);
    if (existingGame && isPlayerNameTaken(existingGame, validatedPlayerName, socket.id)) {
      console.log(`Player name already taken: ${validatedPlayerName} in game ${validatedGameId}`);
      socket.emit('joinError', { error: 'Dieser Spielername ist bereits vergeben' });
      return;
    }

    // Prüfe ob Spiel bereits läuft und Spieler nicht bereits drin ist
    if (existingGame && existingGame.state === 'playing') {
      const existingPlayer = existingGame.players.find(p => p.name === validatedPlayerName);
      if (!existingPlayer) {
        console.log(`Game already running, cannot add new player: ${validatedPlayerName}`);
        socket.emit('joinError', { error: 'Das Spiel läuft bereits. Du kannst nicht mehr beitreten.' });
        return;
      }
    }

    try {
      const game = gameManager.addPlayer(validatedGameId, socket.id, validatedPlayerName);
      socket.join(validatedGameId);

      console.log(`${validatedPlayerName} successfully joined lobby ${validatedGameId}`);
      io.to(validatedGameId).emit('lobbyUpdate', game.players);

      // Bestätige erfolgreichen Beitritt
      socket.emit('joinSuccess', {
        gameId: validatedGameId,
        playerName: validatedPlayerName
      });
    } catch (error) {
      console.error(`Error adding player to game:`, error);
      socket.emit('joinError', { error: 'Fehler beim Beitreten des Spiels' });
    }
  });

  /**
   * Spiel starten
   */
  socket.on('startGame', (gameId) => {
    console.log(`Start game request for ${gameId} from ${socket.id}`);

    // Validiere Raum-ID
    const gameValidation = validateGameId(gameId);
    if (!gameValidation.isValid) {
      console.log(`Invalid game ID for start: ${gameValidation.error}`);
      socket.emit('startGameError', { error: gameValidation.error });
      return;
    }

    const validatedGameId = gameValidation.gameId;
    const game = gameManager.getGame(validatedGameId);

    if (!game) {
      console.log(`Game not found for start: ${validatedGameId}`);
      socket.emit('startGameError', { error: 'Spiel nicht gefunden' });
      return;
    }

    // Prüfe ob der anfragende Spieler im Spiel ist
    const requestingPlayer = game.players.find(p => p.id === socket.id);
    if (!requestingPlayer) {
      console.log(`Unauthorized start game request from ${socket.id}`);
      socket.emit('startGameError', { error: 'Du bist nicht berechtigt, das Spiel zu starten' });
      return;
    }

    // Prüfe Mindestanzahl Spieler
    if (game.players.length < 3) {
      console.log(`Not enough players to start game ${validatedGameId}: ${game.players.length}`);
      socket.emit('startGameError', { error: 'Mindestens 3 Spieler werden benötigt' });
      return;
    }

    // Prüfe ob Spiel bereits läuft
    if (game.state === 'playing') {
      console.log(`Game already running: ${validatedGameId}`);
      socket.emit('startGameError', { error: 'Das Spiel läuft bereits' });
      return;
    }

    const startedGame = gameManager.startGame(validatedGameId, cards);
    if (!startedGame) {
      console.log(`Failed to start game ${validatedGameId}`);
      socket.emit('startGameError', { error: 'Fehler beim Starten des Spiels' });
      return;
    }

    console.log(`Game ${validatedGameId} started successfully`);
    io.to(validatedGameId).emit('gameStarted', {
      ...startedGame,
      storytellerIndex: startedGame.storytellerIndex
    });
  });

  /**
   * Spieler wählt Karte
   */
  socket.on('chooseCard', ({ gameId, cardId }) => {
    console.log(`Card chosen in game ${gameId} by ${socket.id}`);

    const game = gameManager.getGame(gameId);
    if (!game) return;

    // Validierungen
    if (socket.id === game.selectedCards[0].playerId) return; // Erzähler
    if (game.selectedCards.find(c => c.playerId === socket.id)) return; // Bereits gewählt

    // Zusätzliche Validierung: Prüfe ob Spieler die Karte wirklich hat
    const player = game.players.find(p => p.id === socket.id);
    if (!player) {
      console.error(`Player not found for socket ${socket.id}`);
      return;
    }

    const hasCard = player.hand.find(c => c.id === cardId);
    if (!hasCard) {
      console.error(`Player ${player.name} tried to play card ${cardId} but doesn't have it!`);
      console.error(`Player's hand: ${player.hand.map(c => c.id).join(', ')}`);
      return;
    }

    // Karte aus Hand entfernen und zu ausgewählten hinzufügen
    player.hand = player.hand.filter(card => card.id !== cardId);
    game.selectedCards.push({ cardId, playerId: socket.id });

    console.log(`${player.name} played card ${cardId}. Hand now has ${player.hand.length} cards.`);
    console.log(`Card chosen: ${game.selectedCards.length}/${game.players.length} cards selected`);

    // Alle Karten gewählt? -> Voting-Phase
    if (game.selectedCards.length === game.players.length) {
      game.mixedCards = shuffle([...game.selectedCards]);
      game.phase = 'voting';
      console.log(`All cards selected in game ${gameId}, starting voting phase`);

      // Debug: Zeige alle gespielten Karten
      console.log('=== CARDS PLAYED THIS ROUND ===');
      game.selectedCards.forEach(sc => {
        const player = game.players.find(p => p.id === sc.playerId);
        console.log(`${player ? player.name : 'Unknown'}: Card ${sc.cardId}`);
      });
      console.log('=== END CARDS PLAYED ===');

      io.to(gameId).emit('cardsReady', { cards: game.mixedCards });
    }

    io.to(gameId).emit('gameState', {
      ...game,
      storytellerIndex: game.storytellerIndex
    });
  });

  /**
   * Erzähler gibt Hinweis
   */
  socket.on('giveHint', ({ gameId, cardId, hint }) => {
    console.log(`Give hint request: ${hint} (card: ${cardId}) from ${socket.id}`);

    // Validiere Raum-ID
    const gameValidation = validateGameId(gameId);
    if (!gameValidation.isValid) {
      console.log(`Invalid game ID for hint: ${gameValidation.error}`);
      return;
    }

    // Validiere Hinweis
    if (!hint || typeof hint !== 'string') {
      console.log(`Invalid hint from ${socket.id}: empty or not string`);
      return;
    }

    const trimmedHint = hint.trim();
    if (trimmedHint.length === 0) {
      console.log(`Empty hint from ${socket.id}`);
      return;
    }

    if (trimmedHint.length > 100) {
      console.log(`Hint too long from ${socket.id}: ${trimmedHint.length} characters`);
      return;
    }

    // Validiere Karten-ID
    if (!cardId || (typeof cardId !== 'string' && typeof cardId !== 'number')) {
      console.log(`Invalid card ID from ${socket.id}: ${cardId}`);
      return;
    }

    const game = gameManager.getGame(gameValidation.gameId);
    if (!game) return;

    // Weitere Validierungen wie zuvor...
    if (game.hint && game.hint !== '') {
      console.log(`Hint already given in game ${gameValidation.gameId}, ignoring new hint`);
      return;
    }

    const currentPlayer = game.players.find(p => p.id === socket.id);
    if (!currentPlayer) {
      console.log(`Player not found for socket ${socket.id} in game ${gameValidation.gameId}`);
      return;
    }

    const currentStoryteller = game.players[game.storytellerIndex];
    if (!currentStoryteller || currentStoryteller.name !== currentPlayer.name) {
      console.log(`Non-storyteller tried to give hint in game ${gameValidation.gameId}`);
      return;
    }

    const hasCard = currentPlayer.hand.find(c => c.id == cardId);
    if (!hasCard) {
      console.error(`Storyteller ${currentPlayer.name} tried to play card ${cardId} but doesn't have it!`);
      return;
    }

    // Hinweis setzen und Karte entfernen
    game.hint = trimmedHint;
    game.storytellerCard = cardId;
    game.selectedCards = [{ cardId, playerId: socket.id }];
    game.phase = 'selectCards';
    game.votes = [];

    currentPlayer.hand = currentPlayer.hand.filter(card => card.id != cardId);
    console.log(`Storyteller ${currentPlayer.name} played card ${cardId}. Hand now has ${currentPlayer.hand.length} cards.`);

    io.to(gameValidation.gameId).emit('gameState', {
      ...game,
      storytellerIndex: game.storytellerIndex
    });
  });

  /**
   * Spieler stimmt für Karte ab
   */
  socket.on('voteCard', ({ gameId, cardId }) => {
    console.log(`Vote cast in game ${gameId} by ${socket.id}`);

    const game = gameManager.getGame(gameId);
    if (!game) return;

    if (!game.votes) game.votes = [];
    if (game.votes.find(v => v.playerId === socket.id)) return; // Bereits gestimmt

    game.votes.push({ cardId, playerId: socket.id });
    console.log(`Vote cast: ${game.votes.length}/${game.players.length - 1} votes`);

    // Alle Stimmen abgegeben? -> Reveal-Phase
    if (game.votes.length === game.players.length - 1) {
      const results = calculatePoints(game);

      // Prüfe auf Spielende (30 Punkte erreicht)
      const winner = game.players.find(p => p.points >= 30);

      if (winner) {
        // Spiel beenden
        game.phase = 'gameEnd';
        game.winner = winner.name;

        console.log(`Game ${gameId} ended! Winner: ${winner.name} with ${winner.points} points`);

        io.to(gameId).emit('gameEnded', {
          winner: winner.name,
          finalScores: game.players.map(p => ({
            name: p.name,
            points: p.points,
            id: p.id
          }))
        });

        io.to(gameId).emit('gameState', {
          ...game,
          storytellerIndex: game.storytellerIndex
        });
      } else {
        // Normale Reveal-Phase
        game.phase = 'reveal';

        console.log(`All votes cast in game ${gameId}, starting reveal phase`);

        io.to(gameId).emit('roundEnded', results);
        io.to(gameId).emit('gameState', {
          ...game,
          storytellerIndex: game.storytellerIndex
        });
      }
    } else {
      // Sende Update während des Votings
      io.to(gameId).emit('gameState', {
        ...game,
        storytellerIndex: game.storytellerIndex
      });
    }
  });

  /**
   * Spiel neustarten
   */
  socket.on('restartGame', (gameId) => {
    console.log(`Restart game requested for ${gameId}`);

    const game = gameManager.getGame(gameId);
    if (!game) return;

    // Spiel komplett zurücksetzen
    game.state = 'lobby';
    game.round = 0;
    game.storytellerIndex = 0;
    game.hint = '';
    game.storytellerCard = null;
    game.selectedCards = [];
    game.mixedCards = [];
    game.votes = [];
    game.phase = 'waiting';
    game.winner = null;

    // Alle Spieler-Punkte zurücksetzen und Hände leeren
    for (const player of game.players) {
      player.points = 0;
      player.hand = [];
    }

    // Deck neu mischen
    game.deck = shuffle([...cards]);

    console.log(`Game ${gameId} restarted, back to lobby`);

    // Sende spezifisches Restart-Event
    io.to(gameId).emit('gameRestarted');

    io.to(gameId).emit('gameState', {
      ...game,
      storytellerIndex: game.storytellerIndex
    });

    io.to(gameId).emit('lobbyUpdate', game.players);
  });

  /**
   * Weiter zur nächsten Runde nach Reveal
   */
  socket.on('continueToNextRound', (gameId) => {
    console.log(`Continue to next round requested for game ${gameId}`);

    const game = gameManager.getGame(gameId);
    if (!game || game.phase !== 'reveal') {
      console.log(`Cannot continue - game not found or not in reveal phase. Current phase: ${game?.phase}`);
      return;
    }

    console.log(`Preparing next round for game ${gameId}`);
    gameManager.prepareNextRound(gameId);

    const updatedGame = gameManager.getGame(gameId);
    console.log(`Next round prepared. New phase: ${updatedGame.phase}, New storyteller: ${updatedGame.players[updatedGame.storytellerIndex].name}`);

    io.to(gameId).emit('gameState', {
      ...updatedGame,
      storytellerIndex: updatedGame.storytellerIndex
    });
  });

  /**
   * Aktuellen Spielzustand abrufen
   */
  socket.on('getGameState', (gameId) => {
    const game = gameManager.getGame(gameId);

    if (game && game.state === 'playing') {
      const requestingPlayer = game.players.find(p => p.id === socket.id);

      console.log(`=== GAME STATE REQUEST DEBUG ===`);
      console.log(`Game ID: ${gameId}`);
      console.log(`Requesting socket: ${socket.id}`);
      console.log(`Requesting player: ${requestingPlayer?.name || 'unknown'}`);
      console.log(`Player hand size: ${requestingPlayer?.hand?.length || 0}`);
      console.log(`Player hand IDs: ${requestingPlayer?.hand?.map(c => c.id).join(', ') || 'empty'}`);
      console.log(`Game phase: ${game.phase}`);
      console.log(`Game hint: ${game.hint || 'none'}`);
      console.log(`=== END GAME STATE REQUEST DEBUG ===`);

      socket.emit('gameState', {
        ...game,
        storytellerIndex: game.storytellerIndex
      });
    } else {
      console.log(`No valid game state found for ${gameId}`);
    }
  });

  /**
   * Spieler verlässt Lobby
   */
  socket.on('leaveLobby', ({ gameId, playerName }) => {
    console.log(`Player ${playerName} leaving lobby ${gameId}`);

    const game = gameManager.getGame(gameId);
    if (game) {
      // Entferne Spieler aus dem Spiel
      const playerIndex = game.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        game.players.splice(playerIndex, 1);
        console.log(`Removed player ${playerName} from game ${gameId}`);

        // Verlasse den Socket-Raum
        socket.leave(gameId);

        // Sende Update an alle verbleibenden Spieler
        io.to(gameId).emit('lobbyUpdate', game.players);

        // Lösche Spiel wenn keine Spieler mehr da sind
        if (game.players.length === 0) {
          gameManager.removeGame(gameId);
          console.log(`Deleted empty game ${gameId}`);
        }
      }
    }
  });

  /**
   * Client-Verbindung getrennt
   */
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);

    const affectedGames = gameManager.removePlayer(socket.id);

    // Lobby-Updates für betroffene Spiele senden
    for (const gameId of affectedGames) {
      const game = gameManager.getGame(gameId);
      if (game) {
        io.to(gameId).emit('lobbyUpdate', game.players);
      }
    }
  });
});

// === UTILITY FUNCTIONS ===

/**
 * Validiert einen Spielernamen
 * @param {string} playerName - Der zu validierende Spielername
 * @returns {Object} { isValid: boolean, error?: string }
 */
function validatePlayerName(playerName) {
  if (!playerName || typeof playerName !== 'string') {
    return { isValid: false, error: 'Spielername ist erforderlich' };
  }

  const trimmedName = playerName.trim();

  if (trimmedName.length === 0) {
    return { isValid: false, error: 'Spielername darf nicht leer sein' };
  }

  if (trimmedName.length < 2) {
    return { isValid: false, error: 'Spielername muss mindestens 2 Zeichen lang sein' };
  }

  if (trimmedName.length > 20) {
    return { isValid: false, error: 'Spielername darf maximal 20 Zeichen lang sein' };
  }

  // Prüfe auf erlaubte Zeichen (Buchstaben, Zahlen, Leerzeichen, Umlaute)
  if (!/^[a-zA-ZäöüÄÖÜß0-9\s]+$/.test(trimmedName)) {
    return { isValid: false, error: 'Spielername darf nur Buchstaben, Zahlen und Leerzeichen enthalten' };
  }

  // Prüfe auf aufeinanderfolgende Leerzeichen
  if (/\s{2,}/.test(trimmedName)) {
    return { isValid: false, error: 'Spielername darf keine aufeinanderfolgenden Leerzeichen enthalten' };
  }

  return { isValid: true, playerName: trimmedName };
}

/**
 * Validiert eine Raum-ID
 * @param {string} gameId - Die zu validierende Raum-ID
 * @returns {Object} { isValid: boolean, error?: string }
 */
function validateGameId(gameId) {
  if (!gameId || typeof gameId !== 'string') {
    return { isValid: false, error: 'Raum-ID ist erforderlich' };
  }

  const trimmedId = gameId.trim();

  if (trimmedId.length === 0) {
    return { isValid: false, error: 'Raum-ID darf nicht leer sein' };
  }

  if (trimmedId.length < 2) {
    return { isValid: false, error: 'Raum-ID muss mindestens 2 Zeichen lang sein' };
  }

  if (trimmedId.length > 15) {
    return { isValid: false, error: 'Raum-ID darf maximal 15 Zeichen lang sein' };
  }

  // Prüfe auf erlaubte Zeichen (Buchstaben, Zahlen, Bindestrich, Unterstrich)
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmedId)) {
    return { isValid: false, error: 'Raum-ID darf nur Buchstaben, Zahlen, Bindestriche und Unterstriche enthalten' };
  }

  return { isValid: true, gameId: trimmedId };
}

/**
 * Prüft ob ein Spielername in einem Spiel bereits existiert
 * @param {Object} game - Das Spielobjekt
 * @param {string} playerName - Der zu prüfende Spielername
 * @param {string} excludeSocketId - Socket-ID die ausgeschlossen werden soll (für Updates)
 * @returns {boolean} True wenn Name bereits existiert
 */
function isPlayerNameTaken(game, playerName, excludeSocketId = null) {
  return game.players.some(player =>
    player.name.toLowerCase() === playerName.toLowerCase() &&
    player.id !== excludeSocketId
  );
}

/**
 * Mischt ein Array zufällig (Fisher-Yates Shuffle)
 * @param {Array} array - Das zu mischende Array
 * @returns {Array} Das gemischte Array
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
 * Berechnet die Punkte am Ende einer Runde
 * @param {Object} game - Das Spielobjekt
 * @returns {Object} Die Punkteverteilung
 */
function calculatePoints(game) {
  const storytellerId = game.selectedCards[0].playerId;
  const correctCardId = game.storytellerCard;
  const votes = game.votes;

  const correctVotes = votes.filter(v => v.cardId === correctCardId).length;
  const allCorrect = correctVotes === votes.length;
  const noneCorrect = correctVotes === 0;

  // Punkte für den Erzähler
  for (const player of game.players) {
    if (player.id === storytellerId) {
      if (!noneCorrect && !allCorrect) {
        player.points += 3;
      }
    }
  }

  // Punkte für richtige Stimmen
  for (const vote of votes) {
    if (vote.cardId === correctCardId) {
      const player = game.players.find(p => p.id === vote.playerId);
      if (player) {
        player.points += 3;
      }
    }
  }

  // Punkte für eigene Karten die Stimmen bekommen haben (aber nicht die Erzähler-Karte)
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

  // Alle anderen Spieler bekommen einen Punkt, wenn niemand oder alle richtig geraten haben
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
  console.log(`PicMe Server läuft auf Port ${PORT}`);
  console.log(`Umgebung: ${isProduction ? 'Produktion' : 'Entwicklung'}`);
  console.log(`Karten geladen: ${cards.length}`);
  if (isProduction) {
    console.log(`Server erreichbar unter: http://your-server-ip:${PORT}`);
  }
});
