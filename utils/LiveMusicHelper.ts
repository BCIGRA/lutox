/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import type { PlaybackState, Prompt } from '../types';
import type { AudioChunk, GoogleGenAI, LiveMusicFilteredPrompt, LiveMusicSession } from '@google/genai';
import { decode, decodeAudioData } from './audio';
import { throttle } from './throttle';

// Map of prompt text to local audio file.
// NOTE: These files must exist in an `assets` directory at the root of your project for the fallback to work.
const FALLBACK_AUDIO_MAP = new Map<string, string>([
  ['Bossa Nova', 'assets/bossa_nova.wav'],
  ['Chillwave', 'assets/chillwave.wav'],
  ['Drum and Bass', 'assets/drum_and_bass.wav'],
  ['Funk', 'assets/funk.wav'],
  ['Ambient', 'assets/ambient.wav'],
  ['Lo-fi', 'assets/lo_fi.wav'],
]);

export class LiveMusicHelper extends EventTarget {

  private ai: GoogleGenAI;
  private model: string;

  private session: LiveMusicSession | null = null;
  private sessionPromise: Promise<LiveMusicSession> | null = null;
  private isFallbackMode = false;
  private fallbackPlayers = new Map<string, HTMLAudioElement>();

  private filteredPrompts = new Set<string>();
  private nextStartTime = 0;
  private bufferTime = 2;

  public readonly audioContext: AudioContext;
  public extraDestination: AudioNode | null = null;

  private outputNode: GainNode;
  private playbackState: PlaybackState = 'stopped';

  private prompts: Map<string, Prompt>;

  private isRecording = false;
  private recordedBuffers: AudioBuffer[] = [];
  
  // Audio Effects Nodes
  private finalOutput: GainNode;
  private masterVolumeNode: GainNode;
  private dryGain: GainNode;
  private distortionNode: WaveShaperNode;
  private distortionWetGain: GainNode;
  private delayNode: DelayNode;
  private delayFeedback: GainNode;
  private delayWetGain: GainNode;
  private reverbNode: ConvolverNode;
  private reverbWetGain: GainNode;
  private isAudioGraphConnected = false;

  constructor(ai: GoogleGenAI, model: string) {
    super();
    this.ai = ai;
    this.model = model;
    this.prompts = new Map();
    this.audioContext = new AudioContext({ sampleRate: 48000 });
    this.outputNode = this.audioContext.createGain();

    // Initialize effects
    this.finalOutput = this.audioContext.createGain();
    this.masterVolumeNode = this.audioContext.createGain();
    this.masterVolumeNode.gain.value = 1;

    this.dryGain = this.audioContext.createGain();
    this.dryGain.gain.value = 1;

    // Distortion
    this.distortionNode = this.audioContext.createWaveShaper();
    this.makeDistortionCurve(400); // A default curve
    this.distortionWetGain = this.audioContext.createGain();
    this.distortionWetGain.gain.value = 0;

    // Delay
    this.delayNode = this.audioContext.createDelay(2.0);
    this.delayNode.delayTime.value = 0.4;
    this.delayFeedback = this.audioContext.createGain();
    this.delayFeedback.gain.value = 0.5;
    this.delayWetGain = this.audioContext.createGain();
    this.delayWetGain.gain.value = 0;
    
    // Reverb
    this.reverbNode = this.audioContext.createConvolver();
    this.createReverbImpulseResponse().then(buffer => this.reverbNode.buffer = buffer);
    this.reverbWetGain = this.audioContext.createGain();
    this.reverbWetGain.gain.value = 0;
  }

