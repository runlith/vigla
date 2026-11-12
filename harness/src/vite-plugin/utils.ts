import { e2eServer, editFile, hmrUpdateTimeout, page, saveScreenshot } from '~upstream-utils';

export * from '~upstream-utils';

const finished = /built in \d+ms\./;

async function untilBuilt(logs: string[], from: number, timeout: number): Promise<void> {
	const deadline = Date.now() + timeout;
	while (!logs.slice(from).some((line) => finished.test(line))) {
		if (Date.now() > deadline) {
			throw new Error(`watch rebuild did not finish after ${timeout}ms`);
		}
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
}

export async function editFileAndWaitForBuildWatchComplete(
	file: string,
	replacer: (content: string) => string
): Promise<void> {
	const logs = e2eServer.logs.watch.out;
	const from = logs.length;
	editFile(file, replacer);
	try {
		await untilBuilt(logs, from, hmrUpdateTimeout);
	} catch (error) {
		await saveScreenshot(`failed_update_${file}`);
		throw error;
	}
	await page.reload();
}
