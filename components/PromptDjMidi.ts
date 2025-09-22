/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement, svg } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

import { throttle } from '../utils/throttle';

import './PromptController';
import './PlayPauseButton';
import './MusicExamples';
import './AudioVisualizer';
import './FxKnob';
import './SuggestionModal';
import './ActionModal';
import type { FxKnob } from './FxKnob';
import type { PlaybackState, Prompt } from '../types';
import { MidiDispatcher } from '../utils/MidiDispatcher';

/** The grid of prompt inputs. */
@customElement('prompt-dj-midi')
// FIX: Extended LitElement to define a proper web component.
export class PromptDjMidi extends LitElement {
  static override styles = css`
    :host {
      display: block;
      position: relative;
    }
    #app-header {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      z-index: 10;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: clamp(1rem, 2vmin, 1.5rem) clamp(1.5rem, 4vmin, 3rem);
      box-sizing: border-box;
      background-color: rgba(17, 17, 17, 0.7);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      transition: background-color 0.3s ease;
    }
    #app-header:hover {
      background-color: rgba(17, 17, 17, 0.85);
    }
    .logo {
      font-size: clamp(1.25rem, 2.5vmin, 1.75rem);
      font-weight: 600;
      color: #fff;
      text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.5);
    }
    nav a {
      color: #ddd;
      text-decoration: none;
      font-size: clamp(0.9rem, 1.8vmin, 1.1rem);
      margin-left: clamp(1rem, 3vmin, 2rem);
      font-weight: 500;
      transition: color 0.2s ease;
    }
    nav a:hover {
      color: #fff;
    }
    #background {
      will-change: background-image;
      position: fixed;
      height: 100%;
      width: 100%;
      top: 0;
      left: 0;
      z-index: -1;
      background: #111;
    }
    .page-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: clamp(4rem, 10vmin, 8rem) clamp(1rem, 4vmin, 2rem);
      box-sizing: border-box;
      position: relative;
    }
    .hero-section {
      min-height: 100vh;
    }
    #hero {
      text-align: center;
      color: #fff;
      text-shadow: 2px 2px 8px rgba(0, 0, 0, 0.5);
    }
    #hero h2 {
      font-size: clamp(2.5rem, 6vmin, 4.5rem);
      font-weight: 700;
      margin: 0 0 clamp(0.5rem, 2vmin, 1rem) 0;
      letter-spacing: -0.02em;
    }
    #hero p {
      font-size: clamp(1rem, 2vmin, 1.25rem);
      max-width: 60ch;
      margin: clamp(0.5rem, 2vmin, 1rem) auto 0;
      opacity: 0.8;
      line-height: 1.6;
    }
    #hero p:last-of-type {
        margin-bottom: clamp(1.5rem, 4vmin, 2.5rem);
    }
    #contract-section {
      display: flex;
      flex-direction: column;
      gap: clamp(0.75rem, 1.5vmin, 1rem);
      max-width: 500px;
      margin: 0 auto;
      padding: clamp(1rem, 2vmin, 1.25rem);
      background: rgba(0,0,0,0.25);
      border-radius: clamp(0.75rem, 1.5vmin, 1rem);
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(5px);
    }
    .contract-row {
      display: flex;
      align-items: center;
      gap: clamp(0.75rem, 1.5vmin, 1rem);
      background: rgba(0,0,0,0.2);
      padding: clamp(0.5rem, 1vmin, 0.75rem) clamp(0.75rem, 1.5vmin, 1rem);
      border-radius: clamp(0.5rem, 1vmin, 0.75rem);
    }
    .network-name {
      font-weight: 600;
      font-size: clamp(0.9rem, 1.8vmin, 1.1rem);
      padding: 0.25em 0.75em;
      border-radius: 5px;
      color: #fff;
    }
    .network-name.solana {
        background: linear-gradient(45deg, #9945FF, #14F195);
    }
    .network-name.bsc {
        background: #F0B90B;
        color: #1E1E1E;
    }
    .address {
      font-family: monospace;
      font-size: clamp(0.9rem, 1.8vmin, 1.1rem);
      color: #ccc;
      flex-grow: 1;
      text-align: left;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .copy-button {
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      color: #fff;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 5px;
      padding: 0.5em 1em;
      font-size: clamp(0.8rem, 1.6vmin, 1rem);
      transition: all 0.2s ease-in-out;
      flex-shrink: 0;
    }
    .copy-button:hover {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.4);
    }
    .copy-button.copied {
        background: #3dffab;
        border-color: #3dffab;
        color: #111;
        cursor: default;
    }
    .app-container {
      width: 95%;
      max-width: 1100px;
      margin: 0 auto;
      padding: clamp(1.5rem, 4vmin, 2.5rem);
      background: linear-gradient(145deg, #2e2e2e, #1a1a1a);
      border-radius: clamp(1rem, 2vmin, 1.5rem);
      border: 1px solid #111;
      box-shadow: inset 0.5vmin 0.5vmin 1vmin #111,
                  inset -0.5vmin -0.5vmin 1vmin #444,
                  0 1vmin 3vmin rgba(0,0,0,0.5);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }
    #main-content {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    #grid {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: clamp(1rem, 2.5vmin, 2rem);
    }
    prompt-controller {
      width: 100%;
    }
    play-pause-button {
      position: relative;
      width: clamp(70px, 10vmin, 100px);
      aspect-ratio: 1;
    }
    #record-button {
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      color: #fff;
      background: rgba(255, 255, 255, 0.1);
      -webkit-font-smoothing: antialiased;
      border: 1.5px solid #fff8;
      border-radius: 50px;
      user-select: none;
      padding: clamp(0.75rem, 1.5vmin, 1rem) clamp(1.5rem, 3vmin, 2rem);
      font-size: clamp(0.9rem, 1.6vmin, 1rem);
      display: flex;
      align-items: center;
      gap: clamp(0.5rem, 1.5vmin, 1rem);
      transition: all 0.2s ease-in-out;
    }
    #record-button:hover {
      background: rgba(255, 255, 255, 0.2);
      border-color: #fff;
    }
    #record-button .icon {
      width: clamp(14px, 2vmin, 18px);
      height: clamp(14px, 2vmin, 18px);
      background-color: #ff4545;
      border-radius: 50%;
      transition: all 0.2s ease-in-out;
    }
    #record-button.recording .icon {
      border-radius: 4px;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0% {
        transform: scale(1);
        opacity: 1;
      }
      50% {
        transform: scale(1.1);
        opacity: 0.7;
      }
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }
    #midi-tools {
      display: flex;
      gap: clamp(0.75rem, 2vmin, 1.25rem);
      margin-bottom: clamp(1.5rem, 3vmin, 2.5rem);
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
    }
    #effects-panel, #preset-controls {
      display: flex;
      gap: clamp(0.5rem, 1.5vmin, 1rem);
      align-items: center;
      padding: clamp(0.5rem, 1vmin, 0.75rem) clamp(1rem, 2vmin, 1.25rem);
      background: rgba(0,0,0,0.2);
      border-radius: clamp(0.75rem, 1.5vmin, 1rem);
      border: 1px solid rgba(0,0,0,0.4);
    }
    .separator {
      width: 1px;
      align-self: stretch;
      background-color: #0005;
      margin: 0.5vmin 1.5vmin;
      border-right: 1px solid #fff2;
    }
    fx-knob {
      width: clamp(50px, 7vmin, 70px);
      height: clamp(50px, 7vmin, 70px);
    }
    audio-visualizer {
      width: 100%;
      height: clamp(50px, 8vmin, 80px);
      margin-bottom: clamp(1.5rem, 3vmin, 2.5rem);
    }
    button {
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      color: #fff;
      background: #0002;
      -webkit-font-smoothing: antialiased;
      border: 1.5px solid #fff8;
      border-radius: 4px;
      user-select: none;
      padding: clamp(0.4rem, 0.8vmin, 0.6rem) clamp(0.8rem, 1.5vmin, 1.1rem);
      font-size: clamp(0.85rem, 1.6vmin, 1rem);
      transition: background 0.2s, border-color 0.2s;
      &:hover:not(:disabled) {
        background: #fff2;
        border-color: #fff;
      }
      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      &.active {
        background-color: #fff;
        color: #000;
        border-color: #fff;
      }
    }
    .control-button {
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 0;
      width: clamp(36px, 4.5vmin, 48px);
      height: clamp(36px, 4.5vmin, 48px);
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background-color 0.2s;
    }
    .control-button:hover:not(:disabled) {
      background-color: rgba(255, 255, 255, 0.1);
    }
    .control-button svg {
      width: 60%;
      height: 60%;
      fill: #fff;
    }
    .control-button:disabled {
      cursor: not-allowed;
    }
    .control-button:disabled svg {
      fill: #666;
    }
    .loader {
      stroke: #ffffff;
      stroke-width: 3;
      stroke-linecap: round;
      animation: spin linear 1s infinite;
      transform-origin: center;
      transform-box: fill-box;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(359deg); }
    }
    select {
      font: inherit;
      padding: clamp(0.4rem, 0.8vmin, 0.6rem) clamp(0.8rem, 1.5vmin, 1.1rem);
      font-size: clamp(0.85rem, 1.6vmin, 1rem);
      background: #0002;
      color: #fff;
      border-radius: 4px;
      border: 1.5px solid #fff8;
      outline: none;
      cursor: pointer;
      -webkit-font-smoothing: antialiased;
      transition: background 0.2s, border-color 0.2s;
    }
    select:hover {
      background: #fff2;
      border-color: #fff;
    }
    .footer-section {
      background-color: #1a1a1a;
      color: #fff;
      text-shadow: 1px 1px 4px rgba(0, 0, 0, 0.5);
    }
    #community h2 {
      font-size: clamp(1.5rem, 3vmin, 2.25rem);
      margin: 0 0 clamp(0.25rem, 1vmin, 0.75rem);
      font-weight: 600;
    }
    #community p {
      font-size: clamp(1rem, 1.8vmin, 1.1rem);
      opacity: 0.8;
      margin: 0 0 clamp(0.5rem, 2vmin, 1.5rem);
    }
    #community a {
      color: #fff;
      background-color: #111; /* Black for X */
      border: 1px solid #888;
      padding: clamp(0.6rem, 1vmin, 0.8rem) clamp(1.2rem, 2vmin, 1.5rem);
      border-radius: clamp(1rem, 3vmin, 1.5rem);
      text-decoration: none;
      font-weight: 600;
      font-size: clamp(1rem, 2vmin, 1.25rem);
      transition: all 0.2s ease-in-out;
    }
    #community a:hover {
      background-color: #fff;
      color: #111;
      border-color: #fff;
    }

    #app-footer {
      background-color: #0a0a0a;
      padding: clamp(1.5rem, 3vmin, 2rem) clamp(1rem, 4vmin, 2rem);
      border-top: 1px solid #222;
    }
    .footer-content {
      max-width: 1200px;
      margin: 0 auto;
      text-align: center;
      color: #888;
      font-size: clamp(0.8rem, 1.6vmin, 1rem);
    }
    .footer-content p {
      margin: clamp(0.1rem, 0.5vmin, 0.25rem) 0;
    }
    .footer-content a {
      color: #eee;
      text-decoration: none;
      font-weight: 500;
    }
    .footer-content a:hover {
      text-decoration: underline;
    }
    .copyright {
      font-size: clamp(0.7rem, 1.4vmin, 0.9rem);
      opacity: 0.7;
    }

    @media (max-width: 768px) {
      .app-container {
        width: 100%;
        padding: 1rem;
      }
      #grid {
        grid-template-columns: repeat(2, 1fr);
      }
      #midi-tools {
        flex-direction: column;
        gap: 1rem;
      }
      #effects-panel, #preset-controls {
        flex-wrap: wrap;
        justify-content: center;
      }
      nav a {
        margin-left: 1rem;
      }
    }
  `;

