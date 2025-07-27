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

// Statische Dateien für Bilder servieren
app.use('/images', express.static(path.join(__dirname, 'images')));

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

    // Zusätzliche Validierung: Prüfe ob Erzähler die Karte wirklich hat
    const hasCard = currentPlayer.hand.find(c => c.id === cardId);
    if (!hasCard) {
      console.error(`Storyteller ${currentPlayer.name} tried to play card ${cardId} but doesn't have it!`);
      console.error(`Storyteller's hand: ${currentPlayer.hand.map(c => c.id).join(', ')}`);
      return;
    }

    // Hinweis setzen und Karte entfernen
    game.hint = hint;
    game.storytellerCard = cardId;
    game.selectedCards = [{ cardId, playerId: socket.id }];
    game.phase = 'selectCards';
    game.votes = [];

    // Karte aus Hand entfernen
    currentPlayer.hand = currentPlayer.hand.filter(card => card.id !== cardId);
    console.log(`Storyteller ${currentPlayer.name} played card ${cardId}. Hand now has ${currentPlayer.hand.length} cards.`);

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
