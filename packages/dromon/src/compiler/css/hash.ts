const returns = /\r/g;

export function hash(text: string): string {
	const input = text.replace(returns, '');
	let value = 5381;
	for (let i = input.length - 1; i >= 0; i--) value = ((value << 5) - value) ^ input.charCodeAt(i);
	return (value >>> 0).toString(36);
}
