<script>
	import First from './First.svelte';
	import Second from './Second.svelte';
	let tab = $state(1);
</script>

<button onclick={() => (tab = tab === 1 ? 2 : 1)}>Switch</button>
{#if tab === 1}
	<First />
{:else}
	<Second />
{/if}
