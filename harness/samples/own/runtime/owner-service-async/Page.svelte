<script>
	import { effect as observe, root } from 'vigla';
	let { app, gate, value } = $props();

	const service = root(() => {
		observe(() => console.log(value.current));
	}, app);

	$effect(() => {
		void service.start(async () => {
			const answer = await gate.promise;
			service.run(() => value.current = answer);
		});
	});
</script>

<p>page</p>
