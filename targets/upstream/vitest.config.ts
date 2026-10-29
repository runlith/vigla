import { fileURLToPath } from 'node:url';
import { harness } from '@vigla/harness/vitest';

const root = fileURLToPath(new URL('.', import.meta.url));

export default harness({ name: 'upstream', root, fresh: `${root}fresh.ts` });
