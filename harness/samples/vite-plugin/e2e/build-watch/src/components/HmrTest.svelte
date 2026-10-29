<script>
	import { getStore } from '../stores/hmr-stores';
	let { id } = $props();
	// svelte-ignore state_referenced_locally
	const count = getStore(id, 0);
	const label = 'hmr-test';
	function increment() {
		$count++;
	}
</script>

<div class="hmr-test" {id}>
	<span class="label">{label}</span>
	<button class="counter increment" onclick={increment}>{$count}</button>
</div>

<!-- HMR-TEMPLATE-INJECT -->
<style>
	.label {
		color: red;
	}
</style>
