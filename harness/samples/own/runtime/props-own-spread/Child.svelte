<script>
	let { toString } = $props();
</script>

<p>{typeof toString === 'string' ? toString : typeof toString}</p>
