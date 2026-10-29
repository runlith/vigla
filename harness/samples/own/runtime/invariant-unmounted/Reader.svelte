<script>
	import { shared } from './shared.svelte.js';

	const doubled = $derived.by(() => {
		console.log(`derived ${shared.value}`);
		return shared.value * 2;
	});

	$effect(() => {
		console.log(`effect ${doubled}`);
		return () => console.log('teardown');
	});
</script>

<p>{doubled}</p>
