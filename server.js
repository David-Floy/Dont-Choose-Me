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
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const PORT = 3001;

// === GAME STATE ===
let cards = [];
const gameManager = new GameManager();

// === INITIALIZATION ===

/**
 * Lädt die Karten aus der JSON-Datei
 */
function loadCards() {
  fs.readFile(path.join(__dirname, 'cards.json'), 'utf8', (err, data) => {
    if (!err) {
      cards = JSON.parse(data);
      console.log(`${cards.length} Karten geladen`);
    } else {
      console.error('Fehler beim Laden der Karten:', err);
    }
  });
}

// === EXPRESS ROUTES ===

// API-Route für Karten
app.get('/api/cards', (req, res) => {
  res.json(cards);
});

// Statische Dateien servieren
app.use(express.static(path.join(__dirname, 'build')));

// Fallback-Route für SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
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
    console.log(`${playerName} joins lobby ${gameId}`);

    const game = gameManager.addPlayer(gameId, socket.id, playerName);
    socket.join(gameId);

    io.to(gameId).emit('lobbyUpdate', game.players);
  });

  /**
   * Spiel starten
   */
  socket.on('startGame', (gameId) => {
    console.log(`Starting game ${gameId}`);

    const game = gameManager.startGame(gameId, cards);
    if (!game) {
      console.log(`Failed to start game ${gameId} - insufficient players`);
      return;
    }

    io.to(gameId).emit('gameStarted', {
      ...game,
      storytellerIndex: game.storytellerIndex
    });
  });

  /**
   * Erzähler gibt Hinweis
   */
  socket.on('giveHint', ({ gameId, cardId, hint }) => {
    console.log(`Hint given in game ${gameId}: "${hint}" by socket ${socket.id}`);

    const game = gameManager.getGame(gameId);
    if (!game) return;

    // Validierungen
    if (game.hint && game.hint !== '') {
      console.log(`Hint already given in game ${gameId}, ignoring new hint`);
      return;
    }

    // Finde den aktuellen Spieler basierend auf Socket-ID
    const currentPlayer = game.players.find(p => p.id === socket.id);
    if (!currentPlayer) {
      console.log(`Player not found for socket ${socket.id} in game ${gameId}`);
      return;
    }

    const currentStoryteller = game.players[game.storytellerIndex];
    if (!currentStoryteller || currentStoryteller.name !== currentPlayer.name) {
      console.log(`Non-storyteller tried to give hint in game ${gameId}. Expected: ${currentStoryteller?.name}, Got: ${currentPlayer.name}`);
      return;
    }

    // Hinweis setzen und Karte entfernen
    game.hint = hint;
    game.storytellerCard = cardId;
    game.selectedCards = [{ cardId, playerId: socket.id }];
    game.phase = 'selectCards';
    game.votes = [];

    const storyteller = game.players.find(p => p.id === socket.id);
    if (storyteller) {
      storyteller.hand = storyteller.hand.filter(card => card.id !== cardId);
      console.log(`Storyteller ${storyteller.name} hand after hint: ${storyteller.hand.length} cards`);
    }

    // Debug: Alle Spieler-Hände detailliert loggen
    console.log('=== DETAILED HAND DEBUG AFTER HINT ===');
    game.players.forEach((p, index) => {
      console.log(`Player ${index}: ${p.name} (${p.id})`);
      console.log(`  Hand size: ${p.hand?.length || 0}`);
      console.log(`  Hand IDs: ${p.hand?.map(c => c.id).join(', ') || 'empty'}`);
      console.log(`  Is storyteller: ${index === game.storytellerIndex}`);
    });
    console.log('=== END HAND DEBUG ===');

    console.log(`Game state after hint - Phase: ${game.phase}, Selected cards: ${game.selectedCards.length}`);

    // Sende vollständigen Spielzustand an alle Clients
    io.to(gameId).emit('gameState', {
      ...game,
      storytellerIndex: game.storytellerIndex
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

    // Karte aus Hand entfernen und zu ausgewählten hinzufügen
    const player = game.players.find(p => p.id === socket.id);
    if (player) {
      player.hand = player.hand.filter(card => card.id !== cardId);
    }

    game.selectedCards.push({ cardId, playerId: socket.id });
    console.log(`Card chosen: ${game.selectedCards.length}/${game.players.length} cards selected`);

    // Alle Karten gewählt? -> Voting-Phase
    if (game.selectedCards.length === game.players.length) {
      game.mixedCards = shuffle([...game.selectedCards]);
      game.phase = 'voting';
      console.log(`All cards selected in game ${gameId}, starting voting phase`);
      io.to(gameId).emit('cardsReady', { cards: game.mixedCards });
    }

    io.to(gameId).emit('gameState', {
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

    // Alle Stimmen abgegeben? -> Runde beenden
    if (game.votes.length === game.players.length - 1) {
      const results = calculatePoints(game);
      io.to(gameId).emit('roundEnded', results);

      gameManager.prepareNextRound(gameId);

      io.to(gameId).emit('gameState', {
        ...gameManager.getGame(gameId),
        storytellerIndex: gameManager.getGame(gameId).storytellerIndex
      });
    }
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
      if (player) player.points += 3;
    }
  }

  // Punkte für andere Spieler, die Stimmen für ihre Karten erhalten haben
  for (const selectedCard of game.selectedCards) {
    if (selectedCard.playerId !== storytellerId) {
      const votesForCard = votes.filter(v => v.cardId === selectedCard.cardId).length;
      const player = game.players.find(p => p.id === selectedCard.playerId);
      if (player) player.points += votesForCard;
    }
  }

  return { points: game.players.map(p => ({ id: p.name, points: p.points })) };
}

// === SERVER START ===

// Karten laden und Server starten
loadCards();

server.listen(PORT, () => {
  console.log(`PicMe Server läuft auf Port ${PORT}`);
});
