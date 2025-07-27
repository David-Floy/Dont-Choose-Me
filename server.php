<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
session_start();

// Karten laden
$cardsPath = __DIR__ . '/cards.json';
$cards = [];
if (file_exists($cardsPath)) {
    $cards = json_decode(file_get_contents($cardsPath), true);
}

// Spiele-Manager laden
require_once(__DIR__ . '/server/gameManager.php');
$gameManager = GameManager::getInstance();

// Routing - berücksichtige verschiedene Pfade
$requestUri = $_GET['REQUEST_URI'] ?? parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$requestMethod = $_SERVER['REQUEST_METHOD'];

// Entferne Basis-Pfad falls vorhanden (für XAMPP htdocs/xampp/PicMe)
$basePath = '/xampp/PicMe';
if (strpos($requestUri, $basePath) === 0) {
    $requestUri = substr($requestUri, strlen($basePath));
}
if (empty($requestUri)) {
    $requestUri = '/';
}

// CORS Headers für Frontend-Kommunikation
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($requestMethod === 'OPTIONS') {
    exit(0);
}

// Statische Bilder ausliefern
if (strpos($requestUri, '/images/') === 0) {
    $imageFile = __DIR__ . $requestUri;
    if (file_exists($imageFile)) {
        $mime = mime_content_type($imageFile);
        header('Content-Type: ' . $mime);
        readfile($imageFile);
        exit;
    } else {
        http_response_code(404);
        echo "Bild nicht gefunden: " . $requestUri;
        exit;
    }
}

