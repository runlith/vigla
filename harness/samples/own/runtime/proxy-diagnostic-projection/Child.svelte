<script>
	let { value } = $props();
</script>
<button onclick={() => (value.items = []).push(2)}>child</button>
