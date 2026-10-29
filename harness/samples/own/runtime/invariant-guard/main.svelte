<script>
	import Guarded from './Guarded.svelte';
	import Holder from './Holder.svelte';

	let count = $state(0);
	let byEffect = $state({ name: 'effect' });
	let byTeardown = $state({ name: 'teardown' });
	let holding = $state(true);

	$effect(() => {
		if (count > 0) byEffect = null;
	});
</script>

<button
	onclick={() => {
		count += 1;
		holding = false;
	}}>step</button
>
{#if byEffect !== null}
	<Guarded item={byEffect} {count} />
{/if}
{#if byTeardown !== null}
	<Guarded item={byTeardown} {count} />
{/if}
{#if holding}
	<Holder onclose={() => (byTeardown = null)} />
{/if}
