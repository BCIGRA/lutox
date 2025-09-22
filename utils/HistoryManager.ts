/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/** A simple history manager for undo/redo functionality. */
export class HistoryManager<T> {
  private historyStack: T[] = [];
  private currentIndex = -1;
  private readonly maxSize = 100; // Limit history size

  /**
   * Adds a new state to the history stack.
   * If the current index is not at the end of the stack, it truncates the future history.
   * @param state The state to add.
   */
  addState(state: T) {
    // If we've undone, and then make a new change, clear the "redo" history.
    if (this.currentIndex < this.historyStack.length - 1) {
      this.historyStack = this.historyStack.slice(0, this.currentIndex + 1);
    }

    this.historyStack.push(state);

    // Enforce max size
    if (this.historyStack.length > this.maxSize) {
      this.historyStack.shift();
    }
    
    this.currentIndex = this.historyStack.length - 1;
  }

  /**
   * Moves back in history and returns the previous state.
   * @returns The previous state or null if at the beginning of history.
   */
  undo(): T | null {
    if (this.canUndo()) {
      this.currentIndex--;
      return this.historyStack[this.currentIndex];
    }
    return null;
  }

  /**
   * Moves forward in history and returns the next state.
   * @returns The next state or null if at the end of history.
   */
  redo(): T | null {
    if (this.canRedo()) {
      this.currentIndex++;
      return this.historyStack[this.currentIndex];
    }
    return null;
  }

  /**
   * Checks if an undo operation is possible.
   * @returns True if undo is possible, false otherwise.
   */
  canUndo(): boolean {
    return this.currentIndex > 0;
  }

  /**
   * Checks if a redo operation is possible.
   * @returns True if redo is possible, false otherwise.
   */
  canRedo(): boolean {
    return this.currentIndex < this.historyStack.length - 1;
  }
}
