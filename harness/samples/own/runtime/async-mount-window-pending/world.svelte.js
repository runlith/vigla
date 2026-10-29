export const world = $state({ a: undefined, b: undefined });

let release = () => {};
const gate = new Promise((resolve) => {
	release = resolve;
});

export function engine() {
	return gate.then(() => 'hit:book');
}

export function open() {
	release();
}

$effect.root(() => {
	$effect(() => {
		console.log(`${world.a}/${world.b}`);
	});
});
