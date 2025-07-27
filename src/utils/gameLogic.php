<?php
function shuffleArray($array) {
    $shuffled = $array;
    for ($i = count($shuffled) - 1; $i > 0; $i--) {
        $j = rand(0, $i);
        $tmp = $shuffled[$i];
        $shuffled[$i] = $shuffled[$j];
        $shuffled[$j] = $tmp;
    }
    return $shuffled;
}

function calculatePoints(&$game) {
    // Korrektur: Index-Check für selectedCards
    if (!isset($game['selectedCards'][0])) return [];

    $storytellerId = $game['selectedCards'][0]['playerId'];
    $correctCardId = $game['storytellerCard'];
    $votes = $game['votes'];

    $correctVotes = count(array_filter($votes, function($v) use ($correctCardId) {
        return $v['cardId'] === $correctCardId;
    }));
    $allCorrect = $correctVotes === count($votes);
    $noneCorrect = $correctVotes === 0;

    // Punkte für den Erzähler
    foreach ($game['players'] as &$player) {
        if ($player['id'] === $storytellerId) {
            if (!$noneCorrect && !$allCorrect) {
                $player['points'] += 3;
            }
        }
    }

    // Punkte für richtige Stimmen
    foreach ($votes as $vote) {
        if ($vote['cardId'] === $correctCardId) {
            foreach ($game['players'] as &$player) {
                if ($player['id'] === $vote['playerId']) {
                    $player['points'] += 3;
                }
            }
        }
    }

    // Punkte für andere Spieler, die Stimmen für ihre Karten erhalten haben
    foreach ($game['selectedCards'] as $selectedCard) {
        if ($selectedCard['playerId'] !== $storytellerId) {
            $votesForCard = count(array_filter($votes, function($v) use ($selectedCard) {
                return $v['cardId'] === $selectedCard['cardId'];
            }));
            foreach ($game['players'] as &$player) {
                if ($player['id'] === $selectedCard['playerId']) {
                    $player['points'] += $votesForCard;
                }
            }
        }
    }

    return ['points' => array_map(function($p) {
        return ['id' => $p['name'], 'points' => $p['points']];
    }, $game['players'])];
}

function validateGameState($game) {
    if (!$game || !isset($game['players']) || count($game['players']) < 2) {
        return false;
    }
    if ($game['storytellerIndex'] < 0 || $game['storytellerIndex'] >= count($game['players'])) {
        return false;
    }
    return true;
}
?>
