<script>
	// @ts-ignore
	import cjs from 'e2e-test-dep-layout-svelte';
	cjs.cjs();
	let { children } = $props();
</script>

{@render children?.()}

<p>this layout uses a new dependency</p>
