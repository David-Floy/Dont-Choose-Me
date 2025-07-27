/**
 * Utility-Funktionen für die Spiellogik
 */

/**
 * Mischt ein Array zufällig (Fisher-Yates Shuffle)
 * @param {Array} array - Das zu mischende Array
 * @returns {Array} Das gemischte Array
 */
export function shuffle(array) {
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
export function calculatePoints(game) {
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

/**
 * Validiert, ob ein Spielzustand gültig ist
 * @param {Object} game - Das zu validierende Spielobjekt
 * @returns {boolean} True wenn gültig, false sonst
 */
export function validateGameState(game) {
  if (!game || !game.players || game.players.length < 2) {
    return false;
  }

  if (game.storytellerIndex < 0 || game.storytellerIndex >= game.players.length) {
    return false;
  }

  return true;
}

