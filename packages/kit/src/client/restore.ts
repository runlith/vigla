import { parse, stringify } from 'devalue';
import { getOwner, type Owner } from 'vigla';
import type { ComponentInstance } from '../types/internal/client.ts';
import type { ScrollPosition, SnapshotOptions } from '../types/navigation.ts';
import { snapshot_duplicate_id } from './errors.ts';
import type { Transport } from './transport.ts';
import { identity } from '../shared/identity.ts';

interface Registration {
	snapshot: SnapshotOptions<any>;
	owner: Owner | null;
}

function hashElement(url: URL, hash: boolean): HTMLElement | null {
	const fragment = hash ? (url.hash.split('#')[2] ?? '') : url.hash.slice(1);
	return fragment ? document.getElementById(decodeURIComponent(fragment)) : null;
}

export class Restoration {
	#auto = true;
	#entries: Record<
		string,
		{ scroll: ScrollPosition; snapshots: unknown[]; registered?: Record<string, string> }
	> = {};
	readonly #key: string;
	readonly #hash: boolean;
	readonly #transport: Transport | undefined;
	readonly #registrations = new Map<string, Registration>();

	constructor(key: string, hash: boolean, transport?: Transport) {
		this.#transport = transport;
		this.#key = `${identity.name}:snapshot:${key}`;
		this.#hash = hash;
		try {
			this.#entries = JSON.parse(sessionStorage.getItem(this.#key) ?? '{}');
		} catch {}
	}

	#run<T>(registration: Registration, callback: () => T): T {
		return registration.owner ? registration.owner.run(callback) : callback();
	}

	capture(index: number, components: ComponentInstance[]): void {
		this.#entries[index] = {
			scroll: { x: window.scrollX, y: window.scrollY },
			snapshots: components.map((component) => component?.snapshot?.capture()),
			registered: Object.fromEntries(
				[...this.#registrations].map(([id, registration]) => [
					id,
					this.#transport
						? this.#transport.stringify(
								this.#run(registration, () => registration.snapshot.capture())
							)
						: stringify(this.#run(registration, () => registration.snapshot.capture()))
				])
			)
		};
	}

	clear(index: number, onward = true): void {
		for (const key of Object.keys(this.#entries))
			if (+key === index || (onward && +key > index)) delete this.#entries[key];
	}

	position(index: number): ScrollPosition | null {
		return this.#entries[index]?.scroll ?? null;
	}

	restore(index: number, components: ComponentInstance[]): void {
		this.#entries[index]?.snapshots.forEach((value, depth) => {
			components[depth]?.snapshot?.restore(value);
		});
		const saved = this.#entries[index]?.registered;
		for (const [id, registration] of this.#registrations) {
			if (saved && Object.hasOwn(saved, id))
				this.#run(registration, () =>
					registration.snapshot.restore(
						this.#transport ? this.#transport.parse(saved[id]!) : parse(saved[id]!)
					)
				);
		}
	}

	register(id: string, snapshot: SnapshotOptions<any>, index: number | null): () => void {
		if (this.#registrations.has(id)) snapshot_duplicate_id({ id });
		const registration: Registration = { snapshot, owner: getOwner() };
		this.#registrations.set(id, registration);
		const saved = index === null ? undefined : this.#entries[index]?.registered?.[id];
		if (saved !== undefined)
			this.#run(registration, () =>
				snapshot.restore(this.#transport ? this.#transport.parse(saved) : parse(saved))
			);
		return () => this.#registrations.delete(id);
	}

	registrations(): Set<SnapshotOptions<any>> {
		return new Set([...this.#registrations.values()].map((registration) => registration.snapshot));
	}

	reset(previous: Set<SnapshotOptions<any>>): void {
		for (const registration of this.#registrations.values())
			if (previous.has(registration.snapshot))
				this.#run(registration, () => registration.snapshot.reset?.());
	}

	persist(): void {
		try {
			sessionStorage.setItem(this.#key, JSON.stringify(this.#entries));
		} catch {}
	}

	disableScroll(): void {
		this.#auto = false;
	}

	blur(reset: boolean): void {
		const active = document.activeElement;
		if (
			reset &&
			active !== document.body &&
			(active instanceof HTMLElement || active instanceof SVGElement)
		)
			active.blur();
	}

	scroll(url: URL, reset: boolean, position?: ScrollPosition | null): void {
		if (reset && this.#auto) {
			if (position) window.scrollTo(position.x, position.y);
			else {
				const anchor = hashElement(url, this.#hash);
				if (anchor) anchor.scrollIntoView();
				else window.scrollTo(0, 0);
			}
		}
		this.#auto = true;
	}

	focus(url: URL): void {
		const canFocus = window.parent === window || document.hasFocus();
		const autofocus = document.querySelector<HTMLElement>('[autofocus]');
		if (autofocus) {
			if (canFocus) autofocus.focus();
			return;
		}
		if (canFocus) {
			const target = hashElement(url, this.#hash) ?? document.body;
			const tab = target.getAttribute('tabindex');
			target.setAttribute('tabindex', '-1');
			target.focus({ preventScroll: true });
			if (tab === null) target.removeAttribute('tabindex');
			else target.setAttribute('tabindex', tab);
		}
		const selection = window.getSelection();
		if (!selection || selection.type === 'None') return;
		const ranges = Array.from({ length: selection.rangeCount }, (_, index) => {
			const range = selection.getRangeAt(index);
			return {
				start: range.startContainer,
				end: range.endContainer,
				from: range.startOffset,
				to: range.endOffset
			};
		});
		setTimeout(() => {
			if (selection.rangeCount !== ranges.length) return;
			if (
				ranges.every((saved, index) => {
					const range = selection.getRangeAt(index);
					return (
						saved.start === range.startContainer &&
						saved.end === range.endContainer &&
						saved.from === range.startOffset &&
						saved.to === range.endOffset
					);
				})
			)
				selection.removeAllRanges();
		});
	}
}
