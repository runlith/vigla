import { parserModern } from '../../src/compiler/parser.ts';
import { plainSuite } from '../../src/samples.ts';

await plainSuite('parser-modern', parserModern);
