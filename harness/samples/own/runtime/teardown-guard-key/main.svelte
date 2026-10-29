<script>
	import Column from './Column.svelte';
	import Page from './Page.svelte';

	let open = $state(true);
	let seat = $state(null);
	let tick = $state(0);
</script>

<button
	onclick={() => {
		open = false;
		tick = 1;
	}}>leave</button
>
<svelte:boundary onerror={(error) => console.log(String(error))}>
	{#if open}
		<Page onopen={() => (seat = { active: 'one' })} onclose={() => (seat = null)} />
	{/if}
	{#if seat !== null}
		{#key seat}
			<Column host={seat} {tick} />
		{/key}
	{/if}
	{#snippet failed()}{/snippet}
</svelte:boundary>
