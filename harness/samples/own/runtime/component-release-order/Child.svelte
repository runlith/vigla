<script>
	import { onDestroy } from 'svelte';
	let { id } = $props();
	onDestroy(() => console.log(id));
</script>
