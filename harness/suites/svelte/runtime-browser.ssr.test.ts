// @vitest-environment jsdom
import { browserSsr } from '../../src/browser/ssr.ts';
import { sampleSuite } from '../../src/runtime/suite.ts';

await sampleSuite('runtime-browser', browserSsr);
