<script>
	import { hydratable } from 'vigla';
	const value = hydratable('key', () => 'client');
</script>

<p>{value}</p>
