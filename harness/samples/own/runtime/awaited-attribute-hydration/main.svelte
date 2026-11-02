<script>
	let { value } = $props();
	let text = $state('server');

	async function get(given) {
		return given;
	}
</script>

<p data-x={await get(value)} style={await get(value && 'color: red')}></p>
<form>
	<input {...{}} data-x={await get(1)} bind:value={text} />
</form>
