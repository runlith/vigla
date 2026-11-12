<script>
	import { untrack } from 'svelte';
	let { name, registry } = $props();
	$effect(() => {
		const named = name;
		return untrack(() => registry.add(named));
	});
</script>
