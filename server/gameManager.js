/**
 * Klasse zur Verwaltung aller Spiele
 */
class GameManager {
  constructor() {
    this.games = {};
  }

  /**
   * Erstellt ein neues Spiel oder gibt ein bestehendes zurück
   * @param {string} gameId - Die Spiel-ID
   * @returns {Object} Das Spielobjekt
   */
  getOrCreateGame(gameId) {
    if (!this.games[gameId]) {
      this.games[gameId] = {
        players: [],
        state: 'lobby',
        deck: [],
        round: 0,
        storytellerIndex: 0,
        hint: '',
        storytellerCard: null,
        selectedCards: [],
        mixedCards: [],
        votes: [],
        phase: 'waiting'
      };
    }
    return this.games[gameId];
  }

  /**
   * Fügt einen Spieler zu einem Spiel hinzu
   * @param {string} gameId - Die Spiel-ID
   * @param {string} socketId - Die Socket-ID des Spielers
   * @param {string} playerName - Der Name des Spielers
   */
  addPlayer(gameId, socketId, playerName) {
    const game = this.getOrCreateGame(gameId);

    // Prüfe ob ein Spieler mit diesem Namen bereits existiert
    const existingPlayer = game.players.find(p => p.name === playerName);

    if (existingPlayer) {
      // Aktualisiere die Socket-ID für bestehenden Spieler (Neuverbindung)
      console.log(`Updating socket ID for existing player ${playerName}: ${existingPlayer.id} -> ${socketId}`);
      console.log(`Player ${playerName} hand size: ${existingPlayer.hand?.length || 0}`);
      existingPlayer.id = socketId;
    } else {
      // Füge neuen Spieler hinzu
      game.players.push({
        id: socketId,
        name: playerName,
        points: 0,
        hand: []
      });
      console.log(`Added new player ${playerName} with socket ${socketId} to game ${gameId}`);
    }

    return game;
  }

  /**
   * Findet einen Spieler nach Namen
   * @param {string} gameId - Die Spiel-ID
   * @param {string} playerName - Der Name des Spielers
   * @returns {Object|null} Der Spieler oder null
   */
  findPlayerByName(gameId, playerName) {
    const game = this.games[gameId];
    if (!game) return null;

    return game.players.find(p => p.name === playerName) || null;
  }

  /**
   * Aktualisiert die Socket-ID eines Spielers
   * @param {string} gameId - Die Spiel-ID
   * @param {string} playerName - Der Name des Spielers
   * @param {string} newSocketId - Die neue Socket-ID
   * @returns {boolean} True wenn erfolgreich aktualisiert
   */
  updatePlayerSocketId(gameId, playerName, newSocketId) {
    const game = this.games[gameId];
    if (!game) return false;

    const player = game.players.find(p => p.name === playerName);
    if (player) {
      const oldSocketId = player.id;
      player.id = newSocketId;
      console.log(`Updated socket ID for player ${playerName} in game ${gameId}: ${oldSocketId} -> ${newSocketId}`);
      return true;
    }

    return false;
  }

  /**
   * Entfernt einen Spieler aus einem Spiel
   * @param {string} socketId - Die Socket-ID des zu entfernenden Spielers
   * @returns {Array} Array der betroffenen Spiel-IDs
   */
  removePlayer(socketId) {
    const affectedGames = [];

    for (const gameId in this.games) {
      const game = this.games[gameId];
      const playerIndex = game.players.findIndex(p => p.id === socketId);

      if (playerIndex !== -1) {
        game.players.splice(playerIndex, 1);
        affectedGames.push(gameId);

        // Spiel löschen wenn keine Spieler mehr da sind
        if (game.players.length === 0) {
          delete this.games[gameId];
        }
      }
    }

    return affectedGames;
  }

  /**
   * Startet ein Spiel
   * @param {string} gameId - Die Spiel-ID
   * @param {Array} cards - Array aller verfügbaren Karten
   * @returns {Object|null} Das gestartete Spiel oder null bei Fehler
   */
  startGame(gameId, cards) {
    const game = this.games[gameId];

    if (!game || game.players.length < 2) {
      return null;
    }

    console.log(`=== STARTING GAME ${gameId} ===`);
    console.log(`Total cards available: ${cards.length}`);
    console.log(`Number of players: ${game.players.length}`);

    // Überprüfe ob genug Karten für alle Spieler vorhanden sind
    const cardsNeeded = game.players.length * 6;
    if (cards.length < cardsNeeded) {
      console.error(`Not enough cards! Need ${cardsNeeded}, but only have ${cards.length}`);
      return null;
    }

    // Spiel initialisieren
    game.deck = this.shuffle([...cards]); // Kopie erstellen um Original nicht zu verändern
    game.state = 'playing';
    game.round = 1;
    game.storytellerIndex = 0;
    game.hint = '';
    game.storytellerCard = null;
    game.selectedCards = [];
    game.mixedCards = [];
    game.votes = [];
    game.phase = 'storytelling';

    // Karten an Spieler verteilen - jede Karte nur einmal
    for (let i = 0; i < game.players.length; i++) {
      const player = game.players[i];
      const cardsToTake = Math.min(6, game.deck.length);
      player.hand = game.deck.splice(0, cardsToTake); // splice entfernt Karten aus dem Deck

      console.log(`Dealt ${player.hand.length} cards to ${player.name} (${player.id})`);
      console.log(`  Card IDs: ${player.hand.map(c => c.id).join(', ')}`);
      console.log(`  Remaining deck size: ${game.deck.length}`);
    }

    // Validierung: Prüfe auf Duplikate
    const allHandCards = game.players.flatMap(p => p.hand);
    const cardIds = allHandCards.map(c => c.id);
    const uniqueCardIds = [...new Set(cardIds)];

    if (cardIds.length !== uniqueCardIds.length) {
      console.error(`ERROR: Duplicate cards detected!`);
      console.error(`Total cards in hands: ${cardIds.length}, Unique cards: ${uniqueCardIds.length}`);

      // Debug: Finde Duplikate
      const duplicates = cardIds.filter((id, index) => cardIds.indexOf(id) !== index);
      console.error(`Duplicate card IDs:`, [...new Set(duplicates)]);
    }

    console.log(`=== GAME ${gameId} STARTED ===`);
    console.log(`Initial storyteller: ${game.players[game.storytellerIndex].name}`);
    console.log(`Final deck size: ${game.deck.length}`);
    console.log(`Cards distributed: ${allHandCards.length}, Unique cards: ${uniqueCardIds.length}`);

    // Validierung: Alle Spieler haben Karten
    const playersWithoutCards = game.players.filter(p => !p.hand || p.hand.length === 0);
    if (playersWithoutCards.length > 0) {
      console.error(`ERROR: Players without cards:`, playersWithoutCards.map(p => p.name));
    }

    return game;
  }

