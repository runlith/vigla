<script>
	import Widget from './Widget.svelte';

	let { bar, x, compound, go } = $props();
</script>

<div>
	<Widget foo='{bar}' baz='{40 + x}' qux='this is a {compound} string' quux='{go.deeper}'/>
</div>
