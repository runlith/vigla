<script>
	import Page from './Page.svelte';

	let { app, value } = $props();
	let shown = $state(true);
</script>

<button onclick={() => (shown = false)}>leave</button>
{#if shown}
	<Page {app} {value} />
{/if}
