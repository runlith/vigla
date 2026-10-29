// @vitest-environment jsdom
import { hydration } from '../../src/runtime/hydration.ts';
import { sampleSuite } from '../../src/runtime/suite.ts';

await sampleSuite('hydration', hydration);
