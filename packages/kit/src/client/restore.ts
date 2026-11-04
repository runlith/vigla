import { parse, stringify } from 'devalue';
import { getOwner, type Owner } from 'vigla';
import type { ScrollPosition, SnapshotOptions } from '../types/navigation.ts';
import { snapshot_duplicate_id } from './errors.ts';
import type { Transport } from './transport.ts';
import { identity } from '../shared/identity.ts';
import type { HistoryEntry } from './history.ts';

interface Registration {
	snapshot: SnapshotOptions<any>;
	owner: Owner | null;
}

const keys = {
	info: `${identity.name}:history-info`,
	registered: `${identity.name}:navigation-snapshot`
};

function hashElement(url: URL, hash: boolean): HTMLElement | null {
	const fragment = hash ? (url.hash.split('#')[2] ?? '') : url.hash.slice(1);
	return fragment ? document.getElementById(decodeURIComponent(fragment)) : null;
}

type Records<T> = Record<string, T>;

function read<T>(key: string): Records<T> {
	try {
		return JSON.parse(sessionStorage.getItem(key) ?? '{}') ?? {};
	} catch {
		return {};
	}
}

function write(key: string, value: unknown): void {
	try {
		sessionStorage.setItem(key, JSON.stringify(value));
	} catch {}
}

function prune(records: Records<unknown>, index: number, onward: boolean): void {
	for (const key of Object.keys(records))
		if (+key === index || (onward && +key > index)) delete records[key];
}

export class Restoration {
	#auto = true;
	readonly #info: Records<{ scroll?: ScrollPosition; resetIndex?: number }>;
	readonly #registered: Records<Record<string, string>>;
	readonly #hash: boolean;
	readonly #transport: Transport | undefined;
	readonly #registrations = new Map<string, Registration>();

	constructor(hash: boolean, transport?: Transport) {
		this.#transport = transport;
		this.#hash = hash;
		this.#info = read(keys.info);
		this.#registered = read(keys.registered);
	}

	#run<T>(registration: Registration, callback: () => T): T {
		return registration.owner ? registration.owner.run(callback) : callback();
	}

	#stringify(value: unknown): string {
		return this.#transport ? this.#transport.stringify(value) : stringify(value);
	}

	#parse(value: string): unknown {
		return this.#transport ? this.#transport.parse(value) : parse(value);
	}

	capture(entry: HistoryEntry): void {
		this.#info[entry.index] = {
			...this.#info[entry.index],
			scroll: { x: window.scrollX, y: window.scrollY }
		};
		if (this.#registrations.size)
			this.#registered[entry.index] = Object.fromEntries(
				[...this.#registrations].map(([id, registration]) => [
					id,
					this.#stringify(this.#run(registration, () => registration.snapshot.capture()))
				])
			);
		else delete this.#registered[entry.index];
	}

	clear(entry: HistoryEntry, onward = true): void {
		prune(this.#info, entry.index, onward);
		prune(this.#registered, entry.index, onward);
	}

	position(index: number): ScrollPosition | null {
		return this.#info[index]?.scroll ?? null;
	}

	restore(entry: HistoryEntry): void {
		const saved = this.#registered[entry.index];
		for (const [id, registration] of this.#registrations) {
			if (saved && Object.hasOwn(saved, id))
				this.#run(registration, () => registration.snapshot.restore(this.#parse(saved[id]!)));
		}
	}

	register(id: string, snapshot: SnapshotOptions<any>, index: number | null): () => void {
		if (this.#registrations.has(id)) snapshot_duplicate_id({ id });
		const registration: Registration = { snapshot, owner: getOwner() };
		this.#registrations.set(id, registration);
		const saved = index === null ? undefined : this.#registered[index]?.[id];
		if (saved !== undefined) this.#run(registration, () => snapshot.restore(this.#parse(saved)));
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
		write(keys.info, this.#info);
		write(keys.registered, this.#registered);
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
