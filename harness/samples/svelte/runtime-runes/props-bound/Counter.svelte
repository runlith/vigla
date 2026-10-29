<script>
	let { count = $bindable() } = $props();
</script>

<button onclick={() => count++}>{count}</button>
