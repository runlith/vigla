<script>
	/** @type {import('./$types').PageData} */
	let { data } = $props();
</script>

<h1>content-type: {data.headers.get('content-type')}</h1>
