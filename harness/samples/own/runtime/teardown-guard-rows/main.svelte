<script>
	import Column from './Column.svelte';

	let open = $state(true);
	let seat = $state(null);
	let rows = $state([
		{ id: 0, title: 'zero' },
		{ id: 1, title: 'one' }
	]);

	function take() {
		seat = { name: 'main' };
		return () => {
			seat = null;
		};
	}
</script>

<button
	onclick={() => {
		rows = rows.map((row) => ({ ...row, title: `${row.title} renamed` }));
		open = false;
	}}>leave</button
>
<svelte:boundary onerror={(error) => console.log(String(error))}>
	{#if open}
		<span hidden {@attach take}></span>
	{/if}
	{#if seat !== null}
		{#key seat}
			<Column host={seat} {rows} />
		{/key}
	{/if}
	{#snippet failed()}{/snippet}
</svelte:boundary>
