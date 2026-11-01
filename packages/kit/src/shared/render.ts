export function errorGuards(
	depths: readonly number[],
	errors: readonly unknown[]
): Array<number | undefined> {
	let floor = 0;
	return depths.map((depth, index) => {
		if (index === 0) return undefined;
		let guard = depth - 1;
		while (guard > floor && errors[guard] == null) guard--;
		floor = guard + 1;
		return errors[guard] == null ? undefined : guard;
	});
}
