/** True when the page URL has ?test=1. Works in the production build too. */
export function isTestMode(): boolean {
  return testFlag('test');
}

export function testFlag(name: string): boolean {
  try {
    return new URLSearchParams(location.search).get(name) === '1';
  } catch {
    return false;
  }
}
