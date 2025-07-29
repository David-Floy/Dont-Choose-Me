/**
 * Zentraler AudioManager für die Musikverwaltung
 */
class AudioManager {
  constructor() {
    this.currentAudio = null;
    this.volume = 0.1; // Reduzierte Standard-Lautstärke auf 10%
    this.isPlaying = false;
    this.currentTrack = null;
    this.fadeInterval = null;
    this.audioQueue = []; // Queue für geplante Audio-Wechsel
    this.isTransitioning = false; // Flag für laufende Übergänge
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

    // Wenn gerade ein Übergang läuft, zur Queue hinzufügen
    if (this.isTransitioning) {
      this.audioQueue.push({ trackName, loop, fadeInDuration });
      console.log(`🎵 AudioManager: ${trackName} zur Queue hinzugefügt (Übergang läuft)`);
      return;
    }

    // Stoppe aktuelle Musik mit Fade-out
    if (this.currentAudio && this.isPlaying) {
      this.isTransitioning = true;
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
      // Bereinige vorherige Audio-Instanz
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio.src = '';
        this.currentAudio.removeAttribute('src');
        this.currentAudio.load();
      }

      // Erstelle neue Audio-Instanz
      this.currentAudio = new Audio(`/sounds/${trackName}`);
      this.currentAudio.loop = loop;
      this.currentAudio.volume = 0; // Starte bei 0 für Fade-in
      this.currentTrack = trackName;

      // Ereignis-Handler vor dem Laden hinzufügen
      this.currentAudio.addEventListener('canplaythrough', () => {
        if (!this.currentAudio) return; // Sicherheitsüberprüfung

        this.currentAudio.play()
          .then(() => {
            this.isPlaying = true;
            this.fadeIn(fadeInDuration);
            console.log(`✅ AudioManager: ${trackName} gestartet`);

            // Übergangsstatus zurücksetzen
            this.isTransitioning = false;

            // Nächsten Track aus der Queue starten, falls vorhanden
            if (this.audioQueue.length > 0) {
              const nextTrack = this.audioQueue.shift();
              console.log(`🎵 AudioManager: Starte nächsten Track aus Queue: ${nextTrack.trackName}`);
              this.playTrack(nextTrack.trackName, nextTrack.loop, nextTrack.fadeInDuration);
            }
          })
          .catch(error => {
            console.error(`❌ AudioManager: Fehler beim Abspielen von ${trackName}:`, error);
            this.isTransitioning = false; // Fehlerfall: Status zurücksetzen
            this.handleAudioError();
          });
      }, { once: true }); // Event nur einmal auslösen

      this.currentAudio.addEventListener('error', (error) => {
        console.error(`❌ AudioManager: Ladefehler für ${trackName}:`, error);
        this.isTransitioning = false; // Fehlerfall: Status zurücksetzen
        this.handleAudioError();
      });

      // Lade die Audiodatei
      this.currentAudio.load();
    } catch (error) {
      console.error(`❌ AudioManager: Allgemeiner Fehler bei ${trackName}:`, error);
      this.isTransitioning = false; // Fehlerfall: Status zurücksetzen
      this.handleAudioError();
    }
  }

  /**
   * Behandelt Audio-Fehler und versucht Wiederherstellung
   */
  handleAudioError() {
    // Audio-Instanz bereinigen
    this.cleanupAudio();

    // Versuche den nächsten Track in der Queue, falls vorhanden
    if (this.audioQueue.length > 0) {
      const nextTrack = this.audioQueue.shift();
      console.log(`🔄 AudioManager: Versuche nächsten Track nach Fehler: ${nextTrack.trackName}`);
      setTimeout(() => {
        this.playTrack(nextTrack.trackName, nextTrack.loop, nextTrack.fadeInDuration);
      }, 1000); // Kurze Verzögerung vor neuem Versuch
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
    } else {
      // Bereits gestoppt oder kein Audio
      this.isTransitioning = false;
    }
  }

  /**
   * Bereinigt Audio-Ressourcen
   */
  cleanupAudio() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.src = ''; // Wichtig für Speicherfreigabe
      this.currentAudio.removeAttribute('src');
      this.currentAudio.load();
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

    // Bestehenden Fade-Effekt abbrechen
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }

    const steps = 50;
    const stepTime = duration / steps;
    const volumeStep = this.volume / steps;
    let currentStep = 0;

    this.fadeInterval = setInterval(() => {
      if (!this.currentAudio || currentStep >= steps) {
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

    // Bestehenden Fade-Effekt abbrechen
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }

    const steps = 50;
    const stepTime = duration / steps;
    const startVolume = this.currentAudio.volume;
    const volumeStep = startVolume / steps;
    let currentStep = 0;

    this.fadeInterval = setInterval(() => {
      if (!this.currentAudio || currentStep >= steps) {
        if (this.fadeInterval) {
          clearInterval(this.fadeInterval);
          this.fadeInterval = null;
        }
        if (callback) callback();
        return;
      }

      this.currentAudio.volume = Math.max(0, startVolume - (volumeStep * currentStep));
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
