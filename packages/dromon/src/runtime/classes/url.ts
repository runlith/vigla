import { set, state } from '../reactivity/sources.ts';
import { get } from '../reactivity/tracking.ts';
import { bind, ReactiveURLSearchParams, replace } from './search.ts';

export class ReactiveURL extends URL {
	readonly #protocol = state(super.protocol);
	readonly #username = state(super.username);
	readonly #password = state(super.password);
	readonly #hostname = state(super.hostname);
	readonly #port = state(super.port);
	readonly #pathname = state(super.pathname);
	readonly #hash = state(super.hash);
	readonly #search = state(super.search);
	readonly #params: ReactiveURLSearchParams;

	constructor(url: string | URL, base?: string | URL) {
		const parsed = new URL(url, base);
		super(parsed);
		this.#params = new ReactiveURLSearchParams(parsed.searchParams);
		bind(this.#params, this);
	}

	override get hash(): string {
		return get(this.#hash);
	}

	override set hash(value: string) {
		super.hash = value;
		set(this.#hash, super.hash);
	}

	override get host(): string {
		get(this.#hostname);
		get(this.#port);
		return super.host;
	}

	override set host(value: string) {
		super.host = value;
		set(this.#hostname, super.hostname);
		set(this.#port, super.port);
	}

	override get hostname(): string {
		return get(this.#hostname);
	}

	override set hostname(value: string) {
		super.hostname = value;
		set(this.#hostname, super.hostname);
	}

	override get href(): string {
		get(this.#protocol);
		get(this.#username);
		get(this.#password);
		get(this.#hostname);
		get(this.#port);
		get(this.#pathname);
		get(this.#hash);
		get(this.#search);
		return super.href;
	}

	override set href(value: string) {
		super.href = value;
		set(this.#protocol, super.protocol);
		set(this.#username, super.username);
		set(this.#password, super.password);
		set(this.#hostname, super.hostname);
		set(this.#port, super.port);
		set(this.#pathname, super.pathname);
		set(this.#hash, super.hash);
		set(this.#search, super.search);
		replace(this.#params, super.searchParams);
	}

	override get password(): string {
		return get(this.#password);
	}

	override set password(value: string) {
		super.password = value;
		set(this.#password, super.password);
	}

	override get pathname(): string {
		return get(this.#pathname);
	}

	override set pathname(value: string) {
		super.pathname = value;
		set(this.#pathname, super.pathname);
	}

	override get port(): string {
		return get(this.#port);
	}

	override set port(value: string) {
		super.port = value;
		set(this.#port, super.port);
	}

	override get protocol(): string {
		return get(this.#protocol);
	}

	override set protocol(value: string) {
		super.protocol = value;
		set(this.#protocol, super.protocol);
		set(this.#port, super.port);
	}

	override get search(): string {
		return get(this.#search);
	}

	override set search(value: string) {
		super.search = value;
		set(this.#search, super.search);
		replace(this.#params, super.searchParams);
	}

	override get username(): string {
		return get(this.#username);
	}

	override set username(value: string) {
		super.username = value;
		set(this.#username, super.username);
	}

	override get origin(): string {
		get(this.#protocol);
		get(this.#hostname);
		get(this.#port);
		return super.origin;
	}

	override get searchParams(): ReactiveURLSearchParams {
		return this.#params;
	}

	override toString(): string {
		return this.href;
	}

	override toJSON(): string {
		return this.href;
	}
}
