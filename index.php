<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once('server/gameManager.php');

// Hilfsfunktionen für HTML-Rendering
function renderCard($card, $selected = false) {
    $border = $selected ? '4px solid #007bff' : '2px solid #ccc';
    $bg = $selected ? '#e3f2fd' : '#fff';
    $img = htmlspecialchars($card['image']);
    $title = htmlspecialchars($card['title'] ?? 'Karte');
    return "<div style='border:$border;border-radius:12px;padding:8px;margin:8px;background:$bg;display:inline-block;'>
        <img src='$img' alt='$title' style='width:250px;height:200px;object-fit:cover;border-radius:12px;display:block;' />
        <div style='text-align:center;font-weight:bold;'>$title</div>
    </div>";
}

function renderLobby($gameId, $playerName, $players, $error = '') {
    $html = "<h2>Lobby: $gameId</h2>";
    if ($error) {
        $html .= "<div style='color:red;font-weight:bold;'>$error</div>";
    }
    $html .= "<form method='post'>
        <input type='hidden' name='action' value='joinLobby' />
        <input type='text' name='playerName' value='".htmlspecialchars($playerName)."' placeholder='Dein Name' required />
        <input type='text' name='gameId' value='".htmlspecialchars($gameId)."' placeholder='Raum-ID' required />
        <button type='submit'>Raum beitreten</button>
    </form>";
    $html .= "<h3>Spieler in der Lobby:</h3><ul id='lobbyPlayers'>";
    foreach ($players as $p) {
        $html .= "<li>".htmlspecialchars($p['name'])."</li>";
    }
    $html .= "</ul>";
    $html .= "<div id='minPlayers'>".(count($players) >= 3 ? '' : 'Mindestens 3 Spieler benötigt!')."</div>";
    if (count($players) >= 3) {
        $html .= "<form method='post' id='startGameForm'>
            <input type='hidden' name='action' value='startGame' />
            <input type='hidden' name='gameId' value='".htmlspecialchars($gameId)."' />
            <button type='submit'>Spiel starten</button>
        </form>";
    } else {
        $html .= "<div id='startGameForm' style='display:none;'>
            <form method='post'>
                <input type='hidden' name='action' value='startGame' />
                <input type='hidden' name='gameId' value='".htmlspecialchars($gameId)."' />
                <button type='submit'>Spiel starten</button>
            </form>
        </div>";
    }
    return $html;
}

