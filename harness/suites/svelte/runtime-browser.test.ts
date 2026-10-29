import { browser } from '../../src/browser/run.ts';
import { sampleSuite } from '../../src/runtime/suite.ts';

await sampleSuite('runtime-browser', browser(false));
