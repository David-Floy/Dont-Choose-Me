# Don't Choose Me - Card Game

A digital implementation of the popular card game "Dixit" where players use their imagination to give creative hints about picture cards.

## 🎮 Game Overview

Don't Choose Me is a multiplayer storytelling game where:
- One player acts as the storyteller and gives a creative hint about their chosen card
- Other players select cards from their hand that best match the hint
- All selected cards are shuffled and presented for voting
- Players vote for which card they think belongs to the storyteller
- Points are awarded based on voting results

## 🏗️ Project Structure

```
PicMe/
├── frontend/                 # React frontend application
│   ├── public/
│   │   ├── images/          # Card images storage
│   │   │   ├── default/     # Default card deck
│   │   │   ├── deck-1/      # Additional card deck 1
│   │   │   └── deck-2/      # Additional card deck 2
│   │   └── index.html
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── App.js      # Main application component
│   │   │   ├── Lobby.js    # Game lobby management
│   │   │   ├── Game.js     # Main game logic
│   │   │   ├── Card.js     # Card display component
│   │   │   └── DeckSelector.js  # Card deck selection component
│   │   └── index.js        # Application entry point
│   └── package.json
├── backend/                 # Node.js backend server
│   ├── server.js           # Express server and game logic
│   ├── cards.json          # Card database with deck information
│   ├── AddCards.js         # Card import utility
│   ├── decks/              # Card deck definitions
│   │   ├── default.json    # Default deck configuration
│   │   ├── deck-1.json     # Additional deck 1
│   │   └── deck-2.json     # Additional deck 2
│   └── import/             # Directory for new card imports
└── README.md
```

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn package manager

### Backend Setup
```bash
cd backend
npm install
node server.js
```
The backend server will start on port 3001.

### Frontend Setup
```bash
cd frontend
npm install
npm start
```
The frontend will start on port 3000.

## 🎯 Game Rules

### Setup
- Minimum 3 players required to start a game
- Each player receives 6 cards at the beginning
- Players take turns being the storyteller

### Gameplay Phases

1. **Storytelling Phase**
   - The storyteller chooses a card from their hand
   - They provide a creative hint (word, phrase, or story)
   - The hint should be neither too obvious nor too obscure

2. **Card Selection Phase**
   - Other players choose a card from their hand that matches the hint
   - Players cannot see which cards others have chosen

3. **Voting Phase**
   - All chosen cards are shuffled and displayed
   - Players (except the storyteller) vote for the card they think belongs to the storyteller
   - Players cannot vote for their own card

4. **Scoring Phase**
   - Points are awarded based on voting results

### Scoring System

**Storyteller Scoring:**
- Gets 3 points if some (but not all) players guess correctly
- Gets 0 points if everyone or no one guesses correctly

**Other Players:**
- Get 3 points for correctly guessing the storyteller's card
- Get 1 point for each vote their card receives from other players

**Winning:**
- First player to reach 30 points wins the game

## 🔧 Technical Features

### Frontend (React)
- **Responsive Design**: Works on desktop and mobile devices
- **Real-time Updates**: Polling-based game state synchronization
- **Interactive UI**: Smooth animations and hover effects
- **Game Phases**: Distinct interfaces for each game phase
- **Lobby System**: Room-based multiplayer with custom room codes

### Backend (Node.js/Express)
- **REST API**: Game state management via HTTP endpoints
- **Memory Storage**: In-memory game state (resets on server restart)
- **Room Management**: Multiple concurrent games supported
- **Card Management**: Dynamic card loading and validation
- **Game Logic**: Complete implementation of scoring rules

## 📁 Card Management

### Adding New Cards
1. Place image files in `backend/import/` directory
2. Run the card import utility:
   ```bash
   cd backend
   node AddCards.js
   ```
3. Images will be moved to `frontend/public/images/`
4. Card entries will be added to `cards.json`

### Supported Formats
- JPG, JPEG, PNG image files
- Recommended size: 300x200 pixels
- Files are automatically renamed and cataloged

## 🚀 Upcoming Features

