<script>
	import { setup } from '../../../../setup.js';

	setup();
	let { children } = $props();
</script>

{@render children?.()}

<style>
	:global(h1) {
		color: teal;
	}
</style>
