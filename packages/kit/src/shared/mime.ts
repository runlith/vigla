import { lookup as lookupDefault } from 'mrmime';

export function lookup(file: string): string | undefined {
	const extension = file.slice(file.lastIndexOf('.') + 1).toLowerCase();
	return extension === 'ico' ? 'image/x-icon' : lookupDefault(file);
}
