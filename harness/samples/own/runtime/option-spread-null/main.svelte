<script>
	let value = $state('initial');
	const options = [
		{ value: 'initial', label: 'initial' },
		{ value: undefined, label: 'undefined' },
		{ value: null, label: 'null' }
	];
</script>

<select bind:value>
	{#each options as { value, label, ...rest }}
		<option {value} {...rest}>{label}</option>
	{/each}
</select>
<p>{value === undefined ? 'undefined' : JSON.stringify(value)}</p>
