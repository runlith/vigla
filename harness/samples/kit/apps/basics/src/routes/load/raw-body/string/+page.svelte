<script>
	/** @type {import('./$types').PageData} */
	let { data } = $props();
</script>

<pre class="parsed">{JSON.stringify(data.body)}</pre>
<pre class="raw">{data.rawBody}</pre>
