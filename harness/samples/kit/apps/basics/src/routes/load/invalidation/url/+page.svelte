<script>
	/** @type {import('./$types').PageData} */
	let { data } = $props();
</script>

<h1>{data.a}</h1>

<a href="?a=1">1</a>
<a href="?a=2">2</a>
<a href="?a=3">3</a>
