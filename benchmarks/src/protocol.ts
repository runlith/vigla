export interface Listed {
	readonly suite: string;
	readonly label: string;
}

export interface Measured {
	readonly time: number;
	readonly gc: number;
}
