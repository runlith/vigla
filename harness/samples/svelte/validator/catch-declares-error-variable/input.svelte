<script>
	let value = $state(null);
</script>

<button onclick={event => {
	try {
		throw new Error('foo');
	} catch (error) {
		value = error;
	}
}}>Click to create error</button>

{String(value)}
