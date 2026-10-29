// @vitest-environment jsdom
import { ssr } from '../../src/runtime/ssr.ts';
import { sampleSuite } from '../../src/runtime/suite.ts';

await sampleSuite('server-side-rendering', ssr);
