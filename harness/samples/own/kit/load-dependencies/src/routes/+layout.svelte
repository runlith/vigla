<script>
	import { onMount } from 'svelte';
	let { children } = $props();
	let ready = $state(false);
	onMount(() => { ready = true; });
</script>

<main data-ready={ready}>
	{@render children()}
</main>
