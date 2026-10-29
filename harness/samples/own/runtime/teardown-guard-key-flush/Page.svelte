<script>
	import { onDestroy } from 'svelte';

	let { onopen, onclose } = $props();

	onopen();
	onDestroy(onclose);
</script>

<p>page</p>
