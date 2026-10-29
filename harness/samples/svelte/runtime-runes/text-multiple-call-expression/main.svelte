<script>
	let x = $state(0);
	let y = $state(0);

	function getX() {
		console.log('x')
		return x;
	}

	function getY() {
		console.log('y')
		return y;
	}
</script>

<button onclick={() => x++}>{x}</button>
<button onclick={() => y++}>{y}</button>

{getX()}|{getY()}
