<script>
  let { foo = '"></div><script>alert(42)</' + 'script>', bar = "'></div><script>alert(42)</" + 'script>', props = {
		['"></div><script>alert(42)</' + 'script>']: 'baz',
		qux: '&&&',
	} } = $props();
</script>

<div {foo} bar={bar} {...props}></div>