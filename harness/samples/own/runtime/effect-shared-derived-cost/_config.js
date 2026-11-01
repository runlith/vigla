import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	timeout: 15000,
	test({ assert, instance }) {
		const depth = 24;
		const measure = fromEffect => {
			const start = process.threadCpuUsage();
			const value = instance.run(depth, fromEffect);
			const used = process.threadCpuUsage(start);
			assert.equal(value, 4 * 2 ** depth - 3);
			return used.user + used.system;
		};
		measure(false);
		measure(true);
		const direct = [];
		const effect = [];
		for (let i = 0; i < 3; i++) {
			direct.push(measure(false));
			effect.push(measure(true));
		}
		const median = values => values.sort((a, b) => a - b)[1];
		const ratio = median(effect) / median(direct);
		console.log({ direct, effect, ratio });
		assert.isAtMost(ratio, 32);
	}
});
