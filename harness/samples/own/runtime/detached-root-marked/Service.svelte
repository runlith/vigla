<script>
	import { store } from './store.svelte.js';

	$effect.root(() => {
		$effect(() => {
			console.log(`count ${store.count}`);
		});
		$effect(() => {
			console.log(`other ${store.other}`);
		});
	});
</script>
