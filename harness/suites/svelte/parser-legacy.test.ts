import { parserLegacy } from '../../src/compiler/parser.ts';
import { plainSuite } from '../../src/samples.ts';

await plainSuite('parser-legacy', parserLegacy);
