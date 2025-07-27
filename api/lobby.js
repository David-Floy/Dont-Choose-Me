import { put, get } from '@vercel/blob';

const BLOB_PREFIX = 'lobby-';

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

  const { gameId, playerName, action } = req.body;
  if (!gameId) return res.status(400).json({ error: 'gameId fehlt' });

  // Lade Lobby aus Blob Storage
  let lobby = null;
  try {
    const blob = await get(`${BLOB_PREFIX}${gameId}.json`);
    lobby = blob ? JSON.parse(blob.toString()) : { players: [], state: 'lobby' };
  } catch {
    lobby = { players: [], state: 'lobby' };
  }

  switch (action) {
    case 'join':
      if (!playerName) return res.status(400).json({ error: 'playerName fehlt' });
      if (lobby.players.find(p => p.name === playerName)) {
        return res.status(400).json({ error: 'Spielername bereits vergeben' });
      }
      const playerId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
      lobby.players.push({ name: playerName, id: playerId, points: 0 });
      await put(`${BLOB_PREFIX}${gameId}.json`, JSON.stringify(lobby));
      return res.status(200).json({ success: true, players: lobby.players, playerId });

    case 'leave':
      lobby.players = lobby.players.filter(p => p.name !== playerName);
      await put(`${BLOB_PREFIX}${gameId}.json`, JSON.stringify(lobby));
      return res.status(200).json({ success: true, players: lobby.players });

    case 'getPlayers':
      return res.status(200).json({ players: lobby.players });

    case 'startGame':
      if (lobby.players.length < 3) {
        return res.status(400).json({ error: 'Mindestens 3 Spieler benötigt' });
      }
      lobby.state = 'playing';
      await put(`${BLOB_PREFIX}${gameId}.json`, JSON.stringify(lobby));
      return res.status(200).json({ success: true, game: { gameId, players: lobby.players, state: 'playing', round: 1 } });

    default:
      return res.status(400).json({ error: 'Ungültige Aktion' });
  }
}
