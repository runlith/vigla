<script>
	const immutable = 0;

	const obj1 = { prop: true };
	const obj2 = { prop: 0 }
</script>

<!-- should not error -->
<button onclick={() => obj1.prop = false}>click</button>
<button onclick={() => obj2.prop++}>click</button>

<!-- should error -->
<button onclick={() => immutable++}>click</button>


