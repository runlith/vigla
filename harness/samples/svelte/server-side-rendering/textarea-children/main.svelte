<script>
	let { foo = 42 } = $props();
</script>

<textarea>
	<p>not actually an element. {foo}</p>
</textarea>