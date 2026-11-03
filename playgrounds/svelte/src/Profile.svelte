<script>
	import { setContext } from 'svelte';
	import ProfileCard from './ProfileCard.svelte';

	const user = await new Promise((resolve) =>
		setTimeout(() => resolve({ name: 'Ada', role: 'admin' }), 600)
	);
	setContext('user', user);
</script>

<ProfileCard />
