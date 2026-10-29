<script>
	/** @type {import('./$types').PageData} */
	let { data } = $props();
</script>

<p>Page with server load</p>

<pre>{JSON.stringify(data)}</pre>
