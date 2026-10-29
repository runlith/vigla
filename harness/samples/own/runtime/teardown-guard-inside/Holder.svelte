<script>
	import { onDestroy } from 'svelte';

	let { onclose } = $props();

	onDestroy(onclose);
</script>

<p>holder</p>
