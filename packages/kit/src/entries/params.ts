import { identity } from '../shared/identity.ts';
import { paramsDefiner } from './define-params.ts';

export type {
	DefinedParams,
	MatcherParam,
	ParamDefinition,
	ParamMatcher,
	ParamValue
} from '../types/params.ts';

export const defineParams = paramsDefiner(identity);
