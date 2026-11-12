<script>
	import Portal from './Portal.svelte';
	let shown = $state(true);
</script>

<button onclick={() => (shown = false)}>hide</button>
{#if shown}
	<Portal />
{/if}
