<script>
	import { getOwner } from 'vigla';
	let { model, held } = $props();
	held.owner = getOwner();
</script>

<section>
	<span>{model.count}</span>
	{#if model.count > 1}<b>many</b>{/if}
	<ul>
		{#each model.items as item (item)}<li>{item}</li>{/each}
	</ul>
</section>
