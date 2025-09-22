/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

/** A knob for adjusting audio effect parameters. */
@customElement('fx-knob')
// FIX: Extended LitElement to define a proper web component.
export class FxKnob extends LitElement {
  static override styles = css`
    :host {
      cursor: grab;
      position: relative;
      width: 100%;
      aspect-ratio: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      touch-action: none;
      -webkit-font-smoothing: antialiased;
    }
    svg {
      width: 80%;
      height: 80%;
    }
    .label {
      font-size: 1.5vmin;
      color: #ccc;
      margin-top: 0.5vmin;
      font-weight: 500;
      user-select: none;
    }
  `;

  @property({ type: Number }) value = 0; // 0 to 1
  @property({ type: String }) label = '';
  @property({ type: String }) color = '#3dffab';

  private dragStartPos = 0;
  private dragStartValue = 0;

  constructor() {
    super();
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
  }

  private handlePointerDown(e: PointerEvent) {
    e.preventDefault();
    this.dragStartPos = e.clientY;
    this.dragStartValue = this.value;
    document.body.classList.add('dragging');
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
  }

  private handlePointerMove(e: PointerEvent) {
    const delta = this.dragStartPos - e.clientY;
    this.value = this.dragStartValue + delta * 0.005;
    this.value = Math.max(0, Math.min(1, this.value));
    this.dispatchEvent(new CustomEvent('input'));
  }

  private handlePointerUp() {
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    document.body.classList.remove('dragging');
  }

  private handleWheel(e: WheelEvent) {
    const delta = e.deltaY;
    this.value = this.value + delta * -0.001;
    this.value = Math.max(0, Math.min(1, this.value));
    this.dispatchEvent(new CustomEvent('input'));
  }
  
  private describeArc(
    centerX: number,
    centerY: number,
    startAngle: number,
    endAngle: number,
    radius: number,
  ): string {
    const startX = centerX + radius * Math.cos(startAngle);
    const startY = centerY + radius * Math.sin(startAngle);
    const endX = centerX + radius * Math.cos(endAngle);
    const endY = centerY + radius * Math.sin(endAngle);

    const largeArcFlag = endAngle - startAngle <= Math.PI ? '0' : '1';

    return (
      `M ${startX} ${startY}` +
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`
    );
  }

  override render() {
    const rotationRange = Math.PI * 2 * 0.75;
    const minRot = -rotationRange / 2 - Math.PI / 2;
    const maxRot = rotationRange / 2 - Math.PI / 2;
    const rot = minRot + this.value * (maxRot - minRot);
    const indicatorStyle = styleMap({
      transform: `rotate(${rot}rad)`,
      transformOrigin: '50px 50px',
    });

    return html`
      <svg
        viewBox="0 0 100 100"
        @pointerdown=${this.handlePointerDown}
        @wheel=${this.handleWheel}>
        <circle cx="50" cy="50" r="45" fill="#111" />
        <path
          d=${this.describeArc(50, 50, minRot, maxRot, 38)}
          fill="none"
          stroke="#0005"
          stroke-width="8"
          stroke-linecap="round" />
        <path
          d=${this.describeArc(50, 50, minRot, rot, 38)}
          fill="none"
          stroke=${this.color}
          stroke-width="8"
          stroke-linecap="round" />
        <circle cx="50" cy="50" r="30" fill="url(#grad)" />
        <g style=${indicatorStyle}>
          <line
            x1="50"
            y1="28"
            x2="50"
            y2="18"
            stroke=${this.color}
            stroke-width="6"
            stroke-linecap="round" />
        </g>
        <defs>
          <radialGradient id="grad">
            <stop offset="0%" stop-color="#555" />
            <stop offset="100%" stop-color="#222" />
          </radialGradient>
        </defs>
      </svg>
      <div class="label">${this.label}</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fx-knob': FxKnob;
  }
}
