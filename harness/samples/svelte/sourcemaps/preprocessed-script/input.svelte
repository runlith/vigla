<style>
	h1 {
		color: red;
	}
</style>
<script>
	let { foo = { baritone: { baz: 5 } } } = $props();
</script>
<h1>{foo.bar.baz}</h1>
