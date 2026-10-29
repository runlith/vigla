<script>
	let { data } = $props();

	let arr = $derived([...new Uint8Array(data.data)]);
</script>

<a href="/load/fetch-cache-control">fetch-cache-control</a>

<span class="test-content">{JSON.stringify(arr)}</span>
