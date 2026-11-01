<script>
	import Child from './Child.svelte';
	const model = $state({ value: 'initial', remove: false });
</script>

<button onclick={() => { model.value = 'changed'; model.remove = true; }}>hide</button>
{#if !model.remove}
	<Child {model} />
{/if}
