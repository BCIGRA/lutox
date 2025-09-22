/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/** Simple class for getting the current audio level. */
export class AudioAnalyser extends EventTarget {
  readonly node: AnalyserNode;
  private readonly freqData: Uint8Array;
  private rafId: number | null = null;

  constructor(context: AudioContext) {
    super();
    this.node = context.createAnalyser();
    this.node.smoothingTimeConstant = 0;
    this.freqData = new Uint8Array(this.node.frequencyBinCount);
  }

  private loop = () => {
    this.node.getByteFrequencyData(this.freqData);
    const avg = this.freqData.reduce((a, b) => a + b, 0) / this.freqData.length;
    const level = avg / 0xff;
    this.dispatchEvent(
      new CustomEvent('data-updated', {
        detail: { level, frequencyData: this.freqData },
      }),
    );
    this.rafId = requestAnimationFrame(this.loop);
  };

  start() {
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this.loop);
    }
  }
  
  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
