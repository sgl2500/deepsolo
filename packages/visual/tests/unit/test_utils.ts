import assert from 'node:assert/strict';

export type TestCase = {
  name: string;
  fn: () => void | Promise<void>;
};

export function test(name: string, fn: TestCase['fn']): TestCase {
  return { name, fn };
}

export async function runTests(suites: Array<{ suite: string; tests: TestCase[] }>): Promise<void> {
  let passed = 0;
  for (const { suite, tests } of suites) {
    for (const item of tests) {
      try {
        await item.fn();
        passed += 1;
        console.info(`✓ ${suite} / ${item.name}`);
      } catch (error) {
        console.error(`✗ ${suite} / ${item.name}`);
        throw error;
      }
    }
  }
  console.info(`\n${passed} unit tests passed.`);
}

export { assert };
