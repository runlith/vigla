<script>
	import { external, root } from 'vigla';

	const count = { active: 0 };
	const owner = root();
	const value = owner.run(() => external(() => ({
		subscribe(run) {
			count.active++;
			run(1);
			return () => count.active--;
		}
	})));
	value.current;
	owner.dispose();
</script>

<p>{count.active}</p>
