<script>
	import { getContext, hydratable } from 'svelte';
	import { getAbortSignal, getOwner } from 'vigla';

	let { probe = {} } = $props();
	probe.owner = getOwner();
	probe.signal = getAbortSignal();
	const value = hydratable('greeting', () => 'hello');
</script>

<p>{getContext('scope')} {value}</p>
