<script>
	function slow() {
		return { duration: 100, tick() {} };
	}
</script>

<p out:slow>leaving</p>
