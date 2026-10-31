<script>
	import { hydratable } from 'svelte';
	const nodes = Array.from({ length: 18 }, () => ({ value: 1 }));
	const data = hydratable('shared-graph', () => ({
		nodes: nodes.flatMap((node) => [node, node]),
		pending: Promise.resolve('ready')
	}));
</script>

<p>{await data.pending}</p>
