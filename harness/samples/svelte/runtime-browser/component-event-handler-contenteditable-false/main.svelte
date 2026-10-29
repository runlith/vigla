<script>
	let { text = '' } = $props();
	const updater = (event) => {text = event.target.textContent}
</script>

<div contenteditable="false" oninput={updater}>{text}</div>
