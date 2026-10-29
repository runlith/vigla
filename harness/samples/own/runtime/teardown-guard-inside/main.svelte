<script>
	import Holder from './Holder.svelte';

	let grip = $state({ size: 1 });
	let holding = $state(true);
</script>

<button onclick={() => (holding = false)}>release</button>
<svelte:boundary onerror={(error) => console.log(String(error))}>
	{#if grip !== null}
		{#if holding}
			<Holder onclose={() => (grip = null)} />
		{/if}
		<b>{grip.size}</b>
	{/if}
	{#snippet failed()}{/snippet}
</svelte:boundary>
