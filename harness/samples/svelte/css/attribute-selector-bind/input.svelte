<script>
	let open = $state(false);
</script>

<details bind:open>Hello</details>

<style>
	details[open] {
		color: red;
	}
</style>
