<script>
	import Failing from './Failing.svelte';
</script>

<svelte:boundary>
	<Failing />
	{#snippet failed(error)}
		<p>{error.message}</p>
	{/snippet}
</svelte:boundary>
