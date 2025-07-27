import { put, get } from '@vercel/blob';

const BLOB_PREFIX = 'game-';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://dont-choose-me.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { gameId, action, playerId, cardId, hint } = req.body;
  if (!gameId) return res.status(400).json({ error: 'gameId fehlt' });

  // Lade Spiel aus Blob Storage
  let game = null;
  try {
    const blob = await get(`${BLOB_PREFIX}${gameId}.json`);
    game = blob ? JSON.parse(blob.toString()) : null;
  } catch {
    game = null;
  }
  if (!game) {
    game = {
      gameId,
      state: 'playing',
      round: 1,
      players: [],
      storytellerIndex: 0,
      phase: 'storytelling',
      hint: '',
      storytellerCard: null,
      selectedCards: [],
      votes: [],
      mixedCards: [],
      winner: null
    };
  }

  switch (action) {
    case 'getState':
      return res.status(200).json({ game });

    case 'giveHint':
      if (!playerId || !cardId || !hint) return res.status(400).json({ error: 'Fehlende Daten' });
      if (game.phase !== 'storytelling') return res.status(400).json({ error: 'Nicht in Hint-Phase' });
      game.hint = hint;
      game.storytellerCard = cardId;
      game.selectedCards = [{ cardId, playerId }];
      game.phase = 'selectCards';
      await put(`${BLOB_PREFIX}${gameId}.json`, JSON.stringify(game));
      return res.status(200).json({ success: true, game });

    case 'chooseCard':
      if (!playerId || !cardId) return res.status(400).json({ error: 'Fehlende Daten' });
      if (game.phase !== 'selectCards') return res.status(400).json({ error: 'Nicht in Kartenwahl-Phase' });
      if (game.selectedCards.find(c => c.playerId === playerId)) return res.status(400).json({ error: 'Bereits gewählt' });
      game.selectedCards.push({ cardId, playerId });
      if (game.selectedCards.length === game.players.length) {
        game.phase = 'voting';
        game.mixedCards = shuffle([...game.selectedCards]);
      }
      await put(`${BLOB_PREFIX}${gameId}.json`, JSON.stringify(game));
      return res.status(200).json({ success: true, game });

    case 'vote':
      if (!playerId || !cardId) return res.status(400).json({ error: 'Fehlende Daten' });
      if (game.phase !== 'voting') return res.status(400).json({ error: 'Nicht in Voting-Phase' });
      if (game.votes.find(v => v.playerId === playerId)) return res.status(400).json({ error: 'Bereits abgestimmt' });
      game.votes.push({ cardId, playerId });
      if (game.votes.length === game.players.length - 1) {
        calculatePoints(game);
        const winner = game.players.find(p => p.points >= 30);
        if (winner) {
          game.phase = 'gameEnd';
          game.winner = winner.name;
        } else {
          game.phase = 'reveal';
        }
      }
      await put(`${BLOB_PREFIX}${gameId}.json`, JSON.stringify(game));
      return res.status(200).json({ success: true, game });

    case 'nextRound':
      game.round++;
      game.storytellerIndex = (game.storytellerIndex + 1) % game.players.length;
      game.phase = 'storytelling';
      game.hint = '';
      game.storytellerCard = null;
      game.selectedCards = [];
      game.votes = [];
      game.mixedCards = [];
      await put(`${BLOB_PREFIX}${gameId}.json`, JSON.stringify(game));
      return res.status(200).json({ success: true, game });

    case 'restart':
      game = {
        gameId,
        state: 'playing',
        round: 1,
        players: game.players.map(p => ({ ...p, points: 0 })),
        storytellerIndex: 0,
        phase: 'storytelling',
        hint: '',
        storytellerCard: null,
        selectedCards: [],
        votes: [],
        mixedCards: [],
        winner: null
      };
      await put(`${BLOB_PREFIX}${gameId}.json`, JSON.stringify(game));
      return res.status(200).json({ success: true, game });

    default:
      return res.status(400).json({ error: 'Ungültige Aktion' });
  }
}

// Hilfsfunktionen
function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function calculatePoints(game) {
  if (!game.selectedCards.length) return;
  const storytellerId = game.selectedCards[0].playerId;
  const correctCardId = game.storytellerCard;
  const votes = game.votes;

  const correctVotes = votes.filter(v => v.cardId === correctCardId).length;
  const allCorrect = correctVotes === votes.length;
  const noneCorrect = correctVotes === 0;

  // Erzähler
  for (const player of game.players) {
    if (player.id === storytellerId) {
      if (!noneCorrect && !allCorrect) player.points += 3;
    }
  }
  // Richtige Stimmen
  for (const vote of votes) {
    if (vote.cardId === correctCardId) {
      const player = game.players.find(p => p.id === vote.playerId);
      if (player) player.points += 3;
    }
  }
  // Spieler, deren Karte gewählt wurde
  for (const vote of votes) {
    if (vote.cardId !== correctCardId) {
      const cardOwner = game.selectedCards.find(c => c.cardId === vote.cardId);
      if (cardOwner && cardOwner.playerId !== storytellerId) {
        const ownerPlayer = game.players.find(p => p.id === cardOwner.playerId);
        if (ownerPlayer) ownerPlayer.points += 1;
      }
    }
  }
  // Bonuspunkte wenn alle oder keiner richtig lag
  if (allCorrect || noneCorrect) {
    for (const player of game.players) {
      if (player.id !== storytellerId) player.points += 2;
    }
  }
}

// Achtung: Die Datenhaltung ist nicht persistent! Für Vercel KV siehe Doku:
// https://vercel.com/docs/storage/vercel-kv