function renderGame($game, $playerName) {
    $html = "<h2>Spielraum: ".htmlspecialchars($game['id'] ?? '')."</h2>";
    $html .= "<div><strong>Runde:</strong> ".$game['round']."</div>";
    $html .= "<div><strong>Erzähler:</strong> ".htmlspecialchars($game['players'][$game['storytellerIndex']]['name'])."</div>";
    $html .= "<div><strong>Phase:</strong> ".htmlspecialchars($game['phase'])."</div>";

    if (!empty($game['hint'])) {
        $html .= "<div><strong>Hinweis:</strong> <em>".htmlspecialchars($game['hint'])."</em></div>";
    }

    $html .= "<h3>Punkte:</h3><ul>";
    foreach ($game['players'] as $p) {
        $html .= "<li>".htmlspecialchars($p['name']).": ".$p['points']."</li>";
    }
    $html .= "</ul>";

    // Finde aktuellen Spieler
    $currentPlayer = null;
    $isStoryteller = false;
    foreach ($game['players'] as $index => $p) {
        if ($p['name'] === $playerName) {
            $currentPlayer = $p;
            $isStoryteller = ($index === $game['storytellerIndex']);
            break;
        }
    }

    if (!$currentPlayer) {
        return $html . "<div style='color:red;'>Spieler nicht gefunden!</div>";
    }

    // Spielphase: Storytelling (Erzähler gibt Hinweis)
    if ($game['phase'] === 'storytelling' && $isStoryteller) {
        $html .= "<h3>Du bist der Erzähler!</h3>";
        $html .= "<p>Wähle eine Karte und gib einen Hinweis:</p>";
        $html .= "<form method='post' id='storytellerForm'>
            <input type='hidden' name='action' value='giveHint' />
            <input type='hidden' name='gameId' value='".htmlspecialchars($game['id'])."' />
            <input type='hidden' name='playerName' value='".htmlspecialchars($playerName)."' />
            <input type='text' name='hint' placeholder='Dein Hinweis...' required style='width:300px;padding:8px;margin:8px;' />
            <input type='hidden' name='cardId' id='selectedCardId' />
            <button type='submit' id='submitHint' disabled style='padding:8px 16px;'>Hinweis geben</button>
        </form>";

        $html .= "<h4>Wähle deine Karte:</h4>";
        $html .= "<div id='storytellerCards'>";
        foreach ($currentPlayer['hand'] as $card) {
            $html .= "<div class='card-selectable' data-card-id='".$card['id']."' style='display:inline-block;cursor:pointer;margin:8px;'>
                ".renderCard($card)."
            </div>";
        }
        $html .= "</div>";

        $html .= "<script>
        document.querySelectorAll('.card-selectable').forEach(function(card) {
            card.addEventListener('click', function() {
                // Entferne vorherige Auswahl
                document.querySelectorAll('.card-selectable').forEach(function(c) {
                    c.style.opacity = '1';
                    c.style.transform = 'scale(1)';
                });
                // Markiere diese Karte
                this.style.opacity = '0.7';
                this.style.transform = 'scale(1.1)';
                // Setze die Karten-ID
                document.getElementById('selectedCardId').value = this.dataset.cardId;
                document.getElementById('submitHint').disabled = false;
            });
        });
        </script>";
    }

    // Spielphase: Storytelling (andere Spieler warten)
    else if ($game['phase'] === 'storytelling' && !$isStoryteller) {
        $html .= "<h3>Warte auf den Erzähler...</h3>";
        $html .= "<p>".htmlspecialchars($game['players'][$game['storytellerIndex']]['name'])." gibt gerade einen Hinweis.</p>";
    }

    // Spielphase: Kartenwahl (nicht-Erzähler wählen Karten)
    else if ($game['phase'] === 'selectCards' && !$isStoryteller) {
        $html .= "<h3>Wähle eine passende Karte!</h3>";
        $html .= "<p><strong>Hinweis:</strong> <em>".htmlspecialchars($game['hint'])."</em></p>";

        // Prüfe ob Spieler bereits eine Karte gewählt hat
        $hasSelectedCard = false;
        foreach ($game['selectedCards'] as $selected) {
            if ($selected['playerId'] === $currentPlayer['id']) {
                $hasSelectedCard = true;
                break;
            }
        }

        if ($hasSelectedCard) {
            $html .= "<p style='color:green;'>✓ Du hast bereits eine Karte gewählt. Warte auf die anderen Spieler...</p>";
        } else {
            $html .= "<form method='post' id='cardChoiceForm'>
                <input type='hidden' name='action' value='chooseCard' />
                <input type='hidden' name='gameId' value='".htmlspecialchars($game['id'])."' />
                <input type='hidden' name='playerName' value='".htmlspecialchars($playerName)."' />
                <input type='hidden' name='cardId' id='chosenCardId' />
            </form>";

            $html .= "<h4>Deine Karten:</h4>";
            $html .= "<div id='playerCards'>";
            foreach ($currentPlayer['hand'] as $card) {
                $html .= "<div class='card-choosable' data-card-id='".$card['id']."' style='display:inline-block;cursor:pointer;margin:8px;'>
                    ".renderCard($card)."
                </div>";
            }
            $html .= "</div>";

            $html .= "<script>
            document.querySelectorAll('.card-choosable').forEach(function(card) {
                card.addEventListener('click', function() {
                    if (confirm('Diese Karte wählen?')) {
                        document.getElementById('chosenCardId').value = this.dataset.cardId;
                        document.getElementById('cardChoiceForm').submit();
                    }
                });
            });
            </script>";
        }

        $html .= "<p>Gewählte Karten: ".count($game['selectedCards'])." / ".count($game['players'])."</p>";
    }

    // Spielphase: Kartenwahl (Erzähler wartet)
    else if ($game['phase'] === 'selectCards' && $isStoryteller) {
        $html .= "<h3>Warte auf die anderen Spieler...</h3>";
        $html .= "<p>Die anderen Spieler wählen gerade ihre Karten zu deinem Hinweis: <em>".htmlspecialchars($game['hint'])."</em></p>";
        $html .= "<p>Gewählte Karten: ".count($game['selectedCards'])." / ".count($game['players'])."</p>";
    }

    // Spielphase: Voting
    else if ($game['phase'] === 'voting') {
        if ($isStoryteller) {
            $html .= "<h3>Die anderen Spieler stimmen ab...</h3>";
            $html .= "<p>Warte, bis alle abgestimmt haben.</p>";
        } else {
            // Prüfe ob Spieler bereits abgestimmt hat
            $hasVoted = false;
            foreach ($game['votes'] as $vote) {
                if ($vote['playerId'] === $currentPlayer['id']) {
                    $hasVoted = true;
                    break;
                }
            }

            if ($hasVoted) {
                $html .= "<h3>Du hast abgestimmt!</h3>";
                $html .= "<p>Warte auf die anderen Spieler...</p>";
            } else {
                $html .= "<h3>Welche Karte gehört zum Erzähler?</h3>";
                $html .= "<p><strong>Hinweis:</strong> <em>".htmlspecialchars($game['hint'])."</em></p>";
                $html .= "<p>Wähle die Karte, die deiner Meinung nach vom Erzähler stammt:</p>";

                $html .= "<form method='post' id='votingForm'>
                    <input type='hidden' name='action' value='voteCard' />
                    <input type='hidden' name='gameId' value='".htmlspecialchars($game['id'])."' />
                    <input type='hidden' name='playerName' value='".htmlspecialchars($playerName)."' />
                    <input type='hidden' name='cardId' id='votedCardId' />
                </form>";

                $html .= "<div id='votingCards'>";
                foreach ($game['mixedCards'] as $selected) {
                    // Finde die Karte in den Cards
                    $cardData = null;
                    // Hier müssten wir die Karten-Daten laden - vereinfacht dargestellt
                    $html .= "<div class='card-votable' data-card-id='".$selected['cardId']."' style='display:inline-block;cursor:pointer;margin:8px;'>
                        <div style='border:2px solid #ccc;border-radius:12px;padding:8px;background:#fff;'>
                            <div style='width:250px;height:200px;background:#f0f0f0;border-radius:8px;display:flex;align-items:center;justify-content:center;'>
                                Karte ".$selected['cardId']."
                            </div>
                        </div>
                    </div>";
                }
                $html .= "</div>";

                $html .= "<script>
                document.querySelectorAll('.card-votable').forEach(function(card) {
                    card.addEventListener('click', function() {
                        if (confirm('Für diese Karte stimmen?')) {
                            document.getElementById('votedCardId').value = this.dataset.cardId;
                            document.getElementById('votingForm').submit();
                        }
                    });
                });
                </script>";
            }
        }

        $html .= "<p>Stimmen: ".count($game['votes'])." / ".(count($game['players'])-1)."</p>";
    }

    // Weitere Phasen (reveal, gameEnd) können hier ergänzt werden
    else if ($game['phase'] === 'reveal') {
        $html .= "<h3>Auflösung</h3>";
        $html .= "<p>Hinweis war: <em>".htmlspecialchars($game['hint'])."</em></p>";
        // Hier könnten die Ergebnisse angezeigt werden
        $html .= "<form method='post'>
            <input type='hidden' name='action' value='nextRound' />
            <input type='hidden' name='gameId' value='".htmlspecialchars($game['id'])."' />
            <button type='submit'>Nächste Runde</button>
        </form>";
    }

    return $html;
}

