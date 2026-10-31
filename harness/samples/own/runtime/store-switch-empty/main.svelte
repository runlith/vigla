<script>
	let source = { subscribe(run) { run(1); return () => {}; } };
	const before = $source;
	source = { subscribe() { return () => {}; } };
	const after = $source;
</script>

<p>{before}/{after}</p>
