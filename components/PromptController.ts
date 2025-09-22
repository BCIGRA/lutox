/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import './WeightKnob';
import type { WeightKnob } from './WeightKnob';

import type { MidiDispatcher } from '../utils/MidiDispatcher';
import type { Prompt, ControlChange } from '../types';

/** A single prompt input associated with a MIDI CC. */
@customElement('prompt-controller')
// FIX: Extended LitElement to define a proper web component.
export class PromptController extends LitElement {
  static override styles = css`
    .prompt {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    weight-knob {
      width: 70%;
      flex-shrink: 0;
    }
    #midi {
      font-family: monospace;
      text-align: center;
      font-size: clamp(10px, 1.5vmin, 12px);
      border: 1px solid #fff;
      border-radius: 4px;
      padding: 2px 5px;
      color: #fff;
      background: #0006;
      cursor: pointer;
      visibility: hidden;
      user-select: none;
      margin-top: clamp(0.25rem, 0.75vmin, 0.5rem);
      .learn-mode & {
        color: orange;
        border-color: orange;
      }
      .show-cc & {
        visibility: visible;
      }
    }
    #text {
      font-weight: 500;
      font-size: clamp(12px, 1.8vmin, 16px);
      width: 100%;
      max-width: 180px;
      padding: 0.5em 0.7em;
      margin-top: clamp(0.25rem, 0.75vmin, 0.5rem);
      flex-shrink: 0;
      border-radius: clamp(1.5rem, 5vmin, 2.5rem);
      text-align: center;
      white-space: pre;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.15);
      outline: none;
      -webkit-font-smoothing: antialiased;
      background: linear-gradient(145deg, #333, #1a1a1a);
      color: #fff;
      box-shadow: inset 1px 1px 2px rgba(255, 255, 255, 0.1),
        inset -1px -1px 2px rgba(0, 0, 0, 0.6),
        3px 3px 8px rgba(0, 0, 0, 0.4);
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
      transition: all 0.2s ease-in-out;
      cursor: text;

      &:not(:focus) {
        text-overflow: ellipsis;
      }

      &:focus {
        border-color: var(--prompt-color);
        box-shadow: inset 2px 2px 4px rgba(0, 0, 0, 0.6),
          inset -1px -1px 2px rgba(255, 255, 255, 0.1),
          0 0 10px -2px var(--prompt-color), 3px 3px 8px rgba(0, 0, 0, 0.4);
      }
    }
    :host([filtered]) {
      weight-knob {
        opacity: 0.5;
      }
      #text {
        background: linear-gradient(145deg, #8b1400, #5c0e00);
        box-shadow: inset 1px 1px 2px rgba(255, 100, 100, 0.2),
          inset -1px -1px 2px rgba(0, 0, 0, 0.6),
          3px 3px 8px rgba(0, 0, 0, 0.4);
        border-color: rgba(255, 100, 100, 0.3);
        color: #ffc0c0;
        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
      }
    }
  `;

  @property({ type: String }) promptId = '';
  @property({ type: String }) text = '';
  @property({ type: Number }) weight = 0;
  @property({ type: String }) color = '';
  @property({ type: Boolean, reflect: true }) filtered = false;

  @property({ type: Number }) cc = 0;
  @property({ type: Number }) channel = 0; // Not currently used

  @property({ type: Boolean }) isInLearnMode = false;
  @property({ type: Boolean }) showCC = false;

  @query('weight-knob') private weightInput!: WeightKnob;
  @query('#text') private textInput!: HTMLInputElement;

  @property({ type: Object })
  midiDispatcher: MidiDispatcher | null = null;

  @property({ type: Number }) audioLevel = 0;

  private lastValidText!: string;

  override connectedCallback() {
    super.connectedCallback();
    this.midiDispatcher?.addEventListener('cc-message', (e: Event) => {
      const customEvent = e as CustomEvent<ControlChange>;
      const { channel, cc, value } = customEvent.detail;
      if (this.isInLearnMode) {
        this.cc = cc;
        this.channel = channel;
        this.dispatchPromptChange();
      } else if (cc === this.cc) {
        this.weight = (value / 127) * 2;
        this.dispatchPromptChange();
      }
    });
  }

  override firstUpdated() {
    // contenteditable is applied to textInput so we can "shrink-wrap" to text width
    // It's set here and not render() because Lit doesn't believe it's a valid attribute.
    this.textInput.setAttribute('contenteditable', 'plaintext-only');

    // contenteditable will do weird things if this is part of the template.
    this.textInput.textContent = this.text;
    this.lastValidText = this.text;
  }

  override update(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('text') && this.textInput) {
      this.textInput.textContent = this.text;
    }
    super.update(changedProperties);
  }

  private dispatchPromptChange() {
    this.dispatchEvent(
      new CustomEvent<Prompt>('prompt-changed', {
        detail: {
          promptId: this.promptId,
          text: this.text,
          weight: this.weight,
          cc: this.cc,
          color: this.color,
        },
      }),
    );
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.textInput.blur();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      this.resetText();
      this.textInput.blur();
    }
  }

  private resetText() {
    this.text = this.lastValidText;
    this.textInput.textContent = this.lastValidText;
  }

  private async updateText() {
    const newText = this.textInput.textContent?.trim();
    if (!newText) {
      this.resetText();
    } else {
      this.text = newText;
      this.lastValidText = newText;
    }
    this.dispatchPromptChange();
    // Show the prompt from the beginning if it's cropped
    this.textInput.scrollLeft = 0;
  }

  private onFocus() {
    // .select() for contenteditable doesn't work.
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(this.textInput);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  private updateWeight() {
    this.weight = this.weightInput.value;
    this.dispatchPromptChange();
  }

  private requestLearnMode() {
    this.dispatchEvent(
      new CustomEvent('request-learn-mode', {
        detail: { promptId: this.promptId },
      }),
    );
  }

  override render() {
    const classes = classMap({
      'prompt': true,
      'learn-mode': this.isInLearnMode,
      'show-cc': this.showCC,
    });
    const styles = styleMap({
      '--prompt-color': this.color,
    });
    return html`<div class=${classes} style=${styles}>
      <weight-knob
        id="weight"
        value=${this.weight}
        color=${this.filtered ? '#888' : this.color}
        audioLevel=${this.filtered ? 0 : this.audioLevel}
        @input=${this.updateWeight}></weight-knob>
      <span
        id="text"
        spellcheck="false"
        @focus=${this.onFocus}
        @keydown=${this.onKeyDown}
        @blur=${this.updateText}></span>
      <div id="midi" @click=${this.requestLearnMode}>
        ${this.isInLearnMode ? 'Learn' : `CC:${this.cc}`}
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'prompt-controller': PromptController;
  }
}