// Routing/Logik erweitern
$action = $_POST['action'] ?? '';
$gameId = $_POST['gameId'] ?? $_GET['gameId'] ?? '';
$playerName = $_POST['playerName'] ?? $_GET['playerName'] ?? '';
$error = '';
$players = [];
$game = null;

// Wenn gameId und playerName aus URL kommen, automatisch beitreten
if ($gameId && $playerName && !$action) {
    $gameManager = GameManager::getInstance();
    $gameManager->addPlayer($gameId, uniqid('player_'), $playerName);
    $game = $gameManager->getGame($gameId);
    $players = $game['players'];
} elseif ($action === 'joinLobby' && $gameId && $playerName) {
    $gameManager = GameManager::getInstance();
    $gameManager->addPlayer($gameId, uniqid('player_'), $playerName);
    $game = $gameManager->getGame($gameId);
    $players = $game['players'];
} elseif ($action === 'startGame' && $gameId) {
    $gameManager = GameManager::getInstance();
    $cards = json_decode(file_get_contents(__DIR__ . '/cards.json'), true);
    $gameManager->startGame($gameId, $cards);
    $game = $gameManager->getGame($gameId);
    $players = $game['players'];
} elseif ($gameId) {
    $gameManager = GameManager::getInstance();
    $game = $gameManager->getGame($gameId);
    $players = $game['players'] ?? [];
}

