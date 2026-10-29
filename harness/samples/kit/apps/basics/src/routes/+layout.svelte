<script lang="ts">
	import { setup } from '../../../../setup.js';

	/** @type {import('./$types').LayoutData} */
	let { data, children } = $props();

	setup();
</script>

{@render children?.()}

<footer>{data.foo.bar}</footer>

<style>
	footer {
		color: purple;
	}
</style>
