import { browser } from '../../src/browser/run.ts';
import { sampleSuite } from '../../src/runtime/suite.ts';

await sampleSuite('browser', browser(false));
