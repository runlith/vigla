<script>
	let x = $state(0);
	let a = $state(0);
	let b = $state(0);
	let releaseA;
	let releaseB;

	function holdA(value) {
		if (!value) return value;
		return new Promise((done) => (releaseA = done));
	}

	function holdB(value) {
		if (!value) return value;
		return new Promise((done) => (releaseB = done));
	}
</script>

<button onclick={() => { x = 1; a = 1; }}>first</button>
<button onclick={() => { x = 2; b = 1; }}>second</button>
<button onclick={() => x = 3}>overwrite</button>
<button onclick={() => releaseA(1)}>resolve first</button>
<button onclick={() => releaseB(1)}>resolve second</button>
<p>{x}</p>
<small>{await holdA(a)}</small>
<em>{await holdB(b)}</em>
