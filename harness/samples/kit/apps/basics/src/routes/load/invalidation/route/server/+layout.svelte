<script>
	/** @type {import('./$types').LayoutData} */
	let { data, children } = $props();
</script>

<h1>route.id: {data.route.id}</h1>
{@render children?.()}

<a href="/load/invalidation/route/server/a">/load/invalidation/route/server/a</a>
<a href="/load/invalidation/route/server/b">/load/invalidation/route/server/b</a>
