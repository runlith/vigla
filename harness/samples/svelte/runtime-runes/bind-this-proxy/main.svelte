<script>
	import Component from './Component.svelte';

	let type = $state(Component)
	let elem = $state()
	const Type = $derived(type)

	$effect(() => {
		console.log(elem);
	});
</script>

<button onclick={() => {
	if (!type) {
		type = Component
	} else {
		type = false
	}
}}>Toggle</button>

<Type bind:this={elem}>
	Content
</Type>
