<script>
	let { oncall } = $props();

	function slow() {
		oncall?.();
		return { duration: 100, tick() {} };
	}
</script>

<p out:slow>leaving</p>
