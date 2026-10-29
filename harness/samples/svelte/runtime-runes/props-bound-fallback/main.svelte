<script>
    import Counter from './Counter.svelte';

    let bound = $state();
</script>

<button onclick={() => bound = 1}>{bound}</button>

<Counter bind:count={bound} />
