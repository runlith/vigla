<script>
	/** @type {import('./$types').PageData} */
	let { data } = $props();
</script>

<h1>x: {data.x}</h1>
<a href="/load/server-data-nostore?x=2">2</a>
