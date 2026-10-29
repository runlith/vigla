<script>
	const immutable = false;

	const obj1 = { prop: true };
	const obj2 = { prop: 0 };

	function shouldNotError() {
		obj1.prop = false;
	}

	function shouldNotError2() {
		obj2.prop++;
	}

	function shouldError() {
		immutable = true
	}

	
</script>

<button onclick={shouldNotError}>click</button>
<button onclick={shouldNotError2}>click</button>
<button onclick={shouldError}>click</button>
