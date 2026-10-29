<script>
  let { offsetHeight = $bindable(), offsetWidth = $bindable(), toggle = $bindable(false) } = $props();
  $effect.pre(() => {
    if (offsetWidth) toggle = true;
  });
</script>

<div class:toggle>
  <div bind:offsetHeight bind:offsetWidth>{offsetHeight}</div>
</div>

<style>
  .toggle > div {
    height: 800px;
  }
</style>
