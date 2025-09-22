/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

/** A modal for displaying prompt suggestions. */
@customElement('suggestion-modal')
// FIX: Extended LitElement to define a proper web component.
export class SuggestionModal extends LitElement {
  static override styles = css`
    :host {
      --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
    }
    .overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      opacity: 0;
      animation: fadeIn 0.3s var(--ease-out-quart) forwards;
    }
    @keyframes fadeIn {
      to { opacity: 1; }
    }
    .modal {
      background: linear-gradient(145deg, #3a3a3a, #202020);
      border-radius: 1.5vmin;
      padding: 3vmin;
      width: min(500px, 90vw);
      max-height: 80vh;
      overflow-y: auto;
      border: 1px solid #444;
      box-shadow: 0 1vmin 4vmin rgba(0,0,0,0.5);
      color: #fff;
      transform: scale(0.95);
      opacity: 0;
      animation: fadeIn 0.4s 0.1s var(--ease-out-quart) forwards,
                 scaleUp 0.4s 0.1s var(--ease-out-quart) forwards;
    }
    @keyframes scaleUp {
      to { transform: scale(1); opacity: 1; }
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2vmin;
    }
    h2 {
      font-size: 2.5vmin;
      margin: 0;
      font-weight: 600;
    }
    .close-button {
      background: none;
      border: none;
      color: #aaa;
      font-size: 3vmin;
      cursor: pointer;
      line-height: 1;
      padding: 0.5vmin;
      transition: color 0.2s;
    }
    .close-button:hover {
      color: #fff;
    }
    .suggestions-list {
      display: flex;
      flex-direction: column;
      gap: 1.5vmin;
    }
    .suggestion {
      background: linear-gradient(145deg, #2e2e2e, #1a1a1a);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 1vmin;
      padding: 1.5vmin 2vmin;
      font-size: 1.8vmin;
      cursor: pointer;
      text-align: left;
      color: #eee;
      width: 100%;
      transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
    }
    .suggestion:hover {
      background: linear-gradient(145deg, #383838, #222222);
      transform: translateY(-2px);
      box-shadow: 0 0.5vmin 1.5vmin rgba(0,0,0,0.3);
    }
  `;

  @property({ type: Array }) suggestions: string[] = [];

  private close() {
    this.dispatchEvent(new CustomEvent('close-modal'));
  }

  private selectSuggestion(suggestion: string) {
    this.dispatchEvent(new CustomEvent('suggestion-selected', { detail: suggestion }));
  }

  override render() {
    return html`
      <div class="overlay" @click=${this.close}>
        <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
          <div class="header">
            <h2>Prompt Ideas</h2>
            <button class="close-button" @click=${this.close} title="Close">×</button>
          </div>
          <div class="suggestions-list">
            ${this.suggestions.map(s => html`
              <button class="suggestion" @click=${() => this.selectSuggestion(s)}>
                ${s}
              </button>
            `)}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'suggestion-modal': SuggestionModal;
  }
}
