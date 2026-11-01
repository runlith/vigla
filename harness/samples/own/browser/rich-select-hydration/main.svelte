<script>
	let label = $state('first');
</script>

<select>
	<button>Choose</button>
	<option value="a"><span>{label}</span></option>
	<option value="b">Other</option>
</select>
<p>{label}</p>
<button onclick={() => label = 'second'}>Update</button>
