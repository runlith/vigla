export const actions = {
	default: async ({ request }) => ({ greeting: (await request.formData()).get('greeting') ?? null })
};
