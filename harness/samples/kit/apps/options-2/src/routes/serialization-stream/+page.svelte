<script>
	let { data } = $props();
</script>

<h1>
	{#await data.foo}
		Loading...
	{:then result}
		{result.bar()}
	{/await}
</h1>