// Neue Aktionen hinzufügen
if ($action === 'giveHint' && $gameId && $playerName && isset($_POST['hint']) && isset($_POST['cardId'])) {
    $gameManager = GameManager::getInstance();
    $game = &$gameManager->games[$gameId]; // Referenz verwenden
    if ($game) {
        $storyteller = $game['players'][$game['storytellerIndex']];
        if ($storyteller['name'] === $playerName) {
            $game['hint'] = $_POST['hint'];
            $game['storytellerCard'] = $_POST['cardId'];
            $game['selectedCards'] = [['cardId' => $_POST['cardId'], 'playerId' => $storyteller['id']]];
            $game['phase'] = 'selectCards';

            // Entferne Karte aus der Hand des Erzählers
            foreach ($game['players'] as &$p) {
                if ($p['id'] === $storyteller['id']) {
                    foreach ($p['hand'] as $i => $c) {
                        if ($c['id'] == $_POST['cardId']) {
                            array_splice($p['hand'], $i, 1);
                            break;
                        }
                    }
                    break;
                }
            }
            $gameManager->saveGames(); // Speichern hinzufügen
        }
    }
    $game = $gameManager->getGame($gameId);
    $players = $game['players'];
} elseif ($action === 'chooseCard' && $gameId && $playerName && isset($_POST['cardId'])) {
    $gameManager = GameManager::getInstance();
    $game = &$gameManager->games[$gameId]; // Referenz verwenden
    if ($game) {
        foreach ($game['players'] as $index => &$p) { // Index hinzufügen
            if ($p['name'] === $playerName) {
                foreach ($p['hand'] as $i => $c) {
                    if ($c['id'] == $_POST['cardId']) {
                        $game['selectedCards'][] = ['cardId' => $_POST['cardId'], 'playerId' => $p['id']];
                        array_splice($p['hand'], $i, 1); // Korrigiert: $p['hand'] statt falsche Referenz

                        // Wenn alle Karten gewählt wurden, zur Voting-Phase
                        if (count($game['selectedCards']) === count($game['players'])) {
                            $gameManager->prepareVoting($gameId);
                        }
                        break;
                    }
                }
                break;
            }
        }
        $gameManager->saveGames(); // Speichern hinzufügen
    }
    $game = $gameManager->getGame($gameId);
    $players = $game['players'];
} elseif ($action === 'voteCard' && $gameId && $playerName && isset($_POST['cardId'])) {
    $gameManager = GameManager::getInstance();
    $game = &$gameManager->games[$gameId]; // Referenz verwenden
    if ($game) {
        foreach ($game['players'] as $p) {
            if ($p['name'] === $playerName) {
                $game['votes'][] = ['cardId' => $_POST['cardId'], 'playerId' => $p['id']];

                // Wenn alle abgestimmt haben, zur Reveal-Phase
                if (count($game['votes']) === count($game['players']) - 1) {
                    require_once(__DIR__ . '/src/utils/gameLogic.php');
                    calculatePoints($game);
                    $game['phase'] = 'reveal';
                }
                break;
            }
        }
        $gameManager->saveGames(); // Speichern hinzufügen
    }
    $game = $gameManager->getGame($gameId);
    $players = $game['players'];
}

