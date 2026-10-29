<script>
	import Consumer from './Consumer.svelte';

	let open = $state(false);
</script>

<button onclick={() => (open = true)}>open</button>
<svelte:boundary>
	{#snippet pending()}<i>loading</i>{/snippet}
	{#if open}
		<Consumer session="1" />
		<Consumer session="1" />
	{/if}
</svelte:boundary>
