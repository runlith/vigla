export type Easing = (t: number) => number;

const BACK = 1.70158;

export function linear(t: number): number {
	return t;
}

export function backIn(t: number): number {
	return t * t * ((BACK + 1) * t - BACK);
}

export function backOut(t: number): number {
	const s = t - 1;
	return s * s * ((BACK + 1) * s + BACK) + 1;
}

export function backInOut(t: number): number {
	const s = BACK * 1.525;
	const x = t * 2;
	if (x < 1) return 0.5 * (x * x * ((s + 1) * x - s));
	const y = x - 2;
	return 0.5 * (y * y * ((s + 1) * y + s) + 2);
}

export function bounceOut(t: number): number {
	const square = t * t;
	if (t < 4 / 11) return 7.5625 * square;
	if (t < 8 / 11) return 9.075 * square - 9.9 * t + 3.4;
	if (t < 9 / 10) return (4356 / 361) * square - (35442 / 1805) * t + 16061 / 1805;
	return 10.8 * t * t - 20.52 * t + 10.72;
}

export function bounceIn(t: number): number {
	return 1 - bounceOut(1 - t);
}

export function bounceInOut(t: number): number {
	return t < 0.5 ? 0.5 * (1 - bounceOut(1 - t * 2)) : 0.5 * bounceOut(t * 2 - 1) + 0.5;
}

export function circIn(t: number): number {
	return 1 - Math.sqrt(1 - t * t);
}

export function circOut(t: number): number {
	const s = t - 1;
	return Math.sqrt(1 - s * s);
}

export function circInOut(t: number): number {
	const x = t * 2;
	if (x < 1) return -0.5 * (Math.sqrt(1 - x * x) - 1);
	const y = x - 2;
	return 0.5 * (Math.sqrt(1 - y * y) + 1);
}

export function cubicIn(t: number): number {
	return t * t * t;
}

export function cubicOut(t: number): number {
	const s = t - 1;
	return s * s * s + 1;
}

export function cubicInOut(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 0.5 * Math.pow(2 * t - 2, 3) + 1;
}

export function elasticIn(t: number): number {
	return Math.sin((13 * t * Math.PI) / 2) * Math.pow(2, 10 * (t - 1));
}

export function elasticOut(t: number): number {
	return Math.sin((-13 * (t + 1) * Math.PI) / 2) * Math.pow(2, -10 * t) + 1;
}

export function elasticInOut(t: number): number {
	if (t < 0.5) return 0.5 * Math.sin(((13 * Math.PI) / 2) * 2 * t) * Math.pow(2, 10 * (2 * t - 1));
	return (
		0.5 * Math.sin(((-13 * Math.PI) / 2) * (2 * t - 1 + 1)) * Math.pow(2, -10 * (2 * t - 1)) + 1
	);
}

export function expoIn(t: number): number {
	return t === 0 ? t : Math.pow(2, 10 * (t - 1));
}

export function expoOut(t: number): number {
	return t === 1 ? t : 1 - Math.pow(2, -10 * t);
}

export function expoInOut(t: number): number {
	if (t === 0 || t === 1) return t;
	return t < 0.5 ? 0.5 * Math.pow(2, 20 * t - 10) : -0.5 * Math.pow(2, 10 - t * 20) + 1;
}

export function quadIn(t: number): number {
	return t * t;
}

export function quadOut(t: number): number {
	return -t * (t - 2);
}

export function quadInOut(t: number): number {
	const x = t / 0.5;
	if (x < 1) return 0.5 * x * x;
	const y = x - 1;
	return -0.5 * (y * (y - 2) - 1);
}

export function quartIn(t: number): number {
	return Math.pow(t, 4);
}

export function quartOut(t: number): number {
	return Math.pow(t - 1, 3) * (1 - t) + 1;
}

export function quartInOut(t: number): number {
	return t < 0.5 ? 8 * Math.pow(t, 4) : -8 * Math.pow(t - 1, 4) + 1;
}

export function quintIn(t: number): number {
	return t * t * t * t * t;
}

export function quintOut(t: number): number {
	const s = t - 1;
	return s * s * s * s * s + 1;
}

export function quintInOut(t: number): number {
	const x = t * 2;
	if (x < 1) return 0.5 * x * x * x * x * x;
	const y = x - 2;
	return 0.5 * (y * y * y * y * y + 2);
}

export function sineIn(t: number): number {
	const v = Math.cos(t * Math.PI * 0.5);
	return Math.abs(v) < 1e-14 ? 1 : 1 - v;
}

export function sineOut(t: number): number {
	return Math.sin((t * Math.PI) / 2);
}

export function sineInOut(t: number): number {
	return -0.5 * (Math.cos(Math.PI * t) - 1);
}