  private connectAudioGraph() {
    if (this.isAudioGraphConnected) {
      // Disconnect to avoid multiple connections if play is clicked multiple times
      this.outputNode.disconnect();
      this.dryGain.disconnect();
      this.distortionNode.disconnect();
      this.distortionWetGain.disconnect();
      this.delayWetGain.disconnect();
      this.delayNode.disconnect(this.finalOutput); // Disconnect direct path
      this.delayNode.disconnect(this.delayFeedback); // Disconnect feedback loop
      this.delayFeedback.disconnect();
      this.reverbNode.disconnect();
      this.reverbWetGain.disconnect();
      this.finalOutput.disconnect(this.masterVolumeNode);
      this.masterVolumeNode.disconnect();
    }

    // Main dry path
    this.outputNode.connect(this.dryGain);
    this.dryGain.connect(this.finalOutput);

    // Distortion path
    this.outputNode.connect(this.distortionNode);
    this.distortionNode.connect(this.distortionWetGain);
    this.distortionWetGain.connect(this.finalOutput);

    // Delay path
    this.outputNode.connect(this.delayWetGain);
    this.delayWetGain.connect(this.delayNode);
    this.delayNode.connect(this.finalOutput);
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);

    // Reverb path
    this.outputNode.connect(this.reverbNode);
    this.reverbNode.connect(this.reverbWetGain);
    this.reverbWetGain.connect(this.finalOutput);
    
    // Connect final output to master volume
    this.finalOutput.connect(this.masterVolumeNode);
    
    // Connect master volume to destination
    this.masterVolumeNode.connect(this.audioContext.destination);
    if (this.extraDestination) this.masterVolumeNode.connect(this.extraDestination);

