export class Environment {
	readonly values: Record<string, string | undefined>;
	readonly prefix: string;

	constructor(values: Record<string, string | undefined>, prefix = '') {
		this.values = values;
		this.prefix = prefix;
		const names = new Set([
			'ORIGIN',
			'SOCKET_PATH',
			'HOST',
			'PORT',
			'XFF_DEPTH',
			'ADDRESS_HEADER',
			'PROTOCOL_HEADER',
			'HOST_HEADER',
			'PORT_HEADER',
			'BODY_SIZE_LIMIT',
			'SHUTDOWN_TIMEOUT',
			'IDLE_TIMEOUT',
			'KEEP_ALIVE_TIMEOUT',
			'HEADERS_TIMEOUT'
		]);
		if (prefix)
			for (const key of Object.keys(values)) {
				if (key.startsWith(prefix) && !names.has(key.slice(prefix.length)))
					throw new Error(
						`Unexpected environment variable ${key}; change envPrefix to avoid conflicts`
					);
			}
	}

	get(name: string, fallback?: string): string | undefined {
		const key = name === 'LISTEN_PID' || name === 'LISTEN_FDS' ? name : this.prefix + name;
		return this.values[key] ?? fallback;
	}

	integer(name: string, fallback?: number): number | undefined {
		const value = this.get(name);
		if (value === undefined || value === '') return fallback;
		const number = Number(value);
		if (!/^\d+$/.test(value) || !Number.isSafeInteger(number))
			throw new Error(`Invalid ${this.prefix + name}: expected a non-negative integer`);
		return number;
	}

	bytes(name: string, fallback: string): number {
		const value = this.get(name, fallback)!;
		const units: Record<string, number> = { K: 1024, M: 1024 ** 2, G: 1024 ** 3 };
		const multiplier = units[value.slice(-1).toUpperCase()] ?? 1;
		const bytes = Number(multiplier === 1 ? value : value.slice(0, -1)) * multiplier;
		if (Number.isNaN(bytes) || bytes < 0)
			throw new Error(`Invalid ${this.prefix + name}: expected a byte size`);
		return bytes;
	}
}
