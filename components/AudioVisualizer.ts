/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('audio-visualizer')
// FIX: Extended LitElement to define a proper web component.
export class AudioVisualizer extends LitElement {
  static override styles = css`
    :host {
      display: block;
      width: 100%;
      height: 10vmin;
      background-color: #0003;
      border-radius: 0.5vmin;
      border: 1px solid #0008;
      box-shadow: inset 0 0 10px #0005;
      overflow: hidden;
    }
    canvas {
      width: 100%;
      height: 100%;
    }
  `;

  @property({ type: Object })
  frequencyData: Uint8Array | null = null;

  private canvas: HTMLCanvasElement | null = null;
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private animationFrameId: number | null = null;

  override connectedCallback() {
    super.connectedCallback();
    this.startDrawing();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  override firstUpdated() {
    this.canvas = this.shadowRoot!.querySelector('canvas');
    if (this.canvas) {
      this.canvas.width = this.canvas.clientWidth;
      this.canvas.height = this.canvas.clientHeight;
      this.canvasCtx = this.canvas.getContext('2d');
    }
  }

  private startDrawing() {
    const draw = () => {
      this.animationFrameId = requestAnimationFrame(draw);

      if (!this.canvas || !this.canvasCtx) {
        return;
      };

      const ctx = this.canvasCtx;
      // Handle canvas resizing
      if (this.canvas.width !== this.canvas.clientWidth || this.canvas.height !== this.canvas.clientHeight) {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
      }

      const width = this.canvas.width;
      const height = this.canvas.height;
      ctx.clearRect(0, 0, width, height);

      if (!this.frequencyData) {
        return;
      };

      // Use a subset of frequencies for a cleaner look
      const numBars = 128;
      const dataSubset = this.frequencyData.slice(0, numBars);

      const barWidth = width / numBars;
      let barHeight;
      let x = 0;

      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#3dffab');
      gradient.addColorStop(0.5, '#2af6de');
      gradient.addColorStop(1, '#9900ff');
      ctx.fillStyle = gradient;

      for (let i = 0; i < numBars; i++) {
        barHeight = (dataSubset[i] / 255) * height;
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);
        x += barWidth;
      }
    };
    draw();
  }

  override render() {
    return html`<canvas></canvas>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'audio-visualizer': AudioVisualizer;
  }
}
