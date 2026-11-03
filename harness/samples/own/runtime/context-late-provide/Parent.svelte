<script>
	import { setContext } from 'svelte';
	import { theme } from './theme.js';
	import User from './User.svelte';
	import Theme from './Theme.svelte';

	let late = $state(false);
	let shown = $state(false);

	await Promise.resolve();
	setContext('user', 'ada');

	$effect(() => {
		if (late) theme[1]('dark');
	});
</script>

<User />
<button onclick={() => (late = true)}>late</button>
<button onclick={() => (shown = true)}>show</button>
{#if shown}
	<Theme />
{/if}