  @property({ attribute: false }) prompts: Map<string, Prompt> = new Map();
  private midiDispatcher: MidiDispatcher;

  @property({ type: Boolean }) private showMidi = false;
  @property({ type: String }) public playbackState: PlaybackState = 'stopped';
  @property({ type: Boolean }) public isRecording = false;
  @property({ type: Boolean }) public isGeneratingSuggestions = false;
  @property({ type: Boolean }) canUndo = false;
  @property({ type: Boolean }) canRedo = false;
  @state() public audioLevel = 0;
  @property({ attribute: false }) frequencyData: Uint8Array | null = null;
  @state() private midiInputIds: string[] = [];
  @state() private activeMidiInputId: string | null = null;
  @state() private promptIdInLearnMode: string | null = null;
  @state() public suggestions: string[] = [];
  @property({ type: Array }) presets: string[] = [];
  @property({ type: String }) selectedPreset = '';
  @state() private modal: { type: 'save' | 'delete' | 'none'; data?: any } = { type: 'none' };
  @state() private copiedContract: 'solana' | 'bsc' | null = null;


  @property({ type: Object })
  private filteredPrompts = new Set<string>();

  constructor() {
    super();
    this.midiDispatcher = new MidiDispatcher();
  }

  private handlePromptChanged(e: CustomEvent<Prompt>) {
    const newPrompt = e.detail;
    // If the prompt that changed was in learn mode, exit learn mode.
    if (this.promptIdInLearnMode === newPrompt.promptId) {
      this.promptIdInLearnMode = null;
    }

    const newPrompts = new Map(this.prompts);
    newPrompts.set(newPrompt.promptId, newPrompt);

    this.dispatchEvent(
      new CustomEvent('prompts-changed', { detail: newPrompts }),
    );
  }

