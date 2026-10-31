export class Environment {
	readonly values: Record<string, string | undefined>;
	readonly prefix: string;

	constructor(values: Record<string, string | undefined>, prefix: string) {
		this.values = values;
		this.prefix = prefix;
		const names = new Set([
			'ORIGIN',
			'SOCKET_PATH',
			'HOST',
			'PORT',
			'REUSE_PORT',
			'IPV6_ONLY',
			'CONNECTION_IDLE_TIMEOUT',
			'BODY_SIZE_LIMIT',
			'SHUTDOWN_TIMEOUT',
			'DEVELOPMENT',
			'XFF_DEPTH',
			'ADDRESS_HEADER',
			'PROTOCOL_HEADER',
			'HOST_HEADER',
			'PORT_HEADER'
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
		return this.values[this.prefix + name] ?? fallback;
	}

	integer(name: string, fallback?: number, min = 0, max = Infinity): number | undefined {
		const value = this.get(name);
		if (value === undefined) return fallback;
		const number = Number(value);
		if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < min || number > max)
			throw new Error(
				`Invalid ${this.prefix + name}: expected an integer between ${min} and ${max}`
			);
		return number;
	}

	boolean(name: string, fallback?: boolean): boolean | undefined {
		const value = this.get(name);
		if (value === undefined) return fallback;
		if (['1', 'true', 'yes', 'on'].includes(value.toLowerCase())) return true;
		if (['0', 'false', 'no', 'off'].includes(value.toLowerCase())) return false;
		throw new Error(`Invalid ${this.prefix + name}: expected a boolean`);
	}

	bytes(name: string, fallback: number): number {
		const value = this.get(name);
		if (value === undefined) return fallback;
		if (value === 'Infinity') return Infinity;
		const match = /^(\d+(?:\.\d*)?|\.\d+)([KMG])?$/i.exec(value);
		if (!match) throw new Error(`Invalid ${this.prefix + name}: expected a byte size`);
		const units: Record<string, number> = { K: 1024, M: 1024 ** 2, G: 1024 ** 3 };
		const bytes = Number(match[1]) * (units[match[2]?.toUpperCase() ?? ''] ?? 1);
		if (!Number.isSafeInteger(bytes))
			throw new Error(`Invalid ${this.prefix + name}: expected a safe whole byte size`);
		return bytes;
	}
}
