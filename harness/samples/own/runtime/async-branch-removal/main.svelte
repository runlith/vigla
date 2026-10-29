<script>
	import Column from './Column.svelte';

	let slot = $state({ active: 'one' });
	let other = $state(0);
	let tick = $state(0);
	let gate = Promise.resolve();
	let release = () => {};

	function hold() {
		gate = new Promise((resolve) => {
			release = resolve;
		});
	}

	function reach(slot) {
		void slot;
		return gate;
	}
</script>

<button
	onclick={() => {
		hold();
		slot = null;
		other = 1;
	}}>remove</button
>
<button
	onclick={() => {
		other = 2;
		tick = 1;
	}}>tick</button
>
<button onclick={() => release()}>release</button>
<svelte:boundary onerror={(error) => console.log(String(error))}>
	{#if slot !== null}
		{#key slot}
			<Column host={slot} {tick} />
		{/key}
	{/if}
	<svelte:boundary>{await reach(slot)}</svelte:boundary>
	{#snippet failed()}{/snippet}
</svelte:boundary>
