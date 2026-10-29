<script>
	/** @type {import('./$types').PageData} */
	let { data } = $props();
</script>

<h1>{data.regex.test('hello')}</h1>
