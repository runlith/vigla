<script>
	let { foo = '"></div>\\<script>alert(42)</' + 'script>', bar = { toString: () => '"></div>\\<script>alert(42)<\/script>' } } = $props();
</script>

<div foo={foo} bar={bar}></div>
