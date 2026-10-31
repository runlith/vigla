<script>
	let { value = $bindable() } = $props();
</script>

<button onclick={() => value.n++}>increment</button>