### Next Development Phase
The following features are planned for the next development iteration:

#### 🃏 Multiple Card Decks
- **Deck Management System**: Support for multiple themed card collections
- **Deck Categories**: Organization by themes (fantasy, nature, abstract, etc.)
- **Deck Metadata**: Name, description, theme, difficulty level for each deck
- **Import Utility Enhancement**: Ability to import cards into specific decks

#### 🎨 Lobby Deck Selection
- **Deck Preview**: Visual preview of available decks in lobby
- **Deck Combination**: Option to combine multiple decks for variety
- **Deck Information**: Display deck size, theme, and preview cards
- **Host Controls**: Lobby leader can select which decks to use

#### ✨ UI/UX Improvements
- **Modern Design Language**: Updated visual design with improved aesthetics
- **Enhanced Animations**: Smooth transitions between game phases
- **Responsive Mobile Design**: Optimized interface for mobile devices
- **Accessibility Features**: Better contrast, keyboard navigation, screen reader support
- **Loading States**: Improved feedback during game state changes
- **Error Handling**: Better user feedback for connection issues

## 📁 Card Deck Management

### Current Implementation
Cards are currently stored in a single collection in `cards.json` and images in `frontend/public/images/`.

### Planned Deck Structure
```
frontend/public/images/
├── default/              # Default card deck
│   ├── card1.jpg
│   ├── card2.jpg
│   └── ...
├── fantasy/              # Fantasy-themed deck
│   ├── dragon.jpg
│   ├── wizard.jpg
│   └── ...
└── nature/               # Nature-themed deck
    ├── forest.jpg
    ├── ocean.jpg
    └── ...
```

### Deck Configuration Format
```json
{
  "id": "fantasy",
  "name": "Fantasy Adventure",
  "description": "Mystical creatures and magical landscapes",
  "theme": "fantasy",
  "difficulty": "medium",
  "cardCount": 84,
  "previewCards": ["dragon.jpg", "wizard.jpg", "castle.jpg"],
  "cards": [...]
}
```

### Adding New Decks
1. Create a new folder in `frontend/public/images/[deck-name]/`
2. Place themed image files in the deck folder
3. Run the enhanced card import utility:
   ```bash
   cd backend
   node AddCards.js --deck [deck-name] --theme [theme]
   ```
4. Configure deck metadata in `backend/decks/[deck-name].json`

## 🌐 Enhanced API Endpoints

### Deck Management (Planned)
- `GET /api/decks` - Retrieve all available decks
- `GET /api/decks/:deckId` - Get specific deck information
- `GET /api/decks/:deckId/preview` - Get preview cards for a deck
- `POST /api/game/selectDecks` - Set active decks for a game room

### Game Management
- `POST /api/game` - Main game endpoint for all actions
  - `joinLobby` - Join a game room
  - `startGame` - Start the game (requires 3+ players)
  - `getState` - Get current game state
  - `giveHint` - Storyteller gives hint and selects card
  - `chooseCard` - Player selects card during selection phase
  - `vote` - Player votes for a card
  - `nextRound` - Continue to next round
  - `restart` - Restart the game

### Card Management
- `GET /api/cards` - Retrieve all available cards

## 🎨 Enhanced UI Components

### Lobby Component (Enhanced)
- Player name and room ID input
- **Deck Selection Interface**: Choose from available card decks
- **Deck Preview**: Visual representation of selected decks
- Quick join buttons for common room names
- Real-time player list with lobby leader indication
- **Game Configuration**: Settings for deck combination and game rules
- Minimum player count validation

### Game Component (Enhanced)
- Dynamic phase-based UI rendering
- **Improved Card Animations**: Smooth card transitions and effects
- Interactive card selection and voting
- **Enhanced Scoreboard**: Better visual hierarchy and information display
- Detailed reveal phase with voting results
- **Mobile-Optimized Interface**: Touch-friendly controls
- Game end screen with final rankings

