<script>
	let { color = 'red' } = $props();
</script>

<h1 style:background-color={color} >hello</h1>
<h1 style:background-color|important="{color}">hello</h1>

<style>
	h1 {
		background-color: blue !important;
	}
</style> 