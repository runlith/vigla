<script>
	const outer = 'outer';
	let label = $state('first');
	let markup = $state('<b>one</b>');
</script>

<select>
	<option value="a">
		{const prefix = 'inner:'}
		{#if label}
			{@const text = prefix + label.toUpperCase()}
			<span>{text}</span>
		{/if}
	</option>
	<option value="b">{@html markup}</option>
</select>
<select>
	<optgroup label="group">
		<span class="heading">{label}</span>
		<option><em>{label}</em></option>
	</optgroup>
</select>
<p>{outer} {label}</p>
<button onclick={() => { label = 'second'; markup = '<b>two</b>'; }}>update</button>
