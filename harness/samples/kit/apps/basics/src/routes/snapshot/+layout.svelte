<script>
	let { children } = $props();
</script>
<a href="/snapshot/a">a</a>
<a href="/snapshot/b">b</a>
<a href="/snapshot/c" data-sveltekit-reload>c</a>

{@render children?.()}
