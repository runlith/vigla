<script>
	import { onDestroy } from 'svelte';

	const { counts, fail = false, invalid = false } = $props();
	let value = $state(0);
	const result = $derived.by(() => {
		if (invalid) value += 1;
		return value;
	});
	counts.calls += 1;
	onDestroy(() => counts.cleanups += 1);
	if (fail && counts.calls === 1) {
		const node = document.createElement('div');
		node.append(node);
	}
</script>

<p>{invalid ? result : counts.calls}</p>
