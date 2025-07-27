<?php
require_once(__DIR__ . '/../src/utils/gameLogic.php');

class GameManager {
    private static $instance = null;
    public $games = [];
    private $dataFile;

    private function __construct() {
        $this->dataFile = __DIR__ . '/../data/games.json';
        $this->loadGames();
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new GameManager();
        }
        return self::$instance;
    }

    private function loadGames() {
        if (file_exists($this->dataFile)) {
            $data = file_get_contents($this->dataFile);
            $this->games = json_decode($data, true) ?: [];
        }
    }

    public function saveGames() { // Ändere von private zu public
        $dir = dirname($this->dataFile);
        if (!is_dir($dir)) {
            mkdir($dir, 0777, true);
        }
        file_put_contents($this->dataFile, json_encode($this->games, JSON_PRETTY_PRINT));
    }

    public function getOrCreateGame($gameId) {
        if (!isset($this->games[$gameId])) {
            $this->games[$gameId] = [
                'id' => $gameId,
                'players' => [],
                'state' => 'lobby',
                'deck' => [],
                'round' => 0,
                'storytellerIndex' => 0,
                'hint' => '',
                'storytellerCard' => null,
                'selectedCards' => [],
                'mixedCards' => [],
                'votes' => [],
                'phase' => 'waiting'
            ];
            $this->saveGames();
        }
        return $this->games[$gameId];
    }

    public function addPlayer($gameId, $playerId, $playerName) {
        $game = $this->getOrCreateGame($gameId);

        // Prüfe ob Spieler bereits existiert (nach Name)
        $existingPlayerIndex = -1;
        foreach ($game['players'] as $index => $p) {
            if ($p['name'] === $playerName) {
                $existingPlayerIndex = $index;
                break;
            }
        }

        if ($existingPlayerIndex >= 0) {
            // Aktualisiere bestehenden Spieler
            $this->games[$gameId]['players'][$existingPlayerIndex]['id'] = $playerId;
            $this->games[$gameId]['players'][$existingPlayerIndex]['lastSeen'] = time();
        } else {
            // Füge neuen Spieler hinzu
            $this->games[$gameId]['players'][] = [
                'id' => $playerId,
                'name' => $playerName,
                'points' => 0,
                'hand' => [],
                'joinedAt' => time(),
                'lastSeen' => time()
            ];
        }

        $this->saveGames();
        return $this->games[$gameId];
    }

    public function findPlayerByName($gameId, $playerName) {
        $game = $this->games[$gameId] ?? null;
        if (!$game) return null;
        foreach ($game['players'] as $p) {
            if ($p['name'] === $playerName) return $p;
        }
        return null;
    }

    public function removePlayer($gameId, $playerId) {
        if (!isset($this->games[$gameId])) return;

        $newPlayers = [];
        $removedPlayerIndex = -1;

        foreach ($this->games[$gameId]['players'] as $index => $p) {
            if ($p['id'] !== $playerId) {
                $newPlayers[] = $p;
            } else {
                $removedPlayerIndex = $index;
            }
        }

        $this->games[$gameId]['players'] = $newPlayers;

        // Storyteller-Index anpassen wenn nötig
        if ($removedPlayerIndex >= 0 && $this->games[$gameId]['storytellerIndex'] >= $removedPlayerIndex) {
            $this->games[$gameId]['storytellerIndex'] = max(0, $this->games[$gameId]['storytellerIndex'] - 1);
        }

        if ($this->games[$gameId]['storytellerIndex'] >= count($this->games[$gameId]['players']) && count($this->games[$gameId]['players']) > 0) {
            $this->games[$gameId]['storytellerIndex'] = 0;
        }

        if (count($this->games[$gameId]['players']) === 0) {
            unset($this->games[$gameId]);
        }

        $this->saveGames();
    }

    // Neue Methode: Bereinige inaktive Spieler
    public function cleanupInactivePlayers($gameId, $timeoutSeconds = 300) {
        if (!isset($this->games[$gameId])) return;
        $game = &$this->games[$gameId];

        $currentTime = time();
        $activePlayers = [];

        foreach ($game['players'] as $player) {
            if (($currentTime - $player['lastSeen']) < $timeoutSeconds) {
                $activePlayers[] = $player;
            }
        }

        $game['players'] = $activePlayers;

        if (count($game['players']) === 0) {
            unset($this->games[$gameId]);
        } else {
            $this->games[$gameId] = $game;
        }

        $this->saveGames();
    }

    public function startGame($gameId, $cards) {
        if (!isset($this->games[$gameId])) return null;

        if (count($this->games[$gameId]['players']) < 3) return null;

        $this->games[$gameId]['deck'] = shuffleArray($cards);
        $this->games[$gameId]['state'] = 'playing';
        $this->games[$gameId]['round'] = 1;
        $this->games[$gameId]['storytellerIndex'] = rand(0, count($this->games[$gameId]['players']) - 1);
        $this->games[$gameId]['hint'] = '';
        $this->games[$gameId]['storytellerCard'] = null;
        $this->games[$gameId]['selectedCards'] = [];
        $this->games[$gameId]['mixedCards'] = [];
        $this->games[$gameId]['votes'] = [];
        $this->games[$gameId]['phase'] = 'storytelling';

        // Karten verteilen
        foreach ($this->games[$gameId]['players'] as &$player) {
            $player['hand'] = array_splice($this->games[$gameId]['deck'], 0, 6);
        }

        $this->saveGames();
        return $this->games[$gameId];
    }

    public function prepareVoting($gameId) {
        if (!isset($this->games[$gameId])) return;
        $game = &$this->games[$gameId];

        // Mische die gelegten Karten
        $mixed = shuffleArray($game['selectedCards']);
        $game['mixedCards'] = $mixed;
        $game['phase'] = 'voting';

        $this->games[$gameId] = $game;
    }

    public function prepareNextRound($gameId) {
        if (!isset($this->games[$gameId])) return;
        $game = &$this->games[$gameId];

        // Prüfe auf Spielende
        foreach ($game['players'] as $p) {
            if ($p['points'] >= 30) {
                $game['phase'] = 'gameEnd';
                $game['winner'] = $p['name'];
                $this->games[$gameId] = $game;
                return;
            }
        }

        // Nächste Runde vorbereiten
        $game['round'] += 1;
        $game['storytellerIndex'] = ($game['storytellerIndex'] + 1) % count($game['players']);

        // Karten nachfüllen
        foreach ($game['players'] as &$player) {
            $cardsNeeded = 6 - count($player['hand']);
            if ($cardsNeeded > 0 && count($game['deck']) >= $cardsNeeded) {
                $newCards = array_splice($game['deck'], 0, $cardsNeeded);
                $player['hand'] = array_merge($player['hand'], $newCards);
            }
        }

        $game['hint'] = '';
        $game['storytellerCard'] = null;
        $game['selectedCards'] = [];
        $game['mixedCards'] = [];
        $game['votes'] = [];
        $game['phase'] = 'storytelling';

        $this->games[$gameId] = $game;
    }

    public function restartGame($gameId, $cards) {
        if (!isset($this->games[$gameId])) return null;
        $game = &$this->games[$gameId];

        $game['state'] = 'lobby';
        $game['round'] = 0;
        $game['storytellerIndex'] = 0;
        $game['hint'] = '';
        $game['storytellerCard'] = null;
        $game['selectedCards'] = [];
        $game['mixedCards'] = [];
        $game['votes'] = [];
        $game['phase'] = 'waiting';
        $game['winner'] = null;
        $game['deck'] = [];

        foreach ($game['players'] as &$player) {
            $player['points'] = 0;
            $player['hand'] = [];
        }

        $this->games[$gameId] = $game;
        return $game;
    }

    public function getGame($gameId) {
        return $this->games[$gameId] ?? null;
    }
}
?>