### New Components (Planned)
- **DeckSelector**: Interactive deck selection with previews
- **DeckPreview**: Shows deck information and sample cards
- **GameSettings**: Configuration options for game rules
- **LoadingSpinner**: Consistent loading states across the app
- **ErrorBoundary**: Graceful error handling and recovery

## 🔄 Enhanced Game Flow

```
Lobby → Deck Selection → Storytelling → Card Selection → Voting → Reveal → Next Round
  ↑           ↓                                                      ↓
  ←←← Game Settings ←←←←←←←←←←←←←←←←←←←←← Game End ←←←←←←←←←←←←←←←←←←←←
```

## 🎯 UX Improvements Roadmap

### Phase 1: Core Deck System
- [ ] Implement deck management backend
- [ ] Create deck selection UI in lobby
- [ ] Update card import utility for decks
- [ ] Test with multiple themed decks

### Phase 2: Enhanced Lobby Experience
- [ ] Visual deck previews
- [ ] Deck combination options
- [ ] Game settings interface
- [ ] Improved player management

### Phase 3: UI/UX Overhaul
- [ ] Modern design system implementation
- [ ] Enhanced animations and transitions
- [ ] Mobile-responsive design improvements
- [ ] Accessibility enhancements

### Phase 4: Advanced Features
- [ ] Deck rating and favorites
- [ ] Custom deck creation tools
- [ ] Advanced game statistics
- [ ] Social features and sharing

## 🐛 Troubleshooting

### Common Issues

**Cards not displaying:**
- Check if images exist in `frontend/public/images/`
- Verify `cards.json` has correct image paths
- Run `node AddCards.js` to reimport cards

**Game state not updating:**
- Check browser console for network errors
- Verify backend server is running on port 3001
- Check if API proxy is configured correctly

**Players can't join lobby:**
- Verify room ID format (alphanumeric, hyphens, underscores only)
- Check player name format (letters, numbers, spaces only)
- Ensure minimum/maximum length requirements are met

## 📝 Development Notes

### State Management
- Game state is stored in memory on the backend
- Frontend polls every 2 seconds for updates
- No persistence - games reset on server restart

### Security Considerations
- Input validation on both client and server
- No authentication system (intended for private use)
- Room codes provide basic access control

### Performance
- Image optimization recommended for production
- Consider implementing WebSocket for real-time updates
- Database storage for game persistence

## 🚀 Future Enhancements

### Immediate Priorities
- [x] Basic game functionality
- [x] Multi-room support
- [ ] **Multiple card deck system**
- [ ] **Lobby deck selection interface**
- [ ] **UI/UX modernization**

### Medium-term Goals
- [ ] WebSocket implementation for real-time updates
- [ ] Database persistence for game history
- [ ] Player authentication and profiles
- [ ] Custom deck upload interface
- [ ] Advanced game statistics and analytics

### Long-term Vision
- [ ] Mobile app development
- [ ] AI players for single-player mode
- [ ] Tournament and competitive modes
- [ ] Community-generated content platform
- [ ] Cross-platform synchronization

## 📄 License & Disclaimer

### Open Source Project
This project is **open source** and released under the MIT License. You are free to:
- Use the code for personal and educational purposes
- Modify and distribute the code
- Contribute to the project development

### Non-Commercial Use
**Important**: This is **NOT a commercial product**. Don't Choose Me is developed as:
- An educational project to learn web development
- A personal implementation for private use with friends and family
- A demonstration of game development techniques

### Card Image Rights
**We do NOT own the rights to any card images used in this project.**
- Card images are used for demonstration and educational purposes only
- Users must ensure they have proper rights/licenses for any images they import
- Commercial use of the card images may require separate licensing
- Default images should be replaced with properly licensed content for any public deployment

### Trademark Notice
- "Dixit" is a trademark of Libellud
- This project is not affiliated with or endorsed by Libellud
- Don't Choose Me is an independent implementation inspired by similar storytelling card games

### Liability
- This software is provided "as is" without warranty of any kind
- The developers are not responsible for any misuse of copyrighted content
- Users are responsible for ensuring compliance with applicable laws and licenses
