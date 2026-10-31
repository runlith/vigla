<script>
	import Page from './Page.svelte';
	let { app, gate, value } = $props();
	let shown = $state(true);
</script>

<button onclick={() => shown = false}>leave</button>
{#if shown}
	<Page {app} {gate} {value} />
{/if}
<output>{value.current}</output>
