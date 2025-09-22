/**
 * @fileoverview Control real time music with a MIDI controller
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PlaybackState, Prompt } from './types';
import { GoogleGenAI, LiveMusicFilteredPrompt, Type } from '@google/genai';
import { PromptDjMidi } from './components/PromptDjMidi';
import { ToastMessage } from './components/ToastMessage';
import { LiveMusicHelper } from './utils/LiveMusicHelper';
import { AudioAnalyser } from './utils/AudioAnalyser';
import { HistoryManager } from './utils/HistoryManager';
import { PresetManager } from './utils/PresetManager';
import { debounce } from './utils/debounce';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const model = 'models/lyria-realtime-exp';
const historyManager = new HistoryManager<Map<string, Prompt>>();
const presetManager = new PresetManager('prompt-dj-presets');

function main() {
  const initialPrompts = buildInitialPrompts();
  historyManager.addState(new Map(initialPrompts));

  const pdjMidi = new PromptDjMidi();
  pdjMidi.prompts = initialPrompts;
  pdjMidi.presets = presetManager.listPresets();
  updateUndoRedoState();
  document.body.appendChild(pdjMidi);

  const toastMessage = new ToastMessage();
  document.body.appendChild(toastMessage);

  const liveMusicHelper = new LiveMusicHelper(ai, model);
  liveMusicHelper.setWeightedPrompts(initialPrompts);

  const audioAnalyser = new AudioAnalyser(liveMusicHelper.audioContext);
  liveMusicHelper.extraDestination = audioAnalyser.node;

  const saveStateToHistory = debounce((prompts: Map<string, Prompt>) => {
    historyManager.addState(new Map(prompts)); // Save a clone
    updateUndoRedoState();
  }, 500);

  pdjMidi.addEventListener('prompts-changed', ((e: Event) => {
    const customEvent = e as CustomEvent<Map<string, Prompt>>;
    const prompts = customEvent.detail;
    // The component's state is now managed by the parent.
    // So update it directly here to complete the data flow loop.
    pdjMidi.prompts = prompts;
    liveMusicHelper.setWeightedPrompts(prompts);
    saveStateToHistory(prompts);
  }));

  pdjMidi.addEventListener('play-pause', () => {
    liveMusicHelper.playPause();
  });

  pdjMidi.addEventListener('record-toggle', ((e: Event) => {
    const customEvent = e as CustomEvent<boolean>;
    const shouldStartRecording = customEvent.detail;
    if (shouldStartRecording) {
      liveMusicHelper.startRecording();
    } else {
      liveMusicHelper.stopRecordingAndDownload();
    }
  }));

  function updateUndoRedoState() {
    pdjMidi.canUndo = historyManager.canUndo();
    pdjMidi.canRedo = historyManager.canRedo();
  }

  pdjMidi.addEventListener('undo-requested', () => {
    const prevState = historyManager.undo();
    if (prevState) {
      const prompts = new Map(prevState);
      pdjMidi.prompts = prompts;
      liveMusicHelper.setWeightedPrompts(prompts);
      updateUndoRedoState();
    }
  });

  pdjMidi.addEventListener('redo-requested', () => {
    const nextState = historyManager.redo();
    if (nextState) {
      const prompts = new Map(nextState);
      pdjMidi.prompts = prompts;
      liveMusicHelper.setWeightedPrompts(prompts);
      updateUndoRedoState();
    }
  });

  liveMusicHelper.addEventListener('recording-state-changed', ((e: Event) => {
    const customEvent = e as CustomEvent<boolean>;
    pdjMidi.isRecording = customEvent.detail;
  }));

  liveMusicHelper.addEventListener('playback-state-changed', ((e: Event) => {
    const customEvent = e as CustomEvent<PlaybackState>;
    const playbackState = customEvent.detail;
    pdjMidi.playbackState = playbackState;
    playbackState === 'playing' ? audioAnalyser.start() : audioAnalyser.stop();
  }));

  liveMusicHelper.addEventListener('filtered-prompt', ((e: Event) => {
    const customEvent = e as CustomEvent<LiveMusicFilteredPrompt>;
    const filteredPrompt = customEvent.detail;
    toastMessage.show(filteredPrompt.filteredReason!)
    pdjMidi.addFilteredPrompt(filteredPrompt.text!);
  }));

  const errorToast = ((e: Event) => {
    const customEvent = e as CustomEvent<string>;
    const error = customEvent.detail;
    toastMessage.show(error);
  });

  liveMusicHelper.addEventListener('error', errorToast);
  pdjMidi.addEventListener('error', errorToast);

  audioAnalyser.addEventListener('data-updated', ((e: Event) => {
    const customEvent =
      e as CustomEvent<{ level: number, frequencyData: Uint8Array }>;
    const { level, frequencyData } = customEvent.detail;
    pdjMidi.audioLevel = level;
    pdjMidi.frequencyData = frequencyData;
  }));

  pdjMidi.addEventListener('distortion-changed', (e: Event) => {
    const customEvent = e as CustomEvent<number>;
    liveMusicHelper.setDistortion(customEvent.detail);
  });
  pdjMidi.addEventListener('delay-changed', (e: Event) => {
    const customEvent = e as CustomEvent<number>;
    liveMusicHelper.setDelay(customEvent.detail);
  });
  pdjMidi.addEventListener('reverb-changed', (e: Event) => {
    const customEvent = e as CustomEvent<number>;
    liveMusicHelper.setReverb(customEvent.detail);
  });
  pdjMidi.addEventListener('master-volume-changed', (e: Event) => {
    const customEvent = e as CustomEvent<number>;
    liveMusicHelper.setMasterVolume(customEvent.detail);
  });

  pdjMidi.addEventListener('request-suggestions', async () => {
    pdjMidi.isGeneratingSuggestions = true;
    try {
      const activePrompts = Array.from(pdjMidi.prompts.values())
        .filter(p => p.weight > 0)
        .map(p => p.text);

      let userPrompt: string;
      if (activePrompts.length > 0) {
        userPrompt = `Based on these musical concepts: '${activePrompts.join(', ')}', suggest 5 new, related musical prompts.`;
      } else {
        userPrompt = 'Suggest 5 creative musical prompts to get started.';
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: userPrompt }] },
        config: {
          systemInstruction: 'You are a creative assistant for a musician. Your goal is to provide inspiring musical prompts. Each prompt must be short, containing only 2-3 words. The prompts can be genres, moods, or musical techniques.',
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING,
                  description: 'A short musical prompt, 2-3 words long.'
                }
              }
            }
          }
        }
      });

      const result = JSON.parse(response.text);
      if (result?.suggestions) {
        pdjMidi.suggestions = result.suggestions;
      } else {
        throw new Error('Received invalid suggestions format from API.');
      }
    } catch (e) {
      console.error('Error generating suggestions:', e);
      toastMessage.show('Sorry, the suggestion service is currently unavailable. Please try again later.');
    } finally {
      pdjMidi.isGeneratingSuggestions = false;
    }
  });

  pdjMidi.addEventListener('suggestion-selected', (e: Event) => {
    const customEvent = e as CustomEvent<string>;
    const suggestion = customEvent.detail;
    const prompts = new Map(pdjMidi.prompts);

    // Find the first prompt with a weight of 0
    let emptyPrompt: Prompt | undefined;
    for (const p of prompts.values()) {
      if (p.weight === 0) {
        emptyPrompt = p;
        break;
      }
    }

    if (emptyPrompt) {
      const updatedPrompt = { ...emptyPrompt, text: suggestion };
      prompts.set(updatedPrompt.promptId, updatedPrompt);
      pdjMidi.prompts = prompts;
      // Dispatch prompts-changed to trigger history save and other updates
      pdjMidi.dispatchEvent(new CustomEvent('prompts-changed', { detail: prompts }));
    } else {
      toastMessage.show('No empty prompt slots. Please clear a prompt to add a new one.');
    }
  });

  pdjMidi.addEventListener('save-preset-requested', (e: Event) => {
    const customEvent = e as CustomEvent<string>;
    const name = customEvent.detail;
    try {
      presetManager.savePreset(name, pdjMidi.prompts);
      pdjMidi.presets = presetManager.listPresets();
      pdjMidi.selectedPreset = name;
      toastMessage.show(`Preset "${name}" saved.`);
    } catch (error) {
      toastMessage.show(`Error saving preset: ${error.message}`);
    }
  });

  pdjMidi.addEventListener('load-preset-requested', (e: Event) => {
    const customEvent = e as CustomEvent<string>;
    const name = customEvent.detail;
    const presetPrompts = presetManager.loadPreset(name);
    if (presetPrompts) {
      const prompts = new Map(presetPrompts.map(p => [p.promptId, p]));
      pdjMidi.prompts = prompts;
      liveMusicHelper.setWeightedPrompts(prompts);
      historyManager.addState(new Map(prompts)); // Add loaded state to history
      updateUndoRedoState();
      toastMessage.show(`Preset "${name}" loaded.`);
    } else {
      toastMessage.show(`Could not load preset "${name}".`);
    }
  });

  pdjMidi.addEventListener('delete-preset-requested', (e: Event) => {
    const customEvent = e as CustomEvent<string>;
    const name = customEvent.detail;
    try {
      presetManager.deletePreset(name);
      pdjMidi.presets = presetManager.listPresets();
      toastMessage.show(`Preset "${name}" deleted.`);
    } catch (error) {
      toastMessage.show(`Error deleting preset: ${error.message}`);
    }
  });
}

function buildInitialPrompts() {
  // Pick 3 random prompts to start at weight = 1
  const startOn = [...DEFAULT_PROMPTS]
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const prompts = new Map<string, Prompt>();

  for (let i = 0; i < DEFAULT_PROMPTS.length; i++) {
    const promptId = `prompt-${i}`;
    const prompt = DEFAULT_PROMPTS[i];
    const { text, color } = prompt;
    prompts.set(promptId, {
      promptId,
      text,
      weight: startOn.includes(prompt) ? 1 : 0,
      cc: i,
      color,
    });
  }

  return prompts;
}

const DEFAULT_PROMPTS = [
  { color: '#9900ff', text: 'Bossa Nova' },
  { color: '#5200ff', text: 'Chillwave' },
  { color: '#ff25f6', text: 'Drum and Bass' },
  { color: '#2af6de', text: 'Post Punk' },
  { color: '#ffdd28', text: 'Shoegaze' },
  { color: '#2af6de', text: 'Funk' },
  { color: '#9900ff', text: 'Chiptune' },
  { color: '#3dffab', text: 'Lush Strings' },
  { color: '#d8ff3e', text: 'Sparkling Arpeggios' },
  { color: '#d9b2ff', text: 'Staccato Rhythms' },
  { color: '#3dffab', text: 'Punchy Kick' },
  { color: '#ffdd28', text: 'Dubstep' },
  { color: '#ff25f6', text: 'K Pop' },
  { color: '#d8ff3e', text: 'Neo Soul' },
  { color: '#5200ff', text: 'Trip Hop' },
  { color: '#d9b2ff', text: 'Thrash' },
  { color: '#2af6de', text: 'Ambient' },
  { color: '#ff25f6', text: 'Synthwave' },
  { color: '#d9b2ff', text: 'Lo-fi' },
  { color: '#ffdd28', text: 'Hardstyle' },
  { color: '#ff9900', text: 'Glitch Hop' },
  { color: '#ff2525', text: 'Metal' },
  { color: '#ff6600', text: 'Rock' },
  { color: '#0099ff', text: 'Jazz' },
];

main();