<script>
	let { a, b } = $props();

	function c() {
		return a + b;
	}

	function cSquared() {
		return c() * c();
	}
</script>

<p>{a} + {b} = {c()}</p>
<p>{c()} * {c()} = {cSquared()}</p>
