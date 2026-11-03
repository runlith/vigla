let loads = 0;

export const actions = { default: async () => ({ added: 1 }) };
export const load = () => ({ loads: ++loads });
