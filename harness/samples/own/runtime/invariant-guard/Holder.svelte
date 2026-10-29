<script>
	import { onDestroy } from 'svelte';

	let { onclose } = $props();

	onDestroy(onclose);
</script>

<i>holder</i>
