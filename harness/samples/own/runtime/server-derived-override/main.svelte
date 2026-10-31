<script>
	let value = $derived(20);
	const initial = value;
	value = 30;
	const overridden = value;
	value = null;
</script>

<p>{initial}/{overridden}/{value}</p>