  private handleRequestLearnMode(e: CustomEvent<{ promptId: string }>) {
    const { promptId } = e.detail;
    if (this.promptIdInLearnMode === promptId) {
      this.promptIdInLearnMode = null; // Toggle off
    } else {
      this.promptIdInLearnMode = promptId; // Toggle on for this one
    }
  }

  /** Generates radial gradients for each prompt based on weight and color. */
  private readonly makeBackground = throttle(() => {
    const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

    const MAX_WEIGHT = 0.5;
    const MAX_ALPHA = 0.6;

    const bg: string[] = [];

    [...this.prompts.values()].forEach((p, i) => {
      const alphaPct = clamp01(p.weight / MAX_WEIGHT) * MAX_ALPHA;
      const alpha = Math.round(alphaPct * 0xff)
        .toString(16)
        .padStart(2, '0');

      const stop = p.weight / 2;
      const x = (i % 4) / 3;
      const y = Math.floor(i / 4) / 4;
      const s = `radial-gradient(circle at ${x * 100}% ${
        y * 100
      }%, ${p.color}${alpha} 0px, ${p.color}00 ${stop * 100}%)`;

      bg.push(s);
    });

    return bg.join(', ');
  }, 30); // don't re-render more than once every XXms

  private toggleShowMidi() {
    return this.setShowMidi(!this.showMidi);
  }

