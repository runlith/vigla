<script>
	import { onDestroy } from 'svelte';
	import Child from './Child.svelte';

	let { log, gate } = $props();
	onDestroy(() => log.push('main'));

	function boom() {
		throw new Error('boom');
	}
</script>

<Child name="before" {log} />
<svelte:boundary>
	<Child name="discarded" {log} />
	{boom()}

	{#snippet failed()}
		<p>failed</p>
	{/snippet}
</svelte:boundary>
{#if await gate}
	<Child name="late" {log} />
{/if}
