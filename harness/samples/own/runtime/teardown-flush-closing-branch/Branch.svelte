<script>
	import { flushSync, onDestroy } from 'svelte';

	let { onclose } = $props();

	onDestroy(() => {
		onclose();
		flushSync();
	});
</script>

<p>open</p>