  public async setShowMidi(show: boolean) {
    this.showMidi = show;
    if (!this.showMidi) {
      this.promptIdInLearnMode = null;
      return;
    }
    try {
      const inputIds = await this.midiDispatcher.getMidiAccess();
      this.midiInputIds = inputIds;
      this.activeMidiInputId = this.midiDispatcher.activeMidiInputId;
    } catch (e: any) {
      this.showMidi = false;
      this.dispatchEvent(new CustomEvent('error', { detail: e.message }));
    }
  }

  private handleMidiInputChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    const newMidiId = selectElement.value;
    this.activeMidiInputId = newMidiId;
    this.midiDispatcher.activeMidiInputId = newMidiId;
  }

  private playPause() {
    this.dispatchEvent(new CustomEvent('play-pause'));
  }

  private toggleRecording() {
    this.dispatchEvent(
      new CustomEvent('record-toggle', { detail: !this.isRecording }),
    );
  }

  private undo() {
    this.dispatchEvent(new CustomEvent('undo-requested'));
  }
  
  private redo() {
    this.dispatchEvent(new CustomEvent('redo-requested'));
  }

  private handleFxChange(effect: string, e: CustomEvent) {
    const value = (e.target as FxKnob).value;
    this.dispatchEvent(new CustomEvent(`${effect}-changed`, { detail: value }));
  }

  private handleMasterVolumeChange(e: CustomEvent) {
    const value = (e.target as FxKnob).value;
    this.dispatchEvent(new CustomEvent('master-volume-changed', { detail: value }));
  }

  private requestSuggestions() {
    this.dispatchEvent(new CustomEvent('request-suggestions'));
  }

  private handleSuggestionSelected(e: CustomEvent<string>) {
    this.dispatchEvent(new CustomEvent('suggestion-selected', { detail: e.detail }));
    this.suggestions = []; // Close the modal
  }

  private closeSuggestionModal() {
    this.suggestions = [];
  }

  public addFilteredPrompt(prompt: string) {
    this.filteredPrompts = new Set([...this.filteredPrompts, prompt]);
  }

  private handlePresetSelect(e: Event) {
    const select = e.target as HTMLSelectElement;
    this.selectedPreset = select.value;
    if (this.selectedPreset) {
      this.dispatchEvent(new CustomEvent('load-preset-requested', { detail: this.selectedPreset }));
    }
  }

  private savePreset() {
    this.modal = { type: 'save' };
  }

  private deletePreset() {
    if (this.selectedPreset) {
      this.modal = { type: 'delete', data: { name: this.selectedPreset } };
    }
  }

  private handleModalConfirm(e: CustomEvent) {
    if (this.modal.type === 'save') {
      const presetName = e.detail;
      if (presetName) {
        this.dispatchEvent(new CustomEvent('save-preset-requested', { detail: presetName }));
      }
    } else if (this.modal.type === 'delete') {
      this.dispatchEvent(new CustomEvent('delete-preset-requested', { detail: this.modal.data.name }));
      this.selectedPreset = ''; // Reset selection
    }
    this.modal = { type: 'none' }; // Close modal
  }
  
  private handleModalCancel() {
    this.modal = { type: 'none' }; // Close modal
  }

  private handleCopyContract(network: 'solana' | 'bsc') {
    const addresses = {
        solana: '7i5qj3J8tJ2tL3d9gH5kL3m9nB2v8sK9t4jF2r8hN9', // Placeholder
        bsc: '0x1234567890abcdef1234567890abcdef12345678', // Placeholder
    };
    const address = addresses[network];
    navigator.clipboard.writeText(address).then(() => {
        this.copiedContract = network;
        setTimeout(() => {
            this.copiedContract = null;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy contract address: ', err);
        this.dispatchEvent(new CustomEvent('error', { detail: 'Failed to copy address.' }));
    });
  }

  private renderSuggestButtonContent() {
    if (this.isGeneratingSuggestions) {
      return svg`<svg viewBox="0 0 50 50"><path class="loader" d="M25,4.2C13.5,4.2,4.2,13.5,4.2,25C4.2,36.5,13.5,45.8,25,45.8C36.5,45.8,45.8,36.5,45.8,25" fill="none" stroke-width="4"></path></svg>`;
    }
    return svg`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2.5a.75.75 0 0 1 .65.375l2.75 4.5 5 .75a.75.75 0 0 1 .417 1.282l-3.625 3.53.856 4.982a.75.75 0 0 1-1.088.79L12 16.25l-4.46 2.345a.75.75 0 0 1-1.088-.79l.856-4.982-3.625-3.53a.75.75 0 0 1 .417-1.282l5-.75 2.75-4.5A.75.75 0 0 1 12 2.5Z"/></svg>`;
  }

  private renderModal() {
    if (this.modal.type === 'none') {
        return html``;
    }
    if (this.modal.type === 'save') {
        return html`<action-modal
            modalTitle="Save Preset"
            inputType="text"
            confirmText="Save"
            @confirm=${this.handleModalConfirm}
            @cancel=${this.handleModalCancel}
        ></action-modal>`;
    }
    if (this.modal.type === 'delete') {
        return html`<action-modal
            modalTitle="Delete Preset"
            message="Are you sure you want to delete the preset '${this.modal.data.name}'?"
            confirmText="Delete"
            @confirm=${this.handleModalConfirm}
            @cancel=${this.handleModalCancel}
        ></action-modal>`;
    }
    return html``;
  }

  override render() {
    const bg = styleMap({
      backgroundImage: this.makeBackground(),
    });
    return html`
      ${this.renderModal()}
      ${this.suggestions.length > 0 ? html`
        <suggestion-modal 
          .suggestions=${this.suggestions}
          @suggestion-selected=${this.handleSuggestionSelected}
          @close-modal=${this.closeSuggestionModal}
        ></suggestion-modal>
      ` : ''}

      <header id="app-header">
        <span class="logo">Lutox Oscillia</span>
        <nav>
          <a href="#the-app">The App</a>
          <a href="#community">Community</a>
        </nav>
      </header>

      <div id="background" style=${bg}></div>

      <section class="page-section hero-section">
        <div id="hero">
          <h2>Lutox Oscillia</h2>
          <p>
            Generate unique MIDI compositions with AI and bring them on-chain.
            Mint your creations on the Solana and BSC networks.
          </p>
          <p>
            You are the composer of the decentralized future. Your prompts are
            the genesis blocks of new melodies, minted forever on the
            blockchain. Every knob turn is a transaction, crafting a permanent,
            ownable piece of musical art. This is your studio, your mint, your
            legacy.
          </p>
          <div id="contract-section">
            <div class="contract-row">
                <span class="network-name solana">Solana</span>
                <span class="address">7i5q...8hN9</span>
                <button
                    class="copy-button ${this.copiedContract === 'solana' ? 'copied' : ''}"
                    @click=${() => this.handleCopyContract('solana')}>
                    ${this.copiedContract === 'solana' ? 'Copied!' : 'Copy'}
                </button>
            </div>
            <div class="contract-row">
                <span class="network-name bsc">BSC</span>
                <span class="address">0x1234...5678</span>
                <button
                    class="copy-button ${this.copiedContract === 'bsc' ? 'copied' : ''}"
                    @click=${() => this.handleCopyContract('bsc')}>
                    ${this.copiedContract === 'bsc' ? 'Copied!' : 'Copy'}
                </button>
            </div>
          </div>
        </div>
      </section>

      <section id="the-app" class="page-section app-section">
        <div class="app-container">
          <main id="main-content">
            <div id="midi-tools">
              <button
                @click=${this.toggleShowMidi}
                class=${this.showMidi ? 'active' : ''}
                >MIDI</button
              >
              <select
                @change=${this.handleMidiInputChange}
                .value=${this.activeMidiInputId || ''}
                style=${this.showMidi ? '' : 'display: none'}>
                ${
                  this.midiInputIds.length > 0
                    ? this.midiInputIds.map(
                        (id) =>
                          html`<option value=${id}>
                            ${this.midiDispatcher.getDeviceName(id)}
                          </option>`,
                      )
                    : html`<option value="">No devices found</option>`
                }
              </select>
              <div id="preset-controls">
                <select id="preset-select" .value=${this.selectedPreset} @change=${this.handlePresetSelect}>
                  <option value="">Load Preset...</option>
                  ${this.presets.map(name => html`<option value=${name}>${name}</option>`)}
                </select>
                <button @click=${this.savePreset}>Save</button>
                <button @click=${this.deletePreset} ?disabled=${!this.selectedPreset}>Delete</button>
              </div>
              <play-pause-button
                .playbackState=${this.playbackState}
                @click=${this.playPause}></play-pause-button>
              <button 
                class="control-button" 
                @click=${this.undo} 
                ?disabled=${!this.canUndo}
                title="Undo">
                ${svg`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12.5 8C9.85 8 7.45 8.99 5.6 10.6L2 7V16H11L7.38 12.38C8.77 11.22 10.54 10.5 12.5 10.5C16.04 10.5 19.05 12.81 20.1 16L22.47 15.22C21.08 11.03 17.15 8 12.5 8Z"/></svg>`}
              </button>
              <button 
                class="control-button" 
                @click=${this.redo} 
                ?disabled=${!this.canRedo}
                title="Redo">
                ${svg`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8C6.85 8 2.92 11.03 1.53 15.22L3.9 16C4.95 12.81 7.96 10.5 11.5 10.5C13.46 10.5 15.23 11.22 16.62 12.38L13 16H22V7L18.4 10.6Z"/></svg>`}
              </button>
              <button 
                class="control-button" 
                @click=${this.requestSuggestions} 
                ?disabled=${this.isGeneratingSuggestions}
                title="Suggest Prompts">
                ${this.renderSuggestButtonContent()}
              </button>
               <div id="effects-panel">
                <fx-knob label="Distort" @input=${(e: CustomEvent) => this.handleFxChange('distortion', e)}></fx-knob>
                <fx-knob label="Delay" @input=${(e: CustomEvent) => this.handleFxChange('delay', e)}></fx-knob>
                <fx-knob label="Reverb" @input=${(e: CustomEvent) => this.handleFxChange('reverb', e)}></fx-knob>
                <div class="separator"></div>
                <fx-knob label="Volume" .value=${1} @input=${this.handleMasterVolumeChange}></fx-knob>
              </div>
              <button
                id="record-button"
                @click=${this.toggleRecording}
                class=${this.isRecording ? 'recording' : ''}>
                <div class="icon"></div>
                <span>
                  ${this.isRecording ? 'Stop & Download' : 'Record'}
                </span>
              </button>
            </div>
            <audio-visualizer .frequencyData=${this.frequencyData}></audio-visualizer>
            <div id="grid">${this.renderPrompts()}</div>
          </main>
        </div>
      </section>

      <section class="page-section examples-section">
        <music-examples></music-examples>
      </section>

      <section class="page-section footer-section">
        <footer id="community">
          <h2>Join the Community</h2>
          <p>Share your on-chain creations and connect with other Web3 musicians.</p>
          <a href="https://x.com/LutoxOscillia" target="_blank" rel="noopener">
            Follow us on X
          </a>
        </footer>
      </section>

      <footer id="app-footer">
        <div class="footer-content">
          <p>Powered by the <a href="https://ai.google.dev/docs/gemini_api_overview" target="_blank" rel="noopener">Gemini API</a> on Solana & BSC</p>
          <p class="copyright">© ${new Date().getFullYear()} Lutox Oscillia. All Rights Reserved.</p>
        </div>
      </footer>
    `;
  }

  private renderPrompts() {
    return [...this.prompts.values()].map((prompt) => {
      return html`<prompt-controller
        promptId=${prompt.promptId}
        ?filtered=${this.filteredPrompts.has(prompt.text)}
        cc=${prompt.cc}
        text=${prompt.text}
        weight=${prompt.weight}
        color=${prompt.color}
        .midiDispatcher=${this.midiDispatcher}
        .showCC=${this.showMidi}
        ?isInLearnMode=${this.promptIdInLearnMode === prompt.promptId}
        audioLevel=${this.audioLevel}
        @prompt-changed=${this.handlePromptChanged}
        @request-learn-mode=${this.handleRequestLearnMode}>
      </prompt-controller>`;
    });
  }
}