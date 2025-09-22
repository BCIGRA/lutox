/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import type { Prompt } from '../types';

/** Manages saving, loading, and deleting presets in localStorage. */
export class PresetManager {
  private storageKey: string;

  constructor(storageKey: string) {
    this.storageKey = storageKey;
  }

  /**
   * Retrieves all presets from localStorage.
   * @returns A Map of preset names to their prompt arrays.
   */
  private getPresets(): Map<string, Prompt[]> {
    try {
      const presetsJson = localStorage.getItem(this.storageKey);
      if (presetsJson) {
        // JSON.parse can't revive a Map directly, so we parse to an array of [key, value] pairs.
        const presetsArray: [string, Prompt[]][] = JSON.parse(presetsJson);
        return new Map(presetsArray);
      }
    } catch (error) {
      console.error('Error reading presets from localStorage:', error);
    }
    return new Map();
  }

  /**
   * Saves the entire collection of presets to localStorage.
   * @param presets The Map of presets to save.
   */
  private setPresets(presets: Map<string, Prompt[]>) {
    try {
      // Convert Map to an array of [key, value] pairs for JSON serialization.
      const presetsArray = Array.from(presets.entries());
      localStorage.setItem(this.storageKey, JSON.stringify(presetsArray));
    } catch (error) {
      console.error('Error saving presets to localStorage:', error);
      throw new Error('Could not save to local storage. It might be full.');
    }
  }

  /**
   * Returns a list of all saved preset names.
   * @returns An array of strings.
   */
  listPresets(): string[] {
    const presets = this.getPresets();
    return Array.from(presets.keys()).sort();
  }

  /**
   * Saves a new preset.
   * @param name The name of the preset.
   * @param prompts The current Map of prompts to save.
   */
  savePreset(name: string, prompts: Map<string, Prompt>) {
    if (!name) {
      throw new Error('Preset name cannot be empty.');
    }
    const presets = this.getPresets();
    const promptsArray = Array.from(prompts.values());
    presets.set(name, promptsArray);
    this.setPresets(presets);
  }

  /**
   * Loads a preset by name.
   * @param name The name of the preset to load.
   * @returns An array of Prompt objects or null if not found.
   */
  loadPreset(name: string): Prompt[] | null {
    const presets = this.getPresets();
    return presets.get(name) || null;
  }

  /**
   * Deletes a preset by name.
   * @param name The name of the preset to delete.
   */
  deletePreset(name: string) {
    const presets = this.getPresets();
    if (presets.delete(name)) {
      this.setPresets(presets);
    } else {
        throw new Error(`Preset "${name}" not found.`);
    }
  }
}
