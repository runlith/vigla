<script>
	import { getContext } from 'svelte';

	const user = getContext('user');
</script>

<p><strong>{user.name}</strong> <span class="muted">({user.role})</span></p>
<p class="muted">Svelte 5.57.3 throws set_context_after_init here.</p>
