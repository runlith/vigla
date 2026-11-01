<script>
	let first = $state('a');
	let second = $state('b');
</script>

<select defaultValue="b">
	<option value={first}>A</option>
	<option value={second}>B</option>
</select>
<button onclick={() => { first = 'b'; second = 'a'; }}>swap</button>
