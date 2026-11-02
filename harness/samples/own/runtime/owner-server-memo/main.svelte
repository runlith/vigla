<script>
	import { derived, getContext, setContext } from 'vigla';
	import Child from './Child.svelte';
	setContext('scope', 'parent');
	const parent = derived(() => getContext('scope'));
	const probe = {};
</script>

<Child {parent} {probe} />
<p>{probe.child.current}</p>
