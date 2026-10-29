<script>
	// @ts-ignore
	import cjs from 'e2e-test-dep-error';
	cjs.cjs();
	let { children } = $props();
</script>

{@render children?.()}

<p>this error page uses a new dependency</p>
