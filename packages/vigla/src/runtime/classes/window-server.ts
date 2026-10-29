export interface Absent<T> {
	readonly current: T | undefined;
}

function absent<T>(): Absent<T> {
	return { current: undefined };
}

export const scrollX = absent<number>();

export const scrollY = absent<number>();

export const innerWidth = absent<number>();

export const innerHeight = absent<number>();

export const outerWidth = absent<number>();

export const outerHeight = absent<number>();

export const screenLeft = absent<number>();

export const screenTop = absent<number>();

export const online = absent<boolean>();

export const devicePixelRatio = absent<number>();