// API-Routen
if (strpos($requestUri, '/api/') === 0) {
    // Karten-API
    if ($requestUri === '/api/cards') {
        header('Content-Type: application/json');
        echo json_encode($cards);
        exit;
    }

    // Lobby-API mit verbesserter Synchronisation
    if ($requestUri === '/api/lobby.php' || $requestUri === '/api/lobby') {
        header('Content-Type: application/json');

        if ($requestMethod === 'GET') {
            $gameId = $_GET['gameId'] ?? '';
            if (empty($gameId)) {
                echo json_encode(['success' => false, 'error' => 'Raum-ID erforderlich']);
                exit;
            }

            $game = $gameManager->getGame($gameId);
            echo json_encode([
                'success' => true,
                'players' => $game['players'] ?? [],
                'gameState' => $game['state'] ?? 'lobby',
                'timestamp' => time()
            ]);
            exit;
        }

        if ($requestMethod === 'POST') {
            $data = json_decode(file_get_contents('php://input'), true);
            $action = $data['action'] ?? '';
            $gameId = $data['gameId'] ?? '';
            $playerName = $data['playerName'] ?? '';

            if ($action === 'join') {
                // Erweiterte Validierung
                if (empty($playerName) || empty($gameId)) {
                    echo json_encode(['success' => false, 'error' => 'Name und Raum-ID sind erforderlich']);
                    exit;
                }

                if (strlen($playerName) < 2 || strlen($playerName) > 20) {
                    echo json_encode(['success' => false, 'error' => 'Name muss zwischen 2 und 20 Zeichen lang sein']);
                    exit;
                }

                if (!preg_match('/^[a-zA-ZäöüÄÖÜß0-9\s]+$/', $playerName)) {
                    echo json_encode(['success' => false, 'error' => 'Name enthält ungültige Zeichen']);
                    exit;
                }

                // Prüfe auf bereits laufendes Spiel
                $existingGame = $gameManager->getGame($gameId);
                if ($existingGame && $existingGame['state'] === 'playing') {
                    echo json_encode(['success' => false, 'error' => 'Spiel läuft bereits']);
                    exit;
                }

                // Prüfe auf doppelte Namen
                if ($existingGame) {
                    foreach ($existingGame['players'] as $player) {
                        if ($player['name'] === $playerName) {
                            // Spieler existiert bereits - aktualisiere nur die ID
                            $playerId = uniqid('player_');
                            $game = $gameManager->addPlayer($gameId, $playerId, $playerName);
                            echo json_encode([
                                'success' => true,
                                'players' => $game['players'],
                                'message' => 'Willkommen zurück!'
                            ]);
                            exit;
                        }
                    }
                }

                $playerId = uniqid('player_');
                $game = $gameManager->addPlayer($gameId, $playerId, $playerName);
                echo json_encode([
                    'success' => true,
                    'players' => $game['players'],
                    'message' => 'Erfolgreich beigetreten!'
                ]);
                exit;
            }

            if ($action === 'leave') {
                $game = $gameManager->getGame($gameId);
                if ($game) {
                    foreach ($game['players'] as $p) {
                        if ($p['name'] === $playerName) {
                            $gameManager->removePlayer($gameId, $p['id']);
                            break;
                        }
                    }
                }
                echo json_encode(['success' => true, 'message' => 'Erfolgreich verlassen']);
                exit;
            }
        }
    }

    // Spiel-API mit verbesserter Validierung
    if ($requestUri === '/api/game.php' || $requestUri === '/api/game' || strpos($requestUri, '/api/game.php') === 0) {
        header('Content-Type: application/json');

        if ($requestMethod === 'GET') {
            $gameId = $_GET['gameId'] ?? '';
            $playerName = $_GET['playerName'] ?? '';

            if (empty($gameId)) {
                echo json_encode(['error' => 'Raum-ID erforderlich']);
                exit;
            }

            $game = $gameManager->getGame($gameId);
            if (!$game) {
                echo json_encode(['error' => 'Spiel nicht gefunden']);
                exit;
            }

            // Füge Spieler-spezifische Informationen hinzu
            if ($playerName) {
                $currentPlayer = null;
                foreach ($game['players'] as &$player) {
                    if ($player['name'] === $playerName) {
                        $currentPlayer = &$player;
                        break;
                    }
                }

                if ($currentPlayer) {
                    $game['currentPlayerHand'] = $currentPlayer['hand'];
                    $game['isStoryteller'] = ($game['players'][$game['storytellerIndex']]['name'] ?? '') === $playerName;
                }
            }

            echo json_encode($game);
            exit;
        }

        if ($requestMethod === 'POST') {
            $data = json_decode(file_get_contents('php://input'), true);
            $action = $data['action'] ?? '';
            $gameId = $data['gameId'] ?? '';
            $playerName = $data['playerName'] ?? '';
            $cardId = $data['cardId'] ?? null;
            $hint = $data['hint'] ?? null;

            // Grundvalidierung
            if (empty($gameId)) {
                echo json_encode(['success' => false, 'error' => 'Raum-ID erforderlich']);
                exit;
            }

            $game = $gameManager->getGame($gameId);
            if (!$game) {
                echo json_encode(['success' => false, 'error' => 'Spiel nicht gefunden']);
                exit;
            }

            if ($action === 'start') {
                // Erweiterte Validierung für Spielstart
                if (count($game['players']) < 3) {
                    echo json_encode(['success' => false, 'error' => 'Mindestens 3 Spieler erforderlich']);
                    exit;
                }

                if ($game['state'] === 'playing') {
                    echo json_encode(['success' => false, 'error' => 'Spiel läuft bereits']);
                    exit;
                }

                $startedGame = $gameManager->startGame($gameId, $cards);
                echo json_encode([
                    'success' => !!$startedGame,
                    'message' => $startedGame ? 'Spiel gestartet!' : 'Fehler beim Starten'
                ]);
                exit;
            }

            if ($action === 'giveHint') {
                $game = &$gameManager->games[$gameId];
                if ($game) {
                    $storyteller = $game['players'][$game['storytellerIndex']];
                    if ($storyteller['name'] === $playerName) {
                        $game['hint'] = $hint;
                        $game['storytellerCard'] = $cardId;
                        $game['selectedCards'] = [['cardId' => $cardId, 'playerId' => $storyteller['id']]];
                        $game['phase'] = 'selectCards';

                        // Entferne Karte aus der Hand des Erzählers
                        foreach ($game['players'] as &$p) {
                            if ($p['id'] === $storyteller['id']) {
                                foreach ($p['hand'] as $i => $c) {
                                    if ($c['id'] == $cardId) {
                                        array_splice($p['hand'], $i, 1);
                                        break;
                                    }
                                }
                                break;
                            }
                        }
                        echo json_encode(['success' => true]);
                        exit;
                    }
                }
                echo json_encode(['success' => false, 'error' => 'Nicht Erzähler']);
                exit;
            }

            if ($action === 'chooseCard') {
                $game = &$gameManager->games[$gameId];
                if ($game) {
                    foreach ($game['players'] as &$p) {
                        if ($p['name'] === $playerName) {
                            $hasCard = false;
                            foreach ($p['hand'] as $i => $c) {
                                if ($c['id'] == $cardId) {
                                    $hasCard = true;
                                    array_splice($p['hand'], $i, 1);
                                    break;
                                }
                            }
                            if ($hasCard) {
                                $game['selectedCards'][] = ['cardId' => $cardId, 'playerId' => $p['id']];

                                // Wenn alle Spieler Karten gelegt haben, Voting vorbereiten
                                if (count($game['selectedCards']) === count($game['players'])) {
                                    $gameManager->prepareVoting($gameId);
                                }
                                echo json_encode(['success' => true]);
                                exit;
                            }
                        }
                    }
                }
                echo json_encode(['success' => false, 'error' => 'Karte nicht gefunden']);
                exit;
            }

            if ($action === 'voteCard') {
                $game = &$gameManager->games[$gameId];
                if ($game) {
                    foreach ($game['players'] as $p) {
                        if ($p['name'] === $playerName) {
                            if (!isset($game['votes'])) $game['votes'] = [];
                            $alreadyVoted = false;
                            foreach ($game['votes'] as $v) {
                                if ($v['playerId'] === $p['id']) $alreadyVoted = true;
                            }
                            if (!$alreadyVoted) {
                                $game['votes'][] = ['cardId' => $cardId, 'playerId' => $p['id']];

                                // Wenn alle außer Erzähler abgestimmt haben, Punkte berechnen und Reveal-Phase starten
                                if (count($game['votes']) === count($game['players']) - 1) {
                                    require_once(__DIR__ . '/src/utils/gameLogic.php');
                                    calculatePoints($game);
                                    $game['phase'] = 'reveal';
                                }
                                echo json_encode(['success' => true]);
                                exit;
                            }
                        }
                    }
                }
                echo json_encode(['success' => false, 'error' => 'Bereits abgestimmt']);
                exit;
            }

            if ($action === 'continueToNextRound') {
                $gameManager->prepareNextRound($gameId);
                echo json_encode(['success' => true]);
                exit;
            }

            if ($action === 'restartGame') {
                $gameManager->restartGame($gameId, $cards);
                echo json_encode(['success' => true]);
                exit;
            }
        }
    }

    // Wenn keine API-Route gefunden wurde
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode([
        'error' => 'API-Endpunkt nicht gefunden'
    ]);
    exit;
}

// Fallback für nicht-API Anfragen
http_response_code(404);
echo "404 - Seite nicht gefunden";
?>
