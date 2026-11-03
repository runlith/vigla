<script>
	import { readable } from 'svelte/store';

	const time = readable(new Date(), (set) => {
		const id = setInterval(() => set(new Date()), 1000);
		return () => clearInterval(id);
	});
</script>

<p>{$time.toLocaleTimeString()}</p>
