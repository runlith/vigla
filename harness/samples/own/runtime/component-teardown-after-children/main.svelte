<script>
	import Parent from './Parent.svelte';
	let shown = $state(true);
</script>

<button onclick={() => shown = false}>dispose</button>
{#if shown}
	<Parent />
{/if}
