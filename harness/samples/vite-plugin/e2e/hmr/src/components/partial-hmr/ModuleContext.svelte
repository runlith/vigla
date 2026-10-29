<script module>
	export const y = 1;
</script>

<script>
	let { id, children } = $props();
	const x = 0;
</script>

<pre {id}>
  x={x} y={y} slot={@render children?.()}
</pre>
