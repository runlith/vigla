import { identity } from '../shared/identity.ts';
import { rerouter } from './reroute.ts';

export const applyReroute = rerouter(identity);
