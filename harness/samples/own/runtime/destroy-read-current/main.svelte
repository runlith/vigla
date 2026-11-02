<script>
	import Child from './Child.svelte';
	import Delayed from './Delayed.svelte';
	const model = $state({ value: 'initial', remove: false });
</script>

<button onclick={() => { model.value = 'changed'; model.remove = true; }}>hide</button>
{#if !model.remove}
	<Child {model} />
{/if}
{#if !model.remove}
	<Delayed {model} />
{/if}