  /**
   * Bereitet die nächste Runde vor
   * @param {string} gameId - Die Spiel-ID
   */
  prepareNextRound(gameId) {
    const game = this.games[gameId];
    if (!game) return;

    // Prüfe vor der nächsten Runde auf Gewinner
    const winner = game.players.find(p => p.points >= 30);
    if (winner) {
      game.phase = 'gameEnd';
      game.winner = winner.name;
      console.log(`Game ${gameId} ended! Winner: ${winner.name} with ${winner.points} points`);
      return;
    }

    game.round += 1;
    game.storytellerIndex = (game.storytellerIndex + 1) % game.players.length;

    // Spieler-Hände auffüllen - aber nur bis maximal 6 Karten und keine Duplikate
    console.log(`=== REFILLING HANDS FOR ROUND ${game.round} ===`);
    console.log(`Deck size before refill: ${game.deck.length}`);

    for (const player of game.players) {
      const cardsNeeded = 6 - player.hand.length;
      const cardsToTake = Math.min(cardsNeeded, game.deck.length);

      if (cardsToTake > 0) {
        const newCards = game.deck.splice(0, cardsToTake); // splice entfernt Karten aus Deck
        player.hand.push(...newCards);

        console.log(`${player.name}: Added ${cardsToTake} cards (had ${6 - cardsNeeded}, now has ${player.hand.length})`);
        console.log(`  New card IDs: ${newCards.map(c => c.id).join(', ')}`);
      } else {
        console.log(`${player.name}: No cards added (has ${player.hand.length} cards)`);
      }
    }

    console.log(`Deck size after refill: ${game.deck.length}`);

    // Validierung: Prüfe erneut auf Duplikate nach dem Auffüllen
    const allHandCards = game.players.flatMap(p => p.hand);
    const cardIds = allHandCards.map(c => c.id);
    const uniqueCardIds = [...new Set(cardIds)];

    if (cardIds.length !== uniqueCardIds.length) {
      console.error(`ERROR: Duplicate cards after refill!`);
      console.error(`Total cards in hands: ${cardIds.length}, Unique cards: ${uniqueCardIds.length}`);

      // Debug: Finde Duplikate
      const duplicates = cardIds.filter((id, index) => cardIds.indexOf(id) !== index);
      console.error(`Duplicate card IDs:`, [...new Set(duplicates)]);
    } else {
      console.log(`✓ No duplicate cards found. ${uniqueCardIds.length} unique cards in play.`);
    }

    // Runden-spezifische Daten zurücksetzen
    game.hint = '';
    game.storytellerCard = null;
    game.selectedCards = [];
    game.mixedCards = [];
    game.votes = [];
    game.phase = 'storytelling';

    console.log(`Next round prepared for game ${gameId}, new storyteller: ${game.players[game.storytellerIndex].name}`);
    console.log(`=== END REFILLING HANDS ===`);
  }

  /**
   * Startet ein Spiel neu
   * @param {string} gameId - Die Spiel-ID
   * @param {Array} cards - Array aller verfügbaren Karten
   */
  restartGame(gameId, cards) {
    const game = this.games[gameId];
    if (!game) return null;

    // Spiel komplett zurücksetzen, aber Spieler behalten
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
    game.deck = [];

    // Alle Spieler-Punkte zurücksetzen und Hände leeren
    for (const player of game.players) {
      player.points = 0;
      player.hand = [];
    }

    console.log(`Game ${gameId} restarted, ${game.players.length} players ready for new game`);
    return game;
  }

  /**
   * Gibt ein Spiel zurück
   * @param {string} gameId - Die Spiel-ID
   * @returns {Object|null} Das Spielobjekt oder null
   */
  getGame(gameId) {
    return this.games[gameId] || null;
  }

  /**
   * Mischt ein Array zufällig (Fisher-Yates Shuffle)
   * @param {Array} array - Das zu mischende Array
   * @returns {Array} Das gemischte Array
   */
  shuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

module.exports = GameManager;
