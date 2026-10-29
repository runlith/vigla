import { fileURLToPath } from 'node:url';
import { harness } from '@dromon/harness/vitest';

const root = fileURLToPath(new URL('.', import.meta.url));

export default harness({ name: 'upstream', root, fresh: `${root}fresh.ts` });
