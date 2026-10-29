<script>
	let { children } = $props();
</script>
<nav><a href="/selection/a">a</a> <a href="/selection/b">b</a></nav>

{@render children?.()}
