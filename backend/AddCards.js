const fs = require('fs');
const path = require('path');

const importDir = path.join(__dirname, 'import');
const imagesDir = path.join(__dirname, '..', 'frontend', 'public', 'images');
const cardsPath = path.join(__dirname, 'cards.json');

// Stelle sicher, dass der images-Ordner existiert
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
    console.log('images-Ordner erstellt');
}

// Stelle sicher, dass der import-Ordner existiert
if (!fs.existsSync(importDir)) {
    fs.mkdirSync(importDir, { recursive: true });
    console.log('Import-Ordner erstellt. Lege Bilder dort hinein und führe das Skript erneut aus.');
    process.exit(0);
}

// Lade existierende cards.json oder erstelle leeres Array
let existingCards = [];
if (fs.existsSync(cardsPath)) {
    try {
        const data = fs.readFileSync(cardsPath, 'utf8');
        existingCards = JSON.parse(data);
        console.log(`Bestehende Karten geladen: ${existingCards.length}`);
    } catch (error) {
        console.warn('Fehler beim Laden der bestehenden cards.json, erstelle neue Datei');
        existingCards = [];
    }
}

// Finde alle Bilddateien im import-Ordner
const imageFiles = fs.readdirSync(importDir).filter(file =>
    /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
);

if (imageFiles.length === 0) {
    console.log('Keine Bilddateien im import-Ordner gefunden.');
    console.log('Unterstützte Formate: .jpg, .jpeg, .png, .gif, .webp');
    process.exit(0);
}

console.log(`${imageFiles.length} Bilddateien im import-Ordner gefunden`);

// Finde die höchste existierende ID
const maxId = existingCards.length > 0 ? Math.max(...existingCards.map(card => card.id)) : 0;
let nextId = maxId + 1;

const newCards = [];

// Verarbeite jede Bilddatei
imageFiles.forEach((file, index) => {
    const sourcePath = path.join(importDir, file);
    const targetPath = path.join(imagesDir, file);

    // Prüfe ob Datei bereits im images-Ordner existiert
    if (fs.existsSync(targetPath)) {
        console.log(`Überspringe ${file} - existiert bereits in images/`);
        return;
    }

    try {
        // Verschiebe Datei von import/ nach frontend/public/images/
        fs.copyFileSync(sourcePath, targetPath);
        fs.unlinkSync(sourcePath);

        // Erstelle Karteneintrag im korrekten Format
        const newCard = {
            id: nextId,
            title: `Card #${nextId}`,
            image: `images/${file}`
        };

        newCards.push(newCard);
        nextId++;

        console.log(`✅ ${file} -> frontend/public/images/ (ID: ${newCard.id})`);
    } catch (error) {
        console.error(`❌ Fehler beim Verarbeiten von ${file}:`, error.message);
    }
});

if (newCards.length === 0) {
    console.log('Keine neuen Karten hinzugefügt.');
    process.exit(0);
}

// Kombiniere existierende und neue Karten
const allCards = [...existingCards, ...newCards];

// Sortiere nach ID
allCards.sort((a, b) => a.id - b.id);

// Schreibe aktualisierte cards.json
try {
    fs.writeFileSync(cardsPath, JSON.stringify(allCards, null, 2), 'utf8');
    console.log(`\n✅ cards.json erfolgreich aktualisiert!`);
    console.log(`   Neue Karten: ${newCards.length}`);
    console.log(`   Gesamt Karten: ${allCards.length}`);

    // Zeige die neuen Karten-IDs an
    if (newCards.length > 0) {
        const newIds = newCards.map(card => card.id).join(', ');
        console.log(`   Neue IDs: ${newIds}`);
    }
} catch (error) {
    console.error('❌ Fehler beim Schreiben der cards.json:', error.message);
    process.exit(1);
}

// Lösche import-Ordner wenn leer
try {
    const remainingFiles = fs.readdirSync(importDir);
    if (remainingFiles.length === 0) {
        fs.rmdirSync(importDir);
        console.log('Import-Ordner gelöscht (war leer)');
    } else {
        console.log(`Import-Ordner enthält noch ${remainingFiles.length} Dateien`);
    }
} catch (error) {
    console.warn('Warnung: Konnte import-Ordner nicht löschen:', error.message);
}

console.log('\n🎉 Fertig! Starte den Server neu, um die neuen Karten zu laden.');
