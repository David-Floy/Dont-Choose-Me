#!/bin/bash

echo "🚀 Starting Render build process..."

# Farben für bessere Lesbarkeit
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fehlerbehandlung
set -e

echo -e "${BLUE}📁 Aktuelle Verzeichnisstruktur:${NC}"
ls -la

echo -e "${BLUE}🔍 Überprüfe Projektstruktur...${NC}"
if [ ! -d "frontend" ]; then
    echo -e "${RED}❌ Frontend-Ordner nicht gefunden!${NC}"
    exit 1
fi

if [ ! -d "backend" ]; then
    echo -e "${RED}❌ Backend-Ordner nicht gefunden!${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Installiere Root-Dependencies...${NC}"
npm install

echo -e "${BLUE}🎨 Baue Frontend...${NC}"
cd frontend
npm install
npm run build
cd ..

echo -e "${BLUE}⚙️ Installiere Backend-Dependencies...${NC}"
cd backend
npm install --production
cd ..

echo -e "${BLUE}📋 Kopiere Build in Backend...${NC}"
if [ -d "frontend/build" ]; then
    cp -r frontend/build backend/
    echo -e "${GREEN}✅ Build erfolgreich kopiert!${NC}"
else
    echo -e "${RED}❌ Frontend-Build nicht gefunden!${NC}"
    exit 1
fi

echo -e "${BLUE}🔍 Überprüfe Backend-Struktur...${NC}"
ls -la backend/

if [ -d "backend/build" ]; then
    echo -e "${GREEN}✅ Build-Ordner im Backend gefunden!${NC}"
    echo -e "${BLUE}📄 Build-Inhalt:${NC}"
    ls -la backend/build/
else
    echo -e "${RED}❌ Build-Ordner im Backend nicht gefunden!${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 Render-Build erfolgreich abgeschlossen!${NC}"
echo -e "${YELLOW}💡 Der Server kann nun mit 'npm start' gestartet werden${NC}"

