<script>
	let { unknown = 'whatever' } = $props();
</script>

<p class='{unknown}'>this is styled</p>
<p class='bar'>this is unstyled</p>

<style>
	.foo {
		color: red;
	}
</style>