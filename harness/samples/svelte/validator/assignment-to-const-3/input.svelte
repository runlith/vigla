<script>
	const foo = 'hello';
	
	function shouldNotError() {
		let foo = 0;
		
		function inner() {
			foo = 1;
		}
	}
	
	function shouldError() {
		function inner() {
			foo = 1;
		}
	}
</script>

<button onclick={shouldNotError}>click</button>
<button onclick={shouldError}>click</button>