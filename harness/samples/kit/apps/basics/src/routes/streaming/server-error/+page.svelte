<script>
	/** @type {import('./$types').PageData} */
	let { data } = $props();
</script>

<p class="eager">{data.eager}</p>

{#await data.lazy.fail}
	<p class="loadingfail">loading</p>
{:catch}
	<p class="fail">fail</p>
{/await}
