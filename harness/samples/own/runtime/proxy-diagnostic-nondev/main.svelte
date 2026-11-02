<script>
	const raw = {};
	let array = $state([raw]);
	let object = $state({ items: null });
	let result = $state('');
	function run() {
		(object.items ??= []).push(1);
		result = JSON.stringify([object.items, array.includes(raw), array.indexOf(raw), array.lastIndexOf(raw)]);
	}
</script>
<button onclick={run}>run</button>
<p>{result}</p>
