<script>
	import Handle from './Handle.svelte';
	import Holder from './Holder.svelte';

	let grip = $state({ size: 1 });
	let holding = $state(true);
	let third = $state(true);
</script>

<button
	onclick={() => {
		grip = { size: 2 };
		third = false;
	}}>release</button
>
<svelte:boundary onerror={(error) => console.log(String(error))}>
	{#if grip !== null}
		<Handle {grip} />
	{/if}
	{#if holding}
		<Holder onclose={() => (grip = null)} />
	{/if}
	{#if third}
		<Holder
			onclose={() => {
				grip = { size: 3 };
				holding = false;
			}}
		/>
	{/if}
	{#snippet failed()}{/snippet}
</svelte:boundary>
