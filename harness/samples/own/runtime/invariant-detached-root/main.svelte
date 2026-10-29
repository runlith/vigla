<script>
	import { counter } from './probe.svelte.js';

	$effect(() => {
		console.log(`component ${counter.value}`);
	});
</script>

<button onclick={() => (counter.value += 1)}>{counter.value}</button>
