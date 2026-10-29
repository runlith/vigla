<script>
	import { setup } from '../../../../setup.js';

	/** @type {import('./$types').LayoutData} */
	let { data, children } = $props();

	setup();
</script>

{@render children?.()}

<footer id="server-route-id">{data?.server_route_id}</footer>
