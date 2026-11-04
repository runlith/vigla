import { DEV } from 'esm-env';
import type { Snapshot } from '@vigla/kit';
import type { Restorer } from '@vigla/kit/internal/restore';
import { warnDiagnostic } from '../history/diagnostics.ts';
import { identity } from '../identity.ts';

interface Instance {
	snapshot?: Snapshot;
}

const key = `${identity.name}:snapshot`;

function read(): Record<string, unknown[]> {
	try {
		return JSON.parse(sessionStorage.getItem(key) ?? '{}') ?? {};
	} catch {
		return {};
	}
}

class Exported implements Restorer {
	readonly #snapshots = read();
	#warned = false;

	capture(navigation: number, components: Instance[]): void {
		if (!components.some((component) => component?.snapshot)) return;
		if (DEV && !this.#warned) {
			this.#warned = true;
			warnDiagnostic(
				'snapshot_export_deprecated',
				'`export const snapshot` is deprecated. Use the `snapshot` helper from `$app/navigation` instead.'
			);
		}
		this.#snapshots[navigation] = components.map((component) => component?.snapshot?.capture());
	}

	restore(navigation: number, components: Instance[]): void {
		this.#snapshots[navigation]?.forEach((value, depth) => {
			components[depth]?.snapshot?.restore(value);
		});
	}

	prune(navigation: number): void {
		for (let index = navigation + 1; this.#snapshots[index]; index++) delete this.#snapshots[index];
	}

	persist(): void {
		const data = JSON.stringify(this.#snapshots);
		try {
			sessionStorage.setItem(key, data);
		} catch {}
	}
}

export function restorer(): Restorer {
	return new Exported();
}
