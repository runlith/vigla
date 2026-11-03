<script>
	import { fade, fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';

	let todos = $state([
		{ id: 1, text: 'port the scheduler', done: true },
		{ id: 2, text: 'pass upstream tests', done: true },
		{ id: 3, text: 'ship native TSX', done: false }
	]);
	let text = $state('');
	let next = 4;
	const left = $derived(todos.filter((todo) => !todo.done).length);

	function add(event) {
		event.preventDefault();
		if (!text.trim()) return;
		todos.push({ id: next++, text: text.trim(), done: false });
		text = '';
	}

	function remove(id) {
		todos = todos.filter((todo) => todo.id !== id);
	}

	function shuffle() {
		todos = todos.toSorted(() => Math.random() - 0.5);
	}
</script>

<form onsubmit={add}>
	<input bind:value={text} placeholder="new todo" />
	<button>add</button>
	<button type="button" onclick={shuffle}>shuffle</button>
</form>

<ul>
	{#each todos as todo (todo.id)}
		<li animate:flip={{ duration: 250 }} in:fly={{ y: -12 }} out:fade={{ duration: 150 }}>
			<label>
				<input type="checkbox" bind:checked={todo.done} />
				<span class:done={todo.done}>{todo.text}</span>
			</label>
			<button onclick={() => remove(todo.id)}>×</button>
		</li>
	{/each}
</ul>
<p class="muted">{left} left</p>

<style>
	ul {
		list-style: none;
		padding: 0;
	}

	li {
		display: flex;
		justify-content: space-between;
		padding: 4px 0;
		max-width: 360px;
	}

	.done {
		text-decoration: line-through;
		color: #7a8194;
	}
</style>
