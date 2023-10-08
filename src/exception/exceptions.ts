

export class NotFoundException extends Error {
	constructor(message: any) {
		super(message);
		this.name = "NotFoundException";
	}
}

export class BadRequestException extends Error {
	constructor(message: any) {
		super(message);
		this.name = "BadRequestException";
	}
}

export class ConflictException extends Error {
	constructor(message: any) {
		super(message);
		this.name = "ConflictException";
	}
}