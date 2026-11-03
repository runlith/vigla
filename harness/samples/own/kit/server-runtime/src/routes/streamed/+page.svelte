<script>
	let { data } = $props();
</script>

{#await data.streamed}
	<p>loading</p>
{:then value}
	<p id="late">{value}</p>
{/await}
