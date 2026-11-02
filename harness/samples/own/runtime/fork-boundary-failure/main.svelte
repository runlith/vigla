<script>
	import { fork } from 'svelte';

	let failing = $state(false);
	let staged;

	function value() {
		return failing ? Promise.reject('boom') : Promise.resolve('ready');
	}
</script>

<button onclick={() => staged = fork(() => failing = true)}>stage</button>
<button onclick={() => staged.discard()}>discard</button>
<button onclick={() => failing = true}>fail</button>

<svelte:boundary onerror={(error) => console.log(error)}>
	<p>{await value()}</p>
	{#snippet failed(error)}<p>{error}</p>{/snippet}
</svelte:boundary>
