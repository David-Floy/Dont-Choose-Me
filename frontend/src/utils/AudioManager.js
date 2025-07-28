/**
 * Zentraler AudioManager für die Musikverwaltung
 */
class AudioManager {
  constructor() {
    this.currentAudio = null;
    this.volume = 0.3; // Reduzierte Standard-Lautstärke
    this.isPlaying = false;
    this.currentTrack = null;
    this.fadeInterval = null;
  }

  /**
   * Spielt eine Musikdatei ab
   * @param {string} trackName - Name der Musikdatei (ohne Pfad)
   * @param {boolean} loop - Soll die Musik wiederholt werden
   * @param {number} fadeInDuration - Fade-in Dauer in ms
   */
  playTrack(trackName, loop = true, fadeInDuration = 1000) {
    // Verhindere Neustart der gleichen Musik
    if (this.currentTrack === trackName && this.isPlaying) {
      return;
    }

    console.log(`🎵 AudioManager: Starte ${trackName}`);

    // Stoppe aktuelle Musik mit Fade-out
    if (this.currentAudio && this.isPlaying) {
      this.stopTrack(500); // 500ms fade-out

      // Warte kurz bevor neue Musik startet
      setTimeout(() => {
        this.startNewTrack(trackName, loop, fadeInDuration);
      }, 600);
    } else {
      this.startNewTrack(trackName, loop, fadeInDuration);
    }
  }

  /**
   * Startet eine neue Musikdatei
   * @param {string} trackName - Name der Musikdatei
   * @param {boolean} loop - Soll die Musik wiederholt werden
   * @param {number} fadeInDuration - Fade-in Dauer in ms
   */
  startNewTrack(trackName, loop, fadeInDuration) {
    try {
      this.currentAudio = new Audio(`/sounds/${trackName}`);
      this.currentAudio.loop = loop;
      this.currentAudio.volume = 0; // Starte bei 0 für Fade-in
      this.currentTrack = trackName;

      this.currentAudio.addEventListener('canplaythrough', () => {
        this.currentAudio.play()
          .then(() => {
            this.isPlaying = true;
            this.fadeIn(fadeInDuration);
            console.log(`✅ AudioManager: ${trackName} gestartet`);
          })
          .catch(error => {
            console.error(`❌ AudioManager: Fehler beim Abspielen von ${trackName}:`, error);
          });
      });

      this.currentAudio.addEventListener('error', (error) => {
        console.error(`❌ AudioManager: Ladefehler für ${trackName}:`, error);
      });

      // Lade die Audiodatei
      this.currentAudio.load();
    } catch (error) {
      console.error(`❌ AudioManager: Allgemeiner Fehler bei ${trackName}:`, error);
    }
  }

  /**
   * Stoppt die aktuelle Musik
   * @param {number} fadeOutDuration - Fade-out Dauer in ms
   */
  stopTrack(fadeOutDuration = 1000) {
    if (this.currentAudio && this.isPlaying) {
      console.log(`🎵 AudioManager: Stoppe ${this.currentTrack}`);

      if (fadeOutDuration > 0) {
        this.fadeOut(fadeOutDuration, () => {
          this.cleanupAudio();
        });
      } else {
        this.cleanupAudio();
      }
    }
  }

  /**
   * Bereinigt Audio-Ressourcen
   */
  cleanupAudio() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.isPlaying = false;
    this.currentTrack = null;

    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
  }

  /**
   * Setzt die Lautstärke
   * @param {number} volume - Lautstärke zwischen 0 und 1
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));

    if (this.currentAudio) {
      this.currentAudio.volume = this.volume;
    }

    console.log(`🔊 AudioManager: Lautstärke auf ${Math.round(this.volume * 100)}% gesetzt`);
  }

  /**
   * Fade-in Effekt
   * @param {number} duration - Dauer in ms
   */
  fadeIn(duration) {
    if (!this.currentAudio) return;

    const steps = 50;
    const stepTime = duration / steps;
    const volumeStep = this.volume / steps;
    let currentStep = 0;

    this.fadeInterval = setInterval(() => {
      if (currentStep >= steps || !this.currentAudio) {
        if (this.fadeInterval) {
          clearInterval(this.fadeInterval);
          this.fadeInterval = null;
        }
        if (this.currentAudio) {
          this.currentAudio.volume = this.volume;
        }
        return;
      }

      this.currentAudio.volume = volumeStep * currentStep;
      currentStep++;
    }, stepTime);
  }

  /**
   * Fade-out Effekt
   * @param {number} duration - Dauer in ms
   * @param {function} callback - Callback nach dem Fade-out
   */
  fadeOut(duration, callback) {
    if (!this.currentAudio) {
      if (callback) callback();
      return;
    }

    const steps = 50;
    const stepTime = duration / steps;
    const volumeStep = this.currentAudio.volume / steps;
    let currentStep = 0;

    this.fadeInterval = setInterval(() => {
      if (currentStep >= steps || !this.currentAudio) {
        if (this.fadeInterval) {
          clearInterval(this.fadeInterval);
          this.fadeInterval = null;
        }
        if (callback) callback();
        return;
      }

      this.currentAudio.volume = Math.max(0, this.currentAudio.volume - volumeStep);
      currentStep++;
    }, stepTime);
  }

  /**
   * Pausiert/Resumes die Musik
   */
  togglePlayPause() {
    if (!this.currentAudio) return;

    if (this.isPlaying) {
      this.currentAudio.pause();
      this.isPlaying = false;
      console.log(`⏸️ AudioManager: ${this.currentTrack} pausiert`);
    } else {
      this.currentAudio.play()
        .then(() => {
          this.isPlaying = true;
          console.log(`▶️ AudioManager: ${this.currentTrack} fortgesetzt`);
        })
        .catch(error => {
          console.error('❌ AudioManager: Fehler beim Fortsetzen:', error);
        });
    }
  }

  /**
   * Gibt den aktuellen Status zurück
   */
  getStatus() {
    return {
      isPlaying: this.isPlaying,
      currentTrack: this.currentTrack,
      volume: this.volume
    };
  }
}

// Singleton Instance
const audioManager = new AudioManager();
export default audioManager;
