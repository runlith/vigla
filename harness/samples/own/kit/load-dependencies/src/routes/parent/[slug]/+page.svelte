<script>
	let { data } = $props();
</script>

<output data-version={data.version} data-seen={data.seen}>{data.version}:{data.seen}</output>
<a href="/parent/b">b</a>
