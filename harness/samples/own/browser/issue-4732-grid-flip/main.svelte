<script>
	import { flip } from 'svelte/animate';

	let collapsed = $state(false);
	let values = $state([1, 2, 3, 4, 5, 6, 7, 8, 9]);

	function toggle() {
		values = collapsed ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [1, 3, 4, 6, 7, 9];
		collapsed = !collapsed;
	}
</script>

<button onclick={toggle}>Toggle Column</button>
<div class="grid" class:collapsed>
	{#each values as value (value)}
		<div animate:flip>{value}</div>
	{/each}
</div>

<style>
	.grid {
		width: 604px;
		display: grid;
		gap: 16px;
		grid-template-columns: 1fr 1fr 1fr;
	}
	.grid.collapsed {
		grid-template-columns: 1fr 1fr;
	}
	.grid > div {
		padding: 4px;
	}
</style>
