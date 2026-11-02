<script>
	import { effect as watch, getOwner } from 'vigla';
	let { state } = $props();
	watch(() => {
		if (state.input.current > 0) throw new Error(String(state.input.current));
	});
	const stop = $effect.root(() => {
		getOwner().onError(() => { throw new Error('replacement'); });
		watch(() => {
			if (state.detached.current > 0) throw new Error('detached');
		});
	});
	state.registerStop(stop);
</script>

<p>service</p>
