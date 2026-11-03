<script>
	import { mount } from 'svelte';
	import Child from './Child.svelte';

	export function rooted(target, props) {
		let app;
		const stop = $effect.root(() => {
			app = mount(Child, { target, props });
		});
		return { app, stop };
	}
</script>
