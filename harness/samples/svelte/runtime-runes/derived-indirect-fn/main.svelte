<script>
  let count = $state(0);
  function doubled() {
    return count * 2;
  }
  let double = $derived(doubled());
</script>

<button onclick={() => count++}>{double}</button>
