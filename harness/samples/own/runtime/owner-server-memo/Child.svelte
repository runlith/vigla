<script>
	import { derived, getContext, setContext } from 'vigla';
	let { parent, probe } = $props();
	setContext('scope', 'child');
	probe.child = derived(() => getContext('scope'));
</script>

<p>{parent.current}</p>
