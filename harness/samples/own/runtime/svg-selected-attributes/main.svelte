<script>
	let selected = $state(true);
</script>

<button onclick={() => (selected = !selected)}>toggle</button>
<svg>
	<option selected={selected}></option>
	<option {...{ selected }}></option>
</svg>
<select>
	<option selected={selected}>first</option>
	<option>second</option>
</select>
