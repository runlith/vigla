import { DEV } from 'esm-env';
import { app_environment_deprecated } from '../../../shared/warnings.ts';
export { browser, dev, building, version } from '../env/client.ts';
if (DEV) app_environment_deprecated();
