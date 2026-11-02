<script>
	import { getContext, hydratable, setContext } from 'svelte';
	import { getAbortSignal, getOwner } from 'vigla';

	let { probe = {} } = $props();
	probe.owner = getOwner();
	probe.signal = getAbortSignal();
	const value = hydratable('greeting', () => 'hello');
	setContext('component', 'render');
	await Promise.resolve();
	probe.finished?.();
</script>

<svelte:head><title>{await Promise.resolve('scope:')}{getContext('scope')}</title></svelte:head>
<p>{getContext('scope')} {value}</p>
