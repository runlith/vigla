<script>
	let text = $state('');

	function update_text() {
			text = 'updated';
	}
</script>

<button type="button" onclick={update_text}>Update Text</button>

<div>{text}</div>
