/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

@customElement('action-modal')
// FIX: Extended LitElement to define a proper web component.
export class ActionModal extends LitElement {
  static override styles = css`
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
      animation: fadeIn 0.3s cubic-bezier(0.25, 1, 0.5, 1) forwards;
    }
    @keyframes fadeIn {
      to { opacity: 1; }
    }
    .modal {
      background: linear-gradient(145deg, #3a3a3a, #202020);
      border-radius: 1.5vmin;
      padding: 3vmin;
      width: min(450px, 90vw);
      border: 1px solid #444;
      box-shadow: 0 1vmin 4vmin rgba(0,0,0,0.5);
      color: #fff;
      transform: scale(0.95);
      opacity: 0;
      animation: fadeIn 0.4s 0.1s cubic-bezier(0.25, 1, 0.5, 1) forwards,
                 scaleUp 0.4s 0.1s cubic-bezier(0.25, 1, 0.5, 1) forwards;
    }
    @keyframes scaleUp {
      to { transform: scale(1); opacity: 1; }
    }
    h2 {
      font-size: 2.5vmin;
      margin: 0 0 2vmin 0;
      font-weight: 600;
      text-align: center;
    }
    .message {
      font-size: 1.8vmin;
      opacity: 0.9;
      margin-bottom: 3vmin;
      text-align: center;
      line-height: 1.6;
    }
    .input-field {
      width: 100%;
      padding: 1.5vmin;
      font-size: 1.8vmin;
      border-radius: 1vmin;
      border: 1px solid #555;
      background-color: #1a1a1a;
      color: #fff;
      margin-bottom: 3vmin;
      box-sizing: border-box;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 1.5vmin;
    }
    button {
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      color: #fff;
      background: #0002;
      border: 1.5px solid #fff8;
      border-radius: 4px;
      padding: 1.2vmin 2.4vmin;
      font-size: 1.6vmin;
      transition: background 0.2s, border-color 0.2s;
    }
    button:hover {
      background: #fff2;
      border-color: #fff;
    }
    .confirm-button {
      background-color: #3dffab;
      color: #111;
      border-color: #3dffab;
    }
    .confirm-button:hover {
      background-color: #5affc0;
      border-color: #5affc0;
    }
  `;

  @property({ type: String }) modalTitle = '';
  @property({ type: String }) message = '';
  @property({ type: String }) inputType: 'text' | 'none' = 'none';
  @property({ type: String }) confirmText = 'Confirm';
  @property({ type: String }) cancelText = 'Cancel';
  @property({ type: String }) inputValue = '';

  @query('.input-field') private inputElement: HTMLInputElement | undefined;

  override firstUpdated() {
    if (this.inputType === 'text' && this.inputElement) {
        // Use a timeout to ensure the element is focusable after the animation.
        setTimeout(() => this.inputElement?.focus(), 150);
    }
  }

  private handleConfirm() {
    const value = this.inputType === 'text' ? this.inputElement?.value : undefined;
    this.dispatchEvent(new CustomEvent('confirm', { detail: value }));
  }

  private handleCancel() {
    this.dispatchEvent(new CustomEvent('cancel'));
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && this.inputType === 'text') {
        this.handleConfirm();
    }
    if (e.key === 'Escape') {
        this.handleCancel();
    }
  }

  override render() {
    return html`
      <div class="overlay" @click=${this.handleCancel}>
        <div class="modal" @click=${(e: Event) => e.stopPropagation()} @keydown=${this.handleKeyDown}>
          ${this.modalTitle ? html`<h2>${this.modalTitle}</h2>` : ''}
          ${this.message ? html`<p class="message">${this.message}</p>` : ''}
          ${this.inputType === 'text'
            ? html`<input
                class="input-field"
                type="text"
                .value=${this.inputValue}
                placeholder="Preset name..."
              />`
            : ''}
          <div class="actions">
            <button class="cancel-button" @click=${this.handleCancel}>
              ${this.cancelText}
            </button>
            <button class="confirm-button" @click=${this.handleConfirm}>
              ${this.confirmText}
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'action-modal': ActionModal;
  }
}
