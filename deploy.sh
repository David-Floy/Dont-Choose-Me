#!/bin/bash

echo "🚀 Starte Deployment..."

# 1. Dependencies installieren
echo "📦 Installiere Backend-Dependencies..."
cd backend || { echo "❌ backend/ Verzeichnis nicht gefunden"; exit 1; }
npm install --production

echo "📦 Installiere Frontend-Dependencies..."
cd ../frontend || { echo "❌ frontend/ Verzeichnis nicht gefunden"; exit 1; }
npm install

# 2. React App bauen
echo "🏗️ Baue React App..."
npm run build

# 3. Prüfe ob Build erfolgreich war
if [ ! -d "build" ]; then
    echo "❌ Build fehlgeschlagen – build/ Ordner nicht gefunden"
    exit 1
fi
echo "✅ React Build erfolgreich erstellt"

# 4. Kopiere Build-Ordner ins Backend
echo "📁 Kopiere Build-Dateien zum Backend..."
rm -rf ../backend/build
cp -r build ../backend/

# 5. Wichtige Dateien prüfen
cd ../backend
if [ ! -f "server.js" ]; then
    echo "❌ server.js nicht gefunden"
    exit 1
fi

if [ ! -f "cards.json" ]; then
    echo "⚠️ cards.json nicht gefunden – Server erstellt Beispieldaten"
fi

# 6. Starte Server
echo "🎮 Starte PicMe Server..."
NODE_ENV=production node server.js

# Alternativ mit PM2 (empfohlen für Production):
# pm2 start server.js --name picme --env production
