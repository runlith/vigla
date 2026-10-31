<script>
	import { hydratable } from 'vigla';
	const value = await hydratable('key', () => Promise.resolve('client'));
</script>

<p>{value}</p>
