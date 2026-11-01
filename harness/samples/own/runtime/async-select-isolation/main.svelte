<script>
	import Option from './Option.svelte';
	import Head from './Head.svelte';
	let { choice = 'a', gate = Promise.resolve('a') } = $props();
</script>

<svelte:boundary>
	<select value={choice}>
		<Option value={await gate} />
		<option value="z">z</option>
	</select>
	<Head {choice} />
	{#snippet failed(error)}<p>{error}</p>{/snippet}
</svelte:boundary>
