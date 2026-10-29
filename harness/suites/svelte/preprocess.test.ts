import { preprocessor } from '../../src/compiler/preprocess.ts';
import { plainSuite } from '../../src/samples.ts';

await plainSuite('preprocess', preprocessor);
