import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';
import 'vitest';

declare module 'vitest' {
  // jest-dom 7 still augments the Vitest 4 single-param Assertion.
  // Vitest 5 uses Assertion<R, T>; re-open that shape so matchers typecheck.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- declaration merging
  interface Assertion<R, _T> extends TestingLibraryMatchers<any, R> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- declaration merging
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<any, any> {}
}
