<script>
	let { data } = $props();
	let { fr, hu } = $derived(data);
</script>

<a href="/load/fetch-cache-control">fetch-cache-control</a>

<h2>fr</h2>
<div id="fr">
	{JSON.stringify(fr)}
</div>

<h2>hu</h2>
<div id="hu">
	{JSON.stringify(hu)}
</div>
