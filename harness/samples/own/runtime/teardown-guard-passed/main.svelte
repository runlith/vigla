<script>
	import Handle from './Handle.svelte';
	import Holder from './Holder.svelte';

	let grip = $state({ size: 1 });
	let holding = $state(true);
</script>

<button
	onclick={() => {
		grip = { size: 2 };
		holding = false;
	}}>release</button
>
<svelte:boundary onerror={(error) => console.log(String(error))}>
	{#if grip !== null}
		<Handle {grip} />
	{/if}
	{#if holding}
		<Holder onclose={() => (grip = null)} />
	{/if}
	{#snippet failed()}{/snippet}
</svelte:boundary>
