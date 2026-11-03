<script>
	import { onDestroy } from 'svelte';

	let { client } = $props();

	onDestroy(() => {
		if (client) throw new Error('cleanup error');
	});
</script>

<span>child</span>
