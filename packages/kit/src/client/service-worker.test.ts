// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

test('the service-worker entry rejects a self without ServiceWorkerGlobalScope', async () => {
	vi.stubGlobal('document', undefined);
	await expect(import('../entries/app/service-worker/client.ts')).rejects.toThrow(
		'service_worker_module_outside_worker'
	);
});
