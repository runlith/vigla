<script>
	import { dev } from '$app/env';

	/** @type {import('./$types').PageData} */
	let { data } = $props();
</script>

<h2>
	{data.mode_from_endpoint} === {import.meta.env.MODE} === {dev ? 'development' : 'custom'}
</h2>
