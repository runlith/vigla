<script>
	let { value } = $props();
</script>

<select {...{ value }}><option value="a">a</option><option value="b">b</option></select>
<select {...{ value: undefined }}><option value="a">a</option><option value="b">b</option></select>
