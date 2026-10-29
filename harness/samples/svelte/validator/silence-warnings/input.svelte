<script module>
	let foo;
</script>

<script>
	// svelte-ignore state_referenced_locally
	let reactive = $state(foo), copy = reactive; reactive = 1;
</script>

<!-- svelte-ignore css_unused_selector -->
<style>
	.unused {}
</style>
