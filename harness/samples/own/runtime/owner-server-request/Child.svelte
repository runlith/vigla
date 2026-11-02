<script>
	import { onDestroy } from 'svelte';

	let { name, log } = $props();
	onDestroy(() => log.push(name));
</script>

<p>{name}</p>
