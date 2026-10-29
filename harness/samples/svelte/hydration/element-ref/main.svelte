<script>
	let { h1 = $bindable() } = $props();
</script>

<h1 bind:this={h1}>Hello world!</h1>