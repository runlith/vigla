<script>
	import { page } from '$app/state';

	/** @type {import('./$types').ActionData} */
	let { form, data } = $props();

	/** @type {import('./$types').PageData} */
</script>

<h1 class="destination">destination</h1>

<pre class="destination-form">{JSON.stringify(form)}</pre>
<span class="status">{page.status}</span>
<span class="loaded-at">{data.loaded_at}</span>
<pre class="layout-loaded-at">{data.layout_loaded_at}</pre>
<pre class="load-search">{data.search}</pre>
