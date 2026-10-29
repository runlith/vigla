import { vi } from 'vitest';
import { clock } from './clock.ts';

Error.stackTraceLimit = 100;

if (typeof window !== 'undefined') {
	clock.install();
	Object.defineProperty(Window.prototype, 'matchMedia', {
		configurable: true,
		writable: true,
		value: vi.fn((media: string) => ({
			matches: false,
			media,
			addEventListener: () => {},
			removeEventListener: () => {}
		}))
	});
}
