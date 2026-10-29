<script>
	let { count: definedCount = $bindable() } = $props();
</script>

<button onclick={() => definedCount++}>{definedCount}</button>
