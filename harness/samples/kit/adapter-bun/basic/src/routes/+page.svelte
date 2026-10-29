<script>
	let toggled = $state(false);
</script>

<h1>Hello from Bun!</h1>
<button onclick={() => (toggled = !toggled)}>Toggle: {toggled}</button>
