---
id: 01a1a45c-1394-7d52-af39-c701e6186870
title: Kit's diagnostic texts equal upstream's under SvelteKit's identity
ord: 3
tags: ["task"]
fields:
  {
    "status": "open"
  }
edges:
  - kind: implements
    to: 01a1a3ed-6688-7f72-8a35-40a5ff420c2e
---
Make every Kit diagnostic the facade shows equal upstream's text word for word under SvelteKit's identity, with the wording that names the product supplied by the identity and Kit's own wording kept for its own identity.

A comparison of each upstream `@sveltejs/kit@3.1.0` message (`packages/kit/src/messages/*.js` in `.external/kit`) with Kit's emitter of the same code, with SvelteKit's identity substituted, found 42 that differ (the review of the names delivery named only `window_fetch_in_load`, `preload_route_is_pathname` and `config_csp_trusted_types_missing`, now fixed):

- Neutral wording Kit shortened or rephrased: `action_response_not_serializable`, `config_app_dir_slash`, `config_extension_invalid`, `config_extension_missing_dot`, `config_invalid_prerender_handler`, `config_origin_has_path`, `config_origin_invalid`, `config_paths_assets_trailing_slash`, `config_paths_base_invalid`, `config_prerender_entry_invalid` (backticks around quoted values), `csp_report_only_missing_report`, `env_invalid`, `preload_invalid_route_id`, `prerender_client_address`, `prerender_entry_generator_mismatch`, `prerender_fallback_failed`, `read_implementation_missing`, `remote_command_redirect`, `remote_form_multiple_elements`, `remote_form_not_attached`, `remote_form_reserved_field`, `remote_updates_duplicate_override`, `remote_updates_invalid_argument`, `request_event_after_await`, `request_store_after_await`, `route_config_mismatch`, `routes_not_found`, `state_read_outside_render`.
- Values Kit does not pass to the text: `adapter_instrumentation_file_missing`, `navigation_external_url`, `remote_form_mixed_inputs`, `remote_form_multiple_files`, `route_prerender_page_and_endpoint`, `link_option_replaced` (upstream names the fixed `reset="false"` replacement).
- Words naming the product or its documentation: `action_default_with_named`, `form_action_data_without_ssr`, `form_action_error_without_ssr`, `load_not_serializable`, `load_response_header_not_serialized`, `tracing_api_missing` (documentation links), `route_named_layout_in_module` ("Svelte files"), `route_prerender_page_and_endpoint` (`+page.svelte`), `transform_page_chunk_comments` ("Svelte's hydration").

49 upstream codes have no Kit emitter of the same code; each is either a diagnostic Kit lacks or one Kit raises under another code, to be read case by case.

Done when the comparison finds no difference under SvelteKit's identity and a facade test asserts at least one product-worded message whole.
