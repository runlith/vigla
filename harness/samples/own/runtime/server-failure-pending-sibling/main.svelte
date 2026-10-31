<script>
	import Pending from './Pending.svelte';
	import Failing from './Failing.svelte';
</script>

<svelte:boundary>
	<Pending />
	<Failing />
	{#snippet failed(error)}<p>{error}</p>{/snippet}
</svelte:boundary>
