/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
export function debounce<T extends (...args: Parameters<T>) => void>(
  func: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: number;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      func(...args);
    }, delay);
  };
}
