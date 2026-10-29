import type { Reporter } from 'dromon/internal/server';

function link(code: string): string {
	return `https://svelte.dev/e/${code}`;
}

export const reporter: Reporter = {
	warn(code, message) {
		if (message === null) console.warn(link(code));
		else {
			console.warn(
				`%c[svelte] ${code}\n%c${message}\n${link(code)}`,
				'font-weight: bold',
				'font-weight: normal'
			);
		}
	},
	error(code, message) {
		const error = new Error(message === null ? link(code) : `${code}\n${message}\n${link(code)}`);
		error.name = 'Svelte error';
		return error;
	}
};
