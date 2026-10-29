<script>
    let { bar = $bindable() } = $props();
</script>

<button onclick={() => bar--}>{bar}</button>