?>
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <title>Don't Choose Me - PHP Version</title>
    <script>
    let updateInterval;
    let currentGameId = '<?php echo htmlspecialchars($gameId); ?>';
    let currentPlayerName = '<?php echo htmlspecialchars($playerName); ?>';

    // Lobby-Update per AJAX
    function updateLobby() {
        if (!currentGameId) {
            var gameIdInput = document.querySelector('input[name="gameId"]');
            if (gameIdInput && gameIdInput.value) {
                currentGameId = gameIdInput.value;
            } else {
                return; // Keine gameId verfügbar
            }
        }

        if (!currentPlayerName) {
            var playerNameInput = document.querySelector('input[name="playerName"]');
            if (playerNameInput && playerNameInput.value) {
                currentPlayerName = playerNameInput.value;
            }
        }

        console.log('Updating lobby for game:', currentGameId, 'player:', currentPlayerName);

        fetch('/xampp/PicMe/server.php?REQUEST_URI=/api/lobby&gameId=' + encodeURIComponent(currentGameId))
            .then(r => {
                if (!r.ok) {
                    throw new Error('HTTP ' + r.status);
                }
                return r.json();
            })
            .then(data => {
                console.log('Lobby data:', data);
                if (data.success && data.players) {
                    var ul = document.getElementById('lobbyPlayers');
                    if (ul) {
                        ul.innerHTML = '';
                        data.players.forEach(function(p) {
                            var li = document.createElement('li');
                            li.textContent = p.name;
                            ul.appendChild(li);
                        });
                    }
                    var minDiv = document.getElementById('minPlayers');
                    if (minDiv) {
                        minDiv.textContent = (data.players.length >= 3) ? '' : 'Mindestens 3 Spieler benötigt!';
                    }

                    // Zeige/verstecke Start-Button
                    var startForm = document.getElementById('startGameForm');
                    if (startForm) {
                        startForm.style.display = (data.players.length >= 3) ? 'block' : 'none';
                    }

                    // Prüfe ob Spiel gestartet wurde
                    if (data.gameState === 'playing') {
                        console.log('Game started, redirecting...');
                        // Weiterleitung zum Spiel
                        window.location.href = '/xampp/PicMe/?gameId=' + encodeURIComponent(currentGameId) + '&playerName=' + encodeURIComponent(currentPlayerName);
                    }
                }
            })
            .catch(err => {
                console.error('Lobby update error:', err);
            });
    }

    function startLobbyUpdates() {
        // Stoppe vorherige Intervalle
        if (updateInterval) {
            clearInterval(updateInterval);
        }

        // Nur starten wenn wir in der Lobby sind
        var lobbyElement = document.getElementById('lobbyPlayers');
        if (lobbyElement && currentGameId) {
            // Starte neues Intervall
            updateInterval = setInterval(updateLobby, 2000);

            // Sofort einmal ausführen
            updateLobby();
            console.log('Started lobby updates for game:', currentGameId);
        }
    }

    // Beim Laden der Seite
    window.addEventListener('DOMContentLoaded', function() {
        console.log('Page loaded with gameId:', currentGameId, 'playerName:', currentPlayerName);

        // Warte kurz damit das DOM vollständig geladen ist
        setTimeout(startLobbyUpdates, 100);

        // Nach Form-Submit auch updaten
        var forms = document.querySelectorAll('form');
        forms.forEach(function(form) {
            form.addEventListener('submit', function(e) {
                // Aktualisiere die Variablen vor dem Submit
                var gameInput = form.querySelector('input[name="gameId"]');
                var nameInput = form.querySelector('input[name="playerName"]');
                if (gameInput) currentGameId = gameInput.value;
                if (nameInput) currentPlayerName = nameInput.value;

                setTimeout(function() {
                    startLobbyUpdates();
                }, 1000);
            });
        });
    });

    // Beim Verlassen der Seite aufräumen
    window.addEventListener('beforeunload', function() {
        if (updateInterval) {
            clearInterval(updateInterval);
        }
    });
    </script>
</head>
<body>
    <div style="max-width:800px;margin:auto;padding:20px;">
        <h1>Don't Choose Me (PHP)</h1>
        <?php
        if (!$game || $game['state'] === 'lobby') {
            // Zeige die Lobby
            $html = "<h2>Lobby: " . ($gameId ?: '[Neue Lobby]') . "</h2>";
            if ($error) {
                $html .= "<div style='color:red;font-weight:bold;'>$error</div>";
            }
            $html .= "<form method='post'>
                <input type='hidden' name='action' value='joinLobby' />
                <input type='text' name='playerName' value='".htmlspecialchars($playerName)."' placeholder='Dein Name' required />
                <input type='text' name='gameId' value='".htmlspecialchars($gameId)."' placeholder='Raum-ID' required />
                <button type='submit'>Raum beitreten</button>
            </form>";
            $html .= "<h3>Spieler in der Lobby:</h3><ul id='lobbyPlayers'>";
            foreach ($players as $p) {
                $html .= "<li>".htmlspecialchars($p['name'])."</li>";
            }
            $html .= "</ul>";
            $html .= "<div id='minPlayers'>".(count($players) >= 3 ? '' : 'Mindestens 3 Spieler benötigt!')."</div>";
            if (count($players) >= 3) {
                $html .= "<form method='post' id='startGameForm'>
                    <input type='hidden' name='action' value='startGame' />
                    <input type='hidden' name='gameId' value='".htmlspecialchars($gameId)."' />
                    <button type='submit'>Spiel starten</button>
                </form>";
            } else {
                $html .= "<div id='startGameForm' style='display:none;'>
                    <form method='post'>
                        <input type='hidden' name='action' value='startGame' />
                        <input type='hidden' name='gameId' value='".htmlspecialchars($gameId)."' />
                        <button type='submit'>Spiel starten</button>
                    </form>
                </div>";
            }
            echo $html;
        } else {
            echo renderGame($game, $playerName);
        }
        ?>
    </div>
</body>
</html>