    this.isAudioGraphConnected = true;
  }
  
  private makeDistortionCurve(amount: number) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
        const x = i * 2 / n_samples - 1;
        curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    this.distortionNode.curve = curve;
    this.distortionNode.oversample = '4x';
  };

  private async createReverbImpulseResponse() {
      const sampleRate = this.audioContext.sampleRate;
      const length = sampleRate * 2; // 2 seconds reverb
      const impulse = this.audioContext.createBuffer(2, length, sampleRate);
      const left = impulse.getChannelData(0);
      const right = impulse.getChannelData(1);
      for (let i = 0; i < length; i++) {
          left[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
          right[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
      }
      return impulse;
  }

  private getSession(): Promise<LiveMusicSession> {
    if (!this.sessionPromise) this.sessionPromise = this.connect();
    return this.sessionPromise;
  }

  private async connect(): Promise<LiveMusicSession> {
    try {
      // FIX: The `connect` method requires a `callbacks` object for handling events instead of using `addEventListener`.
      const session = await this.ai.live.music.connect({
        model: this.model,
        callbacks: {
          onAudioChunk: (chunks: AudioChunk[]) => {
            this.processAudioChunks(chunks);
          },
          onFilteredPrompt: (filteredPrompt: LiveMusicFilteredPrompt) => {
            this.dispatchEvent(
              new CustomEvent('filtered-prompt', { detail: filteredPrompt }),
            );
            this.filteredPrompts.add(filteredPrompt.text!);
          },
          onError: (e: Error) => {
            this.dispatchEvent(new CustomEvent('error', { detail: e.message }));
            this.stop();
          },
        },
      });
      console.log('Successfully connected to real-time music service (WSS).');

      this.isFallbackMode = false;
      return session;

    } catch(e) {
      console.warn('WSS connection failed, activating fallback mode.', e);
      this.isFallbackMode = true;
      this.dispatchEvent(new CustomEvent('error', { detail: 'Real-time connection failed. Activating offline fallback mode with local audio samples.' }));
      this.initializeFallbackPlayers();
  
      // Return a mock session object that mimics the LiveMusicSession interface
      // to prevent errors in other parts of the code.
      return {
        play: () => { /* Handled by fallback logic */ },
        pause: () => { /* Handled by fallback logic */ },
        stop: () => { /* Handled by fallback logic */ },
        setWeightedPrompts: async () => { /* Handled by fallback logic */ },
      } as unknown as LiveMusicSession;
    }
  }

  private initializeFallbackPlayers() {
    for (const [promptText, audioUrl] of FALLBACK_AUDIO_MAP.entries()) {
      const audio = new Audio(audioUrl);
      audio.crossOrigin = "anonymous";
      audio.loop = true;
      audio.volume = 0;
      this.fallbackPlayers.set(promptText, audio);
  
      // Connect the audio element to the existing effects graph
      const source = this.audioContext.createMediaElementSource(audio);
      source.connect(this.outputNode);
    }
  }

  private setPlaybackState(state: PlaybackState) {
    this.playbackState = state;
    this.dispatchEvent(new CustomEvent('playback-state-changed', { detail: state }));
  }
  
  private async processAudioChunks(audioChunks: AudioChunk[]) {
    if (this.playbackState === 'paused' || this.playbackState === 'stopped') return;
    const audioBuffer = await decodeAudioData(
      decode(audioChunks[0].data!),
      this.audioContext,
      48000,
      2,
    );
    
    if (this.isRecording) {
      this.recordedBuffers.push(audioBuffer);
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.outputNode);
    if (this.nextStartTime === 0) {
      this.nextStartTime = this.audioContext.currentTime + this.bufferTime;
      setTimeout(() => {
        this.setPlaybackState('playing');
      }, this.bufferTime * 1000);
    }
    if (this.nextStartTime < this.audioContext.currentTime) {
      this.setPlaybackState('loading');
      this.nextStartTime = 0;
      return;
    }
    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;
  }

  public get activePrompts() {
    return Array.from(this.prompts.values())
      .filter((p) => {
        return !this.filteredPrompts.has(p.text) && p.weight !== 0;
      })
  }

  public readonly setWeightedPrompts = throttle(async (prompts: Map<string, Prompt>) => {
    this.prompts = prompts;

    if (this.isFallbackMode) {
      for (const [text, player] of this.fallbackPlayers.entries()) {
        const prompt = this.activePrompts.find(p => p.text === text);
        if (prompt) {
          const targetVolume = Math.min(prompt.weight, 1);
          player.volume = targetVolume;
        } else {
          player.volume = 0;
        }
      }
      return;
    }
    
    if (this.activePrompts.length === 0) {
      this.dispatchEvent(new CustomEvent('error', { detail: 'There needs to be one active prompt to play.' }));
      this.pause();
      return;
    }

    if (!this.session) return;

    try {
      await this.session.setWeightedPrompts({
        weightedPrompts: this.activePrompts,
      });
    } catch (e: any) {
      this.dispatchEvent(new CustomEvent('error', { detail: e.message }));
      this.pause();
    }
  }, 200);

  public async play() {
    this.setPlaybackState('loading');
    this.connectAudioGraph();
    this.session = await this.getSession();
    this.audioContext.resume();

    if (this.isFallbackMode) {
        const playPromises = Array.from(this.fallbackPlayers.values()).map(p => p.play().catch(e => console.error(`Error playing ${p.src}:`, e)));
        await Promise.all(playPromises);
        await this.setWeightedPrompts(this.prompts);
        this.setPlaybackState('playing');
    } else {
        await this.setWeightedPrompts(this.prompts);
        this.session.play();
        this.outputNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        this.outputNode.gain.linearRampToValueAtTime(1, this.audioContext.currentTime + 0.1);
    }
  }

  public pause() {
    if (this.isFallbackMode) {
        this.fallbackPlayers.forEach(player => player.pause());
    } else {
      if (this.session) this.session.pause();
    }
    this.setPlaybackState('paused');
    this.outputNode.gain.setValueAtTime(this.outputNode.gain.value, this.audioContext.currentTime);
    this.outputNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.1);
    this.nextStartTime = 0;
  }

  public stop() {
    if (this.isFallbackMode) {
      this.fallbackPlayers.forEach(player => {
        player.pause();
        player.currentTime = 0;
      });
    } else {
      if (this.session) this.session.stop();
    }
    this.setPlaybackState('stopped');
    this.outputNode.gain.setValueAtTime(this.outputNode.gain.value, this.audioContext.currentTime);
    this.outputNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.1);
    this.nextStartTime = 0;
    this.session = null;
    this.sessionPromise = null;
    this.isFallbackMode = false; // Reset mode on stop
  }

  public async playPause() {
    switch (this.playbackState) {
      case 'playing':
        return this.pause();
      case 'paused':
      case 'stopped':
        return this.play();
      case 'loading':
        return this.stop();
    }
  }

  public startRecording() {
    if (this.isFallbackMode) {
      this.dispatchEvent(new CustomEvent('error', { detail: 'Recording is not available in fallback mode.' }));
      return;
    }
    if (this.playbackState !== 'playing' && this.playbackState !== 'loading') {
      this.dispatchEvent(new CustomEvent('error', { detail: 'Please start playback before recording.' }));
      return;
    }
    this.recordedBuffers = [];
    this.isRecording = true;
    this.dispatchEvent(new CustomEvent('recording-state-changed', { detail: true }));
  }

  public stopRecordingAndDownload() {
    if (!this.isRecording) return;
    this.isRecording = false;
    this.dispatchEvent(new CustomEvent('recording-state-changed', { detail: false }));

    if (this.recordedBuffers.length === 0) {
      this.dispatchEvent(new CustomEvent('error', { detail: 'Nothing was recorded.' }));
      return;
    }
    try {
      const fullBuffer = this.concatenateAudioBuffers(this.recordedBuffers);
      const wavBlob = this.audioBufferToWav(fullBuffer);
      this.downloadBlob(wavBlob, 'lutox-oscillia-creation.wav');
    } catch (e) {
      console.error('Error processing recorded audio:', e);
      this.dispatchEvent(new CustomEvent('error', { detail: 'Could not process recorded audio.' }));
    }
    this.recordedBuffers = [];
  }

  private concatenateAudioBuffers(buffers: AudioBuffer[]): AudioBuffer {
    if (buffers.length === 0) {
      throw new Error('Buffer list is empty');
    }
    const numberOfChannels = buffers[0].numberOfChannels;
    const sampleRate = buffers[0].sampleRate;
    let totalLength = 0;
    for (const buffer of buffers) {
      totalLength += buffer.length;
    }

    const result = this.audioContext.createBuffer(
      numberOfChannels,
      totalLength,
      sampleRate,
    );

    let offset = 0;
    for (const buffer of buffers) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        result.copyToChannel(buffer.getChannelData(channel), channel, offset);
      }
      offset += buffer.length;
    }
    return result;
  }

  private audioBufferToWav(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferOut = new ArrayBuffer(length);
    const view = new DataView(bufferOut);
    const channels: Float32Array[] = [];
    let i, sample;
    let offset = 0;

    for (i = 0; i < numOfChan; i++) {
      channels.push(buffer.getChannelData(i));
    }

    const setString = (view: DataView, offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    // WAV header
    setString(view, 0, 'RIFF');
    view.setUint32(4, length - 8, true);
    setString(view, 8, 'WAVE');
    setString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numOfChan, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * 2 * numOfChan, true);
    view.setUint16(32, numOfChan * 2, true);
    view.setUint16(34, 16, true);
    setString(view, 36, 'data');
    view.setUint32(40, length - 44, true);

    // Data
    offset = 44;
    for (i = 0; i < buffer.length; i++) {
      for (let ch = 0; ch < numOfChan; ch++) {
        sample = Math.max(-1, Math.min(1, channels[ch][i]));
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
        view.setInt16(offset, sample, true);
        offset += 2;
      }
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  private downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  public setDistortion(amount: number) {
    this.distortionWetGain.gain.linearRampToValueAtTime(amount, this.audioContext.currentTime + 0.05);
  }

  public setDelay(amount: number) {
    this.delayWetGain.gain.linearRampToValueAtTime(amount, this.audioContext.currentTime + 0.05);
    this.delayFeedback.gain.linearRampToValueAtTime(amount * 0.7, this.audioContext.currentTime + 0.05);
  }

  public setReverb(amount: number) {
    this.reverbWetGain.gain.linearRampToValueAtTime(amount, this.audioContext.currentTime + 0.05);
  }

  public setMasterVolume(amount: number) {
    this.masterVolumeNode.gain.linearRampToValueAtTime(amount, this.audioContext.currentTime + 0.05);
  }
}
