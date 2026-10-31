<script>
	import { effect } from 'vigla';

	let { hooks, value } = $props();

	hooks.effectRoot(() => {
		effect(() => {
			console.log(`service ${value.current}`);
			return () => console.log(`service gone ${value.current}`);
		});
	});
</script>

<p>page</p>
