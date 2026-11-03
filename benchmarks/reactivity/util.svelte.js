import { fastest } from '../shared/time.js';

export function busy() {
	let a = 0;
	for (let i = 0; i < 100; i++) {
		a++;
	}
}

let initial = 0;

class Holder {
	v = $state.raw(initial);
}

export function cell(value) {
	initial = value;
	return new Holder();
}

export function createTest(label, setup) {
	return [
		{
			label: `${label}_owned`,
			fn: async () => {
				let run;
				let destroy;
				const destroyOwned = $effect.root(() => {
					for (let i = 0; i < 10; i++) {
						const warm = setup();
						warm.run(0);
						warm.destroy();
					}
					({ run, destroy } = setup());
				});
				const result = await fastest(10, () => {
					for (let i = 0; i < 1000; i++) run(i);
				});
				destroy();
				destroyOwned();
				return result;
			}
		},
		{
			label: `${label}_unowned`,
			fn: async () => {
				for (let i = 0; i < 10; i++) {
					const warm = setup();
					warm.run(0);
					warm.destroy();
				}
				const { run, destroy } = setup();
				const result = await fastest(10, () => {
					for (let i = 0; i < 1000; i++) run(i);
				});
				destroy();
				return result;
			}
		}
	];
}
