/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { LitElement, html, css, svg } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

const EXAMPLES = [
  {
    title: 'The Fury',
    artist: 'Scott Buckley',
    imageUrl: 'https://picsum.photos/seed/synthwave/400/400',
    audioUrl: 'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/cc_by/Scott_Buckley/The_Fury/Scott_Buckley_-_01_-_The_Fury.mp3',
  },
  {
    title: 'Lofi Mallet',
    artist: 'Ketsa',
    imageUrl: 'https://picsum.photos/seed/lofi/400/400',
    audioUrl: 'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/cc_by_nc_nd/Ketsa/Raising_Frequency/Ketsa_-_10_-_Lofi_Mallet.mp3',
  },
  {
    title: 'Ambient Dreams',
    artist: 'Scott Buckley',
    imageUrl: 'https://picsum.photos/seed/ambient/400/400',
    audioUrl: 'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/cc_by/Scott_Buckley/The_Quiet_Things/Scott_Buckley_-_02_-_The_Things_That_Keep_Us_Here.mp3',
  },
  {
    title: 'Bossa Nova Breeze',
    artist: 'Kevin MacLeod',
    imageUrl: 'https://picsum.photos/seed/bossa/400/400',
    audioUrl: 'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/cc_by/Kevin_MacLeod/Best_of_2014/Kevin_MacLeod_-_04_-_BossaBossa.mp3',
  },
  {
    title: 'Funk Groove',
    artist: 'Kevin MacLeod',
    imageUrl: 'https://picsum.photos/seed/funk/400/400',
    audioUrl: 'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/cc_by/Kevin_MacLeod/Best_of_2014/Kevin_MacLeod_-_03_-_Too_Cool.mp3',
  },
];

@customElement('music-examples')
// FIX: Extended LitElement to define a proper web component.
export class MusicExamples extends LitElement {
  static override styles = css`
    :host {
      display: block;
      color: #fff;
      width: 100%;
      max-width: 1200px;
    }
    .examples-container {
      text-align: center;
    }
    h2 {
      font-size: 4vmin;
      font-weight: 600;
      margin: 0 0 1vmin;
      text-shadow: 1px 1px 4px rgba(0,0,0,0.5);
    }
    p {
      font-size: 1.8vmin;
      max-width: 60ch;
      margin: 0 auto 4vmin;
      opacity: 0.8;
      line-height: 1.6;
    }
    .slider {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: 21%;
      gap: 2vmin;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      padding: 2vmin;
      margin: 0 -2vmin; /* Offset padding */
      scrollbar-width: none; /* Firefox */
    }
    .slider::-webkit-scrollbar {
      display: none; /* Safari and Chrome */
    }
    .card {
      scroll-snap-align: center;
      background: linear-gradient(145deg, #2e2e2e, #1a1a1a);
      border-radius: 1.5vmin;
      overflow: hidden;
      box-shadow: 0 1vmin 3vmin rgba(0,0,0,0.5);
      position: relative;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }
    .card:hover {
      transform: translateY(-5px);
      box-shadow: 0 1.5vmin 4vmin rgba(0,0,0,0.4);
    }
    .card.playing {
      box-shadow: 0 0 2vmin #9900ff, 0 1.5vmin 4vmin rgba(0,0,0,0.4);
    }
    .art {
      width: 100%;
      aspect-ratio: 1 / 1;
      object-fit: cover;
      display: block;
    }
    .info {
      padding: 1.5vmin;
      text-align: left;
    }
    .info h3 {
      font-size: 2vmin;
      font-weight: 600;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .info p {
      font-size: 1.5vmin;
      margin: 0.5vmin 0 0;
      opacity: 0.7;
    }
    .play-button {
      position: absolute;
      bottom: 1.5vmin;
      right: 1.5vmin;
      width: 4vmin;
      height: 4vmin;
      background-color: rgba(255, 255, 255, 0.9);
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      transition: transform 0.2s ease, background-color 0.2s ease;
    }
    .play-button:hover {
      transform: scale(1.1);
      background-color: #fff;
    }
    .play-button svg {
      width: 50%;
      height: 50%;
      fill: #111;
    }

    @media only screen and (max-width: 1024px) {
      .slider {
        grid-auto-columns: 30%;
      }
    }

    @media only screen and (max-width: 600px) {
      h2 { font-size: 6vmin; }
      p { font-size: 3vmin; }
      .slider {
        grid-auto-columns: 60%;
      }
      .info h3 { font-size: 3.5vmin; }
      .info p { font-size: 2.8vmin; }
      .play-button { width: 6vmin; height: 6vmin; }
    }
  `;

  @state()
  private currentlyPlaying: string | null = null; // Store audioUrl of playing track

  private audio: HTMLAudioElement;

  constructor() {
    super();
    this.audio = new Audio();
    this.audio.addEventListener('ended', () => {
      this.currentlyPlaying = null;
    });
    this.audio.addEventListener('pause', () => {
      // Don't clear state if pause was triggered by track ending
      if (this.audio.currentTime < this.audio.duration) {
        this.currentlyPlaying = null;
      }
    });
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.audio.pause(); // Stop audio when component is removed
  }

  private handlePlayToggle(audioUrl: string) {
    if (this.currentlyPlaying === audioUrl) {
      // This track is playing, so pause it
      this.audio.pause();
    } else {
      // Another (or no) track is playing, so play this one
      this.audio.src = audioUrl;
      this.audio.play().catch(e => console.error("Audio playback failed:", e));
      this.currentlyPlaying = audioUrl;
    }
  }

  private renderPlayIcon() {
    return svg`<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
  }

  private renderPauseIcon() {
    return svg`<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
  }

  private renderCard(example: typeof EXAMPLES[0]) {
    const isPlaying = this.currentlyPlaying === example.audioUrl;
    const cardClasses = classMap({
      card: true,
      playing: isPlaying,
    });
    return html`
      <div class=${cardClasses}>
        <img class="art" src=${example.imageUrl} alt=${`Art for ${example.title}`}>
        <div class="info">
          <h3>${example.title}</h3>
          <p>${example.artist}</p>
          <button class="play-button" @click=${() => this.handlePlayToggle(example.audioUrl)} title=${isPlaying ? 'Pause' : 'Play'}>
            ${isPlaying ? this.renderPauseIcon() : this.renderPlayIcon()}
          </button>
        </div>
      </div>
    `;
  }
  
  override render() {
    return html`
      <div class="examples-container">
        <h2>Inspiration Station</h2>
        <p>Explore some pre-made grooves to spark your creativity.</p>
        <div class="slider">
          ${EXAMPLES.map(example => this.renderCard(example))}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'music-examples': MusicExamples;
  }
}
