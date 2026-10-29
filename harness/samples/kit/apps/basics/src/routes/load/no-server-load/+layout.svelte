<script>
	let { children } = $props();
</script>
<a href="/load/no-server-load/a">a</a>
<a href="/load/no-server-load/b">b</a>

{@render children?.()}
