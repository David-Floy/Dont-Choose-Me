<?php
$importDir = __DIR__ . '/import';
$imagesDir = __DIR__ . '/images';
$cardsPath = __DIR__ . '/cards.json';

// Ordner anlegen falls nicht vorhanden
if (!is_dir($imagesDir)) {
    mkdir($imagesDir, 0777, true);
    echo "Images-Ordner erstellt\n";
}
if (!is_dir($importDir)) {
    mkdir($importDir, 0777, true);
    echo "Import-Ordner erstellt. Lege Bilder dort hinein und führe das Skript erneut aus.\n";
    exit;
}

// Bestehende Karten laden
$existingCards = [];
if (file_exists($cardsPath)) {
    $data = file_get_contents($cardsPath);
    $existingCards = json_decode($data, true) ?: [];
}

// Bilddateien im Import-Ordner finden
$imageFiles = array_filter(scandir($importDir), function($file) {
    return preg_match('/\.(jpg|jpeg|png|gif|webp)$/i', $file);
});

if (count($imageFiles) === 0) {
    echo "Keine Bilddateien im import-Ordner gefunden.\n";
    exit;
}

$maxId = count($existingCards) > 0 ? max(array_column($existingCards, 'id')) : 0;
$nextId = $maxId + 1;
$newCards = [];

foreach ($imageFiles as $file) {
    $sourcePath = $importDir . '/' . $file;
    $targetPath = $imagesDir . '/' . $file;

    if (file_exists($targetPath)) {
        echo "Überspringe $file - existiert bereits in images/\n";
        continue;
    }

    if (copy($sourcePath, $targetPath)) {
        unlink($sourcePath);
        $newCards[] = [
            'id' => $nextId,
            'title' => "Card #$nextId",
            'image' => "/images/$file"
        ];
        echo "✅ $file -> images/ (ID: $nextId)\n";
        $nextId++;
    } else {
        echo "❌ Fehler beim Verarbeiten von $file\n";
    }
}

if (count($newCards) === 0) {
    echo "Keine neuen Karten hinzugefügt.\n";
    exit;
}

$allCards = array_merge($existingCards, $newCards);
usort($allCards, function($a, $b) { return $a['id'] - $b['id']; });
file_put_contents($cardsPath, json_encode($allCards, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
echo "\n✅ cards.json erfolgreich aktualisiert!\n";
echo "   Neue Karten: " . count($newCards) . "\n";
echo "   Gesamt Karten: " . count($allCards) . "\n";
echo "   Neue IDs: " . implode(', ', array_column($newCards, 'id')) . "\n";

// Import-Ordner löschen wenn leer
if (count(array_diff(scandir($importDir), ['.', '..'])) === 0) {
    rmdir($importDir);
    echo "Import-Ordner gelöscht (war leer)\n";
}

echo "\n🎉 Fertig! Starte den Server neu, um die neuen Karten zu laden.\n";
?>

