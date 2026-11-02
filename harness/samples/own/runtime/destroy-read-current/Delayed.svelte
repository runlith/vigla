<script>
		import { onDestroy, untrack } from 'svelte';
		import { getOwner } from 'vigla';
	let { model } = $props();
		const value = $derived(model.value);
		const lifetime = getOwner();
		const final = $derived.by(() => {
			untrack(() => lifetime.dispose());
			return model.value;
		});
	$effect(() => {
		value;
		return () => console.log(`cleanup:${value}`);
	});
	onDestroy(() => console.log(`destroy:${model.value}/${value}`));
	function leave() {
		return { duration: 100, tick: (t) => {
				if (t === 0) {
					model.value = 'finished';
					console.log(`active:${final}`);
				}
			} };
	}
</script>

<p out:leave>{value}</p>
