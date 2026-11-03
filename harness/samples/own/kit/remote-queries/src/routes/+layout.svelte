<script>
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		document.documentElement.dataset.ready = '';
	});
</script>

{@render children()}
