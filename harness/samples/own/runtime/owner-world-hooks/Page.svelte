<script>
	import { effect, root } from 'vigla';

	let { app, value } = $props();

	root(() => {
		effect(() => {
			console.log(`service ${value.current}`);
		});
		return () => console.log('service gone');
	}, app);
</script>

<p>page</p>
