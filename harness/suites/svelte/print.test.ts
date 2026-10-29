import { printer } from '../../src/compiler/parser.ts';
import { plainSuite } from '../../src/samples.ts';

await plainSuite('print', printer);
