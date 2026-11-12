<script>
	let { report } = $props();
	const id = $props.id();
	report(id);
</script>

<label for={id}>name</label><input {id} />
