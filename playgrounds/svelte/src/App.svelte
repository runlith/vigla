<script>
	import Counter from './Counter.svelte';
	import Todos from './Todos.svelte';
	import Search from './Search.svelte';
	import Profile from './Profile.svelte';
	import Clock from './Clock.svelte';
	import Boom from './Boom.svelte';
</script>

<h1>Svelte app on Vigla</h1>
<p class="muted">Every import here is <code>svelte</code>; the alias resolves it to <code>@vigla/svelte</code>.</p>

<section>
	<h2>$state, $derived, $effect</h2>
	<Counter />
</section>

<section>
	<h2>Keyed list with transitions and animate:flip</h2>
	<Todos />
</section>

<section>
	<h2>await in markup, $effect.pending()</h2>
	<Search />
</section>

<section>
	<h2>setContext after a top-level await</h2>
	<svelte:boundary>
		<Profile />
		{#snippet pending()}
			<p class="muted">loading profile…</p>
		{/snippet}
	</svelte:boundary>
</section>

<section>
	<h2>svelte/store</h2>
	<Clock />
</section>

<section>
	<h2>Error boundary</h2>
	<svelte:boundary>
		<Boom />
		{#snippet failed(error, reset)}
			<p>caught: {error.message}</p>
			<button onclick={reset}>reset</button>
		{/snippet}
	</svelte:boundary>
</section>
