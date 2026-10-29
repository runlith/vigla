import { test } from '@dromon/harness/helpers';

export default test({
	get props() {
		return {
			items: [{ src: 'https://ds' }]
		};
	},

	async test({ assert, target, component }) {
		assert.equal(target.querySelector('img'), component.items[0].img);
	}
});
