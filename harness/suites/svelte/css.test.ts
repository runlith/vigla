// @vitest-environment jsdom
import { css } from '../../src/compiler/css.ts';
import { plainSuite } from '../../src/samples.ts';

await plainSuite('css', css);
